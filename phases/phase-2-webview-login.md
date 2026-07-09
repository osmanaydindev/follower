# Faz 2 — Mobil WebView giriş + sessionid otomatik yakalama

**Durum:** CODE DONE (tsc + Android bundle temiz) — cihaz doğrulaması dev build'i bekliyor

**Amaç:** Kullanıcı uygulama içinden gerçek IG girişi yapıp otomatik dashboard'a düşsün.

## Adımlar
- [x] `src/screens/WebViewLoginScreen.tsx` (yeni): webview + CookieManager,
      sessionid yakalanınca `api.loginSessionId` → dashboard.
- [x] `src/api.ts`: `loginSessionId(sessionid)`.
- [x] `src/navigation.ts` + `App.tsx`: `webviewLogin` route.
- [x] `LoginScreen.tsx`: birincil "Instagram ile giriş yap" butonu; kullanıcı
      adı/şifre alanı ikincil "geliştirici (mock) girişi" oldu.
- [x] tsc + Android bundle (592 modül) temiz.

## Doğrulama (done kriteri)
- Android dev build + gerçek hesap: WebView'de giriş (2FA/checkpoint IG'nin kendi
  ekranında) → dashboard **gerçek** takipçi/takip sayılarıyla; IG profiliyle birebir.
