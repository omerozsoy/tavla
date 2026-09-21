# TavlaTV — SECURITY + SERVER-AUTHORITATIVE ARCHITECTURE AUDIT

## SECURITY SUMMARY

Bu dosyada yalnızca henüz tamamlanmamış veya production’da kanıtlanmamış riskler bulunur.

| Severity | Kalan bulgu |
|---|---:|
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 2 |
| LOW | 0 |
| UNKNOWN | 1 |

## KALAN SERVER-AUTHORITATIVE CHECKLIST

| İnvariant | Durum | Kalan iş |
|---|---|---|
| Aynı kullanıcı aynı anda birden fazla aktif money match'te oynayamaz | PARTIAL | MariaDB 10.3.39 / REPEATABLE-READ ve unique claim index production’da doğrulandı; gerçek paralel admission testi hâlâ bekliyor. |
| Aynı match iki kez settle edilemez | PARTIAL | Production snapshot’ta terminal/duplicate settlement sorunu yok; gerçek queue retry ve DB isolation testi bekliyor. |
| Client game result belirleyemez | PARTIAL | Tarihsel/offline projeksiyonlar ve harici tüketiciler için canonical zinciri doğrula. |
| Client wallet balance değiştiremez | PARTIAL | Referanssız ekonomik hareketler için ortak idempotency protokolünü tamamla. |
| Client dice sonucunu belirleyemez | PARTIAL | Production seed/reveal ve legacy oda kapsamını doğrula. |
| Timeout/AFK server tarafından belirlenir | PARTIAL | Scheduler ve legacy deployment zincirini production’da doğrula. |
| WebSocket event'i state değiştiremez | UNKNOWN | Production’da harici socket/broadcast servisi kullanılıp kullanılmadığını doğrula. |
| Immutable wallet ledger | PARTIAL | Tüm ekonomik yazarlar ve production ledger şeması için deployment kanıtı topla. |

## KALAN BULGULAR

### SEC-DB-001 — Money-match admission için gerçek DB yarış kanıtı eksik

**Severity:** HIGH
**Category:** Concurrency / database invariant
**Affected file(s):** `backend/app/Http/Controllers/RoomController.php`, `backend/app/Models/Room.php`, room migrations
**Affected endpoint/event:** matchmaking, room join/enter/rematch
**Description:** Production read-only claim snapshot’ı temiz ve unique user claim index’i mevcut; kullanıcı başına claim mekanizmasının gerçek paralel admission yarış davranışı henüz kanıtlanmadı.
**Attack scenario:** Aynı user ile paralel admission istekleri iki aktif money match oluşturmaya çalışabilir.
**Root cause:** SQLite testleri gerçek MariaDB isolation ve lock davranışını temsil etmez; aktif maç yokken paralel admission gözlemi yapılamadı.
**Potential impact:** Aynı bakiye iki maçta rezerve edilebilir, settlement ve AFK sonuçları çakışabilir.
**Recommended fix:** Kontrollü test kullanıcılarıyla 10–50 paralel MySQL join/enter isteği çalıştır; production kullanıcı/coin verisine dokunmadan unique claim sonucunu doğrula.
**Database protection required?:** Evet.
**Regression test required?:** Evet; gerçek MySQL/InnoDB üzerinde.

### SEC-WALLET-001 — Tüm ekonomik hareketlerde ortak idempotency kanıtı eksik

