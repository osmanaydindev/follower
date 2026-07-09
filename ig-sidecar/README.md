# ig-sidecar — Instagram private-API service (instagrapi)

The only component that talks to Instagram. The Go backend's `real` provider
calls it over HTTP when `IG_PROVIDER=real`. Uses
[instagrapi](https://github.com/subzeroid/instagrapi).

## Why a separate service
`instagrapi` (Python) is the most mature private-API client — best handling of
device identity, challenge/2FA, and session serialization. The backend is Go, so
we keep Go as the app server and delegate only the fragile Instagram calls here.

## Account-safety / contract
- The password is used transiently for `/login` (and `/challenge`) and **never
  stored**. On success the service returns instagrapi's serialized settings as an
  opaque `auth` blob; the Go side stores it (as `Session.Auth`) and passes it back
  for `/followers` and `/following`.
- `instagrapi` throttles/paginates internally; still keep usage light to avoid
  getting the user's account checkpointed.

## Run
```
cd ig-sidecar
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --port 8000
```
Then run the Go backend against it:
```
IG_PROVIDER=real IG_SIDECAR_URL=http://localhost:8000 go run ./cmd/server
```

## Status
Implements the intended login / challenge / followers / following flow, but is
**untested against live Instagram** (needs a real account). Verify manually with
a throwaway/secondary account before relying on it.
