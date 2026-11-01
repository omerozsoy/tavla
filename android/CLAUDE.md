# Tavla Android (Capacitor kabuğu)

`com.tavlatv.app` — Capacitor tabanlı **ince kabuk**. Uygulama açılışta canlı siteyi
(`https://www.tavlatv.com`) WebView'da yükler (TWA gibi); web çıktısı (`dist`) APK'ya
GÖMÜLÜ DEĞİL (bkz `../capacitor.config.ts`). Genel kurallar: kök `../CLAUDE.md`.

## EN ÖNEMLİ: ne zaman yeni APK gerekir?
Kabuk canlı siteyi yüklediği için **çoğu değişiklik yeni APK GEREKTİRMEZ** — sadece
`dist`'i deploy et (kök `npm run deploy:build` akışı), app otomatik güncellenir.

Yeni APK/AAB SADECE şunlarda gerekir:
- Native plugin ekleme/güncelleme (push, social-login, screen-orientation ...)
- `capacitor.config.ts` değişikliği (server.url, allowNavigation ...)
- `AndroidManifest.xml` / izin / minSdk değişikliği
- `versionCode` / `versionName` bump + Play yayını

## Build & yayın
- Web → native senkron: kök build sonrası `npx cap sync android`.
- Release (Java 17): `./gradlew bundleRelease` → `app/release/app-release.aab` → Play'e yükle.
- Sürüm: `app/build.gradle` `versionCode`/`versionName` (şu an 4 / "1.4"). Yeni yayında versionCode MUTLAKA artır.
- SDK: min 24, target/compile 36 (`variables.gradle`).

## İmzalama (DİKKAT — geri alınamaz)
- Release imzası `keystore.properties`'ten okunur (**gitignore'da**, repoya girmez). Şablon: `keystore.properties.example`.
- `storeFile` repo DIŞINDA + YEDEKLİ olmalı. Upload keystore kaybolursa Play'e bir daha güncelleme gönderilemez.
- `local.properties` (sdk.dir) ve `keystore.properties` de gitignore'da — commit'leme.

## Native Google Sign-In
- Gömülü WebView Google GIS'i engeller (`disallowed_useragent`) → native sign-in kullanılır (`@capgo/capacitor-social-login`, web tarafı `../src/nativeGoogle.ts`, aynı `/auth/google` endpoint).
- Çalışması için Google Cloud'da **Android OAuth client + SHA-1** (Play App Signing sertifikasından) gerekir. Rehber: `../docs/native-google-signin.md`.
- `google-services.json` Firebase push içindir (repoda).

## Capacitor plugin çağrısı (remote-load tuzağı)
Kabuk canlı siteyi yüklediği için `window.Capacitor.Plugins.X` UNDEFINED olur (sessiz no-op).
Web kodunda `Capacitor.nativePromise(plugin, method, opts)` kullan — bkz kök `../CLAUDE.md`.

## Not
`android/app/` içine kazara bırakılmış görsel/tablo dosyaları (jpg/xls/pdf) build'in parçası
DEĞİL — android kaynağı sanılıp commit'lenmesin.

Türkçe yanıt ver.
