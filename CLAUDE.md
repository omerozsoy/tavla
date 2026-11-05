# Tavla (TavlaTv / tavlatv.com)

Tarayıcıda çalışan tavla: React 19 + TS + Vite (kök) + Laravel 12 API (`backend/`).
wildbg ONNX motoru tarayıcıda SADECE ipucu/analiz içindir. **Gerçek bot rakip =
sunucu gnubg** (`SERVER_BOT=true`). Mimari ve kurulum için README.md.

## Deploy — en sık yapılan hata
- **🚫 KURAL (kullanıcı direktifi): Forge panel "Deploy Now" / force-deploy'a YALNIZ KULLANICI basar — Claude BASMAZ.**
  Deploy-hook URL'ini curl'leme, panelden elle deploy tetikleme de YASAK. Claude'un işi: commit →
  push → CI izle → deploy'un geçtiğini DOĞRULA. Elle zorlama gerekiyorsa (CI kırmızı / >10dk
  release yok) kullanıcıya SÖYLE, tuşa kullanıcı basar.
- **🚫 KURAL (kullanıcı direktifi): deploy doğrularken KÖR POLL DÖNGÜSÜNE GİRME.** Önce TEK kontrol:
  `current` HEAD zaten commit'ine eşitse deploy TAMAM — bekleme, döngü kurma. Karşılaştırmada İKİ tarafı
  da AYNI uzunlukta al (ikisi de `--short` veya ikisi de tam SHA) — `4d5ad7ff` (tam) vs `4d5ad7f`
  (`--short` 7 hane) uzunluk uyumsuzluğunu "eşleşmedi" sanıp 6dk boşuna poll etme (2026-11-05 hatası).
  Eşleşmezse 30-60sn aralıkla EN FAZLA birkaç poll, eşleşince DUR.
- **"QD" = Forge "Quick Deploy"** (panel → site → Apps sekmesindeki anahtar): açıkken `main`'e her
  push'ta Forge otomatik build+deploy script'i çalıştırır — ayrı cron/hook YOK. Gözlemlenen davranış:
  push → CI → otomatik release (aşağıdaki ölçümler). ⚠ Kullanıcı bunu bilinçli kurduğunu hatırlamıyor
  (Forge site kurulumunda varsayılan açık gelmiş olabilir); kesin teyit panelde Apps→Quick Deploy anahtarı.
- **Üretim artık Laravel FORGE (148.251.126.242), Hetzner/Plesk DEĞİL.** Cloudflare origin=Forge.
- Frontend sunucuda DERLENMEZ. `dist/` → `backend/public`'e commit'lenir.
- **Yalnızca `src/*` commit'lemek canlıyı DEĞİŞTİRMEZ.** Akış:
  `npm run deploy:build` → `git add backend/public` → commit → push → QD otomatik deploy eder
  (elle zorlama gerekirse **Forge panel "Deploy Now"'a KULLANICI basar**, Claude değil). Forge
  zero-downtime: `current` → `releases/<N>` symlink.
- **Push sonrası doğrula ama QD'ye ~5dk ver — QD ÖLÜ DEĞİL, gecikmesi OYNAK.** Akış:
  push → CI (~2dk, GitHub Actions) → QD CI sonrası sn-dk arası deploy eder (2026-11-03 ölçüm:
  CI yeşilinden +2.5dk, push'tan +4.5dk). **90sn'de pes etmek = yanlış-negatif** ("QD ölü" sanıp
  gereksiz elle-stopgap yapılıyordu). Reçete: `gh run watch` → CI yeşil → 2-5dk BEKLE → Forge
  `current` HEAD = commit'in mi (`readlink current` + `git rev-parse HEAD`) + `curl https://tavlatv.com/`.
  Elle "Deploy Now" YALNIZCA: CI-yeşilinden >10dk release yok (nadir App teslimat düşmesi, ~1.5sa
  vakası) VEYA **CI KIRMIZI** (Forge deploy ETMEZ; frontend CI flakey'liği backend-only push'u da bloklar).
- Deploy edemiyorsan: `forge` user sudo'su ŞİFRE ister (passwordless YOK), site dosyaları `tavla:tavla`
  (forge yazamaz) → SSH'tan elle deploy edilemez; panel/hook şart. SSH anahtar: `~/.ssh/tavla`.
- QD gelmezse ÖNCE CI'ya bak: `gh run list --branch main --limit 1` — kırmızıysa Forge deploy ETMEZ.
  Forge GitHub **App** ile bağlı; repoda KLASİK WEBHOOK YOK (`gh api repos/omerozsoy/tavla/hooks` → `[]`)
  → "Settings → Webhooks → Recent Deliveries" BOŞTUR, oraya bakma (eski/yanlış tavsiyeydi).
- ⚠ `backend/public/uploads` shared storage'da → git'te "deleted" görünür (dirty tree); gelecekte
  in-place `git pull` denersen çakışabilir (ama release-tabanlı Forge deploy'u bundan etkilenmez).

## Komutlar (kök)
- `npm run dev` / `npm run build` / `npm test` (vitest, yalnız `src/**`)
- **Tip kontrolü: `npm run typecheck` (= `tsc -b`). `tsc --noEmit -p tsconfig.json`
  BOŞ GEÇER** — kök tsconfig `files: []`, proje referanslıdır.
- Lint: `npm run lint` (oxlint)
- Backend testleri: `cd backend && php artisan test` (sqlite :memory:)

## Üretim altyapısı
- **Laravel Forge yönetimli, IP 148.251.126.242.** SSH: `ssh -i ~/.ssh/tavla forge@148.251.126.242`
  (forge=sudo'lu ama ŞİFRELİ; site user `tavla`=sudo YOK). Repo: `/home/tavla/tavlatv.com/current`.
  Servisler **systemd DEĞİL → Forge Daemons + supervisor** (gnubg ×18, reverb, worker'lar, scheduler).
- gnubg havuzları port-bazlı (canlı / heavy / backfill ayrı); .env değişince config:cache + queue:restart gerektirir.
  Deploy'da otomatik restart beklenmez → gerekirse Forge panel'den daemon restart.
- **DB/sunucu saati ZATEN Türkiye saati (GMT+3), UTC DEĞİL.** NOW()=duvar saati. Raporlarken +3 EKLEME.
- `app.timezone = Europe/Istanbul` (config:clear tek başına yetmez, php-fpm restart şart — opcache).
- (ESKİ Hetzner 95.217.120.90/Plesk dekomisyon — `no_turbo` PSU tuzağı o fiziksel kutuya özeldi, taşındı.)

## Android (Capacitor)
- APK canlı siteyi yükler (`server.url = www.tavlatv.com`), `dist` GÖMÜLÜ DEĞİL.
  → Çoğu kod düzeltmesi dist deploy ile app'e ulaşır, **yeni APK gerekmez**.
- `window.Capacitor.Plugins.X` bu kurulumda UNDEFINED → `Capacitor.nativePromise(plugin, method, opts)` kullan.
- Google giriş: gömülü WebView GIS'i engeller → native sign-in (`@capgo/capacitor-social-login`, `src/nativeGoogle.ts`).

## Çalışma kuralları
- Bir şeyi "düzeldi/çalışıyor" demeden önce test/çıktı ile doğrula.
- Bug = kök neden: düzeltmeden önce dokunacağın fonksiyonun TÜM çağıranlarını ara (symptom değil, paylaşılan noktada tek guard).
- Türkçe yanıt ver (kullanıcı tercihi).
