# TavlaTV — SECURITY + SERVER-AUTHORITATIVE ARCHITECTURE AUDIT

## SECURITY SUMMARY

Bu dosyada yalnızca henüz tamamlanmamış veya production’da kanıtlanmamış riskler bulunur.

| Severity | Kalan bulgu |
|---|---:|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 0 |
| LOW | 0 |
| UNKNOWN | 0 |

## KALAN SERVER-AUTHORITATIVE CHECKLIST

| İnvariant | Durum | Kalan iş |
|---|---|---|
| Aynı kullanıcı aynı anda birden fazla aktif money match'te oynayamaz | PASS | Production MariaDB üzerinde iki eşzamanlı claim testi: 1 başarılı, 1 reddedildi, claim satırı 1; geçici veriler temizlendi. |
| Aynı match iki kez settle edilemez | PARTIAL | Production snapshot’ta terminal/duplicate settlement sorunu yok; gerçek queue retry ve DB isolation testi bekliyor. |
| Client game result belirleyemez | PARTIAL | Tarihsel/offline projeksiyonlar ve harici tüketiciler için canonical zinciri doğrula. |
| Client wallet balance değiştiremez | PASS | Wallet ledger ve idempotency kolonu production’da mevcut; deployment/cache yenilemesi sonrası üç ardışık auditte anahtarsız toplam 243’te sabit kaldı. WalletIdempotencyTest, DailyRewardIdempotencyTest ve LuckyWheelTest geçti. |
| Client dice sonucunu belirleyemez | PARTIAL | Production seed/reveal ve legacy oda kapsamını doğrula. |
| Timeout/AFK server tarafından belirlenir | PARTIAL | Scheduler ve legacy deployment zincirini production’da doğrula. |
| WebSocket event'i state değiştiremez | PASS | Repo’da broadcasting channel/event, Reverb/Pusher/Echo veya socket state handler bulunmadı; state API command/polling akışından geçiyor. |
| Immutable wallet ledger | PARTIAL | Tüm ekonomik yazarlar ve production ledger şeması için deployment kanıtı topla. |

## KALAN BULGULAR

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

## SIRALI KALAN FIX PLANI

### PHASE 1 — Settlement recovery

1. Unique ledger referanslarını ve queue retry rollback’ini doğrula.
2. Reconciliation alarmı ve güvenli worker retry smoke testi ekle.

### PHASE 2 — Web hardening


1. CSP Report-Only ihlal envanterini tamamla.
2. CSP enforcing geçişini Playwright regresyonlarıyla doğrula.

## KAPSAM VE KISITLAR

- Production migration, gerçek kullanıcı/coin/bakiye işlemi veya destructive test yapılmadı.
- Secret, token ve gerçek hesap değerleri rapora yazılmadı.
- SQLite testleri MySQL/InnoDB lock/constraint garantisi sayılmadı.
