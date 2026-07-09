"""Instagram private-API sidecar built on instagrapi.

This is the ONLY component that talks to Instagram. The Go backend's `real`
provider calls these endpoints over HTTP when IG_PROVIDER=real.

Design contract with the Go side (see backend/internal/instagram):
  - The user's password is used transiently for /login and /challenge, never stored.
  - On success we return instagrapi's serialized settings as `auth` (an opaque
    blob). The Go backend stores it in Session.Auth and passes it back on
    /followers and /following, so data fetches never need the password again.

ACCOUNT SAFETY (the big lesson from live testing):
  - Repeated password logins get the IP throttled by Instagram ("please wait a
    few minutes"). To avoid that we CACHE the session settings to disk per
    username and REUSE them on the next /login instead of logging in again.
  - delay_range makes instagrapi space out requests.
  - Errors are mapped to clear, honest messages (a throttle is NOT "wrong
    password").

Run:  uvicorn main:app --port 8000
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from instagrapi import Client
from instagrapi.exceptions import (
    BadPassword,
    ChallengeRequired,
    TwoFactorRequired,
    LoginRequired,
    PleaseWaitFewMinutes,
    ClientError,
)

app = FastAPI(title="Follower Instagram sidecar")

# Where cached per-account sessions live (gitignored). Reusing these avoids
# re-login, which is what triggers Instagram's IP throttle.
SESSIONS_DIR = Path(os.getenv("IG_SESSIONS_DIR", Path(__file__).parent / "sessions"))
SESSIONS_DIR.mkdir(exist_ok=True)

# Live clients for logins that are mid-2FA. Kept IN MEMORY (never on disk) between
# /login and /challenge so the SAME client — with its two_factor_identifier and
# device state intact — completes the code step. No re-login → no second SMS, and
# the identifier from the original login stays valid.
PENDING: dict[str, Client] = {}


# ---- request/response models ----

class LoginBody(BaseModel):
    username: str
    password: str


class ChallengeBody(BaseModel):
    auth: str = ""       # serialized settings from the pending login
    username: str
    password: str = ""   # needed to complete 2FA (used transiently)
    code: str


class SessionIdBody(BaseModel):
    sessionid: str       # sessionid cookie captured from a real browser login


class FetchBody(BaseModel):
    auth: str            # serialized settings from a completed login


def _new_client() -> Client:
    cl = Client()
    # Small spacing between requests. A real sessionid session tolerates this
    # fine; keep it low so large accounts (100s-1000s of followers) don't take
    # forever to paginate.
    cl.delay_range = [1, 3]
    # Route through a proxy if configured. This is how you get around an IP that
    # Instagram has blacklisted: point IG_PROXY at a (ideally residential/mobile)
    # proxy. Format: http://user:pass@host:port or socks5://host:port
    proxy = os.getenv("IG_PROXY")
    if proxy:
        cl.set_proxy(proxy)
    return cl


def _session_file(username: str) -> Path:
    safe = "".join(c for c in username.lower() if c.isalnum() or c in "._-")
    return SESSIONS_DIR / f"{safe}.json"


def _client_from_auth(auth: str) -> Client:
    cl = _new_client()
    try:
        cl.set_settings(json.loads(auth))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"gecersiz oturum verisi: {exc}")
    return cl


def _throttle_message() -> str:
    return (
        "Instagram, kisa surede cok fazla giris denemesi oldugu icin bu IP'den "
        "girisi gecici olarak engelledi. Lutfen 15-60 dk bekleyip tekrar dene. "
        "(Hesabin banlanmadi, bu gecici bir sinir.)"
    )


def _two_factor_info(cl: Client) -> dict:
    lj = cl.last_json if isinstance(cl.last_json, dict) else {}
    return lj.get("two_factor_info") or {}


def _is_2fa(cl: Client) -> bool:
    """True if the last login response wants a 2FA code — whether it arrived as a
    TwoFactorRequired or was disguised inside a bad_password / Bloks response."""
    if _two_factor_info(cl):
        return True
    lj = cl.last_json if isinstance(cl.last_json, dict) else {}
    if lj.get("two_factor_required") or lj.get("error_type") == "two_factor_required":
        return True
    extractor = getattr(cl, "_extract_two_step_verification_context", None)
    if callable(extractor):
        try:
            return bool(extractor(lj))
        except Exception:  # noqa: BLE001
            return False
    return False


def _challenge_method(cl: Client) -> str:
    tf = _two_factor_info(cl)
    if tf.get("totp_two_factor_on"):
        return "totp"
    if tf.get("sms_two_factor_on"):
        return "sms"
    return "2fa"


def _start_2fa(cl: Client) -> dict[str, Any]:
    """Register a mid-2FA client in PENDING and return the challenge response so the
    app opens the code screen. auth carries only the pending id (not settings)."""
    pid = uuid4().hex
    PENDING[pid] = cl
    method = _challenge_method(cl)
    print(f"[login] 2FA required (method={method}) pid={pid} "
          f"tf_keys={list(_two_factor_info(cl).keys())}")
    return {"status": "challenge", "method": method, "auth": json.dumps({"pending": pid})}


def _complete_challenge(cl: Client, code: str) -> None:
    """Finish 2FA on the SAME client that started it. Classic flow submits the code
    directly with the original two_factor_identifier (no re-login, no new SMS);
    otherwise fall back to instagrapi's login()/challenge which handles Bloks."""
    ident = _two_factor_info(cl).get("two_factor_identifier")
    if ident:
        data = {
            "verification_code": code,
            "phone_id": cl.phone_id,
            "_csrftoken": cl.token,
            "two_factor_identifier": ident,
            "username": cl.username,
            "trust_this_device": "0",
            "guid": cl.uuid,
            "device_id": cl.android_device_id,
            "waterfall_id": str(uuid4()),
            "verification_method": "3",
        }
        logged = cl.private_request("accounts/two_factor_login/", data, login=True)
        cl.authorization_data = cl.parse_authorization(
            cl.last_response.headers.get("ig-set-authorization")
        )
        if logged:
            cl.login_flow()
            cl.last_login = time.time()
        return
    # Bloks/CAA 2FA or a checkpoint: let instagrapi drive it.
    if cl.username and cl.password:
        cl.login(cl.username, cl.password, verification_code=code)
    else:
        cl.challenge_resolve(cl.last_json)


