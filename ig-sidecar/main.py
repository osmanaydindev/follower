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
  - Data is fetched over the WEB transport when the session came from a browser
    login (see _web_session): a browser cookie sent to the mobile endpoint with
    an Android User-Agent is a mismatch Instagram throttles on sight. Nothing
    here bypasses Instagram's rate limits — they are server-side — it only stops
    us provoking them.
  - Errors are mapped to clear, honest messages (a throttle is NOT "wrong
    password"), and the HTTP status carries the difference: 429 throttled,
    401 session dead. The Go backend forwards both to the app.
  - GUARD RAILS (see the "guard rails" section): once Instagram flags an account,
    every further request makes it worse — so a throttle puts the account into a
    local cooldown where we answer 429 OURSELVES without contacting Instagram,
    an hourly request budget caps whatever the app asks for, fetched lists are
    cached, and each account keeps a single exit IP. Tunable:
      IG_COOLDOWN_MINUTES (60)  how long to stay silent after a refusal
      IG_REQUESTS_PER_HOUR (200) hard ceiling per account
      IG_LIST_CACHE_MINUTES (30) re-analysis inside this window costs 0 requests
      IG_PAGES_PER_REST (10)     pages between long pauses
      IG_PROXIES                 comma-separated pool, sticky per account
      IG_PROXY                   single proxy; wins over the pool

Run:  uvicorn main:app --port 8000
"""
from __future__ import annotations

import json
import os
import random
import re
import time
from pathlib import Path
from typing import Any
from uuid import uuid4

import requests
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
    sessionid: str                      # sessionid cookie from the browser login
    cookies: dict[str, str] = {}        # the REST of that browser's jar (csrftoken, mid, ig_did…)
    userAgent: str = ""                 # the User-Agent that jar was issued to
    # The account summary, already fetched by the app INSIDE the logged-in
    # WebView. When it is here we make no Instagram request at all: signing in
    # becomes pure bookkeeping. Learned the hard way — our own profile call was
    # getting 429 on an account whose browser was browsing the feed happily, so
    # the one request login needed was the one thing keeping the user out.
    profile: dict[str, Any] | None = None


class FetchBody(BaseModel):
    auth: str            # serialized settings from a completed login


class TargetBody(BaseModel):
    auth: str            # serialized settings from a completed login
    pk: str              # the other account's numeric id


# ---- guard rails ----
#
# The private API is the product decision, so the job here is to make it survive.
# Everything below exists because of one live lesson: once Instagram flags an
# account, every further request DEEPENS the flag. The app used to keep asking,
# which is how a fifteen-minute throttle turned into a security checkpoint.
#
#   1. circuit breaker — after a throttle we refuse to touch Instagram for this
#      account at all, and we remember that across sidecar restarts;
#   2. request budget  — a ceiling per account per hour, whatever the app asks;
#   3. list cache      — a re-analysis inside the TTL costs zero requests;
#   4. sticky proxies  — an account always exits from the same IP (a session that
#      hops between IPs is itself a flag).
GUARD_FILE = SESSIONS_DIR / "_guard.json"
COOLDOWN_SECONDS = int(os.getenv("IG_COOLDOWN_MINUTES", "60")) * 60
# Logging in gets a MUCH shorter one. The long cooldown is there to stop us
# poking a flagged account with list fetches; applying it to login instead locks
# the user out of their own app for an hour over a single refusal, and a login
# is one cheap request. What actually needed stopping on this path was a client
# retrying in a loop — minutes are enough for that, and the hourly budget below
# catches anything the window misses.
LOGIN_COOLDOWN_SECONDS = int(os.getenv("IG_LOGIN_COOLDOWN_MINUTES", "3")) * 60
BUDGET_PER_HOUR = int(os.getenv("IG_REQUESTS_PER_HOUR", "200"))
LIST_CACHE_SECONDS = int(os.getenv("IG_LIST_CACHE_MINUTES", "30")) * 60
# Every PAGES_PER_REST pages, take a long break: continuous pagination is the
# least human-looking thing this app does.
PAGES_PER_REST = int(os.getenv("IG_PAGES_PER_REST", "10"))
REST_SECONDS = (20.0, 40.0)

# {account key: {"cooldown_until": epoch, "penalised_at": epoch, "spent": [epoch, ...]}}
GUARD: dict[str, dict[str, Any]] = {}


def _guard_load() -> None:
    global GUARD
    try:
        GUARD = json.loads(GUARD_FILE.read_text())
    except Exception:  # noqa: BLE001 — no state yet, or it is unreadable
        GUARD = {}


def _guard_save() -> None:
    try:
        GUARD_FILE.write_text(json.dumps(GUARD))
    except Exception as exc:  # noqa: BLE001 — never fail a request over bookkeeping
        print(f"[guard] state kaydedilemedi: {exc}")


_guard_load()


def _guard_key(cl: Client) -> str:
    """Numeric id first: instagrapi's settings blob carries the id but not the
    username, so keying on the id is the only way the same account maps to the
    same guard state at login and at every later fetch."""
    return str(cl.user_id or cl.username or "unknown")


def _guard_entry(key: str) -> dict[str, Any]:
    return GUARD.setdefault(key, {"cooldown_until": 0, "spent": []})


def _guard_check(cl: Client) -> str:
    """Refuse, without touching Instagram, if this account is cooling down or has
    spent its hourly budget. Returns the account key for the caller to spend on."""
    return _guard_check_key(_guard_key(cl))


def _guard_check_key(key: str) -> str:
    """Full check — long cooldown plus hourly budget. For fetching data."""
    entry = _guard_entry(key)
    left = entry["cooldown_until"] - time.time()
    if left > 0:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Instagram bu hesabi gecici olarak sinirladi. Hesabi korumak icin "
                f"{int(left // 60) + 1} dk boyunca yeni istek gondermiyoruz. "
                "(Bu bekleme bizim; Instagram'a hic dokunulmuyor.)"
            ),
        )
    _guard_budget(key)
    return key


def _guard_check_login(key: str) -> str:
    """The login path's check: short window since the last refusal, plus the
    hourly budget. Deliberately NOT the long cooldown — being unable to sign in
    for an hour because one request was refused makes the app useless, and the
    expensive work (list pagination) is guarded on its own. This also exists for
    callers that know the account id before they have a usable Client, which the
    login paths do: the browser cookie jar carries ds_user_id."""
    entry = _guard_entry(key)
    left = entry.get("penalised_at", 0) + LOGIN_COOLDOWN_SECONDS - time.time()
    if left > 0:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Instagram az once bu hesabi reddetti. Ust uste denemenin tek "
                f"sonucu isaretlenmek oldugu icin {int(left // 60) + 1} dk bekliyoruz."
            ),
        )
    _guard_budget(key)
    return key


def _guard_budget(key: str) -> None:
    """The hourly ceiling, applied on every path. This is the backstop that stops
    a client stuck in a retry loop whatever door it came through."""
    entry = _guard_entry(key)
    now = time.time()
    entry["spent"] = [t for t in entry["spent"] if now - t < 3600]
    if len(entry["spent"]) >= BUDGET_PER_HOUR:
        oldest = min(entry["spent"])
        raise HTTPException(
            status_code=429,
            detail=(
                f"Saatlik istek siniri doldu ({BUDGET_PER_HOUR}/saat). Hesabin "
                f"isaretlenmemesi icin {int((3600 - (now - oldest)) // 60) + 1} dk "
                "sonra tekrar dene."
            ),
        )


def _guard_spend(key: str, requests_made: int = 1) -> None:
    entry = _guard_entry(key)
    now = time.time()
    entry["spent"].extend([now] * max(1, requests_made))
    _guard_save()


def _guard_penalise(key: str) -> None:
    """Instagram said no. Stop asking — for a long time."""
    entry = _guard_entry(key)
    now = time.time()
    entry["cooldown_until"] = now + COOLDOWN_SECONDS
    # Tracked separately so the login path can enforce its own, much shorter
    # window off the same refusal.
    entry["penalised_at"] = now
    _guard_save()
    print(f"[guard] {key}: Instagram sinirladi, {COOLDOWN_SECONDS // 60} dk boyunca istek yok")


def _proxy_for(key: str) -> str | None:
    """Pick this account's exit IP. IG_PROXIES is a comma-separated pool; the
    choice is a stable hash of the account so a given account always leaves from
    the same address. IG_PROXY (single) still works and wins if set."""
    single = os.getenv("IG_PROXY")
    if single:
        return single
    pool = [p.strip() for p in os.getenv("IG_PROXIES", "").split(",") if p.strip()]
    if not pool:
        return None
    return pool[sum(ord(c) for c in key) % len(pool)]


def _cache_file(key: str, kind: str) -> Path:
    safe = "".join(c for c in key.lower() if c.isalnum() or c in "._-")
    return SESSIONS_DIR / f"_cache_{safe}_{kind}.json"


def _cache_read(key: str, kind: str) -> list[dict[str, Any]] | None:
    if LIST_CACHE_SECONDS <= 0:
        return None
    try:
        blob = json.loads(_cache_file(key, kind).read_text())
    except Exception:  # noqa: BLE001 — no cache yet
        return None
    age = time.time() - blob.get("ts", 0)
    if age > LIST_CACHE_SECONDS:
        return None
    print(f"[{kind}] cache kullanildi ({int(age)} sn once cekilmis, 0 istek)")
    return blob.get("users")


def _cache_clear(key: str) -> None:
    """After a write action the stored lists are wrong, so drop them rather than
    serve a stale answer for the rest of the TTL."""
    for kind in ("followers", "following"):
        _cache_file(key, kind).unlink(missing_ok=True)


def _cache_write(key: str, kind: str, users: list[dict[str, Any]]) -> None:
    try:
        _cache_file(key, kind).write_text(json.dumps({"ts": time.time(), "users": users}))
    except Exception as exc:  # noqa: BLE001
        print(f"[{kind}] cache yazilamadi: {exc}")


def _new_client() -> Client:
    cl = Client()
    # Small spacing between requests. A real sessionid session tolerates this
    # fine; keep it low so large accounts (100s-1000s of followers) don't take
    # forever to paginate.
    cl.delay_range = [1, 3]
    return cl


def _apply_proxy(cl: Client, key: str | None = None) -> None:
    """Bind this client to its account's exit IP. Called once the account is
    known, because the pool is keyed by account, not by process."""
    proxy = _proxy_for(key or _guard_key(cl))
    if proxy:
        cl.set_proxy(proxy)


def _safe_name(username: str) -> str:
    return "".join(c for c in username.lower() if c.isalnum() or c in "._-")


def _session_file(username: str) -> Path:
    return SESSIONS_DIR / f"{_safe_name(username)}.json"


def _device_file(username: str) -> Path:
    return SESSIONS_DIR / f"{_safe_name(username)}.device.json"


# The parts of instagrapi's settings that describe the "phone" we claim to be.
# Everything else in get_settings() is session state.
_DEVICE_KEYS = (
    "uuids",
    "device_settings",
    "user_agent",
    "country",
    "country_code",
    "locale",
    "timezone_offset",
)


def _load_or_create_device(cl: Client, username: str) -> None:
    """Pin this account to ONE device identity across login attempts.

    instagrapi invents a fresh device (uuids, android id, model) for every new
    Client, and settings were only persisted after a *successful* login. When
    Instagram answers with "approve this login on your phone", the login never
    succeeds, so nothing was saved — and the next attempt arrived as yet another
    unknown device needing its own approval. The user approves, retries, and is
    asked again, forever.

    Writing the device out *before* the login breaks that loop: the retry is the
    same phone Instagram was just asked to trust.
    """
    df = _device_file(username)
    if df.exists():
        try:
            stored = json.loads(df.read_text())
            cl.set_settings({**cl.get_settings(), **stored})
            return
        except Exception as exc:  # noqa: BLE001 — unreadable device file, start over
            print(f"[device] {username}: kayitli cihaz okunamadi ({exc}), yenisi uretiliyor")
    settings = cl.get_settings()
    device = {k: settings[k] for k in _DEVICE_KEYS if settings.get(k) is not None}
    try:
        df.write_text(json.dumps(device))
        df.chmod(0o600)
    except Exception as exc:  # noqa: BLE001 — not fatal, only costs another approval
        print(f"[device] {username}: cihaz kaydedilemedi ({exc})")


# Key under which the browser identity rides along in the auth blob. instagrapi's
# get_settings() only knows its own keys, so we merge this in ourselves.
WEB_KEY = "web_identity"


def _client_from_auth(auth: str) -> Client:
    cl = _new_client()
    try:
        settings = json.loads(auth)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"gecersiz oturum verisi: {exc}")
    web = settings.pop(WEB_KEY, None)
    try:
        cl.set_settings(settings)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"gecersiz oturum verisi: {exc}")
    # Stashed on the client, not in instagrapi's settings, so get_settings() can
    # never silently drop it.
    cl.web_identity = web if isinstance(web, dict) else None
    _apply_proxy(cl)
    return cl


def _auth_blob(cl: Client, web: dict[str, Any] | None = None) -> str:
    """instagrapi's settings plus the browser identity, as one opaque blob for
    the Go backend to hand back on every later request."""
    settings = cl.get_settings()
    web = web if web is not None else getattr(cl, "web_identity", None)
    if web:
        settings[WEB_KEY] = web
    return json.dumps(settings)


def _throttle_message() -> str:
    return (
        "Instagram, kisa surede cok fazla istek geldigi icin bu IP'yi gecici olarak "
        "sinirladi. Lutfen 15-60 dk bekleyip tekrar dene. "
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


#: Tokens we look for in the Bloks method-picker response, mapped to the name we
#: report. Order matters: the first match is what the UI is told to ask for.
_METHOD_TOKENS = (
    ("totp", "totp"),
    ("authenticator", "totp"),
    ("backup_code", "backup_codes"),
    ("whatsapp", "whatsapp"),
    ("sms", "sms"),
    ("email", "email"),
)


#: Bloks payloads are a serialised UI tree. We only want the human-readable
#: labels, to identify WHICH screen Instagram is showing — never the tokens and
#: identifiers that sit next to them.
_BLOKS_NOISE = re.compile(
    r"^(?:[0-9a-f]{8,}|[A-Za-z0-9+/=]{40,}|bk\.|com\.bloks|ig_|\d+(?:\.\d+)?)$"
)


def _bloks_screen_text(payload: Any, limit: int = 14) -> list[str]:
    """Readable labels out of a Bloks screen, so a log line can say what the user
    is being shown instead of 'some screen'."""
    found: list[str] = []

    def walk(node: Any) -> None:
        if len(found) >= limit:
            return
        if isinstance(node, str):
            s = node.strip()
            # Labels have spaces or are short words; ids and blobs do not.
            if 3 <= len(s) <= 120 and not _BLOKS_NOISE.match(s) and any(c.isalpha() for c in s):
                if " " in s or s.islower() is False:
                    if s not in found:
                        found.append(s)
        elif isinstance(node, dict):
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(payload)
    return found[:limit]


def _probe_2fa_methods(cl: Client) -> list[str]:
    """Ask Instagram which second factors this account actually offers.

    Without this all we know is "some kind of 2FA", and the app guesses a code
    screen — which is wrong when the account uses an authenticator app (nothing
    is ever delivered; the code is read from the app) and wrong again when it
    is an in-app approval. The official client opens this same picker before it
    decides what to show, so this is not an extra round trip the flow would not
    otherwise make.

    Best effort: a failure here must not break the login, only leave us guessing.
    """
    try:
        ctx = cl._extract_two_step_verification_context(cl.last_json) or ""
    except Exception:  # noqa: BLE001
        ctx = ""
    if not ctx:
        return []
    try:
        cl.bloks_two_step_verification_entrypoint(ctx)
        picker = cl.bloks_two_step_verification_method_picker(ctx)
    except Exception as exc:  # noqa: BLE001
        print(f"[login] yontem listesi alinamadi: {type(exc).__name__}: {exc}")
        return []
    blob = json.dumps(picker).lower()
    found: list[str] = []
    for token, name in _METHOD_TOKENS:
        if token in blob and name not in found:
            found.append(name)
    return found


def _start_2fa(cl: Client) -> dict[str, Any]:
    """Register a mid-2FA client in PENDING and return the challenge response so the
    app opens the code screen. auth carries only the pending id (not settings)."""
    pid = uuid4().hex
    PENDING[pid] = cl
    method = _challenge_method(cl)
    lj = cl.last_json if isinstance(cl.last_json, dict) else {}
    offered = _probe_2fa_methods(cl)
    if offered and method == "2fa":
        method = offered[0]
    print(
        f"[login] 2FA required (method={method}) pid={pid} "
        f"tf_keys={list(_two_factor_info(cl).keys())} "
        f"offered={offered} json_keys={sorted(lj.keys())[:12]} "
        f"error_type={lj.get('error_type')!r}"
    )
    if "layout" in lj:
        print(f"[login] bloks ekrani: {_bloks_screen_text(lj)}")
    return {
        "status": "challenge",
        "method": method,
        "methods": offered,
        "auth": json.dumps({"pending": pid}),
    }


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
    a single request (no pagination). Browser transport first, same as the lists —
    the app calls this on every launch, so it must not be the one request that
    still goes out as an Android app."""
    sess = _web_session(cl)
    if sess is not None:
        try:
            info = _web_get(sess, f"/api/v1/users/{cl.user_id}/info/").get("user") or {}
            if info:
                d = _web_detail_payload(str(cl.user_id), info)
                return {k: v for k, v in d.items() if k != "pk"}
        except (LoginRequired, PleaseWaitFewMinutes):
            raise
        except Exception as exc:  # noqa: BLE001
            print(f"[profile] web API yolu basarisiz ({exc}); mobil API'ye dusuluyor")
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


# ---- web (browser) API path ----
#
# WHY THIS EXISTS. Our sessions come from a real browser login (/login_sessionid),
# but instagrapi sends every request to the MOBILE endpoint (i.instagram.com) with
# an Android app User-Agent. A browser cookie arriving with app credentials is a
# mismatch Instagram notices, and it answers with "Please wait a few minutes ...
# require_login" — which is exactly why the same account browses instagram.com
# without any trouble while this app gets throttled.
#
# So when the session has a browser sessionid we fetch the way the browser does:
# www.instagram.com/api/v1/... with a desktop User-Agent and the X-IG-App-ID the
# web client sends. Same data, same endpoints the website itself calls. This does
# NOT remove Instagram's rate limits (they are server-side, per account/IP —
# nothing on our side can bypass them); it just stops us tripping them early.
WEB_BASE = "https://www.instagram.com"
# Fallback only: normally the app sends the WebView's own User-Agent with the
# login and we replay that. Keep this in sync with mobile/src/screens/
# WebViewLoginScreen.tsx — UA and app id must describe the SAME client.
WEB_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
WEB_APP_ID = "936619743392459"  # the desktop web client's app id
WEB_PAGE_SIZE = 25              # what the followers dialog itself requests
WEB_PAGE_DELAY = (1.5, 3.5)     # jitter between pages, same spirit as delay_range


def _web_session(cl: Client) -> requests.Session | None:
    """A requests.Session impersonating the EXACT browser this login came from,
    or None if there is no browser session (a password login has only app
    credentials).

    Fidelity is the whole point. Instagram issued the sessionid to one specific
    client and checks it stays that client: the User-Agent it was handed to, and
    the companion cookies (csrftoken, mid, ig_did) identifying that browser. The
    same cookie presented by anything else looks like a stolen session — and is
    answered with "Please wait a few minutes ... require_login", which is exactly
    the error this app was getting. So we replay what the WebView captured.
    """
    web = getattr(cl, "web_identity", None) or {}
    cookies = {k: v for k, v in (web.get("cookies") or {}).items() if v}
    # Older sessions (saved before the app sent the whole jar) still have
    # instagrapi's cookies; use them to fill any gap.
    for k, v in (cl.cookie_dict or {}).items():
        if v and k not in cookies:
            cookies[k] = v
    sid = cookies.get("sessionid") or cl.sessionid
    if not sid:
        return None
    cookies["sessionid"] = sid

    sess = requests.Session()
    if cl.proxy:
        sess.proxies = {"http": cl.proxy, "https": cl.proxy}
    for name, value in cookies.items():
        sess.cookies.set(name, value, domain=".instagram.com")
    sess.headers.update({
        "User-Agent": web.get("userAgent") or WEB_UA,
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "X-IG-App-ID": WEB_APP_ID,
        "X-ASBD-ID": "129477",
        "X-IG-WWW-Claim": cl.ig_www_claim or "0",
        "X-Requested-With": "XMLHttpRequest",
        "X-CSRFToken": cookies.get("csrftoken", ""),
        "Referer": f"{WEB_BASE}/{cl.username}/" if cl.username else WEB_BASE + "/",
    })
    return sess


def _web_get(sess: requests.Session, path: str, params: dict | None = None) -> dict:
    """One web-API call, with Instagram's refusals translated into the same
    exceptions the mobile path raises so the endpoints map them identically."""
    # No redirect following: a logged-out web session answers these JSON URLs with
    # a bounce to /accounts/login/, and chasing it just burns requests.
    resp = sess.get(WEB_BASE + path, params=params, timeout=30, allow_redirects=False)
    try:
        body = resp.json()
    except ValueError:
        body = {}
    message = str(body.get("message", ""))
    if resp.status_code == 429 or "few minutes" in message or "wait" in message.lower():
        raise PleaseWaitFewMinutes(message or "rate limited")
    if resp.status_code in (301, 302, 303, 307, 308):
        raise LoginRequired(f"web api redirected to {resp.headers.get('location', '?')}")
    if resp.status_code in (401, 403) or body.get("require_login"):
        raise LoginRequired(message or f"web api {resp.status_code}")
    resp.raise_for_status()
    return body


def _web_user(u: dict[str, Any]) -> dict[str, Any]:
    return {
        "pk": str(u.get("pk") or u.get("pk_id") or u.get("id") or ""),
        "username": u.get("username") or "",
        "fullName": u.get("full_name") or "",
        "isPrivate": bool(u.get("is_private")),
        "isVerified": bool(u.get("is_verified")),
        "profilePicUrl": str(u.get("profile_pic_url") or ""),
    }


# How many requests the last fetch of each kind actually cost, for the budget.
_list_pages: dict[str, int] = {}


def _list_web(cl: Client, sess: requests.Session, kind: str) -> list[dict[str, Any]]:
    """Paginate my followers/following through the web API, small pages with a
    jittered gap — the point is to look like someone scrolling the dialog."""
    path = f"/api/v1/friendships/{cl.user_id}/{kind}/"
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    max_id = ""
    page = 0
    while True:
        params: dict[str, Any] = {"count": WEB_PAGE_SIZE}
        if max_id:
            params["max_id"] = max_id
        body = _web_get(sess, path, params)
        for raw in body.get("users") or []:
            u = _web_user(raw)
            if u["pk"] and u["pk"] not in seen:
                seen.add(u["pk"])
                out.append(u)
        page += 1
        max_id = body.get("next_max_id") or ""
        if not max_id:
            break
        if PAGES_PER_REST and page % PAGES_PER_REST == 0:
            rest = random.uniform(*REST_SECONDS)
            print(f"[{kind}] {page} sayfa cekildi, {rest:.0f} sn mola")
            time.sleep(rest)
        else:
            time.sleep(random.uniform(*WEB_PAGE_DELAY))
    print(f"[{kind}] web API: {len(out)} kullanici, {page} sayfa")
    _list_pages[kind] = page
    return out


def _list_users(cl: Client, kind: str) -> list[dict[str, Any]]:
    """Fetch my followers/following: browser path first, mobile private API as a
    fallback for sessions that have no web cookie (password logins).

    A throttle or a dead session is NOT retried on the other transport — the
    limit belongs to the account, so a second attempt only deepens it.
    """
    sess = _web_session(cl)
    if sess is not None:
        try:
            return _list_web(cl, sess, kind)
        except (LoginRequired, PleaseWaitFewMinutes):
            raise
        except Exception as exc:  # noqa: BLE001 — transport/shape problem, not IG saying no
            print(f"[{kind}] web API yolu basarisiz ({type(exc).__name__}: {exc}); mobil API'ye dusuluyor")
    return _users_payload(_list_v1(cl, kind))


def _list_v1(cl: Client, kind: str) -> dict[str, Any]:
    """Fetch my followers/following through the PRIVATE (mobile) API only.

    Do NOT use instagrapi's user_followers()/user_following() wrappers here: when
    the v1 call fails they silently swallow the exception and retry on the public
    web GraphQL endpoint, which our private-API session has no web cookies for.
    The user then sees a bogus "401 Unauthorized ... /graphql/query/" instead of
    the real cause (usually a throttle: "please wait a few minutes", or an expired
    session). Calling v1 directly lets the honest error reach the handlers below.

    Instagram limits the v1 follower list for some accounts; only in that case do
    we try the GraphQL path, and a failure there keeps the v1 result rather than
    replacing the error.
    """
    fetch_v1 = cl.user_followers_v1 if kind == "followers" else cl.user_following_v1
    fetch_gql = cl.user_followers_gql if kind == "followers" else cl.user_following_gql

    users = fetch_v1(str(cl.user_id), 0)
    last = cl.last_json if isinstance(cl.last_json, dict) else {}
    if last.get("should_limit_list_of_followers"):
        try:
            cl.inject_sessionid_to_public()
            users = fetch_gql(str(cl.user_id), 0)
        except Exception as exc:  # noqa: BLE001
            print(f"[{kind}] gql top-up failed, keeping v1 result: {exc}")
    return {str(u.pk): u for u in users}


def _web_detail_payload(pk: str, u: dict[str, Any]) -> dict[str, Any]:
    """Same shape as _detail_payload, from the web API's JSON (which is a plain
    dict, not an instagrapi model). The response omits pk, so it is passed in."""
    return {
        "pk": str(u.get("pk") or pk),
        "username": u.get("username") or "",
        "fullName": u.get("full_name") or "",
        "profilePicUrl": str(u.get("profile_pic_url_hd") or u.get("profile_pic_url") or ""),
        "followersCount": int(u.get("follower_count") or 0),
        "followingCount": int(u.get("following_count") or 0),
        "mediaCount": int(u.get("media_count") or 0),
        "isPrivate": bool(u.get("is_private")),
        "isVerified": bool(u.get("is_verified")),
    }


def _detail_payload(u: Any) -> dict[str, Any]:
    """Full detail for ANOTHER account (one user_info request): fresh picture URL
    plus the post/follower/following counts shown on the list rows."""
    return {
        "pk": str(u.pk),
        "username": u.username,
        "fullName": u.full_name or "",
        "profilePicUrl": str(getattr(u, "profile_pic_url_hd", None) or u.profile_pic_url or ""),
        "followersCount": int(getattr(u, "follower_count", 0) or 0),
        "followingCount": int(getattr(u, "following_count", 0) or 0),
        "mediaCount": int(getattr(u, "media_count", 0) or 0),
        "isPrivate": bool(u.is_private),
        "isVerified": bool(getattr(u, "is_verified", False)),
    }


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
            return {"status": "ok", "auth": _auth_blob(cl), "reused": True}
        except Exception:  # noqa: BLE001 — stale session, fall through to password login
            cl = _new_client()

    # 2) Fresh password login, from the account's pinned device. Without this
    #    every attempt looks like a brand-new phone and an approval granted on
    #    the previous attempt counts for nothing.
    _load_or_create_device(cl, body.username)
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


def _adopt_browser_session(cl: Client, sid: str, cookies: dict[str, str], user_agent: str) -> str:
    """Set the client up from the browser's cookies WITHOUT calling Instagram.

    instagrapi's login_by_sessionid() does the same state setup but then makes a
    MOBILE user_info call to learn the username — and that one call is what
    Instagram answers with a checkpoint or "please wait a few minutes" for a
    browser session. We do the setup by hand and read the username over the web
    API instead. Returns the numeric user id.
    """
    uid = cookies.get("ds_user_id") or ""
    if not uid:
        match = re.match(r"^\d+", sid)
        if not match:
            raise HTTPException(status_code=400, detail="sessionid bicimi taninmadi")
        uid = match.group()

    cl.web_identity = {"cookies": {**cookies, "sessionid": sid}, "userAgent": user_agent}
    cl.settings["cookies"] = {"sessionid": sid}
    cl.init()
    cl.authorization_data = {
        "ds_user_id": uid,
        "sessionid": sid,
        "should_use_header_over_cookies": True,
    }
    cl.private.cookies.set("ds_user_id", uid)
    cl.private.headers.update(cl.base_headers)
    cl.private.headers.update({"Authorization": cl.authorization})
    return uid


@app.post("/login_sessionid")
def login_sessionid(body: SessionIdBody) -> dict[str, Any]:
    """Authenticate with the cookies captured from the in-app browser login. This
    is the robust path: no password, no 2FA/checkpoint dance. The app sends the
    whole cookie jar and the WebView's User-Agent, and both are stored in the
    auth blob so every later request goes out as that same browser."""
    sid = body.sessionid.strip()
    if not sid:
        raise HTTPException(status_code=400, detail="sessionid bos olamaz")

    cl = _new_client()
    uid = _adopt_browser_session(cl, sid, body.cookies, body.userAgent)

    if _web_session(cl) is None:
        raise HTTPException(status_code=400, detail="tarayici oturumu kurulamadi")

    # Fast path: the app already read the profile inside the WebView, which is
    # proof enough that the session works — it came from a request that session
    # just made. Nothing to ask Instagram, nothing to throttle, nothing to guard.
    if body.profile and body.profile.get("username"):
        username = str(body.profile["username"])
        cl.username = username
        blob = _auth_blob(cl)
        if username:
            _session_file(username).write_text(blob)
        print(f"[login_sessionid] ok user={username or '?'} "
              f"(tarayici profili, {len(body.cookies)} cookie, uid={uid}) — IG'ye istek yok")
        return {"status": "ok", "auth": blob, "username": username, "profile": body.profile}

    # Slow path: no profile came with the request, so we have to ask Instagram
    # ourselves. The cookie jar carries ds_user_id, so we know the account before
    # touching the network — guard it like every other endpoint.
    key = _guard_check_login(uid)
    # One web call proves the session works AND fills the home screen.
    try:
        profile = _profile_payload(cl)
    except PleaseWaitFewMinutes:
        _guard_penalise(key)
        raise HTTPException(status_code=429, detail=_throttle_message())
    except LoginRequired as exc:
        # Last resort, ONE request: let instagrapi validate the cookie the old
        # (mobile) way. Signing in must not become impossible just because the web
        # endpoint moved — but a failure here really does mean a dead session.
        print(f"[login_sessionid] web reddetti ({exc}); mobil API ile son deneme")
        try:
            cl.login_by_sessionid(sid)
            profile = {k: v for k, v in _detail_payload(cl.user_info(cl.user_id)).items() if k != "pk"}
        except PleaseWaitFewMinutes:
            _guard_penalise(key)
            raise HTTPException(status_code=429, detail=_throttle_message())
        except Exception as exc2:  # noqa: BLE001
            print(f"[login_sessionid] mobil deneme de basarisiz: {type(exc2).__name__}: {exc2}")
            raise HTTPException(
                status_code=401,
                detail="Instagram bu tarayici oturumunu kabul etmedi. Cikis yapip tekrar giris dene.",
            )
    except Exception as exc:  # noqa: BLE001
        print(f"[login_sessionid] fail: {type(exc).__name__}: {exc}")
        raise HTTPException(status_code=502, detail=f"Giris dogrulanamadi: {exc}")
    finally:
        # Charge the hourly budget whatever the outcome — a refused request still
        # reached Instagram, and that is what the budget is counting.
        _guard_spend(key)

    username = profile.get("username") or ""
    cl.username = username
    blob = _auth_blob(cl)
    if username:
        _session_file(username).write_text(blob)
    print(f"[login_sessionid] ok user={username or '?'} "
          f"(web transport, {len(body.cookies)} cookie, uid={uid})")
    return {"status": "ok", "auth": blob, "username": username, "profile": profile}


@app.post("/profile")
def profile(body: FetchBody) -> dict[str, Any]:
    cl = _client_from_auth(body.auth)
    # The app calls this on every launch, so it goes through the guard too — a
    # cooling-down account must not be woken up by simply opening the app.
    key = _guard_check(cl)
    try:
        return _profile_payload(cl)
    except LoginRequired:
        raise HTTPException(status_code=401, detail="Oturum suresi doldu, tekrar giris yap.")
    except PleaseWaitFewMinutes:
        _guard_penalise(key)
        raise HTTPException(status_code=429, detail=_throttle_message())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Profil alinamadi: {exc}")
    finally:
        _guard_spend(key)


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


def _list_endpoint(auth: str, kind: str, failure: str) -> list[dict[str, Any]]:
    """Shared body of /followers and /following, wrapped in the guard rails: a
    fresh cache answers for free, a cooling-down account is refused locally, and
    a throttle from Instagram puts the account to sleep instead of being retried."""
    cl = _client_from_auth(auth)
    key = _guard_key(cl)

    cached = _cache_read(key, kind)
    if cached is not None:
        return cached

    key = _guard_check(cl)
    _list_pages.pop(kind, None)
    try:
        users = _list_users(cl, kind)
    except LoginRequired:
        _guard_spend(key)
        raise HTTPException(status_code=401, detail="Oturum suresi doldu, tekrar giris yap.")
    except PleaseWaitFewMinutes:
        _guard_penalise(key)
        raise HTTPException(status_code=429, detail=_throttle_message())
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        _guard_spend(key)
        raise HTTPException(status_code=502, detail=f"{failure}: {exc}")

    _guard_spend(key, _list_pages.get(kind, 1))
    _cache_write(key, kind, users)
    return users


@app.post("/followers")
def followers(body: FetchBody) -> list[dict[str, Any]]:
    return _list_endpoint(body.auth, "followers", "Takipciler alinamadi")


@app.post("/following")
def following(body: FetchBody) -> list[dict[str, Any]]:
    return _list_endpoint(body.auth, "following", "Takip edilenler alinamadi")


@app.post("/user_detail")
def user_detail(body: TargetBody) -> dict[str, Any]:
    """Detail for a single OTHER account. Two reasons the app needs this:
      - list rows show that account's post/follower/following counts;
      - profile picture URLs are signed and expire, so pictures coming from an old
        snapshot (the "unfollowed" list) must be refreshed to render at all.
    One request per account, so the app only asks for rows the user actually sees."""
    cl = _client_from_auth(body.auth)
    key = _guard_check(cl)
    try:
        # Same reasoning as the lists: prefer the browser transport (see
        # _web_session) and only fall back to the mobile API without one.
        sess = _web_session(cl)
        if sess is not None:
            try:
                info = _web_get(sess, f"/api/v1/users/{body.pk}/info/").get("user") or {}
                if info:
                    return _web_detail_payload(str(body.pk), info)
            except (LoginRequired, PleaseWaitFewMinutes):
                raise
            except Exception as exc:  # noqa: BLE001
                print(f"[user_detail] web API yolu basarisiz ({exc}); mobil API'ye dusuluyor")
        return _detail_payload(cl.user_info(str(body.pk)))
    except LoginRequired:
        raise HTTPException(status_code=401, detail="Oturum suresi doldu, tekrar giris yap.")
    except PleaseWaitFewMinutes:
        _guard_penalise(key)
        raise HTTPException(status_code=429, detail=_throttle_message())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Kullanici bilgisi alinamadi: {exc}")
    finally:
        _guard_spend(key)


@app.post("/unfollow")
def unfollow(body: TargetBody) -> dict[str, Any]:
    """Stop following the target account (I follow them → I no longer do)."""
    cl = _client_from_auth(body.auth)
    # Write actions are the most suspicious traffic this app produces, so they
    # respect the cooldown and the budget like everything else.
    key = _guard_check(cl)
    try:
        # instagrapi returns whether the relationship actually changed. Throwing
        # the answer away reports a refusal as a success: Instagram soft-blocks
        # a write by answering 200 with status=fail, and nothing happens.
        ok = cl.user_unfollow(str(body.pk))
    except LoginRequired:
        raise HTTPException(status_code=401, detail="Oturum suresi doldu, tekrar giris yap.")
    except PleaseWaitFewMinutes:
        _guard_penalise(key)
        raise HTTPException(status_code=429, detail=_throttle_message())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Takipten cikilamadi: {exc}")
    finally:
        _guard_spend(key)
    if ok is False:
        raise HTTPException(status_code=502, detail="Instagram takibi birakmadi.")
    _cache_clear(key)
    return {"status": "ok"}


@app.post("/remove_follower")
def remove_follower(body: TargetBody) -> dict[str, Any]:
    """Remove the target account from MY followers (they follow me → they no
    longer do). Instagram does not notify them; they can follow again."""
    cl = _client_from_auth(body.auth)
    # Write actions are the most suspicious traffic this app produces, so they
    # respect the cooldown and the budget like everything else.
    key = _guard_check(cl)
    try:
        # Same reason as /unfollow: the return value is the only thing that
        # distinguishes a real removal from a silently refused one.
        ok = cl.user_remove_follower(str(body.pk))
    except LoginRequired:
        raise HTTPException(status_code=401, detail="Oturum suresi doldu, tekrar giris yap.")
    except PleaseWaitFewMinutes:
        _guard_penalise(key)
        raise HTTPException(status_code=429, detail=_throttle_message())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Takipci cikarilamadi: {exc}")
    finally:
        _guard_spend(key)
    if ok is False:
        raise HTTPException(status_code=502, detail="Instagram takipciyi cikarmadi.")
    _cache_clear(key)
    return {"status": "ok"}
