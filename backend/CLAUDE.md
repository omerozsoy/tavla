# Tavla Backend (Laravel 12 API)

SPA/mobil API + Filament admin paneli (`/admin`). Frontend `backend/public`'ten
servis edilir (tek domain). Genel proje kuralları için kök `../CLAUDE.md`.

## Komutlar
- Test: `php artisan test` (sqlite `:memory:`, `.env.testing`). Tekil: `php artisan test --filter=XxxTest`.
- Format: `./vendor/bin/pint` (Laravel Pint — commit öncesi çalıştır).
- Üretimde PHP yolu: `/opt/plesk/php/8.2/bin/php` (gerekli `^8.2`).

## Kuyruk mimarisi (database driver) — DİKKAT
- `QUEUE_CONNECTION=database`. Worker'lar systemd ile **kuyruk-adına göre izole** (bkz `../deploy/*.service`):
  `tavla-queue` (default), `tavla-review-queue` (reviews), `tavla-backfill-queue@` (reviews-bulk/bulk), scheduler, reverb.
- `queue:work` KATI ÖNCELİKLİDİR: canlı + backfill AYNI worker'da olursa canlı iş backfill'i aç bırakır (**starvation**). Bu yüzden ayrı worker'larda. Yeni ağır işi mevcut canlı kuyruğa SOKMA.
- gnubg havuzları kuyruğa göre ayrışır (canlı reviewMatch ↔ backfill farklı port havuzu). Aynı havuzu paylaştırma.
- **Kuyruğu elle SİLME.** Worker ölürse sadece relaunch = kaldığı yerden devam (baştan değil). İşi mid-kill etme → gnubg kirlenir.
- Dağıtımda yeni `.service` dosyaları `deploy.sh` ile KOPYALANMAZ → sunucuda elle `cp` + `daemon-reload` + `restart`.

## gnubg / PR analizi
- PR = **hibrit `min(emgPr, Snowie)`** (`GnubgSnowieService`); emgPr = XG tanımı (ovErr/(unforced+closeCube)×500).
- reviewMatch **skor-farkında** olmalı (çok-oyunlu maçta game 2+ 0-0'da analiz edilmemeli — küp/checker sapar).
- Analiz job'ları gnubg degrade iken **SAHTE 0.0 yazmaz**: `TransientAnalysisException` fırlatıp retry/heal'e bırakır. Bu bilinçlidir — "hata" diye yakalayıp 0 yazma.

## Alarm sistemi — `bootstrap/app.php` (bozmadan oku)
- `report()` + `Queue::failing` admin'e e-posta/WhatsApp 500 alarmı atar (15 dk spam-limit).
- **Beklenen/geçici hatalar BİLEREK susturulur**: Validation/Auth/404/Throttle, `TransientAnalysisException`, `MaxAttemptsExceededException`, InnoDB deadlock (40001/1213/1205), PsySH. Bu guard'ları SİLME — SAHTE alarm fırtınası çıkar.
- Yeni bir best-effort/geçici job eklersen alarmdan muaf tut (örn. `WarmMatchAnalysisJob` `Queue::failing`'den atlanır).
- `redirectGuestsTo`: `api/*` → `null` (401 JSON). `'login'` adlı web rotası YOK — redirect eklersen `RouteNotFoundException` (500 spam) olur.

## Güvenlik / erişim
- Admin erişimi SADECE `ADMIN_EMAILS` env'den — **kaynak koda gömülü admin YOK**. Boşsa panel/admin API'ye kimse giremez.
- `SiteGate` (SITE_PASSWORD doluysa tüm `/api` için `X-Site-Gate`), `SecurityHeaders`, `ShieldTracker` middleware'leri `bootstrap/app.php`'de kurulu.
- Auth: Sanctum. Google giriş `/auth/google` (web ve native app aynı endpoint). Ödeme: Garanti 3D Sanal POS (`GARANTI_*`, boşsa kapalı).

## Deploy (`../deploy.sh`)
- Adımlar: composer install → `filament:assets` → `migrate --force` → cache yenileme.
- **Cache boşaltma tuzağı:** canlı trafik + worker'lar `bootstrap/cache/*.php`'yi aynı anda yazarsa truncate → site tamamen 500. Kurtarma: `rm -f bootstrap/cache/*.php` + `php artisan package:discover` (TEK süreç, boş bırakma). `deploy.sh` `optimize:clear` yerine `package:discover` + flock kullanır.
- Config değişikliği: `config:cache` + `queue:restart` + **php-fpm restart** (opcache; config:clear tek başına yetmez).

## Bakım komutları (`app/Console/Commands`)
Backfill/heal/audit için zengin komut seti var (`tavla:cube-pr-rescore`, `gnubg-pr-heal`, `careerpr:rebuild`, `*:backfill`, `audit:*` ...). Backfill resumable'dır — yarıda kesme, relaunch devam ettirir.

## Çalışma kuralları
- Bug = kök neden: fonksiyonu düzeltmeden önce TÜM çağıranlarını ara (symptom değil paylaşılan noktada tek guard).
- "Düzeldi" demeden önce ilgili `php artisan test --filter=...` ile doğrula.
- Türkçe yanıt ver.