**Severity:** HIGH
**Category:** Wallet / accounting
**Affected file(s):** `backend/app/Services/WalletService.php`, `backend/app/Console/Commands/AuditWalletReferences.php`, payment, tournament, spin, achievement ve admin controller/service yolları
**Affected endpoint/event:** settlement, payment fulfillment, admin adjustment, wheel/slot reward, tournament prize
**Description:** Ekonomik yazımlar WalletService üzerinden geçse de bazı hareketler ortak business reference taşımıyor.
Yerel ledger envanteri için eklenen salt-okunur `php artisan security:wallet-references` komutu mevcut satırları değiştirmeden eksik referansları tür bazında sayar; production çıktısı henüz alınmadı.
Production kanıtı alındı: toplam 116 eksik referans; `dice_slot_spin=75`, `daily_reward=16`, `lucky_wheel_spin=11`, `dice_slot_payout=12`, `shop_purchase=2`. Bu tarihsel satırlar değiştirilmedi.
**Attack scenario:** `daily_reward`, `shop_purchase`, `tournament_entry/refund`, `dice_slot_spin/payout` veya `lucky_wheel_spin` retry edildiğinde ikinci ekonomik hareket oluşabilir.
**Root cause:** Tarihsel ekonomi yolları farklı idempotency/state mekanizmaları kullanıyor.
**Potential impact:** Bakiye-ledger drift, çift ödeme veya eksik forensic kayıt. Production’daki 116 satır referanssızlığı tek başına çift ödeme kanıtı değildir; mevcut akışların cooldown/ownership kontrolleri ayrı bir savunma katmanıdır.
**Recommended fix:** Ledger’a nullable unique `idempotency_key` altyapısı eklendi (`2026_09_22_030000_add_idempotency_key_to_wallet_transactions.php`) ve `WalletService` aynı anahtarı ikinci kez uygulamıyor; ancak migration production’da henüz çalıştırılmadı ve spin/recurring reward controller’larının command receipt entegrasyonu tamamlanmadı. Her ekonomik komuta benzersiz business reference/command id ekle; recurring ödüller için claim-period anahtarı, spin’ler için spin receipt, mağaza için order/ownership referansı kullan; duplicate-request/job testleri uygula. Tarihsel 116 satırı otomatik yeniden yazma; yalnız reconciliation/forensics için ayrı backfill planla.
**Database protection required?:** Evet.
**Regression test required?:** Evet; her reward/settlement/payment yolunda duplicate job ve rollback testi.

### SEC-SETTLE-001 — Queue retry ve settlement recovery zinciri production’da kanıtlanmadı

**Severity:** HIGH
**Category:** Idempotency / failure recovery
**Affected file(s):** `backend/app/Http/Controllers/RoomController.php`, `backend/routes/console.php`, `backend/app/Support/MatchBackstop.php`
**Affected endpoint/event:** `settle`, `matches:backstop-finished`, HTTP retry/reconnect
**Description:** Settlement endpoint’i `settled=false` claim’i, room finalization ve wallet hareketlerini tek transaction’da yapıyor; production snapshot’ı da temiz. Buna rağmen canlı ortamda aynı settlement isteğinin eşzamanlı/retry davranışı ve scheduler/backstop recovery zinciri henüz kanıtlanmadı. Settlement için ayrı bir financial queue job’ı bulunmadı; bu nedenle risk HTTP retry ve scheduled recovery sınırındadır.
**Attack scenario:** Ağ zaman aşımı sonrası istemci aynı settlement isteğini tekrar gönderir veya backstop ile canlı istek çakışır; claim guard’ın tüm yolları tek bir ekonomik işlemde tuttuğu production DB’de kanıtlanmalıdır.
**Root cause:** Production MariaDB üzerinde kontrollü eşzamanlı retry ve scheduler çakışma testi henüz çalıştırılmadı.
**Potential impact:** Partial settlement, duplicate reward, stuck escrow.
**Recommended fix:** Settlement state machine, unique business reference, idempotent claim, reconciliation alarmı ve güvenli queue retry testi uygula.
**Database protection required?:** Evet.
**Regression test required?:** Evet.

### SEC-WEB-001 — Enforcing CSP için kaynak envanteri eksik

**Severity:** MEDIUM
**Category:** Browser security / XSS defense-in-depth
**Affected file(s):** frontend build, web/Plesk/Nginx headers, CMS-rendered HTML
**Affected endpoint/event:** tüm web sayfaları ve admin içerik render’ı
**Description:** Strict CSP için inline style/script, Google Fonts, analytics, `data:`/`blob:` medya ve API bağlantılarının tamamı sınıflandırılmadı.
**Attack scenario:** Stored veya reflected XSS açığı bulunursa CSP enforcing olmadığı için etki alanı genişler.
**Root cause:** Report-Only gözleminden enforcing politikaya geçiş tamamlanmadı.
**Potential impact:** XSS etkisinin büyümesi, token/oturum kötüye kullanımı.
**Recommended fix:** Tarayıcı ihlallerini topla; nonce/hash ve kaynak allowlist’ini tamamla; ardından enforcing CSP’ye geç.
**Database protection required?:** Hayır.
**Regression test required?:** Evet; Playwright ile ana akışlar ve admin içerik render’ı.

