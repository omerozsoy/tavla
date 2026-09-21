# TavlaTV — SECURITY + SERVER-AUTHORITATIVE ARCHITECTURE AUDIT

## SECURITY SUMMARY

Bu dosyada yalnızca halen açık, kısmi veya güvenli biçimde kanıtlanmamış riskler tutulur. Tamamlanan düzeltmeler ve kapanmış bulgular rapordan çıkarılmıştır.

| Severity | Kalan bulgu |
|---|---:|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 2 |
| LOW | 0 |
| UNKNOWN | 2 |

## KALAN SERVER-AUTHORITATIVE CHECKLIST

| İnvariant | Durum | Kalan kanıt boşluğu |
|---|---|---|
| Aynı kullanıcı aynı anda birden fazla aktif money match'te oynayamaz | PARTIAL | `active_money_match_claims.user_id` unique claim'i ve admission entegrasyonu eklendi; production migration/backfill ve gerçek MySQL/InnoDB paralel test bekliyor. |
| Aynı match + aynı user duplicate participant olamaz | PARTIAL | Claim tablosu kullanıcı başına tek aktif ekonomik oda sağlar; mevcut eski room participant satırları için backfill/duplicate temizliği ve production constraint kanıtı bekliyor. |
| Aynı match iki kez settle edilemez | PARTIAL | Command ve settlement guard'ları var; queue retry, gerçek DB isolation ve kalıcı settlement referansının production kanıtı eksik. |
| Aynı game action iki kez uygulanamaz | PASS (test edilen HTTP command yolları) | HTTP dışı tüketici veya eski deployment sürümü ayrıca doğrulanmalı. |
| Client game result belirleyemez | PARTIAL | Doğrulanmış server result yolları korunuyor; tarihsel/offline projeksiyonlar ve harici tüketiciler için canonical zincir kanıtı yok. |
| Client wallet balance değiştiremez | PARTIAL | WalletService satır kilidi + transaction + ledger kullanıyor; tüm ekonomik yazarların tek servisi kullandığı production kanıtlanmadı. |
| Client dice sonucunu belirleyemez | PARTIAL | Current authoritative roll ve unbiased mapping testli; production seed/reveal ve tüm legacy odaların kapsamı kanıtlanmadı. |
| Stale request reddedilir | PASS (authoritative command yolları) | Legacy/harici entegrasyonların deployment sürümü doğrulanmalı. |
| Timeout/AFK server tarafından belirlenir | PARTIAL | Authoritative clock yolu korunuyor; legacy ve scheduler deployment zincirinin tamamı gerçek ortamda kanıtlanmadı. |
| WebSocket event'i state değiştiremez | UNKNOWN / mevcut repoda socket yok | Production'da harici socket/broadcast servisi çalışıp çalışmadığı doğrulanmadı. |
| Immutable wallet ledger | PARTIAL | Ledger tablosu ve WalletService transaction'ı var; tüm direct `users.coins` yazarlarının kapatıldığı ve production migration durumunun kanıtı yok. |

## KALAN BULGULAR

### SEC-DB-001 — Money-match admission için DB seviyesinde claim yok

**Severity:** HIGH  
**Category:** Concurrency / database invariant  
**Affected file(s):** `backend/app/Http/Controllers/RoomController.php`, `backend/app/Models/Room.php`, room migrations  
**Affected endpoint/event:** matchmaking, room join/enter/rematch  
**Description:** `active_money_match_claims` migration'ı ve admission entegrasyonu artık kullanıcı başına DB unique claim kullanıyor. Ancak migration production'da çalıştırılmadı ve mevcut eski aktif odalar için güvenli backfill/duplicate temizliği yapılmadı.  
**Attack scenario:** Aynı user ile iki paralel HTTP isteği farklı transaction'larda admission kontrolünü geçerse iki aktif money match oluşabilir.  
**Root cause:** Önceki akış yalnız application row-lock ve sorgu kontrolüne dayanıyordu; yeni claim tablosunun production rollout'u ve backfill'i henüz kanıtlanmadı.  
**Evidence:** `ActiveMoneyClaimTest` **1 test / 5 assertions** ve mevcut concurrency suite geçiyor; SQLite `lockForUpdate()` gerçek InnoDB davranışını kanıtlamaz. Production engine/isolation doğrulanmadı.  
**Potential impact:** Aynı bakiye iki maçta rezerve edilebilir, settlement ve AFK sonuçları çakışabilir.  
**Recommended fix:** `2026_09_22_020000_create_active_money_match_claims.php` migration'ını backup ve kontrollü backfill ile rollout et; settlement/cancel/cleanup/recovery claim release'lerini doğrula; gerçek MySQL paralel testi çalıştır.  
**Database protection required?:** Evet.  
**Regression test required?:** Evet; gerçek MySQL ile 10–50 paralel join/enter isteği.