def _profile_payload(cl: Client) -> dict[str, Any]:
    """Cheap profile of the logged-in user: picture + follower/following counts in
    a single request (no pagination)."""
    u = cl.user_info(cl.user_id)
    return {
        "username": u.username,
        "fullName": u.full_name or "",
        "profilePicUrl": str(u.profile_pic_url_hd or u.profile_pic_url or ""),
        "followersCount": int(u.follower_count or 0),
        "followingCount": int(u.following_count or 0),
        "mediaCount": int(getattr(u, "media_count", 0) or 0),
        "isPrivate": bool(u.is_private),
        "isVerified": bool(getattr(u, "is_verified", False)),
    }


def _users_payload(mapping: dict[str, Any]) -> list[dict[str, Any]]:
    """instagrapi returns {user_id: UserShort}; flatten to our User shape."""
    out = []
    for u in mapping.values():
        out.append(
            {
                "pk": str(u.pk),
                "username": u.username,
                "fullName": u.full_name or "",
                "isPrivate": bool(u.is_private),
                "isVerified": bool(getattr(u, "is_verified", False)),
                "profilePicUrl": str(u.profile_pic_url or ""),
            }
        )
    return out


# ---- endpoints ----

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/login")
def login(body: LoginBody) -> dict[str, Any]:
    cl = _new_client()

    # 1) Try to REUSE a cached session for this account (no password login → no
    #    throttle). Validate it with a cheap authenticated call.
    sf = _session_file(body.username)
    if sf.exists():
        try:
            cl.set_settings(json.loads(sf.read_text()))
            cl.get_timeline_feed()  # raises LoginRequired if the session is dead
            return {"status": "ok", "auth": json.dumps(cl.get_settings()), "reused": True}
        except Exception:  # noqa: BLE001 — stale session, fall through to password login
            cl = _new_client()

    # 2) Fresh password login.
    try:
        cl.login(body.username, body.password)
    except TwoFactorRequired:
        # 2FA code needed → keep this client alive and open the code screen.
        return _start_2fa(cl)
    except ChallengeRequired:
        # Email/SMS checkpoint. Keep the client; resolution/code happens at /challenge.
        pid = uuid4().hex
        PENDING[pid] = cl
        try:
            cl.challenge_resolve(cl.last_json)
        except Exception:  # noqa: BLE001 — code still needed next step
            pass
        return {"status": "challenge", "method": "checkpoint", "auth": json.dumps({"pending": pid})}
    except BadPassword as exc:
        # Instagram's newer Bloks 2FA flow arrives as a bad_password response that
        # actually carries a two-step-verification context. Detect that and treat it
        # as 2FA (open the code screen) instead of a flat error — this is exactly the
        # "error before any code arrives" symptom.
        if _is_2fa(cl):
            return _start_2fa(cl)
        # Otherwise it's a genuine bad password OR IG's soft-block. Surface the raw
        # message + hint rather than flatly claiming the password is wrong.
        print(f"[login] BadPassword raw: {exc} | last_json={getattr(cl,'last_json',None)}")
        raise HTTPException(
            status_code=401,
            detail=(
                "Instagram girisi reddetti (sifre hatali gibi gorunuyor). Sifren "
                "dogruysa bu, cok deneme sonrasi IG'nin gecici otomasyon blogudur: "
                "resmi Instagram uygulamasindan giris yapip 'bu sen miydin' uyarisini "
                "onayla, 1-2 saat bekle ve tekrar dene. "
                f"[IG: {exc}]"
            ),
        )
    except PleaseWaitFewMinutes:
        raise HTTPException(status_code=429, detail=_throttle_message())
    except ClientError as exc:
        print(f"[login] ClientError raw: {exc} | last_json={getattr(cl,'last_json',None)}")
        msg = str(exc).lower()
        if any(k in msg for k in ("few minutes", "wait", "try again", "ip", "rate")):
            raise HTTPException(status_code=429, detail=_throttle_message())
        raise HTTPException(status_code=502, detail=f"Giris basarisiz: {exc}")
    except Exception as exc:  # noqa: BLE001
        print(f"[login] Unexpected raw: {type(exc).__name__}: {exc} | last_json={getattr(cl,'last_json',None)}")
        raise HTTPException(status_code=502, detail=f"Giris basarisiz: {exc}")

    # Success → cache the session for reuse.
    settings = cl.get_settings()
    sf.write_text(json.dumps(settings))
    return {"status": "ok", "auth": json.dumps(settings), "reused": False}


