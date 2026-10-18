# Native Google Sign-In (Android APK)

## Neden
Google, **gömülü WebView**'da (Capacitor APK) GIS/OAuth'u engeller (`disallowed_useragent`).
Web'deki `google.accounts.id` akışı app içinde ID-token'ı geri döndürmez → kullanıcı
"Gmail seçtim ama içeri almıyor" diye takılır / beyaz ekran. Çözüm: Android'in **native**
hesap seçicisi (Play Services / Credential Manager) ile ID-token al, **aynı** backend
endpoint'ine gönder.

## Ne yapıldı (kod — bu repoda hazır)
- `@capgo/capacitor-social-login` eklendi (Cap 8 uyumlu).
- `src/nativeGoogle.ts`: `isNativeApp()` + `nativeGoogleSignIn(webClientId)` → ID-token döner.
- `src/ui/Auth.tsx`: app içinde (`Capacitor.isNativePlatform()`) GIS yerine native "Google" butonu;
  ID-token'ı mevcut `api.googleLogin()` → `POST /auth/google`'a yollar. **Backend değişmedi**
  (zaten ID-token doğruluyor; `aud` = Web client ID = `api.GOOGLE_CLIENT_ID`).
- `npx cap sync android` ile plugin native projeye bağlandı.

## SENİN YAPMAN GEREKENLER (kod dışı — bunlar olmadan native Google ÇALIŞMAZ)

### 1) Google Cloud Console — Android OAuth client (ŞART)
Proje: **164766354103** (mevcut Web client ID: `164766354103-tnibk42t91nng26tehvbpjejks3mt5v5`).
- APIs & Services → Credentials → **Create OAuth client ID** → **Android**.
- Package name: `com.tavlatv.app`
- **SHA-1** parmak izleri — İKİSİNİ de ekle:
  - **Play App Signing** SHA-1: Play Console → uygulaman → Setup → **App signing** → "App signing key certificate" SHA-1. (Play dağıtımında FINAL imza budur — en kritik.)
  - **Upload key** SHA-1: `keytool -list -v -keystore C:/Users/Master/AndroidKeys/tavlatv-upload.jks -alias tavlatv` çıktısındaki SHA1. (Kendi test build'lerin için.)
- Web client ID'yi SİLME; native taraf onu `serverClientId` olarak kullanır (idToken aud = Web client).

### 2) APK'yı yeniden derle (Java 17 gerekir — bu makinede Java 8 var, build burada OLMAZ)
```
# Java 17 kurulu ortamda:
node scripts/prepare-deploy.mjs        # (opsiyonel; APK canlı siteyi yükler, webDir=android-shell)
cd android
./gradlew bundleRelease                 # imzalı AAB -> android/app/build/outputs/bundle/release/
# (keystore.properties zaten dolu: storeFile=C:/Users/Master/AndroidKeys/tavlatv-upload.jks)
```
versionCode'u artır (`android/app/build.gradle`, şu an 3) — yoksa Play reddeder.

### 3) Play Console'a yükle
- Play Console → Production (veya önce Internal testing) → yeni AAB yükle → yayınla.
- Kullanıcılar güncelleyince native Google çalışır.

## Notlar
- **Web kullanıcıları etkilenmez** (GIS aynen çalışır; native dal yalnız `isNativePlatform()`).
- Eski APK (plugin'siz) kullanıcıları native butona basınca hata alır → e-posta ile girerler
  (GIS'te sonsuz takılmaları biter). Güncelleyince native Google gelir.
- idToken `aud`'si Web client ID olmalı (serverClientId=webClientId) → backend eşleşir.
  SHA-1 (Play App Signing) eksikse native sign-in "DEVELOPER_ERROR" verir — en sık hata budur.
