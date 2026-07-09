# Faz 1 — Backend + sidecar sessionid girişi

**Durum:** DONE (mock doğrulandı) — real curl doğrulaması kullanıcıda opsiyonel

**Amaç:** sessionid ile giriş yolunu uçtan uca (mock + real) kurmak; WebView'den
önce curl ile doğrulanabilir olsun.

## Adımlar
- [x] `ig-sidecar/main.py`: `POST /login_sessionid {sessionid}` →
      `cl.login_by_sessionid(sessionid)` → `_session_file` kaydet → `auth=json(settings)`;
      geçersiz/expired sessionid'de net hata.
- [x] `backend/internal/instagram/client.go`: arayüze `LoginBySessionID`.
- [x] `real.go`: sidecar `/login_sessionid`'e HTTP (`call` helper).
- [x] `mock.go`: sessionid kabul → normal mock session.
- [x] `api/handlers.go`: `POST /api/login_sessionid {sessionid}` → `{sessionId}`.
- [x] `go build ./... && go vet ./...` temiz.

## Doğrulama (done kriteri)
- [x] Mock: `curl -X POST :8091/api/login_sessionid -d '{"sessionid":"fake123"}'` →
      sessionId → `/api/analysis` → 60/50/32/42 (dolu). ✓
- [ ] **[Kullanıcı, opsiyonel]** Real: sidecar'ı yeni kodla yeniden başlat,
      tarayıcıdan gerçek sessionid al, `curl /api/login_sessionid` → gerçek sayılar
      (WebView/dev-build beklemeden tüm zinciri kanıtlar).
