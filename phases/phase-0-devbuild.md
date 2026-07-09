# Faz 0 — Android dev build altyapısı

**Durum:** CONFIG DONE — build kullanıcı adımını bekliyor

**Amaç:** WebView + native çerez modüllerini içeren, Metro'ya bağlanan kurulabilir
bir Android development client (APK) çıkarmak. Sonraki fazlar cihazda test edilebilsin.

## Adımlar
- [x] `npx expo install expo-dev-client react-native-webview @react-native-cookies/cookies`
      (webview 13.15.0, cookies 6.2.1, dev-client 6.0.21)
- [x] `mobile/eas.json` — `development` profili (developmentClient, internal, apk)
- [x] `app.json` — `android.package = com.osmanaydin.follower` (build için gerekli)
- [x] tsc temiz
- [ ] **[Kullanıcı]** `eas login` (ücretsiz Expo hesabı) — interaktif
- [ ] **[Kullanıcı]** `cd mobile && eas build -p android --profile development` →
      APK → telefona kur. (İlk çalıştırmada EAS `eas init` ile projectId'yi app.json'a ekler.)

## Doğrulama (done kriteri)
- APK açılıyor, Metro'ya bağlanıyor, mevcut mock uygulaması (login → dashboard)
  dev client'ta çalışıyor.

## Notlar
- iOS bilerek kapsam dışı (maliyet). Kod platform-bağımsız.