### SEC-SSO-001 — Admin SSO tokeni URL query string’de taşınıyor

**Severity:** MEDIUM
**Category:** Authentication / credential exposure
**Affected file(s):** `backend/routes/web.php`, `backend/app/Http/Controllers/PanelController.php`
**Affected endpoint/event:** `/admin/enter?token=...`, `/panel/enter?token=...`
**Description:** POST exchange mevcut olsa da legacy GET query token sözleşmesi hâlâ açık.
**Attack scenario:** URL sızıntısı gerçekleşirse saldırgan kısa exchange penceresinde tokenı kullanmayı deneyebilir.
**Root cause:** Backward-compatible GET akışı.
**Potential impact:** Admin web session açılması.
**Recommended fix:** Tüm frontend/panel link üretimini POST exchange’e taşı; deprecation süresinden sonra GET’i kaldır; one-time nonce kullanımını koru.
**Database protection required?:** Tercihen nonce unique/revocation kaydı.
**Regression test required?:** Evet; expiry, replay, concurrent exchange ve referrer/history senaryoları.

### SEC-OPS-001 — Production concurrency ve deployment state kanıtı eksik

**Severity:** UNKNOWN
**Category:** Operations / verification
**Affected file(s):** deployment environment, DB, queue, reverse proxy
**Affected endpoint/event:** tüm money-game ve validator yolları
**Description:** Çalışan release SHA, config cache, DB engine/isolation, queue worker sürümü ve reverse-proxy route’larının tamamı düzenli fingerprint olarak kayıtlı değil.
**Attack scenario:** Sunucuda eski build/config çalışıyor olabilir veya deployment ile repository ayrışabilir.
**Root cause:** Production doğrulama zinciri standardize edilmedi.
**Potential impact:** Yerel test sonuçları production garantisine dönüşmeyebilir.
**Recommended fix:** Read-only release/config/DB/queue/route fingerprint komutu ve periyodik kayıt oluştur; yalnız güvenli smoke test çalıştır.
**Database protection required?:** Evet, yalnız kontrollü rollout ile.
**Regression test required?:** Evet.

## SIRALI KALAN FIX PLANI

### PHASE 0 — Deployment doğrulaması

1. Release SHA, config cache, validator secret guard ve route fingerprint’lerini kaydet.
2. SSO GET kullanımını access-log/referrer politikasıyla izle ve POST migration’ını tamamla.

### PHASE 1 — DB concurrency

1. Eski aktif odaları claim tablosuyla read-only karşılaştır.
2. Gerçek MySQL paralel admission testini çalıştır.

### PHASE 2 — Wallet/settlement

1. Referanssız ekonomik hareketlere command/business id ekle.
2. Unique ledger referanslarını ve queue retry rollback’ini doğrula.
3. Reconciliation alarmı ve güvenli worker retry smoke testi ekle.

### PHASE 3 — Web hardening

1. CSP Report-Only ihlal envanterini tamamla.
2. CSP enforcing geçişini Playwright regresyonlarıyla doğrula.

### PHASE 4 — Monitoring

1. Production release/config/DB/queue fingerprint’lerini periyodik kaydet.
2. WebSocket/broadcast altyapısının command-only state değişimi yaptığını doğrula.

## KAPSAM VE KISITLAR

- Production migration, gerçek kullanıcı/coin/bakiye işlemi veya destructive test yapılmadı.
- Secret, token ve gerçek hesap değerleri rapora yazılmadı.
- SQLite testleri MySQL/InnoDB lock/constraint garantisi sayılmadı.