@app.post("/login_sessionid")
def login_sessionid(body: SessionIdBody) -> dict[str, Any]:
    """Authenticate with a sessionid cookie captured from a real in-app browser
    login. This is the robust path: no password, no 2FA/checkpoint dance, and
    Instagram does not block it because the session is a genuine browser session."""
    sid = body.sessionid.strip()
    if not sid:
        raise HTTPException(status_code=400, detail="sessionid bos olamaz")
    cl = _new_client()
    try:
        cl.login_by_sessionid(sid)
    except Exception as exc:  # noqa: BLE001
        print(f"[login_sessionid] fail: {type(exc).__name__}: {exc}")
        raise HTTPException(
            status_code=401,
            detail=f"sessionid ile giris basarisiz (gecersiz veya suresi dolmus olabilir): {exc}",
        )
    settings = cl.get_settings()
    username = cl.username or ""
    if username:
        _session_file(username).write_text(json.dumps(settings))
    # Cheap profile (counts + picture) in the same call so the home screen has it
    # immediately, before any analysis.
    try:
        profile = _profile_payload(cl)
    except Exception as exc:  # noqa: BLE001 — login still succeeds without it
        print(f"[login_sessionid] profile fetch failed: {exc}")
        profile = None
    print(f"[login_sessionid] ok user={username or '?'}")
    return {"status": "ok", "auth": json.dumps(settings), "username": username, "profile": profile}


@app.post("/profile")
def profile(body: FetchBody) -> dict[str, Any]:
    cl = _client_from_auth(body.auth)
    try:
        return _profile_payload(cl)
    except LoginRequired:
        raise HTTPException(status_code=401, detail="Oturum suresi doldu, tekrar giris yap.")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Profil alinamadi: {exc}")


@app.post("/challenge")
def challenge(body: ChallengeBody) -> dict[str, Any]:
    # auth carries {"pending": pid} pointing at the in-memory client from /login.
    pid = None
    try:
        pid = json.loads(body.auth).get("pending") if body.auth else None
    except Exception:  # noqa: BLE001
        pid = None
    cl = PENDING.get(pid) if pid else None
    if cl is None:
        raise HTTPException(status_code=401, detail="Oturum dustu, lutfen tekrar giris yap.")

    try:
        _complete_challenge(cl, body.code.strip())
    except PleaseWaitFewMinutes:
        raise HTTPException(status_code=429, detail=_throttle_message())
    except Exception as exc:  # noqa: BLE001
        print(f"[challenge] fail: {type(exc).__name__}: {exc} | last_json={getattr(cl,'last_json',None)}")
        raise HTTPException(status_code=401, detail=f"Dogrulama basarisiz: {exc}")

    if not cl.user_id:
        print(f"[challenge] no user_id after code | last_json={getattr(cl,'last_json',None)}")
        raise HTTPException(status_code=401, detail="Kod kabul edilmedi, tekrar dene.")

    settings = cl.get_settings()
    username = cl.username or body.username
    if username:
        _session_file(username).write_text(json.dumps(settings))
    PENDING.pop(pid, None)
    return {"status": "ok", "auth": json.dumps(settings)}


@app.post("/followers")
def followers(body: FetchBody) -> list[dict[str, Any]]:
    cl = _client_from_auth(body.auth)
    try:
        return _users_payload(cl.user_followers(cl.user_id, amount=0))
    except LoginRequired:
        raise HTTPException(status_code=401, detail="Oturum suresi doldu, tekrar giris yap.")
    except PleaseWaitFewMinutes:
        raise HTTPException(status_code=429, detail=_throttle_message())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Takipciler alinamadi: {exc}")


@app.post("/following")
def following(body: FetchBody) -> list[dict[str, Any]]:
    cl = _client_from_auth(body.auth)
    try:
        return _users_payload(cl.user_following(cl.user_id, amount=0))
    except LoginRequired:
        raise HTTPException(status_code=401, detail="Oturum suresi doldu, tekrar giris yap.")
    except PleaseWaitFewMinutes:
        raise HTTPException(status_code=429, detail=_throttle_message())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Takip edilenler alinamadi: {exc}")