### SEC-WALLET-001 — Tüm ekonomik yazıcıların tek ledger protokolüne taşındığı kanıtlanmadı

**Severity:** HIGH  
**Category:** Wallet / accounting  
**Affected file(s):** `backend/app/Services/WalletService.php`, payment, tournament, spin, achievement ve admin controller/service yolları  
**Affected endpoint/event:** settlement, payment fulfillment, admin adjustment, wheel/slot reward, tournament prize  
**Description:** WalletService güvenli transaction ve ledger yazımı sağlıyor; ancak repository'deki bütün ekonomik yolların yalnızca bu servisten geçtiği ve production şemasının ledger migration'larını içerdiği kanıtlanmadı.  
**Attack scenario:** Bir doğrudan `users.coins` güncellemesi ledger dışında kalır veya queue retry'da reference koruması olmadan tekrar çalışır.  
**Root cause:** Tarihsel ekonomi yolları çok sayıda controller/service'e dağılmış.  
**Evidence:** Runtime ekonomik yolları WalletService çağırıyor; `ResetCoins` komutu da artık kullanıcı başına kilitli WalletService + ledger yazımı kullanıyor. Kod taramasında yalnızca E2E seed fixture'ında doğrudan başlangıç bakiyesi ataması kaldı; production migration ve gerçek queue retry kanıtı yok. `WalletAtomicityTest` ve `ResetCoinsLedgerTest` birlikte **2 test / 8 assertions** geçti.  
**Potential impact:** Bakiye-ledger drift, çift ödeme veya forensic kayıt eksikliği.  
**Recommended fix:** Tüm ekonomik hareketleri WalletService/immutable ledger üzerinden geçir; direct balance update için static check ve DB constraint stratejisi değerlendir; settlement reference'larını unique yap.  
**Database protection required?:** Evet.  
**Regression test required?:** Evet; her reward/settlement/payment yolunda duplicate job ve rollback testi.

### SEC-SETTLE-001 — Queue retry ve settlement recovery zinciri production'da kanıtlanmadı

**Severity:** HIGH  
**Category:** Idempotency / failure recovery  
**Affected file(s):** settlement services, `routes/console.php`, queue jobs, `MatchBackstop`  
**Affected endpoint/event:** finish, settle, scheduled backstop, queue retry  
**Description:** HTTP command replay koruması mevcut; Laravel queue'nun at-least-once çalışmasında tüm finansal job'ların aynı idempotency/reference garantisini koruduğu production queue üzerinde kanıtlanmadı.  
**Attack scenario:** Worker timeout veya retry sonrası winner credit ikinci kez uygulanabilir ya da match finalized olmadan ekonomik işlem tamamlanabilir.  
**Root cause:** Queue worker, timeout, retry_after ve DB isolation kombinasyonu canlı ortamda doğrulanmadı.  
**Evidence:** `RoomSettleTest`, `RoomEscrowTest`, `SettlePctMissingSnapshotTest` ve `PaymentCallbackTest` birlikte **22 test / 79 assertions** geçti; rollback, escrow release, duplicate claim ve payment callback idempotency HTTP düzeyinde doğrulandı. `AnalyzeMatchLuckJob` için başarısız işler gözlendi; bunlar settlement değil, eksik tarihsel MAT kayıtlarıdır. Gerçek finansal queue retry simülasyonu çalıştırılmadı.  
**Potential impact:** Partial settlement, duplicate reward, stuck escrow.  
**Recommended fix:** Settlement state machine, unique business reference, idempotent claim, reconciliation alarmı ve gerçek queue retry testi.  
**Database protection required?:** Evet.  
**Regression test required?:** Evet.

