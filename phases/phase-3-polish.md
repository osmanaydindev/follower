# Faz 3 — Dayanıklılık + cila

**Durum:** IN PROGRESS (temel cila yapıldı; kalanlar cihaz testinden sonra)

**Amaç:** Hesap değiştirme, hata halleri, oturum yeniden kullanımı, dokümantasyon.

## Adımlar
- [x] Logout/hesap değiştirme: `CookieManager.clearAll(true)` (App.tsx logout).
- [x] Hata halleri (temel): sessionid gelmezse/başarısızsa WebView ekranında net
      hata + geri; `handled` guard ile çift-tetik önlendi.
- [ ] Session reuse: aynı hesapta tekrar açılışta kayıtlı oturum (WebView'siz).
      (Sidecar tarafı hazır — `_session_file`; mobilde oturum kalıcılığı sonra.)
- [x] `README.md`: WebView/sessionid akışı + Android dev build talimatı.
- [x] `.gitignore`: APK/native artefaktları.
- [ ] Cihazda: hesap değiştirme + kill/reopen doğrulaması (dev build sonrası).

## Doğrulama (done kriteri)
- Tam akış + hesap değiştirme çalışır; kill/reopen'da oturum korunur; hiçbir şifre
  uygulamaya/koda girmez.
