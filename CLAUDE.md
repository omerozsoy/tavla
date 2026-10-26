# Tavla (TavlaTv / tavlatv.com)

Tarayıcıda çalışan tavla: React 19 + TS + Vite (kök) + Laravel 12 API (`backend/`).
wildbg ONNX motoru tarayıcıda SADECE ipucu/analiz içindir. **Gerçek bot rakip =
sunucu gnubg** (`SERVER_BOT=true`). Mimari ve kurulum için README.md.

## Deploy — en sık yapılan hata
- **Üretim artık Laravel FORGE (148.251.126.242), Hetzner/Plesk DEĞİL.** Cloudflare origin=Forge.
- Frontend sunucuda DERLENMEZ. `dist/` → `backend/public`'e commit'lenir.
- **Yalnızca `src/*` commit'lemek canlıyı DEĞİŞTİRMEZ.** Akış:
  `npm run deploy:build` → `git add backend/public` → commit → push → **Forge panel "Deploy Now"**
  (veya deploy-hook URL'ini curl'le). Forge zero-downtime: `current` → `releases/<N>` symlink.
- **Push tek başına canlıya YANSIMAZ** — Quick Deploy güvenilmez (push'u atladığı oldu). Deploy'u
  AÇIKÇA tetikle, sonra doğrula: Forge `current` HEAD = commit'in mi + CF'den `curl https://tavlatv.com/`.
- Deploy edemiyorsan: `forge` user sudo'su ŞİFRE ister (passwordless YOK), site dosyaları `tavla:tavla`
  (forge yazamaz) → SSH'tan elle deploy edilemez; panel/hook şart. SSH anahtar: `~/.ssh/tavla`.
- ⚠ `backend/public/uploads` shared storage'da → git'te "deleted" görünür; dirty-tree deploy'u
  bozup eski commit'te bırakabilir (Quick Deploy'un eski commit deploy etmesinin muhtemel nedeni).

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