### SEC-WEB-001 — Enforcing CSP için kaynak envanteri eksik

**Severity:** MEDIUM  
**Category:** Browser security / XSS defense-in-depth  
**Affected file(s):** frontend build, web/Plesk/Nginx headers, CMS-rendered HTML  
**Affected endpoint/event:** tüm web sayfaları ve admin içerik render'ı  
**Description:** Inline style/script, Google Fonts, opsiyonel analytics, `data:`/`blob:` medya ve API bağlantıları bulunuyor. Kaynakları kapsayan opt-in `Content-Security-Policy-Report-Only` middleware'i eklendi; enforcing CSP hâlâ kaynak envanteri ve gözlem dönemi bekliyor.  
**Attack scenario:** Stored veya reflected XSS açığı bulunursa CSP olmadığı için tarayıcıda daha geniş etki alanı oluşur.  
**Root cause:** Mevcut frontend kaynakları strict CSP ile uyumlu olarak sınıflandırılmadı.  
**Evidence:** Source review; `SecurityHeadersTest` **2 test / 3 assertions** geçti. Production `curl -I https://www.tavlatv.com` artık kesilmeden `style-src`, `font-src`, `img-src` içeren `Content-Security-Policy-Report-Only` header'ını döndürüyor. Enforcing geçişi için gerçek tarayıcı ihlal listesi ve rapor toplama sonucu hâlâ bekleniyor.  
**Potential impact:** XSS etkisinin büyümesi, token/oturum kötüye kullanımı.  
**Recommended fix:** Önce `Content-Security-Policy-Report-Only`, rapor toplama ve nonce/hash kaynak envanteri; sonra enforcing CSP.  
**Database protection required?:** Hayır.  
**Regression test required?:** Evet; Playwright ile ana akışlar ve admin içerik render'ı.

### SEC-SSO-001 — Admin SSO tokeni URL query string'de taşınıyor

**Severity:** MEDIUM  
**Category:** Authentication / credential exposure  
**Affected file(s):** `backend/routes/web.php`, `backend/app/Http/Controllers/PanelController.php`  
**Affected endpoint/event:** `/admin/enter?token=...`, `/panel/enter?token=...`  
**Description:** SSO değişimi PAT başına atomik kısa süreli tek kullanımlık cache claim'i yapıyor; ancak token ilk istekte URL, browser history, access log veya proxy log'larına girebilir.  
**Attack scenario:** URL sızıntısı gerçekleşirse saldırgan exchange penceresinde tokenı kullanmayı deneyebilir.  
**Root cause:** Backward-compatible GET query sözleşmesi.  
**Evidence:** Route ve controller query token okuyor; replay testi yalnız ikinci exchange'i engelliyor.  
**Potential impact:** Admin web session açılması.  
**Recommended fix:** Kısa ömürlü one-time nonce + POST exchange; PAT'yi doğrudan URL'de taşımama.  
**Database protection required?:** Tercihen nonce unique/revocation kaydı.  
**Regression test required?:** Evet; expiry, replay, concurrent exchange ve referrer/history senaryoları.

### SEC-OPS-001 — Gerçek production concurrency ve deployment state kanıtı eksik

