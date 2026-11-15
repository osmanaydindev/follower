# Follower

Instagram takipçi analiz uygulaması. Takipçilerini, takip ettiklerini, **seni
geri takip etmeyenleri** ve **hayranlarını** (senin geri takip etmediğin
takipçiler) gösterir. Mobil öncelikli (React Native / Expo), Go backend, gerçek
IG erişimi için Python (instagrapi) yardımcı servisi.

## Özellikler
- Takipçi ve takip edilen listeleri
- **Beni geri takip etmeyenler** (`takip edilenler − takipçiler`)
- **Hayranlar** (`takipçiler − takip edilenler`)
- Karşılıklı (mutual) sayısı ve özet istatistikler
- Aranabilir listeler, çekme-yenile (pull-to-refresh)
- "Profilime kim baktı?" — dürüst açıklama (bu veri Instagram tarafından
  **hiçbir yerde** paylaşılmaz; bunu iddia eden uygulamalar doğru söylemez)

## Mimari
```
mobile/       Expo React Native (TypeScript) uygulaması
web/          Next.js 15 — tanıtım sayfası + web paneli (:3006)
backend/      Go API sunucusu (:8080)
ig-sidecar/   Python instagrapi servisi (:8000) — sadece IG erişimi
```
Web ve mobil **aynı** backend'i kullanır. Mobil, listeleri kendi gömülü
tarayıcısında toplar; tarayıcıda bunun karşılığı olmadığı için (CORS,
`X-Frame-Options`, HttpOnly çerez) web, backend'in sunucu tarafı yolunu
kullanır. Ayrıntı: `web/CLAUDE.md`.
Backend'in Instagram erişimi **değiştirilebilir (pluggable)** bir provider
arkasındadır:
- `mock` — deterministik sahte veri; uygulama IG'ye hiç dokunmadan uçtan uca
  çalışır (varsayılan, geliştirme için).
- `real` — kullanıcının kendi kimlik bilgileriyle gizli mobil API'ye erişir;
  bunu olgun [instagrapi](https://github.com/subzeroid/instagrapi) kütüphanesini
  saran Python servisine devreder (`IG_PROVIDER=real`).

Güvenlik: şifre asla saklanmaz — yalnızca giriş anında kullanılıp atılır; sadece
oturum token'ı (instagrapi ayar blob'u) tutulur ve o da repoya girmez
(`.gitignore`).

## Çalıştırma

### Hepsi birden (Docker — canlıdaki ile aynı yol)
```bash
cp .env.example .env && chmod 600 .env   # IG_PROVIDER=mock varsayılan
docker compose up -d --build             # web → http://127.0.0.1:3006
```
Veritabanı yok; durum üç adlandırılmış volume'da JSON olarak tutulur ve
`docker compose down` bunları silmez. Canlıya alma: `./deploy.sh`.

### Backend (mock, varsayılan)
```bash
cd backend
go run ./cmd/server          # :8080
```

### Web
```bash
cd web
npm install
npm run dev                  # :3006
```

### Gerçek Instagram verisi (opsiyonel)
Önce yardımcı servis:
```bash
cd ig-sidecar
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --port 8000
```
Sonra backend'i gerçek modda:
```bash
cd backend
IG_PROVIDER=real IG_SIDECAR_URL=http://localhost:8000 go run ./cmd/server
```

IP'n Instagram tarafından kara listeye alınırsa, sidecar'ı bir proxy üzerinden
çalıştır (tercihen residential/mobil): `IG_PROXY=http://kullanici:sifre@host:port`
(veya `socks5://host:port`) env'i ile başlat.

### Mobil — giriş yöntemi
Uygulama, Instagram'a **uygulama içi gömülü tarayıcıdan (WebView)** giriş yapar:
kullanıcı gerçek IG ekranından (2FA/checkpoint dahil) girer, uygulama oturumun
`sessionid` çerezini **native olarak** yakalar ve backend `login_by_sessionid` ile
kullanır. Şifre uygulamaya hiç girmez ve Instagram bunu bloklamaz (giriş gerçek
tarayıcı oturumudur). Ayrıca mock testi için ikincil bir kullanıcı adı/şifre alanı
vardır.

`sessionid` çerezi HttpOnly olduğundan native çerez erişimi gerekir
(`@react-native-cookies/cookies`) — bu **Expo Go'da çalışmaz**, bir **development
build** gerekir.

### Mobil — çalıştırma (Android development build)
```bash
cd mobile
npm install
# tek seferlik: ücretsiz Expo hesabıyla giriş ve APK derleme
eas login
eas build -p android --profile development   # bulutta ~10-15 dk → APK linki
# APK'yı telefona kur, sonra Metro'yu başlat:
npx expo start --dev-client
```
iOS bilerek kapsam dışı (ücretsiz yol Xcode + 7 günde bir yenileme, rahatı
$99/yıl Apple Developer). Kod platform-bağımsızdır.

## API (v1)
| Method | Yol | Açıklama |
|--------|-----|----------|
| POST | `/api/login` | `{username,password}` → `{sessionId}` ya da `{challenge:true}` |
| POST | `/api/challenge` | `{sessionId,code}` → doğrulama (2FA/checkpoint) |
| GET | `/api/analysis?sessionId=…` | özet + `notFollowingBack[]`, `fans[]` |
| GET | `/api/followers?sessionId=…` | takipçiler |
| GET | `/api/following?sessionId=…` | takip edilenler |

## Sorumluluk reddi
Bu proje eğitim/kişisel kullanım içindir ve yalnızca kullanıcının **kendi** hesap
verisini analiz eder. Gizli mobil API kullanımı Instagram'ın kullanım koşullarına
aykırıdır ve hesabın geçici olarak kısıtlanmasına/kilitlenmesine yol açabilir.
Riski kullanıcıya aittir; test için ikincil/yedek bir hesap önerilir.

## Lisans
MIT