**Severity:** UNKNOWN  
**Category:** Operations / verification  
**Affected file(s):** deployment environment, DB, queue, reverse proxy  
**Affected endpoint/event:** tüm money-game ve validator yolları  
**Description:** Yerel testler ve operator tinker çıktıları uygulama davranışını doğruluyor; çalışan release commit'i, production migration state'i, DB engine/isolation, queue worker sürümü ve reverse-proxy route'larının tamamı bu çalışma alanından bağımsızdır.  
**Attack scenario:** Sunucuda eski build/config çalışıyor olabilir veya migration/constraint eksik olabilir.  
**Root cause:** Deployment kanıtı audit çalışma alanında yok.  
**Potential impact:** Yerel PASS sonuçları production garantisine dönüşmeyebilir.  
**Recommended fix:** Read-only release SHA, `migrate:status`, DB engine/isolation, queue worker command ve route/config fingerprint'lerini kayıt altına al; production'da yalnız güvenli smoke test çalıştır.  
**Database protection required?:** Evet, fakat migration yalnız onaylı rollout ile.  
**Regression test required?:** Evet.

### SEC-JOB-001 — Tarihsel MAT analiz job'ları sürekli başarısız

**Severity:** UNKNOWN  
**Category:** Failure recovery / data integrity  
**Affected file(s):** `AnalyzeMatchLuckJob`, `MatSerializer`, historical `game_logs`  
**Affected endpoint/event:** queue retry, match analysis  
**Description:** Failed job kayıtları, sonraki oyun başlarken önceki oyunun authoritative result alanının boş kaldığını gösteriyor. Bu kayıtlar settlement job'ı değildir; tekrar deneme aynı nedenle başarısız olur.  
**Attack scenario:** Queue sürekli retry ederek worker kapasitesini tüketebilir veya eksik analiz sonucu kullanıcıya sunulabilir.  
**Root cause:** Tarihsel loglarda oyun bitiş event/result eksik.  
**Potential impact:** Analiz kuyruğu tıkanması, eksik adli replay.  
**Recommended fix:** Kayıtları quarantine et veya güvenli backfill kuralı tanımla; settlement/coin verisini MAT backfill'den ayır; sınırsız retry yapma.  
**Database protection required?:** Hayır.  
**Regression test required?:** Evet; malformed historical log için no-retry/quarantine testi.

## SIRALI KALAN FIX PLANI

### PHASE 0 — Acil exploit ve deployment doğrulaması

1. Çalışan production release SHA, config cache ve validator secret guard'ını read-only doğrula. **Dosyalar:** deployment/Plesk, `validator/server.ts`, Laravel config.
2. SSO token query kullanımını access-log/referrer politikasıyla sınırla; POST nonce tasarımını hazırla. **Dosyalar:** `routes/web.php`, `PanelController.php`.

### PHASE 1 — DB concurrency claim

1. `2026_09_22_020000_create_active_money_match_claims.php` migration'ını backup ve kontrollü backfill ile production'a uygula; eski aktif odaların claim kayıtlarını doğrula. **Dosyalar:** room migrations, `RoomController`, `Room`.
2. Gerçek MySQL paralel admission testi ekle ve claim insert/release yarışlarını doğrula.

### PHASE 2 — Wallet/settlement bütünlüğü

1. Tüm coin yazarlarını WalletService'e taşı ve direct update taramasını CI kontrolüne bağla. **Dosyalar:** wallet/payment/tournament/spin/achievement servisleri.
2. Settlement state machine ve unique business reference'ı production migration planıyla uygula.
3. Queue retry/rollback/reconciliation testleri ekle.

### PHASE 3 — Web hardening

1. CSP Report-Only gözlem dönemi, ardından enforcing CSP. **Dosyalar:** Plesk/Nginx ve frontend build.

### PHASE 4 — Operasyon ve adli iz

1. Queue malformed MAT kayıtlarını quarantine/backfill akışına al.
2. Production release/config/DB/queue fingerprint'lerini periyodik kaydet.
3. Gerçek MySQL concurrency, duplicate settlement ve worker retry smoke testlerini güvenli test verisiyle otomatikleştir.

## KAPSAM VE KISITLAR

- Bu rapor yalnız kalan riskleri içerir; tamamlanmış düzeltme geçmişi silinmiştir.
- Production migration, gerçek kullanıcı/coin/bakiye işlemi veya destructive test yapılmadı.
- Secret, token ve gerçek hesap değerleri rapora yazılmadı.
- SQLite testleri MySQL/InnoDB lock/constraint garantisi sayılmadı.
