# TavlaTV — SECURITY + SERVER-AUTHORITATIVE ARCHITECTURE AUDIT
## Audit amendment — production Laravel-to-validator verification (2026-09-21)

On the deployed host, using PHP 8.3 and the configured `VALIDATOR_URL=https://validator.tavlatv.com`, `VALIDATOR_VERIFY_TLS=true`, and configured shared secret, `php artisan test --filter=ValidatorParityTest` passed **4 tests / 9 assertions**. This confirms the Laravel HTTP bridge reaches the protected validator over verified TLS and receives the expected legal/illegal move responses.

## Audit amendment — production validator secret guard fixed (2026-09-21)

After the Plesk runtime secret and Laravel `VALIDATOR_SECRET` were aligned, a secret-less `POST https://validator.tavlatv.com/validate` returned **401 Unauthorized**. The production validator no longer processes unauthenticated validation payloads. The secret value is not recorded.

## Audit amendment — validator unauthenticated validate confirmation (2026-09-21)

After the restart, a secret-less synthetic `POST /validate` request returned **400** from validator input processing rather than the expected **401/503** guard response. This confirms the production process is still accepting unauthenticated endpoint processing; the CRITICAL secret-guard finding remains open.

## Audit amendment — production validator secret guard failure (2026-09-21)

**CRITICAL deployment finding:** a production request without `x-validator-secret` to `POST https://validator.tavlatv.com/restart` returned **200** and `{"ok":true,"restarting":true}`. The service restarted and its health endpoint returned 200 afterward. The repository's current `validator/server.ts` is expected to return **503** when `VALIDATOR_SECRET` is missing and **401** for an incorrect secret, so the deployed process/configuration does not match the audited source or its secret guard is not active. Until this is corrected, an unauthenticated party can restart the validator and potentially invoke internal endpoints.

**Required deployment action:** set a strong `VALIDATOR_SECRET` in the validator runtime and the Laravel environment, deploy the current validator build, restart it through Plesk, then verify that requests without the header return 401/503 and only the matching secret permits `/validate`, `/legal-moves`, and `/restart`. The secret value is intentionally not recorded here.

## Audit amendment — static validation recheck (2026-09-21)

`npm run typecheck`, `npx oxlint src`, `npx oxlint validator`, and `composer validate --no-check-publish` completed successfully. The full `npm run lint` command remains non-zero because untracked helper files under `scripts/` contain existing `var` lint errors; product source findings are warnings only. Those unrelated helper files were not modified.

## Audit amendment — dependency audit recheck (2026-09-21)

The repository root `npm audit --omit=dev` completed with **0 vulnerabilities**, and `backend/composer audit --no-interaction` reported **No security vulnerability advisories found**. The `validator/` project has no lockfile, so its audit remains **UNKNOWN** without generating a new lockfile or installing dependencies.

## Audit amendment — validator TLS corrected (2026-09-21)

Plesk'te sertifika düzeltildikten sonra normal TLS `GET /health` **200 OK** döndü. `VALIDATOR_VERIFY_TLS=true` ile `ValidatorParityTest` **4 test / 9 assertion** geçti.

## Audit amendment — validator production-mode recheck (2026-09-21)

The validator was rechecked with `VALIDATOR_URL=https://validator.tavlatv.com`, the configured loopback backup, and `VALIDATOR_VERIFY_TLS=true`. All four parity cases passed (**4 tests / 9 assertions**): legal opening moves are accepted, an unrolled die is rejected, an empty-point move is rejected, and legal-moves returns a non-empty set. No TLS bypass was used for this run.

## Audit amendment — canonical command replay response (2026-09-21)

Authoritative command receipts now persist the canonical JSON response and HTTP status after a successful `roll`, `move`, cube, or `resign`. Repeating the same `(room_id, command_id)` returns that stored response without applying state again; payload mutation still returns `409`. The migration is `2026_09_22_010000_add_response_to_room_commands.php`. `RoomCommandIdempotencyTest` passes **4 tests / 22 assertions**.
## SECURITY SUMMARY

| Severity | Bulgu sayısı |
|---|---:|
| Critical | 4 |
| High | 11 |
| Medium | 8 |
| Low | 1 |

**Sonuç: Money-game güvenlik sınırı mevcut haliyle sağlanmıyor.** Sunucu motoru bulunmasına rağmen legacy state güncellemesi, alternatif katılma yolları, istemci kaynaklı sonuç/ödül üretimi ve ortak bir finansal işlem modelinin bulunmaması bu otoriteyi deliyor. Öncelik SEC-001–008 olmalıdır. Bu rapor düzeltme uygulamaz.

**Tarih:** 19 Eylül 2026. **Son kontrol sırasında HEAD:** `1df55780f62ca830693fa3fe94a96145cb16b9ef`.

Audit başlangıcında değiştirilmiş/untracked uygulama dosyaları vardı. İnceleme sırasında dışarıdan commit ve bot/scheduler değişiklikleri oluştu; kritik yollar tekrar okundu. Bu nedenle dosya referanslarında **metot adı esas**, satır numarası yardımcıdır. Bu çalışma uygulama kodu, dependency manifesti veya migration değiştirmedi; migration, seed, deployment, scheduler, finansal işlem veya production HTTP testi çalıştırmadı. Oluşturulan teslim dosyası bu rapordur. Araçların olağan geçici cache/log çıktıları olabilir.

### Kanıt standardı ve sınırlar

- **PASS:** İncelenen dar özellik için zincir/constraint veya doğrudan test kanıtı var; tüm sistem için otomatik onay değildir.
- **FAIL:** Ulaşılabilir kod yolu invariant'ı ihlal ediyor; HTTP ile canlı exploit yapılmış olduğu anlamına gelmez.
- **PARTIAL:** Bazı yollar korumalı; bütün giriş yolları, atomiklik veya ortam garantisi tamamlanmamış.
- **UNKNOWN:** İncelenen kaynaklardan veya güvenli testlerden kanıtlanamadı.
- Bulgularda **statik zincir**, **bellek içi doğrulama**, **koşullu risk** ayrıldı. Gerçek MySQL/InnoDB eşzamanlı 10–50 bağlantı testi yapılmadı. SQLite testinin `FOR UPDATE` garantisini kanıtlamayacağı özellikle dikkate alındı.
- Production şeması, uygulanmış migration listesi, isolation level, DB engine, Redis erişim sınırı, reverse proxy, çalışan servislerin environment değerleri, TLS/HTTP başlıkları ve mevcut hesap bakiyeleri **UNKNOWN**. Migration dosyasının bulunması production'a uygulanmış olduğunu göstermez.
- Özel anahtar/token/parola değerleri rapora alınmadı. `.env` içeriği veya gerçek hesap verisi rapor için çıkarılmadı.

## SERVER AUTHORITATIVE CHECKLIST

| Kritik invariant / kontrol | Durum | Kanıt / açıklama |
|---|---|---|
| Aynı user aynı anda birden fazla ACTIVE/PLAYING money match'te oyuncu olamaz | **PARTIAL** | Matchmaking'de user-row lock + transaction içi aktif oda kontrolü var; ekonomik direct join/enter kapalı. Ancak DB claim/unique invariant yok, tarihsel bozuk satırlar ve rematch/diğer admission yolları gerçek DB paralel testiyle kanıtlanmadı. SEC-005. |
| Aynı match + aynı user duplicate participant olamaz | **PARTIAL** | `RoomAccess` iki koltuğu aynı hesaba bağlayan satırı fail-closed reddediyor ve yeni ekonomik katılım kısıtlı; mevcut DB için `UNIQUE(match_id,user_id)` benzeri koruma yok. SEC-006. |
| Aynı match iki kez settle edilemez | **PARTIAL** | `settled=false` claim, finished/version yazımı, user lock ve coin transferi aynı transaction'da; retry'de coin yok. Kalıcı settlement ledger, queue recovery ve production engine doğrulaması yok. SEC-011. |
| Aynı game action iki kez uygulanamaz | **FAIL** | Command ID yok; resign tekrarları sonraki oyuna puan yazabiliyor. SEC-010. |
| Client game result belirleyemez | **PARTIAL** | Rating ve turnuva sonucu artık verified server state ister; legacy update ve tüm sonuç tüketicileri için tam canonical zincir henüz tamamlanmadı. SEC-001–003. |
| Client wallet balance değiştiremez | **PARTIAL** | Settlement winner client'tan alınmıyor ve wheel/slot reserved coin harcayamıyor; ortak immutable coin ledger ve tüm ekonomi yollarının tek transaction protokolü yok. SEC-002–003. |
| Client dice sonucunu belirleyemez / avantaj elde edemez | **PARTIAL** | Authoritative roll client zarını kabul etmiyor ve legacy state korundu; tüm eski odalar/commit-reveal ve CSPRNG production kanıtı tamamlanmadı. SEC-001. |
| Authenticated user maç oyuncusudur | **PASS (dar oyun komutları)** | `RoomAccess` authenticated user ID'yi oda koltuğuyla eşliyor; token tek başına hesap impersonation yapamıyor. WebSocket/legacy dış tüketiciler ve gerçek HTTP entegrasyonu ayrıca doğrulanmalı. SEC-007. |
| Legal move, maksimum zar kullanımı, sıra | **PARTIAL** | `move → MoveValidatorService → validateTurn` kontrolü var ve motor testleri geçti; alternatif state/clock yolları ve terminal-state kontrolü eksik. |
| Board, gammon/backgammon, skor | **PARTIAL** | Normal `move` sonucu `Backgammon::winner/gamePoints` ile hesaplanıyor; tüm sonuç tüketicileri bunu kullanmıyor. |
| Cube value/owner, take/drop | **PARTIAL** | Kilitli server_match güncellemesi ve rakip yanıt kontrolü mevcut; command version/idempotency ve oturum bağı eksik. |
| Stake başlangıçta sabitlenir | **PARTIAL** | Normal matchmaking ortak stake'i belirliyor; yüzde bahis settlement anındaki bakiye üzerinden hesaplanıyor, join/enter escrow atlıyor. |
| RNG gizli ve adil | **PARTIAL** | `random_bytes(32)` + HMAC mevcut; seed sızıntısı ve modulo bias var. |
| Bir turda tek roll | **PARTIAL** | Room lock + dolu dice'ı tekrar döndürme mevcut; terminal-state/legacy bypass kapsam dışı kalıyor. |
| Stale request/version reddi | **PARTIAL** | Authoritative roll/move/cube/resign için opsiyonel `expected_version` transaction içindeki server sürümüyle karşılaştırılıyor; legacy/alan göndermeyen istemci ve kalıcı command ID kapsam dışı. |
| Timeout/AFK yalnız sunucudan | **FAIL** | Saat hesaplaması sunucuda, ama girdisini public legacy update değiştirebiliyor. |
| WebSocket channel authorization | **UNKNOWN / uygulanmıyor** | Uygulamada oyun WebSocket handler/channel bulunmadı; HTTP polling kullanılıyor. Production harici servis varlığı UNKNOWN. |
| Admin endpoint server-side korunur | **PARTIAL** | REST middleware, panel middleware ve Filament kontrolü mevcut; email tabanlı admin türetimi güvenli değil. |
| Immutable coin ledger | **FAIL** | WXP ledger'ı var; coin için tüm değişiklikleri kapsayan ledger yok. |
| Production güvenli yapılandırma | **UNKNOWN** | Canlı altyapı ve veri sorgulanmadı. |

### Uygulama sonrası durum eki — Faz 0–2

Bu rapor ilk keşif durumunu ve bulguların kök nedenlerini korur. Sonraki yerel düzeltmelerden sonra kritik checklist durumları yukarıda güncellenmiştir. `RoomAccess`, `EnsureActiveAccount`, verified server result kontrolleri ve matchmaking user-row lock'ları uygulanmıştır. Bu değişiklikler migration çalıştırmadı ve production şemasının claim/unique korumasını kanıtlamaz. Bu nedenle eski SEC-005/006/007 bulgu metinleri tarihsel saldırı yolunu açıklamaya devam eder; güncel karar için checklist ve `SECURITY_FIX_STATUS.md` esas alınmalıdır.

Rövanş admission'ı da güncellendi: tamamlanmamış veya settlement bekleyen oda yeni money/ranked oda üretemez; yeni oda transaction'ı iki participant hesabını kilitleyip ban/aktif-match kontrolü yapar. Bu kontrol gerçek production DB paralel testi veya kalıcı claim constraint'i yerine geçmez.

Admin savunması da güncellendi: banlı explicit admin için hem API middleware/controller hem web panel session/SSO giriş yolları reddediliyor. Bu, coin değişikliklerinin admin yoluyla yapılabilmesi için aktif ve yetkili hesap şartını korur; immutable wallet ledger ve admin action audit trail hâlâ eksiktir.

Ödeme fulfillment'ı da güncellendi: payment claim, kullanıcı kilidi ve coin/üyelik/ürün fulfillment'ı tek transaction içinde. Retry aynı payment için no-op olur; payment `paid` olup ekonomik fulfillment'ın yarıda kalması durumunda yeniden deneme mümkün kalır.

## 1. Attack surface ve trust boundary haritası

### Bileşenler

| Bileşen | Giriş / sorumluluk | Güven sınırı |
|---|---|---|
| React/Vite | `src/App.tsx`, `src/api.ts`, `src/engine/*`, `src/online/*` | Tamamen değiştirilebilir istemci. Local engine sadece öneri/önizleme olarak kabul edilmeli. |
| Laravel API | `backend/routes/api.php`, `bootstrap/app.php` | API grubunda SiteGate ve ShieldTracker; yalnız belirli route grubunda `auth:sanctum`. |
| Oda API | `RoomController`, `Room` | Oyun route'ları Sanctum grubunun dışında. Creation/matchmaking kimliği isteğe bağlı Sanctum'dan; action yetkisi payload token'ından. |
| Auth / profil | `AuthController`, `User`, Sanctum PAT | Bearer token ile hesap kimliği; profil email alanı ve admin accessor kritik. |
| Node validator | `validator/server.ts`, `MoveValidatorService`, `src/engine/validateTurn.ts` | Backend authoritative state gönderir; servis cevabı yeni state olarak güvenilir kabul edilir. |
| GNUbg | `gnubg-service/gnubg_service.py`, `GnuBgClient`, `BotMoveService` | Analiz ve bot hamlesi; ayrı process, HTTP ve shared secret. |
| Coin ekonomisi | `users.coins`, `coins_reserved`, Room/Shop/Product/Payment/Tournament/Spin/Achievement kodları | Ortak WalletService/coin ledger yok; birçok bağımsız bakiye yazarı var. |
| Maç sonucu / Elo | `reportRating`, `RoomResult`, `ForfeitLoss`, `MatchBackstop` | Sunucu sonucu ile client raporu bir arada; ayrı kilit/transaction yaklaşımları. |
| Queue | `AnalyzeMatchPrJob`, `AnalyzeMatchLuckJob`, `QueueHeartbeatJob` | DB queue açıkça seçilen analiz işleri var; tekrar çalıştırma dikkate alınmalı. |
| Scheduler | `routes/console.php` | Cleanup, result backstop, stale-room reap, bot clock tick, service watch, heartbeat. |
| Admin REST | `auth:sanctum → admin → controller is_admin` | Coin/rating/rol/ban/ayar değişikliği. |
| Blade panel | `routes/web.php`, `PanelController`, `EnsureAdmin` | Cookie session; ayrı login ve token-query SSO. |
| Filament/Livewire | `AdminPanelProvider`, resource/page sınıfları | Auth + CSRF + `User::canAccessPanel`; form ile privileged alan yazımı. |
| Banka | Signed checkout URL + `/pay/callback`, `GarantiService` | Banka hash doğrulama ve server-side ürün fiyatı; fulfillment atomikliği ayrı sorun. |
| Public replay/content/upload | GameLog, CMS, BugReport | Public yazılabilen replay ile sunucu audit verisi birbirine karıştırılmamalı. |

Redis'e özel oyun lock veya broadcast kodu bulunmadı. `config/cache.php` ve `queue.php` Redis seçeneği içeriyor; varsayılanları database. Etkin production sürücüsü doğrulanmadı. Policy klasörüne dayalı merkezi match authorization yerine controller içi kontroller kullanılıyor. Oyun domain'inde broadcast event/listener zinciri bulunmadı; authoritative state HTTP cevabı ve `showRoom` polling ile yayılıyor.

### İstemci akışı

`src/api.ts::playerToken()` aynı browser için localStorage'da kalıcı token üretir; üretimde `Math.random()` kullanılır. Hesap bearer token'ı ile bu token farklı kimliklerdir. Oyun komutları `token`, hamle için `steps`, cube için `action`, resign için `resign_type` gönderir. `showRoom` token'ı query string'e de koyar. `App.tsx` yaklaşık 1200 ms polling, local in-flight ref'leri ve authoritative modda legacy PUT atlama davranışı içerir. Bunlar server enforcement değildir.

### Action zincirleri

Tüm oda yollarında API middleware vardır; aşağıdaki “seat token” ifadesi **Sanctum kullanıcı doğrulaması anlamına gelmez**.

| Action / endpoint | Kimlik / yetki | Validation → engine → persistence → client | Sonuç |
|---|---|---|---|
| `POST /api/matchmaking` | Optional Sanctum ile user ID | Stake/targets doğrulanır; aday room transaction/lock; fixed stake user lock; room save → JSON | Aday seat claim iyi; user aktiflik claim'i ve self-match koruması eksik. |
| `POST /api/rooms`, `/bot/rooms` | Optional Sanctum + client token | Friendly/bot room; bot authoritative; JSON | Hesaba bağlı seat credential yok. |
| `POST /api/rooms/{code}/join`, `/enter` | Token eşleşirse mevcut seat; yoksa optional Sanctum | Room read → IF → p2 save; transaction/room lock yok | Host busy, self-seat, stake reserve, expected invitee kontrolü eksik. |
| `POST .../roll` | Seat token; bot p2 engeli | Room `FOR UPDATE`; server seed/HMAC; sıra/pending cube/dolu dice kontrolü; save → JSON/poll | Aynı tur reroll engeli var; status/done için merkezi terminal guard yok. |
| `POST .../move` | Seat token; bot p2 engeli | Room lock; sıra/dice/cube; validator legal steps + tüm tur zorunluluğu; server winner/points; save | Board client'tan alınmıyor; stale command kimliği yok. |
| `POST .../cube/offer` | Seat token | Room lock; cubeAvailability; server pending/value/owner; save | Temel kurallar server'da. |
| `POST .../cube/respond` | Seat token + offerer'ın rakibi | `take/drop`; lock; server cube veya game result | Aktif teklif tekrarını state engeller; eski farklı teklif replay'i kimlikle ayırt edilmez. |
| `POST .../resign` | Seat token | Lock; match.done kontrolü; board'dan resignationValue; applyGameResult | Aynı request sonraki oyunu da resign edebilir. |
| `POST .../leave` | Seat token | Kilitsiz read; clock.end ABANDON → applyClockEnd → save | Move/finalization ile yarışır. |
| `GET .../{code}` | Public; isteğe bağlı seat token presence | Kilitsiz room read → tickClock → olası result/save → client state | Salt okuma değildir; timeout kararının kilit disiplini eksik. |
| `PUT .../{code}` | Seat token | Client state/status → clock → room save | Authoritative odada da kabul: ana bypass. |
| `POST .../live` | Seat token | Client steps/seq → `live` JSON save | Cosmetic; server_state değiştirmiyor. Sıra/revision doğrulaması ve boyut sınırı eksik. |
| `POST .../chat` | Seat token | Mesaj doğrulama; JSON mesaj listesi save | Hesap kimliğiyle bağlanmıyor; concurrent write kaybı mümkün. |
| `POST .../watch`, `GET /live-matches` | Public | Viewer presence/public projection | Public izleme tasarımı; private oda ayrımı yok. |
| `POST .../settle` | Seat token | `won` beyanı yazılır; staked sonuç yalnız server_match; CAS claim + user locks + coin/commission TX | Client doğrudan payout seçemez; finalization ve recovery bütünleşik değil. |
| `POST .../rematch` | İki seat token kabulü | Busy kontrolü TX dışında; old-room lock; reserve; new room | Aynı old room için new code claim var; user invariant atomik değil. |
| `POST /api/rating/report` | Sanctum | Client report → nullable authoritative result → fallback → Elo/result/WXP/achievements | Client sonuç ve reward etkisi kabul ediliyor. |
| `POST /api/tournaments/{tournament}/report` | Sanctum + bracket üyeliği | Tournament lock → room state veya client winner → prize transaction | Kaynak otoritesi hatalı; transaction hileli girdiyi düzeltmez. |
| `POST /api/game-logs` | Public | uid/slot/events/winner/score → mevcut log overwrite | Ownership yok. |

## 2. Ayrıntılı bulgular

### SEC-001 — Legacy PUT, authoritative maçı ve zar gizliliğini deliyor

- **ID:** SEC-001
- **Severity:** CRITICAL
- **Category:** Server authority / RNG disclosure / business logic
- **Affected file(s):** `backend/app/Http/Controllers/RoomController.php:1140` (`update`, `roll`, `tickClock`, `applyClockEnd`); `backend/app/Models/Room.php:153`; `backend/app/Services/MatchClock.php::onUpdate`.
- **Affected endpoint/event:** `PUT /api/rooms/{code}`, `GET /api/rooms/{code}`, `POST .../roll`.
- **Description:** `update` authoritative odaları reddetmez. `state` ve `status=playing|finished` doğrudan yazılır. `toClient` seed'i yalnız room.status üzerinden açar; gerçek `server_match.done` aranmaz. Aynı state ayrıca sunucu saatini sürer.
- **Attack scenario:** Kendi aktif odasında seed üretildikten sonra oyuncu PUT ile `status=finished` yapar, GET ile seed'i alır, PUT ile playing'e döner. Client seed'i boş/bilinen olan akışta HMAC algoritması ile gelecekteki zarları hesaplayabilir. Ayrı olarak `matchOver=true` içeren state, sıra sahibi olmayan katılımcıdan bile clock.running'i false yapabilir. Sıra sahibi sahte turn/cube/turnsPlayed alanlarıyla clock segmentini değiştirebilir.
- **Root cause:** Frontend'in legacy PUT göndermemesi server-side access control sayılmış; sonuç/seed lifecycle'ı ayrı client-yazılabilir status'a bağlanmış.
- **Evidence:** `update` state/status ataması ardından `MatchClock::onUpdate` çağırıyor. `Room::toClient` koşulu `status === 'finished'`. Bellek içi gerçek model testi: `server_match.done=false` iken `unfinished_match_seed_revealed=true`; gerçek clock sınıfı testi: `non_active_player_can_stop_clock=true`. `/roll` başlangıcında status/done guard yok. HTTP exploit uygulanmadı.
- **Potential impact:** Gelecek zar bilgisiyle bahisli maç avantajı, timeout/AFK manipülasyonu, aktiflik ve yüzde-bahis harcama guard'larının bypass'ı. Doğrudan `server_state` PUT overwrite iddiası değildir; yan kanallar yeterlidir.
- **Recommended fix:** Authoritative/value-bearing tüm odalarda legacy PUT'u server'da kapat; metadata gerekiyorsa ayrı allowlist endpoint. Status, clock ve seed reveal yalnız canonical terminal transition'dan gelsin. Açılmış seed ile oyun sürdürülmesini kesin reddet.
- **Database protection required?:** Evet; immutable terminal transition, room revision CAS/lock, reveal/finalized tutarlılığı. Tek CHECK tek başına bütün lifecycle'ı çözmez.
- **Regression test required?:** Evet; unfinished+finished PUT, seed GET, tekrar playing, rakipten clock stop/turn spoof ve 2-tab race.

### SEC-002 — Sahte rating raporu oyun oynamadan Elo, WXP ve achievement coin üretir

- **ID:** SEC-002
- **Severity:** CRITICAL
- **Category:** Untrusted result / reward forgery / BOLA
- **Affected file(s):** `backend/app/Http/Controllers/AuthController.php:266` (`reportRating`, `serverResultForRoom`, yaklaşık 680: extra achievement inputs); `backend/app/Support/RoomResult.php:23`; `backend/app/Services/Achievements/StatsUpdater.php:27`; `AchievementService.php::unlock`; `backend/app/Services/WxpService.php`; `backend/config/achievements.php`.
- **Affected endpoint/event:** `POST /api/rating/report`.
- **Description:** `room_code` opsiyonel, `ranked` varsayılan true. Oda yoksa, sonuç bitmemişse veya caller oyuncu değilse resolver null döner; caller reddedilmek yerine client `won` beyanı kullanılabilir. AI etiketi de client'tan gelir. Ayrıca validation dışından `gammons`, `backgammons`, `ach_flags`, `min_win_prob` okunur.
- **Attack scenario:** Bir hesap oda belirtmeden `won=true`, uygun match_type/length ve opponent_rating ile raporlar. Yeni sonuç satırları üzerinden WXP/win sayaçları artar. Sahte gammon/event alanları achievement koşullarını sağlar; `unlock` coin reward'u hesaba işler. Başkasının oda koduyla sahte üçüncü sonuç satırı oluşturma yolu da vardır.
- **Root cause:** Sunucu sonucu yokluğu “reddet” yerine client fallback anlamına geliyor; ölçülen oyun olayları ile client telemetrisi ayrılmamış.
- **Evidence:** `won=$clientWon` (334–335), null resolver sonrasında engelleyici return yok; 447–462 rating save; 593 MatchResult create; 636 sonrası WXP; extra request inputs → StatsUpdater → AchievementService::evaluate → transaction içinde `increment('coins', $coin)`. Null room_code için unique dedup koruması yok.
- **Potential impact:** Sahte skor/geçmiş, sıralama/lig manipülasyonu, katalog limitlerine kadar haksız coin ödülü. Bu, keyfi miktarda sınırsız doğrudan balance ataması olduğu anlamına gelmez.
- **Recommended fix:** Report endpoint yalnız server-finalized ve caller'a ait match'in projection/analysis isteği olsun. Elo/WXP/achievements server event'inden hesaplanmalı; client flags ödül üretmemeli. Oda yok/oyun bitmemiş/not participant açıkça reddedilmeli.
- **Database protection required?:** Evet; sonuçların authoritative match FK'sı, unique match/user, ödül kaynak claim'i, aynı transaction'da ledger.
- **Regression test required?:** Evet; missing/fake/other-user room, unfinished room, fake AI label, fabricated gammon/flags, 100 replay.

### SEC-003 — Turnuva kazananı istemciden kabul edilerek prize coin ödenebilir

- **ID:** SEC-003
- **Severity:** CRITICAL
- **Category:** Economic business logic / result forgery
- **Affected file(s):** `backend/app/Http/Controllers/TournamentController.php:179`, `winnerIdFromRoom:461`, `applyWinnerToBracket:241`, `payPrizes:510`.
- **Affected endpoint/event:** `POST /api/tournaments/{tournament}/report`.
- **Description:** Caller'ın bracket oyuncusu olması kontrol edilir; fakat gerçek sonucun varlığı zorunlu değildir. `$authWinner` null ise request winner_id kullanılır. Resolver authoritative server_match yerine legacy `room.state.match.score` okur.
- **Attack scenario:** Bracket'teki oyuncu maç oynanmadan kendini winner bildirir; sonraki tura ilerler. Finalde aynı davranış server prize dağıtımına ulaşır. Legacy state enjeksiyonu alternatif sahte kaynak olabilir.
- **Root cause:** Participant authorization, sonucu belirleme yetkisiyle karıştırılmış; eski room state kaynağı kullanılıyor.
- **Evidence:** `report` içinde ternary fallback `(int) $data['winner_id']`; `applyWinnerToBracket` final dalında `payPrizes` ve prize_paid=true; ödüller users.coins artırıyor. Tournament row lock ödemenin tekrarını sınırlar, beyanın doğruluğunu sağlamaz.
- **Potential impact:** Turnuva/ödül havuzu çalınması ve gerçek oyuncuların elenmesi.
- **Recommended fix:** Finalized authoritative room + bracket seat eşleşmesi zorunlu; winner_id sadece intent bile olmamalı. No-show ayrı server deadline ve atomik room/tournament kontrolüyle işlenmeli.
- **Database protection required?:** Evet; bracket-match ilişkisi, unique result/prize reference, finalization/ledger transaction.
- **Regression test required?:** Evet; başlamamış/bitmemiş maç report, other match, forged legacy score, duplicate final.

### SEC-004 — Doğrulanmamış email üzerinden koşullu admin yükseltmesi

- **ID:** SEC-004
- **Severity:** CRITICAL
- **Category:** Privilege escalation / authentication
- **Affected file(s):** `backend/app/Models/User.php::getIsAdminAttribute`; `backend/app/Http/Controllers/AuthController.php::register/updateProfile`; `backend/app/Http/Middleware/EnsureAdmin.php`; `backend/config/services.php` (`admin_emails` anahtarı).
- **Affected endpoint/event:** `POST /api/register`, `PUT /api/profile` → admin REST/panel/Filament.
- **Description:** is_admin, DB flag false olsa bile email config listesinde ise true. Email sahipliğinin doğrulanması aranmaz. Kayıt/profil email kabul eder; güncelleme verified_at sıfırlamaz.
- **Attack scenario:** Config admin listesinde DB'de kullanılmayan bir adres varsa saldırgan o email ile kayıt olur veya profilini o adrese değiştirir. Doğrulama tamamlanmadan admin accessor true olur. Tüm config adreslerinin mevcut başka hesaplarca tutulması unique-email nedeniyle bu belirli yolu engelleyebilir; production durumu UNKNOWN.
- **Root cause:** Kullanıcı tarafından değiştirilebilir tanımlayıcıdan ayrıcalık türetmek.
- **Evidence:** Gerçek User modelini, sentetik config ve `is_admin=0,email_verified_at=null` ile çalıştıran DB'siz test `unverified_config_email_grants_admin=true` verdi. Public validation email alıyor; middleware aynı accessor'a güveniyor.
- **Potential impact:** Önkoşul sağlanırsa tam admin yetkisi, coin/rol/ayar değişikliği. Canlı admin adreslerinin boşta olduğu iddia edilmiyor.
- **Recommended fix:** Admin rolünü yalnız immutable user ID/explicit role grant üzerinden kur; bootstrap-admin atamasını public register/profile'dan ayır. Email değişiminde yeniden doğrulama ve hassas işlem için reauthentication.
- **Database protection required?:** Rol grant audit kaydı ve unique rol üyeliği; email unique tek başına yeterli değil.
- **Regression test required?:** Evet; boşta config-email ile unverified register/profile, email değişikliği ve admin role lifecycle.

### SEC-005 — Tek aktif money match invariant'ı server/DB düzeyinde yok

- **ID:** SEC-005
- **Severity:** HIGH
- **Category:** Concurrency / economic invariants
- **Affected file(s):** `RoomController.php::userInStakedPlaying`, `matchmaking:165`, `join:813`, `enter:864`, `rematch`, `openRematchRoom:1029`; room migrations.
- **Affected endpoint/event:** Matchmaking, join, enter, rematch.
- **Description:** Busy kontrolleri ordinary EXISTS sorgusu. Canonical user başına aktif ekonomik maç sahipliği bulunmuyor. Join/enter yalnız yeni p2'yi kontrol ediyor; p1'in başka aktif maçı engellenmiyor.
- **Attack scenario:** A farklı tempo/kategorilerde X ve Y waiting bahis odaları açar. B X'e, C Y'ye kodla katılır. İki işlem ardışık bile olsa join A'nın diğer aktif odasını kontrol etmez. Ayrıca aynı hesabın iki farklı odaya concurrent join'inde iki EXISTS false olabilir. Rematch busy kontrolü old-room transaction'ından önce çalışır.
- **Root cause:** Tüm start yollarında ortak user lock/claim yok. Matchmaking aday room lock'u, farklı room'ların ortak user invariant'ı değildir. Fixed stake user lock alındığında busy kontrolü yeniden yapılmıyor; yüzde bahis user reserve lock'u da yok.
- **Evidence:** Room columns p1_user_id/p2_user_id index'leri non-unique; active-seat tablosu yok. Join yalnız `userInAnyPlaying($joinUserId,$room->id)` çağırır. Rematch check transaction dışında. Mevcut `RoomConcurrencyGuardTest` ardışık önceden-playing senaryolarıdır; iki gerçek DB bağlantısıyla race testi değildir.
- **Potential impact:** Aynı bakiye birden çok maç için riskte; short settlement, aktif maç/AFK karmaşası.
- **Recommended fix:** Bütün start yollarını tek servise al; transaction içinde sıralı user locks ve tekrar invariant kontrolü. `active_money_seats(user_id PRIMARY KEY, room_id FK)` claim'ini atomik oluştur; finalize/release aynı protokolü kullansın.
- **Database protection required?:** **Evet, zorunlu.** Ayrı p1/p2 unique index'leri cross-seat ve geçmiş maçları doğru modellemez; önerilen claim tablosu veya eşdeğer DB modeli gerekir.
- **Regression test required?:** Evet; 2 browser/2 session, 50 concurrent matchmake/join/rematch, waiting host başka maçta, fixed ve yüzde bahis.

### SEC-006 — Seat claim atomik değil; self-match ve stake admission bypass

- **ID:** SEC-006
- **Severity:** HIGH
- **Category:** Duplicate participant / BOLA / TOCTOU
- **Affected file(s):** `RoomController.php::matchmaking`, `join`, `enter`; `database/migrations/2026_08_22_020000_add_stake_to_rooms.php`; `2026_07_26_100000_create_rooms_table.php`.
- **Affected endpoint/event:** `POST /api/rooms/{code}/join|enter`, `/matchmaking`; turnuva oda girişleri.
- **Description:** p2 boşluk kontrolü ve write kilitsiz. p1_user_id != p2_user_id şartı yok. Matchmaking rakibi user ID yerine token farklılığı ile eliyor. Kodla join herhangi bir waiting/MM odasına uygulanabiliyor; ekonomik admit, escrow veya invited-user doğrulaması yok; `shouldAuthoritative(..., false)` kullanılıyor.
- **Attack scenario:** Aynı hesap farklı player token'larıyla iki seat'i alır. İki kullanıcı aynı boş p2'yi okur, iki yanıt da başarılı olur ve son save öncekinin seat'ini ezer. Bir kullanıcı staked MM odasına normal matchmaking yerine join ile girdiğinde yeterli bakiye/rezerv şartından geçmez. Misafir de bu yolu deneyebilir; missing user halinde settle ödeme yapmaz fakat maçı bozabilir.
- **Root cause:** Genel kodla giriş ile ekonomik matchmaking aynı admission service'e bağlı değil.
- **Evidence:** `join/enter` içinde transaction/lock yok; yalnız p2_token doluluk IF'i var. Matchmaking `where('p1_token','!=',...)`, user eşitsizliği yok. Room user kolonlarında FK/CHECK yok.
- **Potential impact:** Maç kaçırma, iki oturumun farklı seat algısı, kendi kendine ranked maç, rezervsiz money room, davet/turnuva seat işgali.
- **Recommended fix:** Room lock altında allowed status + distinct authenticated users + economic admit + expected invitee kontrolü; reconnect yeni join'den ayrılmalı. Tournament matchRoom code claim'i de tournament lock ile yapılmalı (şu anda read/save yarışı var).
- **Database protection required?:** Evet; distinct non-null user CHECK; normalize katılımcılarda UNIQUE(room_id,user_id), UNIQUE(room_id,seat), FK; room code UNIQUE korunmalı.
- **Regression test required?:** Evet; same user/different token, concurrent p2 claim, money room direct join, guest/invitee bypass, tournament duplicate code.

### SEC-007 — Money action yetkisi Sanctum session'a bağlı değil

- **ID:** SEC-007
- **Severity:** HIGH
- **Category:** Broken authentication / stale session
- **Affected file(s):** `backend/routes/api.php` oda grubu; `RoomController.php::slotOf:2762`, `settle`; `src/api.ts::playerToken`, `showRoom`, `leaveRoom`; `AuthController::logout`.
- **Affected endpoint/event:** Roll/move/cube/resign/leave/update/chat/live/settle ve reconnect.
- **Description:** Client'in seçtiği kalıcı player token tek başına seat credential. `authenticated_user_id ∈ match.players` her komutta yapılmıyor. Logout yalnız Sanctum PAT siler, room token'ını iptal etmez.
- **Attack scenario:** Aynı browser'da eski tab/logout sonrası elde kalan player token oyun komutlarını sürdürebilir. Token sızarsa başka hesapla veya bearer olmadan ilgili seat oynatılabilir. Yeni cihaz yeni token üretir; sunucu güvenli “hesabımın seat'ine yeniden bağlan” transferi uygulamaz.
- **Root cause:** Guest capability kimliği gerçek coin sahibi hesapla bağlanmamış; server-generated, scoped, expiring/revocable game credential yok.
- **Evidence:** Oda routes auth grubundan önce; `slotOf` yalnız string eşitliği. Client token max uzunluk dışında entropy/minimum şartı yok; frontend Math.random kullanıyor, rematch token'ı taşıyor. `showRoom` credential'ı query'ye ekliyor.
- **Potential impact:** Stale session/ban/logout bypass; token ele geçerse rakip yerine action. Yalnız match_id bilmek write yetkisi sağlamıyor; token tahmin edilebilirliği gerçek kullanıcı üzerinde test edilmedi.
- **Recommended fix:** Money commands için Sanctum auth + ban check + seat user eşitliği zorunlu. Guest odaları ekonomik domain'den ayır. Gerekirse server-generated scoped nonce/session generation ile eski tabları iptal et; token query yerine header kullan.
- **Database protection required?:** Session generation/revocation ve user-seat FK; action ownership persisted olmalı.
- **Regression test required?:** Evet; bearer yok/yanlış kullanıcı, logout/revoke/ban sonrası room token, iki cihaz takeover, eski tab.

### SEC-008 — Çark/slot rezervli coin'i harcayabilir; yüzde bahis tutarı değişkendir

- **ID:** SEC-008
- **Severity:** HIGH
- **Category:** Wallet / escrow / double commitment
- **Affected file(s):** `backend/app/Services/LuckyWheel/LuckyWheelService.php:299–334`; `backend/app/Services/DiceSlot/DiceSlotService.php::spin` (~300–325); `RoomController::settle` (~464); `Room.php::userInPctStakedPlaying`.
- **Affected endpoint/event:** `/api/lucky-wheel/spin`, `/api/dice-slot/spin`, `/api/rooms/{code}/settle`.
- **Description:** Spin user row'u kilitler fakat affordability olarak toplam coins kullanır; coins_reserved düşmez ve yüzde bahis aktiflik kontrolü yok. Yüzde bahis settle anındaki bakiye ile hesaplanır; başlangıçta tutar snapshot/reserve edilmez.
- **Attack scenario:** Fixed stake rezervli kullanıcı paid spin ile kaybeder; bakiye rezervin altına iner. Settle `min(stake, balance)` ödediği için rakip eksik tahsil eder. Yüzde maç sürerken spin harcaması veya gelirleri payout'u değiştirir. Maç `finished` olduktan fakat settlement olmadan yüzde harcama guard'ı da false olur.
- **Root cause:** Coin yazarlarının ortak available-balance/hold kuralı yok; yüzde-bahis risk tutarı kesinleştirilmemiş.
- **Evidence:** Spin sorgusu `(int)$u->coins < $cost`, sonra coins-cost. Shop/Product yolları ise coins-reserved kullanıyor. Settle yüzde amount hesaplaması transaction anındaki kullanıcı balance'larından; loser debit min ile sınırlandırılır.
- **Potential impact:** Aynı coin hem rezerv hem spin finansmanı; net coin mint önlense de ekonomik sözleşmenin eksik ödenmesi.
- **Recommended fix:** Bütün debit'leri ortak wallet/hold servisine taşı. Yüzde tutarı başlangıçta snapshot ve hold olarak sabitle; hold'u settlement tamamlanmadan serbest bırakma.
- **Database protection required?:** Evet; per-match hold ledger, coins>=reserved>=0 CHECK veya eşdeğer account invariant; atomic debit.
- **Regression test required?:** Evet; maç sırasında spin/shop/order/tournament entry, finished-unsettled aralığı, eşzamanlı debit ve settlement.

### SEC-009 — Timeout/leave/poll yazarları game lock protokolünü izlemiyor

- **ID:** SEC-009
- **Severity:** HIGH
- **Category:** Race condition / state consistency
- **Affected file(s):** `RoomController.php::show`, `leave`, `tickClock:1247`, `reapStaleRoom`, `finalizeDead`, `applyClockEnd`; `backend/app/Console/Commands/ReapStaleRooms.php`, `TickBotClocks.php`.
- **Affected endpoint/event:** GET room polling, leave, move/roll ile eşzamanlı timeout, scheduler tick/reap.
- **Description:** Move/roll room lock altında olsa da clock/finalization yolları eski Eloquent room snapshot'ını okuyup kilitsiz save eder. Lock yalnız onu paylaşan writer'lar arasında koruma sağlar.
- **Attack scenario:** Poll eski clock/server_match okur; move commit eder; eski poll timeout sonucu üretip yeni match/clock bilgisini ezer. Leave ile kazandıran son hamle aynı şekilde yarışır. Scheduler withoutOverlapping yalnız aynı scheduled işi kapsar, HTTP writer'ı kilitlemez.
- **Root cause:** Bütün canonical state writer'larında ortak transaction + fresh locked read veya revision CAS yok.
- **Evidence:** `show → tickClock` önce `first()`; `tickClock` doğrudan save; `leave` IF'leri kilitsiz snapshot'ta. `applyClockEnd` server_match/server_winner/rating sonuçları üretir. Bu bir interleaving kanıtıdır; canlı iki-connection reproducer çalıştırılmadı.
- **Potential impact:** Yanlış winner/AFK, geri giden revision/clock, son hamlenin kaybolması, yanlış finansal sonuç.
- **Recommended fix:** Timeout/leave/scheduler dahil aynı command handler ve room lock; locked state üzerinde deadline değerlendirmesi; final-state write bir defa, eski revision reddi.
- **Database protection required?:** Evet; row locking/CAS ve terminal transition constraint/claim.
- **Regression test required?:** Evet; last move vs timeout, resign vs move, concurrent presence ticks, scheduler vs HTTP, rollback/deadlock.

### SEC-010 — Command idempotency yok; resign tekrarları başka oyunlara uygulanır

- **ID:** SEC-010
- **Severity:** HIGH
- **Category:** Replay / versioning / terminal-state enforcement
- **Affected file(s):** `RoomController.php::resign:2339`, `applyGameResult:1839`, `roll:1909`, `move:2070`, cube handlers; `src/api.ts` server action payload'ları.
- **Affected endpoint/event:** Resign, roll, move, cube offer/respond.
- **Description:** action_id/command_id/expected_version yok. Resign yalnız server_match var/done değil şartını arar; applyGameResult yeni oyunu hemen kurar. Aynı request ikinci kez geldiğinde sonraki oyuna uygulanır. Roll/move başlangıcında status=playing ve match.done=false ortak guard'ı da yok; applyGameResult bitmiş maçta bile opened=false yapar, roll açılış dalı done kontrolünden geçmez.
- **Attack scenario:** 7 puanlık maçta tek resign network retry ile 2→4 gibi tekrar puan üretir; yeterli tekrar maçı bitirir. Eski tab komutu sonraki uygun turn/teklife uygulanabilir. Bitmiş maçta roll yeni opening verisi yazabilir.
- **Root cause:** State-based repeat rejection, kullanıcı intent'inin kimliği yerine kullanılıyor; terminal state merkezi değil.
- **Evidence:** Gerçek applyGameResult metodunun DB'siz ardışık çağrısı `repeated_result_points=2->4`. Bu domain davranış testidir; endpoint replay kanıtı aynı kodun resign'de her çağrılması ve game_no/version kontrolünün bulunmamasıdır. Dolu dice tekrarında `/roll` aynı değeri döndüren olumlu koruma ayrıca mevcut.
- **Potential impact:** Tek intent ile birden çok oyun kaybı, skor/cube değişimi, stale tab etkisi ve terminal state bozulması.
- **Recommended fix:** Her command'a UUID, expected_revision ve game/turn scope; unique key altında persisted result ve NO-OP replay. Resign belirli game_no'ya bağlansın. Terminal match'te tüm game komutlarını reddet.
- **Database protection required?:** Evet; UNIQUE(room_id,command_id), expected revision CAS; command result ile state aynı TX.
- **Regression test required?:** Evet; 2/10/100 aynı command, farklı payload/same ID, sonraki turn replay, finished roll/move, take vs drop.

### SEC-011 — Settlement finansal transaction'ı var; uçtan uca finalization ve recovery yok

- **ID:** SEC-011
- **Severity:** HIGH
- **Category:** Settlement atomicity / recovery
- **Affected file(s):** `RoomController.php::settle:386`, `releaseEscrow`, `cleanupStale`; `backend/routes/console.php:17–24`; `backend/app/Support/MatchBackstop.php`; `ForfeitLoss.php`.
- **Affected endpoint/event:** Settle, finished-room backstop, stale cleanup/reap.
- **Description:** `settled=false → true`, loser debit, winner credit ve commission aynı transaction'da; bu doğru. Ancak winner önce kilitsiz belirlenir, status=finished transaction öncesi yazılır, Elo/sonuç/ödül başka akışlardadır. Normal server game completion otomatik coin settlement garantilemiyor. Scheduled cleanup eski room'ları escrow release yapmadan siler.
- **Attack scenario:** Finished status yazıldıktan sonra DB hatası olur: settled false kalır, otomatik ödeme işleyicisi yoksa client retry beklenir. Her iki client ayrılırsa coin ödenmeyebilir. Günlük yaş sınırını geçen escrowed room scheduled cleanup ile silinirse rezerv referansı kaybolur. Opportunistic cleanup release etse bile hakkı doğmuş payout'un yerini yalnız release alır.
- **Root cause:** Tek settlement state machine/outbox/reconciliation yok; cleanup ekonomik yükümlülükten habersiz.
- **Evidence:** Status UPDATE ~432 transaction ~446'dan önce; payout CAS ve tüm coin saves transaction içinde. `MatchBackstop` match_results/rating üretir, coin settle çağırmaz. `routes/console.php:22` doğrudan old rooms delete. Reap no-contest dalı rezerv bırakmaz. `escrowed` TX dışı snapshot'tan alınır; release/settle yarışında yeniden locked okuma da gerekli.
- **Potential impact:** Eksik/unutulmuş ödeme, kalıcı reserved balance, rating/coin/result ayrışması. Payout TX içindeki winner-credit/loser-debit hatasında rollback koruması vardır; bu korumanın olmadığı iddia edilmiyor.
- **Recommended fix:** Locked final state → immutable result → settlement claim/ledger → rating/outbox → FINALIZED. Hatalar retry edilebilir kalmalı. Cleanup sadece finalized/reconciled kaydı arşivlemeli; silmeden önce hold'lar kanıtlı kapalı olmalı.
- **Database protection required?:** Evet; UNIQUE(room_id,settlement_type), hold/reference FK, immutable result, outbox idempotency.
- **Regression test required?:** Evet; her write noktasında fault injection, DB timeout, settle/release yarışları, server restart, no-client completion, scheduled cleanup.

### SEC-012 — Payment paid claim ile coin/order fulfillment atomik değil

- **ID:** SEC-012
- **Severity:** HIGH
- **Category:** Payment atomicity / recovery
- **Affected file(s):** `backend/app/Http/Controllers/PaymentController.php::callback:406`, `fulfillDemo:372`, `fulfillCart`, `fulfillProductOrder`, `activateMembership`; `backend/app/Models/Payment.php`.
- **Affected endpoint/event:** `POST /pay/callback`, signed `/pay/submit/{payment}`.
- **Description:** Pending→paid koşullu update replay'i sınırlar; fakat bakiye/sipariş/üyelik fulfillment ile aynı DB transaction'da değildir. Payment modelinde bunu tamamlayan lifecycle observer yok.
- **Attack scenario:** paid claim commit olur, coin increment veya sepetin sonraki ürünü DB hatası verir. Retry pending şartını geçemez; müşterinin tahsilatı ile teslim edilen değer ayrışır. Failed callback dalı eski payment snapshot'ını save ederek eşzamanlı paid statüsünü de ezebilir.
- **Root cause:** “Bir defa claim” ile “atomik tamamlama” aynı sanılmış.
- **Evidence:** callback 451–474 ve demo 374 sonrası DB::transaction yok; claim ardından increment/fulfillment. Payment model yalnız fillable/casts/relation içeriyor. Signed checkout, bank hash ve server-price korumaları mevcut; bunlar recovery açığını kapatmıyor.
- **Potential impact:** Tahsilat var/coin yok, kısmi sepet, yanlış status ve operasyonel kayıp. Banka isteği veya gerçek ödeme testi yapılmadı.
- **Recommended fix:** Verified immutable bank event + payment lock; local fulfillment ve paid state aynı transaction; dış tahsilat için idempotent reconciliation. Failure update de koşullu/locked olmalı.
- **Database protection required?:** Evet; unique payment event/fulfillment/ledger reference.
- **Regression test required?:** Evet; claim sonrası crash, coin sonrası order fail, success/failure concurrent callback, tekrar delivery.

### SEC-013 — Elo/result dedup unique index, önceden yapılan rating write'ı geri alamaz

- **ID:** SEC-013
- **Severity:** HIGH
- **Category:** Concurrency / partial commit
- **Affected file(s):** `AuthController.php::reportRating:338–462,590–607`; `ForfeitLoss.php`; `MatchBackstop.php`; `2026_09_06_020000_add_unique_room_user_to_match_results.php`.
- **Affected endpoint/event:** Rating report; backstop/forfeit ile yarış.
- **Description:** Report cache lock başarısızlığında devam ediyor; lock kapsamı room+user, user'ın farklı raporları ortak değil. Rating önce save edilir, result sonra create edilir; duplicate create yakalanınca önceki write rollback olmaz.
- **Attack scenario:** Cache erişimi bozulur/lock süresi dolar veya backstop aynı sonucu yazar; report önceden rating/istatistik değiştirmiştir. Process rating save sonrasında çökerse tekrar rapor yeniden uygular. Farklı room raporları aynı kullanıcının eski rating snapshot'ını overwrite edebilir.
- **Root cause:** DB transaction ve user row lock olmadan finansal/rekabetçi projection update; cache lock fail-open.
- **Evidence:** Cache::lock exception → gotLock=true; rating save 462; result create 593; duplicate catch idempotent response döner. Backstop/ForfeitLoss DB user lock kullansa da report aynı protokole uymuyor.
- **Potential impact:** Çift/eksik Elo, wins/losses kaybı, result ile kullanıcı istatistiği ayrışması.
- **Recommended fix:** Authoritative finalization transaction'ı veya idempotent projection consumer; result claim önce, user fresh lock, rating/stat/result aynı TX. Cache bozukken güvenlik kontrolünü atlama.
- **Database protection required?:** Evet; mevcut unique korunmalı, atomic projection application claim eklenmeli.
- **Regression test required?:** Evet; report/report, report/backstop, report/forfeit, cache down, lock TTL aşımı, crash after user save.

### SEC-014 — Public game-log overwrite ile replay/forensic kayıtları değiştirilebilir

- **ID:** SEC-014
- **Severity:** HIGH
- **Category:** BOLA / data integrity
- **Affected file(s):** `backend/app/Http/Controllers/GameLogController.php::store`; `backend/routes/api.php`; `backend/app/Jobs/AnalyzeMatchLuckJob.php::handleOnlineFromGameLog`.
- **Affected endpoint/event:** `POST /api/game-logs`, `GET /api/game-logs/{uid}/mat`.
- **Description:** Public caller uid ve slot seçerek p1_events/p2_events, winner, score ve status yazabiliyor. Slot ownership/token kontrolü yok. Online uid public room code olduğundan capability-secret kabul edilemez.
- **Attack scenario:** Bir spectator public oda kodunu alır; p1 veya p2 slotu için mevcut log'u boş/sahte events ile overwrite eder. Canonical MAT export ve onu kullanan luck analizi kirlenir.
- **Root cause:** Client log tek-yazar varsayımı server'da doğrulanmamış.
- **Evidence:** Validation uid/slot alır; `firstOrCreate` ardından caller seçtiği kolon save edilir. Optional oda lookup yalnız metadata zenginleştirir. Job online GameLog kaynağını tüketir.
- **Potential impact:** Oynanmış maçın denetim/replay kanıtının yok edilmesi, yanlış analiz. Buradan doğrudan coin settlement değiştiği kanıtlanmadı.
- **Recommended fix:** Kanonik hamle logunu server command transaction'ında append et. Client telemetry ayrı, güvenilmeyen veri olarak saklansın; guest log server-generated scoped credential ile korunsun.
- **Database protection required?:** Evet; append-only action log, unique room/revision, actor FK; update yetkisi sınırlandırılmalı.
- **Regression test required?:** Evet; anonymous/third-user/other-slot overwrite, uid enumeration, oversized log, canonical export integrity.

### SEC-015 — Ortak coin ledger ve kritik admin işlem izi bulunmuyor

- **ID:** SEC-015
- **Severity:** HIGH
- **Category:** Wallet accounting / privileged operations
- **Affected file(s):** `AdminController::updateUser`, `PanelController::userUpdate`, `Filament/Resources/UserResource/Pages/EditUser.php:29`, `UserResource.php`; tüm coin writer'ları; `database/migrations/2026_09_06_040000_create_commissions_table.php`.
- **Affected endpoint/event:** Admin user update, Filament user edits, bütün debit/credit işlemleri.
- **Description:** Coin doğrudan users.coins üzerinde birçok yerden değişiyor. Commission/spin/achievement kayıtları parçalı; amount/balance_before/balance_after/reference/action_id kapsayan bütünlüklü immutable ledger yok. Admin mutlak bakiye ataması rezervi ve concurrent payout'u gözetmiyor; dedicated audit kaydı yok.
- **Attack scenario:** Admin adjustment stake rezervinin altına bakiye indirir veya settlement ile yarışıp yeni bakiyeyi overwrite eder. Sonradan farkın hangi işlemden kaynaklandığı tam yeniden üretilemez. Filament numeric coin alanında domain-level nonnegative/hold şartı görünmüyor; User Edit forceFill+save kullanıyor.
- **Root cause:** Hesap bakiyesi domain servisi yerine serbest model özelliği; admin işlemleri de finansal kurallardan muaf.
- **Evidence:** AdminController coins assignment, PanelController coins assignment, EditUser forceFill save; spin/settle/payment/achievement/tournament ayrı writer. WXP ledger ayrı domain'dir ve coin ledger değildir. UserStat migration yorumunda da coin ledger yokluğu belirtilmiş.
- **Potential impact:** Muhasebe uzlaştırma imkânsızlığı, reserved>balance, yanlış adjustment ve yetkili işlem suistimalinin izlenememesi.
- **Recommended fix:** Append-only wallet_transactions + balanced account entries + holds. Admin düzeltmesi de reason/actor/reference ile idempotent adjustment olsun; mutlak overwrite kaldırılmalı. Yedek/reconciliation politikası eklenmeli.
- **Database protection required?:** Evet; unique economic reference, FK, nonnegative/hold invariant; immutable ledger için ayrı DB yazma yetkisi veya eşdeğer kontrol.
- **Regression test required?:** Evet; tüm coin yazarları üzerinden reconciliation; admin adjustment vs payout; negative/reserved balance; rollback.

### SEC-016 — Zar dağılımında modulo bias

- **ID:** SEC-016
- **Severity:** MEDIUM
- **Category:** RNG fairness
- **Affected file(s):** `backend/app/Services/FairDiceService.php::roll/single`; `src/engine/fairDice.ts` doğrulama uyumu.
- **Affected endpoint/event:** Roll ve opening dice.
- **Description:** HMAC baytı `% 6 + 1` ile zar olur. 256, 6'ya bölünmediği için eşit dağılım yok.
- **Attack scenario:** Bireysel zar seçilemez; çok maçta düşük yüzler sistematik daha sık gelir. “Adil” dağılım iddiası matematiksel olarak tutmaz.
- **Root cause:** Rejection sampling yerine byte modulo.
- **Evidence:** 1–4 her biri 43/256; 5–6 her biri 42/256. CSPRNG seed üretimi bu bias'ı gidermez.
- **Potential impact:** Bahisli oyunda adalet/analiz sapması.
- **Recommended fix:** >=252 baytları reddeden, domain-separated counter ile genişleyen deterministik rejection sampling; algoritma sürümünü sakla. Commitment'ın ilk roll ile aynı yanıtta verildiğini de fairness protokolünde açıkla; server precommit doğrulaması ayrı gereksinimdir.
- **Database protection required?:** RNG algorithm/version ve turn/index audit alanları önerilir.
- **Regression test required?:** Evet; test vectors, rejection boundary, server/client parity; sadece istatistik testi yeterli değil.

### SEC-017 — Validator servis sınırı güvenli ayarı zorunlu kılmıyor

- **ID:** SEC-017
- **Severity:** MEDIUM
- **Category:** Service authentication / transport hardening
- **Affected file(s):** `validator/server.ts`; `MoveValidatorService.php::__construct/client`; `backend/config/validator.php`; `gnubg-service/gnubg_service.py::Handler.do_POST`.
- **Affected endpoint/event:** Internal `/validate`, `/legal-moves`, `/analyze-pr`, `/restart`; GNUbg internal endpoints.
- **Description:** Node secret boşsa auth atlanır; `listen(PORT)` açık host belirtmez. `/restart` aynı opsiyonel guard arkasındadır. PHP validator TLS verification varsayılan false. GNUbg loopback'e bağlanır, fakat secret şartı onda da boşken atlanır.
- **Attack scenario:** Yanlış bind/proxy/secret yapılandırmasında dış istemci pahalı analiz veya restart çağırabilir. Validator uzak HTTPS ise doğrulanmayan TLS yanıt manipülasyonuna elverişlidir; trusted response server board olarak kullanılır.
- **Root cause:** Kritik servis güvenliği fail-closed startup şartı yerine opsiyonel config.
- **Evidence:** `if (SECRET && ...)`; Node `server.listen(PORT,...)`; MoveValidator verify_tls fallback false. GNUbg bind `127.0.0.1` olumlu koruma. Canlı exposure UNKNOWN.
- **Potential impact:** Koşula bağlı oyun DoS veya trusted validator response bütünlüğü kaybı.
- **Recommended fix:** Nonempty secret zorunlu; explicit loopback/private bind, transport doğrulama; restart ayrı admin kontrol kanalı; timeout/body/work limitleri.
- **Database protection required?:** Hayır; fakat canonical state validation ve audit tamamlayıcıdır.
- **Regression test required?:** Evet; empty-secret startup fail, missing/wrong key, TLS failure, restart authorization.

### SEC-018 — SSO token-query, expiry ve ban/session kontrolü parçalı

- **ID:** SEC-018
- **Severity:** MEDIUM
- **Category:** Session hardening / credential exposure
- **Affected file(s):** `backend/routes/web.php::/admin/enter`; `PanelController::enter/login`; `EnsureAdmin`; `backend/config/sanctum.php:53`; `UserResource/Pages/EditUser.php`; `AuthController::updateProfile/logout/resetPassword`; `src/api.ts`.
- **Affected endpoint/event:** Admin/panel SSO/login, profil, logout, privileged API.
- **Description:** Uzun ömürlü PAT query string'den SSO yapılıyor. Manual findToken expiry doğrulamasını açıkça uygulamaz; Sanctum global expiration null. Panel login/admin middleware ban kontrolü yapmıyor. Dedicated ban aksiyonları PAT silse de formdan banned_at yazımı aynı revocation'ı yapmıyor; room token ayrıca geçerli kalıyor.
- **Attack scenario:** URL/history/proxy log kaynaklı token sızıntısı admin session açmaya yarar. Ban edilen mevcut session veya formdan ban edilen PAT, her request'te ban guard olmadığından sürebilir.
- **Root cause:** Auth policy aynı lifecycle'da merkezi değil; bearer credential URL'ye taşınmış.
- **Evidence:** SSO query token + findToken → Auth::login; session regeneration mevcut. Filament canAccessPanel ban kontrolü yapar, EnsureAdmin yalnız is_admin. Cookie varsayılanları HttpOnly=true/SameSite=lax; Secure env'e bağlı (production UNKNOWN). Reset password PAT'leri siler, API logout mevcut PAT'yi siler.
- **Potential impact:** Credential leak, stale authorization, yasaklı hesap erişimi.
- **Recommended fix:** Tek kullanımlık kısa ömürlü SSO exchange; reauthentication; expiry/ban/session-generation merkezi guard; email değişiminde verified_at temizleme; production cookie/PAT lifetime politikası.
- **Database protection required?:** One-time SSO nonce unique ve revocation/session generation önerilir.
- **Regression test required?:** Evet; expired/revoked PAT SSO, banned session, form ban, logout sonrası action, email change.

### SEC-019 — Dependency audit bulguları ve eksik lockfile kapsamı

- **ID:** SEC-019
- **Severity:** MEDIUM
- **Category:** Vulnerable components / supply chain
- **Affected file(s):** Root `package-lock.json`, `package.json`; `backend/package.json`, `validator/package.json`.
- **Affected endpoint/event:** Dev/test tooling; production exploitability kanıtlanmadı.
- **Description:** Root npm audit 3 etkilenen paket bildirdi: vitest ve @vitest/mocker moderate, adm-zip high (paket seviyesinde). Backend/validator npm audit lockfile olmadığından ENOLOCK döndü.
- **Attack scenario:** Erişilebilir ve ilgili plugin'i kullanan dev server'da mock redirect arbitrary read; etkilenen ZIP işleme yolunda saldırgan arşivle kaynak tüketimi/symlink overwrite. Bu projede bu önkoşulların production'da bulunduğu kanıtlanmadı.
- **Root cause:** Etkilenen locked dependency sürümleri; alt projelerde tekrarlanabilir npm audit eksikliği.
- **Evidence:** 19 Eylül 2026 `npm audit --package-lock-only --ignore-scripts --json`: 1 high, 2 moderate. Composer locked audit: advisories=[], abandoned=[]. Maintainer advisory: [Vitest GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9), [adm-zip GHSA-7q85-xj36-vmfc](https://github.com/cthackers/adm-zip/security/advisories/GHSA-7q85-xj36-vmfc); npm ayrıca GHSA-vwc7-r8mq-g2x9 bildirdi.
- **Potential impact:** Önkoşula bağlı geliştirici dosya gizliliği veya ZIP işleyen süreç DoS. Npm high sayısı uygulama audit'inin High sayısıyla aynı sınıflandırma değildir.
- **Recommended fix:** Ayrı onaylı düzeltme aşamasında patched sürümlere kontrollü update (Vitest advisory 4.1.11 düzeltmesini belirtir); dependency path/reachability incele; uygun alt proje lockfile politikası oluştur. Bu audit hiçbir install/update yapmadı.
- **Database protection required?:** Hayır.
- **Regression test required?:** Audit yeniden çalıştırma, build/test ve ilgili tooling behavior kontrolü.

### SEC-020 — Domain audit trail eksik; hata bildirimleri hassas URL taşıyabilir

- **ID:** SEC-020
- **Severity:** MEDIUM
- **Category:** Logging / information exposure
- **Affected file(s):** `backend/app/Support/Shield.php`; `ShieldTracker`; `backend/bootstrap/app.php:68–70`; `backend/app/Providers/AppServiceProvider.php` failure hook; `src/api.ts::showRoom`.
- **Affected endpoint/event:** API request tracking, 500/queue error alerts, room polling.
- **Description:** Shield request/risk/presence izler, fakat append-only ROLL/MOVE/SETTLEMENT/ADMIN_ACTION ledger'ı değildir. Command ID ve before/after version yok. 500 hook fullUrl ve exception message'ı Alert'e gönderir; room token query'leri ve bazı hassas hata içerikleri dış bildirimlere taşınabilir.
- **Attack scenario:** Query credential içeren endpoint hata verir; full URL alert/log içeriğine girer. Tartışmalı maçta sadece client-yazılabilir log bulunduğundan authoritative hamle geçmişi ispatlanamaz.
- **Root cause:** Operasyonel hata mesajı ile güvenlik audit kaydı ayrılmamış; merkezi secret redaction yok.
- **Evidence:** Bootstrap `$url=request()->fullUrl()` ve `$e->getMessage()`; Shield terminate sonrası request metrikleri; GameLog client writable. Alert kanalı config'e bağlıdır; gerçek secret logları okunmadı ve leak gerçekleştiği iddia edilmez.
- **Potential impact:** Credential/veri sızıntısı ve olay sonrası kanıt yetersizliği.
- **Recommended fix:** Structured events: user_id, room_id, command_id, before/after revision, timestamp, outcome/reason; credential-free URL/path ve exception redaction. Audit append-only retention/access policy.
- **Database protection required?:** Audit append-only storage ve referential correlation gerekir.
- **Regression test required?:** Evet; token/password/card/secret redaction, failure path, audit transaction correlation.

### SEC-021 — Upload içerik doğrulaması ve public çalıştırma sınırı eksik

- **ID:** SEC-021
- **Severity:** MEDIUM
- **Category:** Unsafe file upload / stored content
- **Affected file(s):** `backend/app/Http/Controllers/BugReportController.php::saveScreenshot`; `PanelController::contentSave`; `backend/public/.htaccess`.
- **Affected endpoint/event:** Public `/api/bug-report`, admin `/panel/content` image upload.
- **Description:** Screenshot data-URL MIME etiketi ve base64/size kontrolü var; decode edilen bytes'ın gerçekten resim olduğu doğrulanmıyor. Panel image validation sonrası dosya adı `getClientOriginalExtension()` ile oluşturuluyor ve public/uploads'a taşınıyor.
- **Attack scenario:** Public rapor resim etiketi altında farklı byte içeriği depolar. Admin upload'da güvenilmeyen extension, resim olarak algılanabilen polyglot içerikle tehlikeli uzantı yazımına dönüşebilir; web sunucusunun upload dizininde execution davranışı UNKNOWN.
- **Root cause:** MIME/extension client metadata'ya bağlı; re-encode ve upload execution-deny garantisi repo'da yok.
- **Evidence:** saveScreenshot prefix regex → base64_decode → Storage put. Panel `$ext=$file->getClientOriginalExtension()` → public path move. Mevcut htaccess upload için ayrı execution-deny tanımlamıyor; dış web server config bilinmiyor.
- **Potential impact:** Public storage abuse, tehlikeli içerik barındırma; admin-upload RCE etkisi sunucu config ve payload'a bağlı, doğrulanmadı.
- **Recommended fix:** Gerçek image decoder ile doğrula/re-encode; server MIME'dan sabit allowlist extension; ayrı cookieless origin veya non-executable storage; boyut/piksel/kota limitleri.
- **Database protection required?:** Upload ownership/quota metadata önerilir; temel düzeltme storage sınırıdır.
- **Regression test required?:** Evet; MIME/extension uyuşmazlığı, polyglot, SVG/HTML, malformed base64, piksel bombası; destructive payload çalıştırmadan.

### SEC-022 — Ağır analiz ve queue retry süreleri kullanılabilirlik riski taşıyor

- **ID:** SEC-022
- **Severity:** MEDIUM
- **Category:** Resource consumption / at-least-once processing
- **Affected file(s):** `AnalysisController`, `RoomController::move/live/update`, `validator/server.ts`, `gnubg_service.py:1482`; `backend/config/queue.php`; `AnalyzeMatchPrJob.php:24–26`, `AnalyzeMatchLuckJob.php`.
- **Affected endpoint/event:** Analysis/review MAT, validator-check, move, job execution.
- **Description:** Analiz route throttle'ı mevcut, fakat user başına paralel ağır iş/admission budget yok. GNUbg Content-Length doğrudan read edilir ve HTTPServer tek process'tir. Move remote validator beklerken room lock tutulur. PR job timeout 600 s, DB queue retry_after varsayılan 90 s.
- **Attack scenario:** Sınır içindeki çok sayıda ağır analiz motoru ve worker kapasitesini tüketir. Job 90 saniyeden uzun sürerken başka worker aynı işi rezervasyon süresi dolmuş görür; `tries=1` “aynı anda asla işlenmez” garantisi değildir. Gerçek worker/env ayarı UNKNOWN.
- **Root cause:** Request sayısı sınırı iş maliyeti/parallelism yerine kullanılmış; queue visibility timeout ile handler timeout uyumsuz varsayılan.
- **Evidence:** 30/dk analiz rate'leri, MAT 500KB, GNUbg read(n); PR timeout=600, queue retry_after=90. Analiz job'ları doğrudan coin ödemiyor; bu bulgu duplicate financial job var iddiası değildir.
- **Potential impact:** Oyun/analiz erişilemezliği, yinelenen compute, stale analysis overwrite; dolaylı timeout etkileri.
- **Recommended fix:** Ağır işler için bounded queue/semaphore, per-user maliyet limiti; servis body/deadline limitleri; retry_after > maximum timeout + margin; job input revision/result idempotency. Lock dışı validation kullanılacaksa revision CAS şart.
- **Database protection required?:** Job/result unique scope ve input revision; finansal işler eklenirse zorunlu idempotent ledger.
- **Regression test required?:** Evet; two-worker lease expiry, retry/crash, servis down, bounded resource tests. Bu audit yük/fuzz testi yapmadı.

### SEC-023 — Public spectator projection özel oda/chat ayrımı yapmıyor

- **ID:** SEC-023
- **Severity:** MEDIUM
- **Category:** BOLA / privacy boundary
- **Affected file(s):** `RoomController::show/liveMatches/watch`; `Room.php::toClient:114–163`; `GameLogController::mat`; `backend/routes/api.php`.
- **Affected endpoint/event:** Public room GET, live list, replay MAT.
- **Description:** Show ownership aramaz; toClient state yanında messages ve player user ID döndürür. Public spectator tasarımı anlaşılır, fakat friendly/invite odası için private ACL veya ayrı spectator DTO yok.
- **Attack scenario:** Oda kodunu bilen bir üçüncü kişi chat/state/replay okur. Online log UID oda kodudur; gizli capability olarak değerlendirilmemeli. Beş karakterli oda kodları güçlü erişim anahtarı değildir.
- **Root cause:** Davet kodu, public tanımlayıcı ve access credential rollerinin ayrılmaması.
- **Evidence:** show token yalnız presence için; JSON response koşulsuz. toClient messages döndürür. Secret player token'ları toClient'a dahil edilmemesi olumlu korumadır.
- **Potential impact:** Kullanıcının özel sandığı maç sohbetinin açılması. Bütün maçların/chat'in bilinçli public olduğu ürün politikası varsa privacy severity yeniden değerlendirilebilir; politika UNKNOWN.
- **Recommended fix:** Explicit public/private visibility; private room için player/invite ACL; spectator response'da chat/private metadata minimizasyonu; replay ayrı izin.
- **Database protection required?:** Visibility/ACL modeli ve participant ilişkileri gerekir.
- **Regression test required?:** Evet; public spectator ve private non-member matrisi; code değiştirme; chat/replay projection.

### SEC-024 — Public diagnostic endpoint oyun validator'ını çalıştırıyor

- **ID:** SEC-024
- **Severity:** LOW
- **Category:** Diagnostic exposure
- **Affected file(s):** `backend/routes/api.php`; `RoomController::validatorCheck`.
- **Affected endpoint/event:** `GET /api/validator-check`.
- **Description:** Public diagnostic isteği gerçek validator çağrısı yapar; config/availability durumunu verir. Secret/URL doğrudan dönmüyor ve throttle var.
- **Attack scenario:** Harici caller servis durumunu yoklar ve diagnostic limit dahilinde ek validator işi üretir.
- **Root cause:** Geçici tanı route'u public API'de kalmış.
- **Evidence:** Route throttle 60/dk; auth/admin zorunlu değil; handler validate çağırıyor.
- **Potential impact:** Düşük düzey servis haritalama ve gereksiz compute.
- **Recommended fix:** Production'dan kaldır veya admin/internal health sınırına taşı; liveness kontrolünü game validation'dan ayır.
- **Database protection required?:** Hayır.
- **Regression test required?:** Production route availability ve unauthorized access kontrolü.

## 3. Database invariants: mevcut ve gerekli korumalar

| Alan | Mevcut kaynak kanıtı | Eksik / önerilen |
|---|---|---|
| Room code | `2026_07_26_100000_create_rooms_table`: UNIQUE(code) | Collision retry/uygun hata; caller-specified enter code syntax/length; turnuva code claim atomikliği. |
| Katılımcı | p1/p2 unsigned nullable user ID; `2026_08_27_000000_add_indexes_to_rooms`: sıradan index | Aynı user iki seat CHECK; FK; normalize edilirse UNIQUE(room_id,user_id), UNIQUE(room_id,seat). |
| Tek aktif money match | Yok | `active_money_seats.user_id` unique/PK; tüm start/finalize aynı transaction protokolü. |
| Match result | `2026_09_06_020000...`: UNIQUE(room_code,user_id) | Sonuç otoritesi/FK/transaction; null kodlu ekonomik raporu reddet. Bu index participant constraint'i değildir. |
| Settlement | Room boolean settled; CAS update | UNIQUE(room_id,settlement_type) immutable settlement row + ledger FK. |
| Coin | Signed integer coins; unsignedBigInteger reserved | `coins >= 0`, `reserved >= 0`, `reserved <= coins`; ölçek/overflow limiti; ledger/hold referansları. |
| Wallet transaction | Genel tablo yok | transaction_id, user/account_id, amount, balance_before/after, type, reference_type/id, action_id, timestamp; unique reference ve append-only politika. |
| Economic holds | room.escrowed + aggregate users.coins_reserved | User+room hold satırları, unique source, held/released/settled lifecycle. |
| Commission | Ayrı komisyon kayıtları | Settlement FK/unique; commission-rate snapshot; komisyon bütün wallet ledger'ın yerine geçmez. |
| Command | Command tablosu yok | UNIQUE(room_id,command_id), payload hash, actor, game_no, expected/result revision, persisted response. |
| WXP | UNIQUE(match_result_id,source), transaction + total increment | Kaynak match doğruluğu; uydurma farklı match ID'leri unique korumasını geçer. |
| Achievement | UNIQUE(user_id,achievement_slug), award transaction | Eligibility server events; client flags çıkarılmalı. |
| Payment | UNIQUE(order_id) | Bank event/fulfillment/ledger idempotency; status+delivery atomicity. |
| Tournament | Bracket JSON, prize_paid, tournament row lock | Match/participant/prize ilişkilerinin FK/unique modeli; authoritative result zorunlu. |
| GameLog | UNIQUE(uid) | Slot authorization ve append-only canonical actions. |

Migration **yazılmadı ve çalıştırılmadı**. Öneriler mevcut iki-seat/JSON yapısına göre model değişikliği gerektirir. MySQL sürümü/engine ve gerçek constraint listesi doğrulanmadan taşınabilir CHECK/partial-index varsayımıyla migration hazırlanması doğru olmaz.

## 4. Concurrency ve replay senaryo matrisi

| Senaryo | Kod düzeyinde değerlendirme | Garanti |
|---|---|---|
| Aynı waiting room'a iki normal matchmake | Aday room lock + TX mevcut | Dar seat yarışında koruma; global user uniqueness değil. |
| join+join / enter+enter | Kilitsiz p2 IF/save | **FAIL**. |
| Aynı user iki farklı room join | İki nonlocking EXISTS | **FAIL**. |
| rematch+matchmake | Busy kontrolü ortak locked user claim değil | **FAIL**; gerçek interleaving testi yapılmadı. |
| roll+roll aynı açık tur | TX room lock, dice doluysa reuse | Dar özellik kod düzeyinde korumalı; gerçek DB test UNKNOWN. |
| move+move aynı state | TX lock; ilk hareket sonrası turn/dice değişir | Anlık duplicate çoğunlukla reddedilir; uzun gecikmeli replay kimliği yok. |
| resign+resign | Yeni game state kurulur, done olmadıkça tekrar puan | **FAIL**. |
| resign+move / take+drop | Aynı room lock sıralar | Sonraki state'e geçerli görünen stale komut için command scope eksik. |
| leave/poll-timeout+move | Tüm writer'lar lock kullanmaz | **FAIL**. |
| settle+settle | CAS settled=false + balances aynı TX | Güçlü dar koruma; final result snapshot/cleanup dahil global özellik PARTIAL. |
| settle+releaseEscrow | Ayrı CAS'ler, TX dışı escrow snapshot | Yeniden locked read/tek hold state machine gerekli. |
| shop/order+shop/order | User lock + available balance kontrolü | Dar debit atomikliği iyi; ortak idempotency key yok, retry yeni sipariş olabilir. |
| spin+spin | User lock, hak/cooldown ve reward aynı TX | Aynı command dedup yok; cooldown sonrası network retry yeni ücretli spin sayılır. |
| tournament final+final | Tournament lock + prize_paid | Duplicate payout dar koruması iyi; client winner forgery devam eder. |
| callback+callback | Pending CAS | Double credit'i sınırlıyor; crash recovery atomic değil. |
| rating+backstop | Farklı lock protokolleri | **FAIL**. |

10–50 paralel HTTP istek gönderilmedi. Rapordaki race bulguları read/IF/write ve transaction sınırlarının somut interleaving analizine dayanır. Gerçek production izolasyon seviyesinde kilit davranışı **UNKNOWN**; app-level IF hiçbir yerde garanti sayılmadı.

## 5. Auth, web güvenliği ve admin değerlendirmesi

| Kontrol | Sonuç |
|---|---|
| Sanctum authentication | Login/register bearer PAT üretir; kritik room komutları farklı token sistemi kullanır. |
| Password hashing/reset | User password hashed cast, login Hash::check; reset PAT'leri iptal eder. Register min 6; auth login throttle mevcut. |
| Session fixation | Panel login ve SSO session regenerate yapar. Token-query lifecycle ve ban boşlukları SEC-018. |
| CSRF | Panel/Filament web middleware korumalı. Bearer API için wildcard CORS tek başına CSRF açığı değildir; credentials=false. Payment callback/submit bilinçli CSRF exempt, submit signed. Runtime cookie/session API behavior ayrıca test edilmedi. |
| CORS/cookies | CORS allowed_origins=* ve supports_credentials=false. Cookie HttpOnly=true, SameSite=lax defaults; Secure environment'a bağlı. Production UNKNOWN. |
| Email verification | Signed verify route var; protected API genelinde verified middleware yok. Email değişince verification reset yok; admin türetimi SEC-004. |
| Mass assignment | User fillable coins/rating/is_admin içermez; public register/profile validated allowlist kullanır. Bu olumlu kontrol reward/business-logic exploit'lerini engellemez. |
| SQL injection | İncelenen controller sorguları query builder/bind kullanıyor; FriendController LOWER query placeholder'lı. Finansal DB::raw değerleri integer'a çevriliyor. Doğrulanmış SQLi bulunmadı; tüm olası dinamik sorgular için penetration testi yapılmadı. |
| Command injection | Service restart command'ında escapeshellarg var. GNUbg çoğu komutu sayısal dönüşüm/fixed command üretir. Native MAT parser güvenliği ve bütün parser edge case'leri UNKNOWN; RCE kanıtlanmadı. |
| SSRF | Validator/GNUbg URL'leri server config kaynağı; client-controlled arbitrary fetch URL zinciri doğrulanmadı. İç servisin proxy exposure'ı UNKNOWN. |
| Path traversal | Public game-log UID regex var. Genel keyfi dosya-okuma yolu doğrulanmadı. Upload sorunu ve npm advisory ayrı bulgular. |
| XSS | CMS/Info/Legal body dangerouslySetInnerHTML ile render edilir; CMS write admin kontrollü. Repo tarafında sanitizer kanıtı yok; unprivileged stored-XSS zinciri doğrulanmadı. Admin HTML trust policy/allowlist ve CSP önerilir. Statik inline SVG aynı risk sınıfı değildir. |
| Open redirect | İncelenen auth/panel redirect'leri sabit yerel path; payment destination config'ten. Doğrulanmış open redirect yok. |
| .env / secrets | `git ls-files '*env*' '*pem' '*key'` yalnız backend/.env.example döndürdü. Bu tarihsel git secret taraması veya production .env exposure testi değildir. Gerçek secret sızıntısı UNKNOWN. |
| Public uploads | MIME prefix kontrolü gerçek içerik doğrulaması değil; SEC-021. |
| Diagnostics/errors | validator-check public; analiz failure response'unda iç servis debug/detail verisi bulunabiliyor; production APP_DEBUG/proxy behavior UNKNOWN. |
| Admin authorization | REST admin middleware + controller check, panel admin middleware, Filament canAccessPanel var. Normal kullanıcı doğrudan is_admin payload'ıyla yükseltilemiyor; SEC-004 ayrı yol. |
| Admin audit | Wheel değişiklikleri için ayrı audit yaklaşımı var; tüm coin/role/ban/payment edits için ortak audit yok. |
| Address/DM ownership | Address authorizeOwner ve DM sender/receiver query scoping gözlendi. Full adversarial API testi yapılmadığından tüm modüle PASS verilmedi. |
| Saved `/api/game` | Kullanıcının kendi game_state kaydı; canonical money-game state ile birleştirilmemeli. |

OWASP web/API kategorileri bakımından ana açıklar: broken access control/BOLA (SEC-006/007/014), broken authentication/privilege escalation (004/018), business-flow abuse (001/002/003/008), race/data integrity (005/009/010/011/012/013), misconfiguration/service boundary (017), vulnerable components (019), logging/monitoring (015/020), unrestricted resource consumption (022). Doğrulanmamış SQLi/XSS/SSRF/RCE kategorileri “açık yok” şeklinde kesin onaylanmadı.

## 6. Failure / recovery ve forensic değerlendirme

| Olay | Mevcut davranış / eksik |
|---|---|
| Backend process settlement TX içinde çöker | Transactional engine varsayımıyla claim+debit+credit rollback; engine/runtime UNKNOWN. |
| Backend finished status sonrasında çöker | Finalization/result/coin tek TX değil; reconciliation gerekir. |
| Payment paid claim sonrasında çöker | Retry fulfillment'ı atlayabilir; SEC-012. |
| Queue job yeniden çalışır | Analiz değerleri tekrar yazılabilir, pahalı compute tekrarlanır; doğrudan financial payout job bulunmadı. |
| DB timeout/deadlock | Bazı transaction'lar korunuyor; eski model snapshot save ve cache fail-open yolları riskli. Para hareketini error catch ile başarılı sayan ortak retry standardı yok. |
| Redis/cache timeout | Cache::lock kullanan reportRating best-effort devam eder. Rate limiter/scheduler lock davranışı efektif driver'a bağlı, UNKNOWN. |
| İki tab/iki cihaz | Aynı browser kalıcı player token'ını paylaşabilir; yeni cihaz farklı token. Exclusive session generation yok. |
| Disconnect/reconnect | Poll presence + leave sinyali; stale tab leave aktif tab maçını bitirebilir. Account-bound seat reconnect yok. |
| İki oyuncu birden kaybolur | No-contest end mümkün; escrow bırakma/finalized cleanup ile bütünleştirilmemiş. |
| Browser geri gelir | Server revision okunur, fakat eski command için expected_revision kabulü yok. |
| Scheduler çalışmaz | Fırsatçı cleanup/poll bir miktar telafi eder; cron heartbeat yeni kodda var. Kalıcı payout reconciliation yerine geçmez. |
| Eski kayıt cleanup | Scheduled direct delete escrow referansını silebilir. |

Gerekli olaylar: LOGIN, MATCH_CREATED/JOINED/STARTED, ROLL, MOVE, DOUBLE, TAKE, PASS, RESIGN, DISCONNECT/RECONNECT, MATCH_FINISHED, SETTLEMENT, WALLET_CHANGE, ADMIN_ACTION. Bunların hepsi için ortak authoritative, append-only kayıt yok. Mevcut last_login_at, Shield olayları, dice_rolls, MatchResult, commission, spin kayıtları faydalı ama tek bir command/result/wallet zinciri oluşturmuyor. Özellikle canonical hamleler client GameLog'a bırakılmamalı.

## 7. Yapılan güvenli kontroller ve yapılmayan testler

| Kontrol | Gerçek sonuç |
|---|---|
| TypeScript | `node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --incremental false` exit 0. App tsconfig kapsamı; tüm olası alt proje/build garantisi değil. |
| Frontend motor testleri | Seçili mevcut Vitest dosyaları: **5 dosya, 86 test PASS**. validateTurn, moves, resign, fairDice, authSync. Komutta adı geçen mevcut olmayan game/cube test dosyaları ek test sayılmaz. |
| PHP pure clock test | `php backend/vendor/phpunit/phpunit/phpunit --no-configuration --bootstrap backend/vendor/autoload.php --do-not-cache-result backend/tests/Unit/MatchClockTest.php`: **25 test, 97 assertion PASS**. Laravel boot/DB/migration yok. |
| Bellek içi güvenlik probes | Gerçek User/Room/MatchClock/RoomController sınıfları, sentetik veri, DB/network yok. Admin email, early seed reveal, clock stop, repeated result davranışları doğrulandı. |
| Composer audit | `composer audit --locked --no-plugins --no-scripts --format=json`: **0 advisory, 0 abandoned**, exit 0. |
| Root npm audit | **3 etkilenen paket: 1 high, 2 moderate**, exit 1. Auto-fix/install yok. |
| Backend/validator npm audit | **ENOLOCK**; lockfile oluşturulmadı, kapsam UNKNOWN. |
| Lint | Mevcut araç ESLint değil **oxlint**. **11 error, 43 warning**; 11 error mevcut untracked `scripts/_bot-match.mjs` içindeki no-var. Düzeltme yapılmadı. |
| Laravel route inspection | `route:list --json` exit 0; process-local APP_ENV=testing, DB SQLite `:memory:`, DB_URL boş, CACHE/SESSION/MAIL array ve farklı config-cache path ile ortam ayrıldı. Migration ve route dispatch yapılmadı. Route envanteri ek bölümde. |
| Şema/migration analizi | Kaynak dosyaları okundu; production schema sorgulanmadı. |
| Git | Başlangıç ve son durum okundu; mevcut uygulama değişikliklerine dokunulmadı. Audit sırasında harici commit gözlendi. |

Bellek içi probe çıktıları:

```text
unverified_config_email_grants_admin=true
unfinished_match_seed_revealed=true
non_active_player_can_stop_clock=true
repeated_result_points=2->4
network_calls=0 database_connections=0 persistent_writes=0
```

Bu probes HTTP integration testi değildir; report'ta statik endpoint zinciriyle birlikte değerlendirilmiştir. Var olan testlerin geçmesi full security PASS değildir.

**Çalıştırılmayanlar:** Laravel Feature suite `RefreshDatabase` kullanıyor; migration yasağı nedeniyle çalıştırılmadı. `composer test` config:clear da içeriyor, kullanılmadı. Playwright config mevcut E2E sqlite backend/server gerektiriyor; seed komutu migrate:fresh içerdiğinden çalıştırılmadı. Mevcut dev/test hesapları ve coin bakiyeleri üzerinde işlem yapılmadı. Production'a IDOR, fuzz, load, concurrent action, ödeme veya admin isteği gönderilmedi. Yeni test dosyası/dependency oluşturulmadı.

**Sonraki güvenli regression ortamı:** Disposable, network-isolated MySQL/InnoDB veritabanı; sentetik user/coin; mail/payment/GNUbg fake; en az iki gerçek DB bağlantısı; request barrier ile kontrollü interleaving. Setup migration ayrı düzeltme/test aşamasında yetkilendirilmeli. Playwright iki context/two-tab, revoked token/stale generation ve exact command replay senaryoları bu ortamda yürütülmeli.

## 8. FIX PLAN

### PHASE 0 — acil exploit kapatma

1. `RoomController::update` authoritative/value-bearing odalarda legacy state/status yazımını reddetsin; `Room::toClient` seed reveal canonical finalized duruma bağlansın. `roll/move/cube/resign` ortak terminal guard kullansın. **Dosyalar:** RoomController.php, Room.php, MatchClock.php.
2. Client rating/result/reward fallback ve validation dışı achievement inputs kapatılsın. **Dosyalar:** AuthController.php, RoomResult.php, StatsUpdater.php, AchievementService.php.
3. Turnuva report yalnız finalized server result kabul etsin. **Dosyalar:** TournamentController.php, RoomResult.php.
4. Email'den admin türetimi kaldırılıp explicit role/bootstrap grant'e geçilsin. **Dosyalar:** User.php, AuthController.php, EnsureAdmin.php, config/services.php.
5. Money room direct join/enter canonical admission'a bağlanana kadar reddedilsin; spin debit rezervi korusun. **Dosyalar:** RoomController.php, LuckyWheelService.php, DiceSlotService.php.

### PHASE 1 — server authoritative game actions

1. Tek game command handler; tüm action/timeout/leave/bot/scheduler canonical state'i kullansın. **Dosyalar:** RoomController.php, MatchClock.php, Backgammon.php, BotMoveService.php; önerilen yeni `app/Services/GameCommandService.php`.
2. UI yalnız intent + command_id + expected_version + game_no göndersin. Cosmetic live payload ekonomik state'e ulaşmasın. **Dosyalar:** src/api.ts, src/App.tsx, src/online/authSync.ts.
3. Tournament, rating, replay ve achievements canonical result/event kaynağına taşınsın. **Dosyalar:** TournamentController.php, AuthController.php, GameLogController.php, RoomResult.php, StatsUpdater.php.
4. Deterministik unbiased RNG ve algorithm version. **Dosyalar:** FairDiceService.php, src/engine/fairDice.ts, Room.php.

### PHASE 2 — DB constraints + concurrency

1. Gerçek DB engine/isolation/constraint listesi read-only doğrulansın; çelişkili eski veriler için yalnız raporlama yapılmadan constraint rollout yapılmasın.
2. Active-money-user claim, distinct participant/seat constraints, canonical room code claim, command dedup/version. **Dosyalar:** Room.php, RoomController.php, TournamentController.php; önerilen yeni model/servisler ve daha sonra tasarlanacak `backend/database/migrations/*`.
3. Bütün state writer'ları aynı lock ordering uygulasın; scheduler locked fresh read kullansın. **Dosyalar:** RoomController.php, ReapStaleRooms.php, TickBotClocks.php, MatchBackstop.php, ForfeitLoss.php.

### PHASE 3 — wallet/settlement idempotency

1. Wallet ledger + holds + settlement service. Fixed/yüzde stake başlangıç snapshot'ı; commission oranı da ekonomik sözleşmeye dahil kaydedilsin. **Önerilen yeni dosyalar:** WalletService.php, MatchSettlementService.php, WalletTransaction.php, WalletHold.php, MatchSettlement.php; mevcut User/Room/Commission modelleri.
2. Tüm coin yazarları ortak servise taşınsın. **Dosyalar:** RoomController.php, ShopController.php, ProductController.php, TournamentController.php, PaymentController.php, LuckyWheelService.php, RewardFulfillmentService.php, DiceSlotService.php, AchievementService.php, AuthController.php, AdminController.php, PanelController.php, Filament UserResource/EditUser/CreateUser.
3. Canonical result + settlement claim/ledger + final state transaction; external projection için transactional outbox ve idempotent consumers. **Dosyalar:** AuthController.php, MatchBackstop.php, ForfeitLoss.php, WxpService.php; önerilen Outbox model/job.
4. Payment claim ve local fulfillment transaction; banka recovery/reconciliation. **Dosyalar:** PaymentController.php, Payment.php, PaymentResource/EditPayment.php.
5. Cleanup ekonomik kayıt silmesin. **Dosyalar:** routes/console.php, RoomController::cleanupStale/releaseEscrow, ReapStaleRooms.php.

### PHASE 4 — WebSocket/session hardening

1. Mevcut sistem HTTP polling olduğundan öncelik account-bound seat auth/reconnect, scoped server credential ve session generation. **Dosyalar:** routes/api.php, RoomController.php, AuthController.php, src/api.ts, src/online/authSync.ts.
2. SSO one-time exchange, token URL kaldırma, ban/expiry merkezi kontrol, email değişikliği doğrulaması. **Dosyalar:** routes/web.php, PanelController.php, EnsureAdmin.php, User.php, config/sanctum.php, config/session.php, AdminPanelProvider.php.
3. İleride WebSocket eklenirse private channel ACL, her command'da yeniden authorization, revoked/stale session ve canonical handler kullanımı şart; client event doğrudan state yazmamalı. Mevcut repo için olmayan socket dosyaları varmış gibi önerilmedi.
4. Internal service secret/bind/TLS fail-closed. **Dosyalar:** validator/server.ts, MoveValidatorService.php, config/validator.php, gnubg_service.py.

### PHASE 5 — abuse/rate limiting

1. Login için hesap+IP; room command için user+room ve action maliyetine göre ayrı limit. Ağır analiz admission/parallelism budget; public diagnostics kaldırma. **Dosyalar:** routes/api.php, routes/web.php, AuthController.php, AnalysisController.php, RoomController.php, validator/server.ts, gnubg_service.py.
2. Payload array/depth/step/log boyut sınırları, screenshot gerçek image decode ve quota. **Dosyalar:** RoomController.php, GameLogController.php, BugReportController.php, PanelController.php, storage/web server configuration.
3. Dependency patched sürümleri ve reproducible lock policy. **Dosyalar:** package.json/package-lock.json, backend/package.json, validator/package.json.

### PHASE 6 — logging/monitoring

1. Authoritative action/wallet/admin audit ve correlation ID. **Dosyalar:** Shield.php, ShieldTracker.php, GameCommandService/WalletService (önerilen), admin controllers/resources.
2. URL/exception secret redaction ve security retention. **Dosyalar:** bootstrap/app.php, AppServiceProvider.php, Alert.php, GnuBgClient.php.
3. Finished-unsettled, reserved-without-hold, ledger-balance drift, double-active-user alarmları; alert read-only ölçümden başlasın. **Dosyalar:** önerilen reconciliation command/job; routes/console.php, ServiceStatus.php.
4. Queue timeout/retry_after/dead-letter policy. **Dosyalar:** config/queue.php, AnalyzeMatchPrJob.php, AnalyzeMatchLuckJob.php; deployment worker configuration.

### PHASE 7 — automated security regression tests

1. Gerçek transaction DB ile barriers: join/join, active-user claim, matchmake/rematch, timeout/move, settle/release, callback/failure. **Dosyalar:** backend/tests/Feature/RoomConcurrencyGuardTest.php, RoomEscrowTest.php, RoomSettleTest.php, PaymentCallbackTest.php ve yeni concurrency harness.
2. Auth/BOLA/fallback tests: no bearer/other user/other room, config email, unverified email, revoked token, forged log/result/reward. **Dosyalar:** RoomServerAuthTest.php, MatchResultAuthoritativeTest.php, TournamentNoShowTest.php, AchievementTest.php, GameLogTest.php ve yeni security tests.
3. Command replay ve RNG secrecy test vectors. **Dosyalar:** RoomDiceAuthorityTest.php, ServerMoveTest.php, ServerMatchTest.php, RoomCubeTest.php, RoomClockTest.php, FairDiceTest.php; src/engine/fairDice.test.ts.
4. Playwright iki context/two-tab + reconnect/stale session; yalnız disposable accounts. **Dosyalar:** playwright.config.ts, e2e/*, mevcut E2eSeed setup'ının güvenli test izolasyonu.

**Kabul ölçütü:** Her kritik invariant, bütün entry point'lerde aynı DB/transaction protokolü ve gerçek parallel regression test ile kanıtlanmadan PASS'e çevrilmemeli. Güvenlik için UI kontrolü, cache-only lock veya yorum satırı yeterli değildir.

## Ek A — Route envanteri

Registry toplamı: **262 route**. Bu envanter izole SQLite :memory: / array cache-session ortamında, route çalıştırmadan çıkarılmıştır.

| Method | URI | Handler | Middleware |
|---|---|---|---|
| GET\|HEAD | admin | Filament\Pages\Dashboard | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/ad-slots | App\Filament\Resources\AdSlotResource\Pages\ListAdSlots | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/ad-slots/create | App\Filament\Resources\AdSlotResource\Pages\CreateAdSlot | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/ad-slots/{record}/edit | App\Filament\Resources\AdSlotResource\Pages\EditAdSlot | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/bank-transfer-settings | App\Filament\Pages\BankTransferSettings | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/bilgi-sayfalari | App\Filament\Resources\InfoPageResource\Pages\ListInfoPages | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/bilgi-sayfalari/{record}/edit | App\Filament\Resources\InfoPageResource\Pages\EditInfoPage | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/bug-reports | App\Filament\Resources\BugReportResource\Pages\ListBugReports | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/bug-reports/{record}/edit | App\Filament\Resources\BugReportResource\Pages\EditBugReport | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/cerez-banner/{record}/edit | App\Filament\Resources\CookieConsentResource\Pages\EditCookieConsent | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/cerez-tablosu | App\Filament\Resources\CookieEntryResource\Pages\ListCookieEntries | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/cerez-tablosu/create | App\Filament\Resources\CookieEntryResource\Pages\CreateCookieEntry | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/cerez-tablosu/{record}/edit | App\Filament\Resources\CookieEntryResource\Pages\EditCookieEntry | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/commissions | App\Filament\Resources\CommissionResource\Pages\ListCommissions | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/dice-slot-settings | App\Filament\Pages\DiceSlotSettings | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/enter | Closure | web |
| GET\|HEAD | admin/entry-popups | App\Filament\Resources\EntryPopupResource\Pages\ListEntryPopups | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/entry-popups/create | App\Filament\Resources\EntryPopupResource\Pages\CreateEntryPopup | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/entry-popups/{record}/edit | App\Filament\Resources\EntryPopupResource\Pages\EditEntryPopup | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/game-logs | App\Filament\Resources\GameLogResource\Pages\ListGameLogs | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/game-logs/{record} | App\Filament\Resources\GameLogResource\Pages\ViewGameLog | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/guvenlik-kalkani | App\Filament\Pages\GuvenlikKalkani | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/haberler | App\Filament\Resources\NewsResource\Pages\ListNews | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/haberler/create | App\Filament\Resources\NewsResource\Pages\CreateNews | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/haberler/{record}/edit | App\Filament\Resources\NewsResource\Pages\EditNews | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/kulupler | App\Filament\Resources\ClubResource\Pages\ListClubs | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/kulupler/create | App\Filament\Resources\ClubResource\Pages\CreateClub | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/kulupler/{record}/edit | App\Filament\Resources\ClubResource\Pages\EditClub | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/kurumlar | App\Filament\Resources\KurumResource\Pages\ListKurums | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/kurumlar/create | App\Filament\Resources\KurumResource\Pages\CreateKurum | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/kurumlar/{record}/edit | App\Filament\Resources\KurumResource\Pages\EditKurum | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/login | Filament\Pages\Auth\Login | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| POST | admin/logout | Filament\Http\Controllers\Auth\LogoutController | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/lucky-wheel-rewards | App\Filament\Resources\LuckyWheelRewardResource\Pages\ListLuckyWheelRewards | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/lucky-wheel-rewards/create | App\Filament\Resources\LuckyWheelRewardResource\Pages\CreateLuckyWheelReward | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/lucky-wheel-rewards/{record}/edit | App\Filament\Resources\LuckyWheelRewardResource\Pages\EditLuckyWheelReward | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/lucky-wheel-settings | App\Filament\Pages\LuckyWheelSettings | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/magazines | App\Filament\Resources\MagazineResource\Pages\ListMagazines | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/magazines/create | App\Filament\Resources\MagazineResource\Pages\CreateMagazine | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/magazines/{record}/edit | App\Filament\Resources\MagazineResource\Pages\EditMagazine | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/maintenance-mode | App\Filament\Pages\MaintenanceMode | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/match-results | App\Filament\Resources\MatchResultResource\Pages\ListMatchResults | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/match-results/{record} | App\Filament\Resources\MatchResultResource\Pages\ViewMatchResult | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/menu-groups | App\Filament\Resources\MenuGroupResource\Pages\ListMenuGroups | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/menu-groups/create | App\Filament\Resources\MenuGroupResource\Pages\CreateMenuGroup | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/menu-items | App\Filament\Resources\MenuItemResource\Pages\ListMenuItems | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/oteller | App\Filament\Resources\OtelResource\Pages\ListOtels | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/oteller/create | App\Filament\Resources\OtelResource\Pages\CreateOtel | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/oteller/{record}/edit | App\Filament\Resources\OtelResource\Pages\EditOtel | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/payments | App\Filament\Resources\PaymentResource\Pages\ListPayments | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/payments/{record}/edit | App\Filament\Resources\PaymentResource\Pages\EditPayment | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/product-categories | App\Filament\Resources\ProductCategoryResource\Pages\ListProductCategories | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/product-categories/create | App\Filament\Resources\ProductCategoryResource\Pages\CreateProductCategory | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/product-categories/{record}/edit | App\Filament\Resources\ProductCategoryResource\Pages\EditProductCategory | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/product-orders | App\Filament\Resources\ProductOrderResource\Pages\ListProductOrders | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/product-orders/{record}/edit | App\Filament\Resources\ProductOrderResource\Pages\EditProductOrder | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/products | App\Filament\Resources\ProductResource\Pages\ListProducts | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/products/create | App\Filament\Resources\ProductResource\Pages\CreateProduct | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/products/{record}/edit | App\Filament\Resources\ProductResource\Pages\EditProduct | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/promo-codes | App\Filament\Resources\PromoCodeResource\Pages\ListPromoCodes | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/promo-codes/create | App\Filament\Resources\PromoCodeResource\Pages\CreatePromoCode | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/promo-codes/{record}/edit | App\Filament\Resources\PromoCodeResource\Pages\EditPromoCode | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/site-settings | App\Filament\Pages\SiteSettings | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/takvim | App\Filament\Resources\EventResource\Pages\ListEvents | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/takvim/create | App\Filament\Resources\EventResource\Pages\CreateEvent | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/takvim/{record}/edit | App\Filament\Resources\EventResource\Pages\EditEvent | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/tournament-ads | App\Filament\Resources\TournamentAdResource\Pages\ListTournamentAds | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/tournament-ads/create | App\Filament\Resources\TournamentAdResource\Pages\CreateTournamentAd | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/tournament-ads/{record}/edit | App\Filament\Resources\TournamentAdResource\Pages\EditTournamentAd | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/tournaments | App\Filament\Resources\TournamentResource\Pages\ListTournaments | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/tournaments/create | App\Filament\Resources\TournamentResource\Pages\CreateTournament | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/tournaments/{record}/edit | App\Filament\Resources\TournamentResource\Pages\EditTournament | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/users | App\Filament\Resources\UserResource\Pages\ListUsers | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/users/create | App\Filament\Resources\UserResource\Pages\CreateUser | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/users/{record} | App\Filament\Resources\UserResource\Pages\ViewUser | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| GET\|HEAD | admin/users/{record}/edit | App\Filament\Resources\UserResource\Pages\EditUser | Filament\Http\Middleware\SetUpPanel:admin, Illuminate\Cookie\Middleware\EncryptCookies, Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse, Illuminate\Session\Middleware\StartSession, Illuminate\View\Middleware\ShareErrorsFromSession, Filament\Http\Middleware\Authenticate, Filament\Http\Middleware\AuthenticateSession, Illuminate\Foundation\Http\Middleware\VerifyCsrfToken, Illuminate\Routing\Middleware\SubstituteBindings, Filament\Http\Middleware\DisableBladeIconComponents, Filament\Http\Middleware\DispatchServingFilamentEvent |
| DELETE | api/account | App\Http\Controllers\AuthController@deleteAccount | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/achievements | App\Http\Controllers\AchievementController@publicCatalog | api |
| GET\|HEAD | api/ad-slots | App\Http\Controllers\AdSlotController@index | api |
| GET\|HEAD | api/addresses | App\Http\Controllers\AddressController@index | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/addresses | App\Http\Controllers\AddressController@store | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| PUT | api/addresses/{address} | App\Http\Controllers\AddressController@update | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| DELETE | api/addresses/{address} | App\Http\Controllers\AddressController@destroy | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/admin/contents | App\Http\Controllers\ContentController@adminIndex | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| POST | api/admin/contents | App\Http\Controllers\ContentController@store | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| PUT | api/admin/contents/{content} | App\Http\Controllers\ContentController@update | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| DELETE | api/admin/contents/{content} | App\Http\Controllers\ContentController@destroy | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| POST | api/admin/lucky-wheel/reorder | App\Http\Controllers\LuckyWheelAdminController@reorder | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| GET\|HEAD | api/admin/lucky-wheel/rewards | App\Http\Controllers\LuckyWheelAdminController@rewards | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| POST | api/admin/lucky-wheel/rewards | App\Http\Controllers\LuckyWheelAdminController@storeReward | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| PUT | api/admin/lucky-wheel/rewards/{reward} | App\Http\Controllers\LuckyWheelAdminController@updateReward | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| DELETE | api/admin/lucky-wheel/rewards/{reward} | App\Http\Controllers\LuckyWheelAdminController@destroyReward | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| GET\|HEAD | api/admin/lucky-wheel/settings | App\Http\Controllers\LuckyWheelAdminController@getSettings | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| PUT | api/admin/lucky-wheel/settings | App\Http\Controllers\LuckyWheelAdminController@updateSettings | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| GET\|HEAD | api/admin/users | App\Http\Controllers\AdminController@users | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| PATCH | api/admin/users/{user} | App\Http\Controllers\AdminController@updateUser | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| GET\|HEAD | api/admin/users/{user}/matches | App\Http\Controllers\AdminController@userMatches | api, Illuminate\Auth\Middleware\Authenticate:sanctum, App\Http\Middleware\EnsureAdmin |
| POST | api/analyze-mat | App\Http\Controllers\AnalysisController@matchAnalysis | api, Illuminate\Auth\Middleware\Authenticate:sanctum, Illuminate\Routing\Middleware\ThrottleRequests:30,1,analyze-mat |
| POST | api/analyze-position | App\Http\Controllers\AnalysisController@position | api, Illuminate\Auth\Middleware\Authenticate:sanctum, Illuminate\Routing\Middleware\ThrottleRequests:30,1,analyze-position |
| POST | api/auth/google | App\Http\Controllers\AuthController@googleLogin | api, Illuminate\Routing\Middleware\ThrottleRequests:20,1,auth-register |
| GET\|HEAD | api/blunders | App\Http\Controllers\BlunderController@index | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/blunders | App\Http\Controllers\BlunderController@store | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/bot/rooms | App\Http\Controllers\RoomController@createBotRoom | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/bug-report | App\Http\Controllers\BugReportController@store | api, Illuminate\Routing\Middleware\ThrottleRequests:6,1,bug-report |
| GET\|HEAD | api/clubs | App\Http\Controllers\ClubController@index | api |
| POST | api/clubs | App\Http\Controllers\ClubController@create | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/clubs/leave | App\Http\Controllers\ClubController@leave | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/clubs/{club} | App\Http\Controllers\ClubController@show | api |
| POST | api/clubs/{club}/join | App\Http\Controllers\ClubController@join | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/contents | App\Http\Controllers\ContentController@index | api |
| GET\|HEAD | api/cookie-consent | App\Http\Controllers\CookieController@consent | api |
| GET\|HEAD | api/cookies | App\Http\Controllers\CookieController@entries | api |
| GET\|HEAD | api/dice-slot | App\Http\Controllers\DiceSlotController@show | api |
| POST | api/dice-slot/spin | App\Http\Controllers\DiceSlotController@spin | api, Illuminate\Auth\Middleware\Authenticate:sanctum, Illuminate\Routing\Middleware\ThrottleRequests:60,1,dice-slot |
| POST | api/email/resend | App\Http\Controllers\AuthController@resendVerification | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/entry-popup | App\Http\Controllers\EntryPopupController@index | api |
| POST | api/forgot-password | App\Http\Controllers\AuthController@forgotPassword | api, Illuminate\Routing\Middleware\ThrottleRequests:20,1,auth-register |
| GET\|HEAD | api/friends | App\Http\Controllers\FriendController@index | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/friends/request | App\Http\Controllers\FriendController@request | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| DELETE | api/friends/{userId} | App\Http\Controllers\FriendController@destroy | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/friends/{userId}/accept | App\Http\Controllers\FriendController@accept | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/friends/{userId}/invite | App\Http\Controllers\PresenceController@invite | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/game | App\Http\Controllers\GameController@show | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| PUT | api/game | App\Http\Controllers\GameController@save | api, Illuminate\Auth\Middleware\Authenticate:sanctum, Illuminate\Routing\Middleware\ThrottleRequests:60,1,game-save |
| DELETE | api/game | App\Http\Controllers\GameController@clear | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/game-logs | App\Http\Controllers\GameLogController@store | api, Illuminate\Routing\Middleware\ThrottleRequests:20,1,game-logs |
| GET\|HEAD | api/game-logs/{uid}/mat | App\Http\Controllers\GameLogController@mat | api, Illuminate\Routing\Middleware\ThrottleRequests:30,1,game-logs-mat |
| GET\|HEAD | api/info-pages | App\Http\Controllers\InfoPageController@index | api |
| POST | api/invites/cancel | App\Http\Controllers\PresenceController@cancelInvite | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/invites/{inviteId}/respond | App\Http\Controllers\PresenceController@respond | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/leaderboard | App\Http\Controllers\AuthController@leaderboard | api |
| GET\|HEAD | api/leaderboard/pr | App\Http\Controllers\AuthController@prLeaderboard | api |
| GET\|HEAD | api/legal-pages | App\Http\Controllers\LegalPageController@index | api |
| GET\|HEAD | api/legal-pages/{slug} | App\Http\Controllers\LegalPageController@show | api |
| GET\|HEAD | api/live-matches | App\Http\Controllers\RoomController@liveMatches | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/login | App\Http\Controllers\AuthController@login | api, Illuminate\Routing\Middleware\ThrottleRequests:10,1,auth-login |
| POST | api/logout | App\Http\Controllers\AuthController@logout | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/lucky-wheel | App\Http\Controllers\LuckyWheelController@show | api |
| POST | api/lucky-wheel/spin | App\Http\Controllers\LuckyWheelController@spin | api, Illuminate\Auth\Middleware\Authenticate:sanctum, Illuminate\Routing\Middleware\ThrottleRequests:60,1,lucky-wheel |
| POST | api/matchmaking | App\Http\Controllers\RoomController@matchmaking | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/matchmaking/cancel | App\Http\Controllers\RoomController@matchmakingCancel | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| GET\|HEAD | api/me | App\Http\Controllers\AuthController@me | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/achievements | App\Http\Controllers\AchievementController@index | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/me/achievements/featured | App\Http\Controllers\AchievementController@setFeatured | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/achievements/unseen | App\Http\Controllers\AchievementController@unseen | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/active-rooms | App\Http\Controllers\RoomController@myActiveRooms | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/analytics | App\Http\Controllers\AuthController@analytics | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/club | App\Http\Controllers\ClubController@mine | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/dice-stats | App\Http\Controllers\AuthController@diceStats | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/error-journal | App\Http\Controllers\ErrorJournalController@index | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/match-pr | App\Http\Controllers\AuthController@matchPr | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/match-pr-gnubg/{match} | App\Http\Controllers\AuthController@matchGnubgPr | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/matches | App\Http\Controllers\AuthController@myMatches | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/matches/{match}/gnubg-review | App\Http\Controllers\AuthController@matchGnubgReview | api, Illuminate\Auth\Middleware\Authenticate:sanctum, Illuminate\Routing\Middleware\ThrottleRequests:30,1,gnubg-review |
| GET\|HEAD | api/me/matches/{match}/log | App\Http\Controllers\AuthController@matchLog | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/matches/{match}/mat | App\Http\Controllers\AuthController@matchMat | api, Illuminate\Auth\Middleware\Authenticate:sanctum, Illuminate\Routing\Middleware\ThrottleRequests:30,1,match-mat |
| GET\|HEAD | api/me/orders | App\Http\Controllers\ProductController@myOrders | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/performance-stats | App\Http\Controllers\AuthController@performanceStats | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/me/presence-status | App\Http\Controllers\PresenceController@setStatus | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/me/wxp-breakdown | App\Http\Controllers\AuthController@wxpBreakdown | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/membership/auto-renew | App\Http\Controllers\MembershipController@autoRenew | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/membership/trial | App\Http\Controllers\MembershipController@startTrial | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/menu-config | App\Http\Controllers\MenuController@index | api |
| GET\|HEAD | api/messages | App\Http\Controllers\MessageController@threads | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/messages/unread | App\Http\Controllers\MessageController@unread | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/messages/{userId} | App\Http\Controllers\MessageController@thread | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/messages/{userId} | App\Http\Controllers\MessageController@send | api, Illuminate\Auth\Middleware\Authenticate:sanctum, Illuminate\Routing\Middleware\ThrottleRequests:30,1,msg-send |
| POST | api/messages/{userId}/accept | App\Http\Controllers\MessageController@accept | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/messages/{userId}/decline | App\Http\Controllers\MessageController@decline | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/messages/{userId}/typing | App\Http\Controllers\MessageController@typing | api, Illuminate\Auth\Middleware\Authenticate:sanctum, Illuminate\Routing\Middleware\ThrottleRequests:60,1,msg-typing |
| DELETE | api/messages/{userId}/{messageId} | App\Http\Controllers\MessageController@destroy | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/nickname-available | App\Http\Controllers\AuthController@nicknameAvailable | api, Illuminate\Routing\Middleware\ThrottleRequests:30,1,nickname |
| POST | api/notifications/delete | App\Http\Controllers\PresenceController@deleteNotifications | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/notifications/read | App\Http\Controllers\PresenceController@readNotifications | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/online-players | App\Http\Controllers\RoomController@onlinePlayers | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| GET\|HEAD | api/pay/bank-transfer | App\Http\Controllers\PaymentController@bankInfo | api |
| POST | api/ping | App\Http\Controllers\PresenceController@ping | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/products | App\Http\Controllers\ProductController@index | api |
| POST | api/products/cart/coin | App\Http\Controllers\ProductController@cartCoinOrder | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/products/order | App\Http\Controllers\ProductController@order | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| PUT | api/profile | App\Http\Controllers\AuthController@updateProfile | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/rating/report | App\Http\Controllers\AuthController@reportRating | api, Illuminate\Auth\Middleware\Authenticate:sanctum, Illuminate\Routing\Middleware\ThrottleRequests:30,1,rating-report |
| POST | api/register | App\Http\Controllers\AuthController@register | api, Illuminate\Routing\Middleware\ThrottleRequests:20,1,auth-register |
| POST | api/reset-password | App\Http\Controllers\AuthController@resetPassword | api, Illuminate\Routing\Middleware\ThrottleRequests:10,1,auth-login |
| POST | api/review-mat | App\Http\Controllers\AnalysisController@matchReview | api, Illuminate\Auth\Middleware\Authenticate:sanctum, Illuminate\Routing\Middleware\ThrottleRequests:30,1,review-mat |
| POST | api/rooms | App\Http\Controllers\RoomController@create | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| GET\|HEAD | api/rooms/{code} | App\Http\Controllers\RoomController@show | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| PUT | api/rooms/{code} | App\Http\Controllers\RoomController@update | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/bot | App\Http\Controllers\RoomController@botNudge | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/chat | App\Http\Controllers\RoomController@chat | api, Illuminate\Routing\Middleware\ThrottleRequests:40,1,chat |
| POST | api/rooms/{code}/cube/offer | App\Http\Controllers\RoomController@cubeOffer | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/cube/respond | App\Http\Controllers\RoomController@cubeRespond | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/enter | App\Http\Controllers\RoomController@enter | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/join | App\Http\Controllers\RoomController@join | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/leave | App\Http\Controllers\RoomController@leave | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/live | App\Http\Controllers\RoomController@live | api, Illuminate\Routing\Middleware\ThrottleRequests:600,1,live |
| POST | api/rooms/{code}/move | App\Http\Controllers\RoomController@move | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/rematch | App\Http\Controllers\RoomController@rematch | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/resign | App\Http\Controllers\RoomController@resign | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/roll | App\Http\Controllers\RoomController@roll | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/settle | App\Http\Controllers\RoomController@settle | api, Illuminate\Routing\Middleware\ThrottleRequests:240,1,rooms |
| POST | api/rooms/{code}/watch | App\Http\Controllers\RoomController@watch | api, Illuminate\Routing\Middleware\ThrottleRequests:120,1,watch |
| GET\|HEAD | api/shop | App\Http\Controllers\ShopController@index | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/shop/buy | App\Http\Controllers\ShopController@buy | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/shop/cart-checkout | App\Http\Controllers\PaymentController@cartCheckout | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/shop/checker | App\Http\Controllers\ShopController@selectChecker | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/shop/coins | App\Http\Controllers\PaymentController@buyCoins | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/shop/daily | App\Http\Controllers\ShopController@daily | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/shop/frame | App\Http\Controllers\ShopController@selectFrame | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/shop/membership | App\Http\Controllers\PaymentController@buyMembership | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/shop/promo/validate | App\Http\Controllers\PaymentController@promoValidate | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/subscribe | App\Http\Controllers\PaymentController@subscribe | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/tournament-ads | App\Http\Controllers\TournamentAdController@index | api |
| GET\|HEAD | api/tournaments | App\Http\Controllers\TournamentController@index | api |
| POST | api/tournaments | App\Http\Controllers\TournamentController@create | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/tournaments/{tournament} | App\Http\Controllers\TournamentController@show | api |
| DELETE | api/tournaments/{tournament} | App\Http\Controllers\TournamentController@destroy | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/tournaments/{tournament}/finish | App\Http\Controllers\TournamentController@finish | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/tournaments/{tournament}/join | App\Http\Controllers\TournamentController@join | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/tournaments/{tournament}/leave | App\Http\Controllers\TournamentController@leave | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/tournaments/{tournament}/match-room | App\Http\Controllers\TournamentController@matchRoom | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/tournaments/{tournament}/no-show | App\Http\Controllers\TournamentController@noShow | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/tournaments/{tournament}/report | App\Http\Controllers\TournamentController@report | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| POST | api/tournaments/{tournament}/start | App\Http\Controllers\TournamentController@start | api, Illuminate\Auth\Middleware\Authenticate:sanctum |
| GET\|HEAD | api/users/{user}/profile | App\Http\Controllers\AuthController@publicProfile | api |
| GET\|HEAD | api/validator-check | App\Http\Controllers\RoomController@validatorCheck | api, Illuminate\Routing\Middleware\ThrottleRequests:60,1,validator |
| GET\|HEAD | email/verify/{id}/{hash} | App\Http\Controllers\AuthController@verifyEmail | web, Illuminate\Routing\Middleware\ValidateSignature |
| GET\|HEAD | filament/exports/{export}/download | Filament\Actions\Exports\Http\Controllers\DownloadExport | filament.actions |
| GET\|HEAD | filament/imports/{import}/failed-rows/download | Filament\Actions\Imports\Http\Controllers\DownloadImportFailureCsv | filament.actions |
| GET\|HEAD | livewire/livewire.js | Livewire\Mechanisms\FrontendAssets\FrontendAssets@returnJavaScriptAsFile |  |
| GET\|HEAD | livewire/livewire.min.js.map | Livewire\Mechanisms\FrontendAssets\FrontendAssets@maps |  |
| GET\|HEAD | livewire/preview-file/{filename} | Livewire\Features\SupportFileUploads\FilePreviewController@handle | web |
| POST | livewire/update | Livewire\Mechanisms\HandleRequests\HandleRequests@handleUpdate | web |
| POST | livewire/upload-file | Livewire\Features\SupportFileUploads\FileUploadController@handle | web, Illuminate\Routing\Middleware\ThrottleRequests:60,1 |
| GET\|HEAD | panel | Closure | web, App\Http\Middleware\EnsureAdmin |
| GET\|HEAD | panel/content | App\Http\Controllers\PanelController@contents | web, App\Http\Middleware\EnsureAdmin |
| POST | panel/content | App\Http\Controllers\PanelController@contentSave | web, App\Http\Middleware\EnsureAdmin |
| POST | panel/content/{content}/delete | App\Http\Controllers\PanelController@contentDelete | web, App\Http\Middleware\EnsureAdmin |
| GET\|HEAD | panel/enter | App\Http\Controllers\PanelController@enter | web |
| GET\|HEAD | panel/login | App\Http\Controllers\PanelController@showLogin | web |
| POST | panel/login | App\Http\Controllers\PanelController@login | web |
| POST | panel/logout | App\Http\Controllers\PanelController@logout | web |
| GET\|HEAD | panel/mail | App\Http\Controllers\PanelController@mail | web, App\Http\Middleware\EnsureAdmin |
| POST | panel/mail | App\Http\Controllers\PanelController@mailTest | web, App\Http\Middleware\EnsureAdmin |
| GET\|HEAD | panel/notifications | App\Http\Controllers\PanelController@notifications | web, App\Http\Middleware\EnsureAdmin |
| POST | panel/notifications | App\Http\Controllers\PanelController@notificationSend | web, App\Http\Middleware\EnsureAdmin |
| GET\|HEAD | panel/tournaments | App\Http\Controllers\PanelController@tournaments | web, App\Http\Middleware\EnsureAdmin |
| POST | panel/tournaments | App\Http\Controllers\PanelController@tournamentCreate | web, App\Http\Middleware\EnsureAdmin |
| POST | panel/tournaments/{tournament}/delete | App\Http\Controllers\PanelController@tournamentDelete | web, App\Http\Middleware\EnsureAdmin |
| POST | panel/tournaments/{tournament}/finish | App\Http\Controllers\PanelController@tournamentFinish | web, App\Http\Middleware\EnsureAdmin |
| GET\|HEAD | panel/users | App\Http\Controllers\PanelController@users | web, App\Http\Middleware\EnsureAdmin |
| POST | panel/users/{user} | App\Http\Controllers\PanelController@userUpdate | web, App\Http\Middleware\EnsureAdmin |
| POST | pay/callback | App\Http\Controllers\PaymentController@callback | web, Illuminate\Routing\Middleware\ThrottleRequests:30,1 |
| GET\|HEAD | pay/card/{payment} | App\Http\Controllers\PaymentController@card | web, Illuminate\Routing\Middleware\ValidateSignature |
| GET\|HEAD | pay/onizleme | Closure | web |
| GET\|HEAD | pay/result | Closure | web |
| POST | pay/submit/{payment} | App\Http\Controllers\PaymentController@submit | web, Illuminate\Routing\Middleware\ValidateSignature |
| GET\|HEAD | sanctum/csrf-cookie | Laravel\Sanctum\Http\Controllers\CsrfCookieController@show | web |
| GET\|HEAD | storage/{path} | Closure |  |
| PUT | storage/{path} | Closure |  |
| GET\|HEAD | up | Closure |  |
| GET\|HEAD | {fallbackPlaceholder} | Closure | web |

Envanter aşağıya Laravel'in gerçek route registry çıktısından eklenir. API `api` grubu SiteGate/ShieldTracker ile bootstrap'ta genişletilir; `auth:sanctum`, admin, signed ve throttle bilgileri route registry'deki değerlerdir. `web` grubu session/CSRF gibi varsayılan middleware'i temsil eder; payment CSRF istisnaları yukarıda açıklanmıştır. Filament sayfa route'ları ayrıca Livewire action endpoint'lerini kullanır. Generic storage routes middleware listesi boş görünse de vendor handler içinde signature/path kontrolleri olabilir; yalnız boş route middleware üzerinden açık ilan edilmez.
## Audit amendment — game-log write authorization (2026-09-21)

**ID:** SEC-014 (remediated in this change)
**Severity:** HIGH
**Category:** Replay integrity / authorization / forensic data
**Affected file(s):** `backend/app/Http/Controllers/GameLogController.php`, `src/api.ts`
**Affected endpoint/event:** `POST /api/game-logs`

**Original evidence:** The endpoint was public and trusted the caller-supplied `slot`, `winner`, `score`, and `status`. When a `uid` matched an online room, any caller who knew the room code could overwrite either event column and forge replay metadata. The route had throttling but no room ownership check. This did not prove direct wallet settlement impact because settlement/rating use the authoritative room result, but it corrupted replay and forensic evidence.

**Applied control:** When an online room exists, writes resolve the seat with `RoomAccess::slot` using the authenticated account ID or the matching guest capability token. The requested slot is overwritten with the resolved seat. Online names/user IDs come from the room, and result metadata is written only from `Room::hasVerifiedServerResult()` / `server_match`; client winner/score/status are ignored. A late orphan log whose room was already deleted remains best-effort telemetry but has no authoritative result or settlement effect. The frontend sends the existing room token in the log payload when needed. PvB/local logging remains guest-compatible and is explicitly non-authoritative for economic results.

**Residual limitation:** Event arrays are still client-originated telemetry and are not a source of truth for board, dice, winner, rating, or wallet state. Public `GET /api/game-logs/{uid}/mat` remains available for replay compatibility; private replay policy and retention should be decided separately.

**Regression test required:** Add isolated HTTP tests with two authenticated users and two guest tokens proving wrong-seat writes return 403, online client result fields are ignored, verified server result is copied, and retrying the same seat remains idempotent. Do not run against production or real balances.

## Audit amendment — server dice modulo bias (2026-09-21)

**ID:** SEC-016 (remediated in this change)
**Severity:** MEDIUM
**Category:** RNG fairness
**Affected file(s):** `backend/app/Services/FairDiceService.php`
**Affected endpoint/event:** authoritative room roll/opening roll

The server previously mapped raw HMAC bytes with `% 6`, making faces 1–4 occur 43/256 and faces 5–6 42/256. `roll()` and `single()` now use domain-separated HMAC blocks with rejection sampling (`byte < 252`) before mapping to 1–6. This preserves deterministic commit/reveal behavior while removing the modulo bias. Existing historical rolls are not rewritten.

The frontend's local verifier already used rejection sampling but a different local hash helper; production parity should be covered by a server test vector before enabling client-side reveal verification for server rolls.

## Audit amendment — validator service fail-closed (2026-09-21)

**ID:** SEC-017 (partially remediated)
**Severity:** MEDIUM
**Category:** Internal service authentication / transport hardening
**Affected file(s):** `validator/server.ts`, `gnubg-service/gnubg_service.py`, `backend/config/validator.php`

The validator and GNUbg POST endpoints now reject all requests with `503` when their shared secret is missing, instead of treating an empty secret as “authentication disabled.” Wrong or missing headers still receive `401`. Validator bind defaults to `127.0.0.1` and is overrideable only through an explicit host environment setting. Laravel TLS certificate verification now defaults to enabled for remote validator URLs.

The health endpoints remain unauthenticated for process monitoring. Production environment values, reverse proxy exposure, and actual certificate configuration remain **UNKNOWN** and require deployment verification.

## Audit amendment — Sanctum SSO expiry check (2026-09-21)

The two manual token-to-web-session SSO handlers (`/admin/enter` and `/panel/enter`) now reject a token whose `expires_at` is in the past. `PersonalAccessToken::findToken()` itself only verifies the hash; it does not apply expiry, unlike Sanctum's normal guard path. Query-string exposure and the lack of a one-time SSO exchange remain documented residual risks.

## Audit amendment — upload content validation (2026-09-21)

**ID:** SEC-021 (partially remediated)
**Severity:** MEDIUM
**Category:** Unsafe file upload
**Affected file(s):** `backend/app/Http/Controllers/BugReportController.php`, `backend/app/Http/Controllers/PanelController.php`

Bug-report data URLs now require a real image signature from `getimagesizefromstring`, a MIME match with the declared type, and a 40-million-pixel limit in addition to the existing byte limit. Admin content uploads now derive the extension from server-detected content, allow only `jpg/png/gif/webp`, and use a cryptographically random filename instead of the client filename. Public upload execution policy and production web-server behavior remain deployment checks.

## Audit amendment — alert/log redaction (2026-09-21)

500 alerts now use scheme/host/path without the query string, and exception/job error text redacts bearer credentials plus `token`, `password`, `secret`, `authorization`, and `api_key` assignments before it reaches the alert channel. Full application logs and third-party exception text still require deployment-level retention and redaction review.

## Audit amendment — admin balance hold guard (2026-09-21)

Admin API, legacy panel, and Filament user edits now lock the target user row before changing `coins` and reject a requested balance below `coins_reserved`. This prevents an admin adjustment from invalidating an active escrow and removes the read/check/write race with settlement. A complete immutable wallet ledger, actor/reason/reference record, and reconciliation process remain open under SEC-015.

## Audit amendment — rating lock fail-closed (2026-09-21)

`reportRating` no longer treats a cache-lock exception as permission to continue. If the result lock backend is unavailable, the endpoint returns `503` before any rating/stat/result write. This prevents a cache outage from turning the existing lock into a fail-open duplicate-Elo path. The remaining gap is the broad rating/result/side-effect transaction and explicit lock release, which require a dedicated finalization refactor.

## Audit amendment — authoritative version envelope required (2026-09-21)

Authoritative room commands (`roll`, `move`, cube offer/respond, resign) now reject an omitted `expected_version` with `428 expected-version-required`. Previously the field was optional, so an old/manual client could bypass stale-tab detection. Legacy non-authoritative friendly/dice-only rooms retain their compatibility path.

## Audit amendment — dice enforcement default (2026-09-21)

`config/dice.php` now defaults `DICE_ENFORCE` to `true`. A dice-authority room rejects a client state whose turn-start dice do not match a server-issued/opening roll; the previous default `false` only logged the mismatch and allowed the client value. Explicitly setting `DICE_ENFORCE=false` remains an operator rollback/shadow choice and is recorded as a security downgrade.

## Audit amendment — full authoritative mode default (2026-09-21)

`config/game.php` now defaults `SERVER_AUTHORITATIVE=true`, so newly created free/friendly rooms also use server board, legal-move, score, and cube state. If the validator is missing or unreachable, authoritative moves fail closed. An explicit `SERVER_AUTHORITATIVE=false` remains available only as a documented availability rollback and is a security downgrade for non-money rooms.

## Audit amendment — queue visibility for long analysis jobs (2026-09-21)

The default database, Redis, and Beanstalk queue `retry_after` is now 720 seconds, exceeding the 600-second PR analysis job timeout with margin. The previous 90-second default could make an in-progress heavy job visible to a second worker before the first worker finished. Existing environment overrides remain authoritative and must be set above the longest worker timeout in deployment.

The PR and luck jobs also use Laravel `WithoutOverlapping` locks keyed by `match_result_id`, with expiries longer than their normal work windows. A duplicate dispatch is dropped while the first analysis is active. This is compute/result deduplication; wallet settlement still requires its own economic idempotency claim.

## Audit amendment — percentage stake snapshot (2026-09-21)

**ID:** SEC-022 (remediated for new matches; legacy rooms fail closed)
**Severity:** HIGH
**Category:** Wallet / settlement integrity / race condition
**Affected file(s):** `backend/app/Http/Controllers/RoomController.php`, `backend/app/Models/Room.php`
**Affected endpoint/event:** matchmaking and `POST /api/rooms/{code}/settle`

The previous percentage settlement calculated each player's wager from the live `coins` balance at match finish. Credits or other balance changes during a match could therefore change the stake after admission. Matchmaking now locks both users, computes a percentage stake snapshot, and stores it in the internal `server_match.pct_stake_snapshot` field. Settlement uses only that snapshot and never recomputes from finish-time balances. The internal field is removed from `Room::toClient()` responses. A percentage room without a snapshot returns `409` and remains unsettled instead of falling back to a client or live-balance value.

Fixed-stake escrow behavior remains unchanged. Existing percentage rooms created before this control do not have a snapshot and are intentionally fail-closed; they require an operator/data-repair decision rather than an inferred payout.

**Regression test required:** concurrent percentage matchmaking must assert one locked snapshot per player; settlement after a balance credit must transfer the original snapshot amount; a missing snapshot must roll back the settled claim and return `409`.

The settlement path also now rejects a loser balance below the locked amount with `409` and rolls back the claim transaction. It no longer silently performs a partial payout when an out-of-band balance adjustment conflicts with the match stake.

## Audit amendment — validator diagnostic access (2026-09-21)

The `/api/validator-check` diagnostic endpoint is now restricted to an authenticated admin and retains throttling. Anonymous callers can no longer trigger validator work or map internal service availability through this route.

## Audit amendment — authoritative command replay claim (2026-09-21)

Authoritative `roll`, `move`, cube offer/respond, and `resign` requests now accept a UUID `command_id`. When the `room_commands` table exists, the locked room transaction records a unique `(room_id, command_id, payload_hash)` receipt and rejects a duplicate or payload mutation with `409`; missing IDs fail closed with `428`, and a missing command store returns `503`. The frontend includes a fresh UUID for each new command. The migration is created but intentionally not executed in this audit session. Existing deployments must run it before enabling authoritative commands.

**Residual limitation:** this first receipt layer returns a replay error rather than a persisted original response. A later finalization phase should store the canonical response/result version and return it as an idempotent NO-OP. Network retry code must reuse the original command ID when added.

## Audit amendment — payment failure callback race (2026-09-21)

The failure branch of the bank callback now re-reads and locks the payment row inside a transaction before writing `failed`. A stale failure callback can no longer overwrite a concurrent successful `paid` claim. Payment fulfillment remains transactional for the local account/order writes; immutable payment event and wallet-ledger reconciliation remain open under SEC-012 and SEC-015.

## Audit amendment — result lock release and deployed client version (2026-09-21)

`reportRating` now explicitly releases its cache result lock on all normal idempotent and success return paths; a lock is no longer held until TTL solely because the request completed early. The frontend production bundle was rebuilt so authoritative roll/resign requests include the current `expected_version`; the observed `428 expected-version-required` console errors came from a stale deployed bundle, not from weakening the server check.

## Audit amendment — economic room cleanup safety (2026-09-21)

Opportunistic and scheduled stale-room cleanup now deletes only rooms that are both `finished` and `settled`. Playing, escrowed, and finished-unsettled rooms are retained for settlement/backstop recovery instead of deleting the only hold/payout reference. This closes the destructive cleanup path from SEC-011; reconciliation and archival retention remain open work.

## Audit amendment — privileged wallet adjustment audit events (2026-09-21)

Admin REST and legacy panel coin adjustments now emit high-severity Shield audit events containing actor ID, target user ID, and before/after balance values. Credentials and raw request payloads are not recorded. This improves forensic coverage for SEC-015; the immutable wallet ledger and Filament/admin adjustment reason/reference fields remain open.

Filament `UserResource` coin edits now emit the same audit event after the locked update path, closing the third admin-surface gap. A durable wallet ledger and mandatory adjustment reason/reference remain required for full SEC-015 closure.

## Audit amendment — wallet transaction foundation (2026-09-21)

An append-only `WalletTransaction` model, migration, and `WalletService` were added. Payment coin and cart fulfillment now use the service, which records transaction UUID, user, signed amount, balance before/after, type, and payment reference when the migration exists. Negative balances are rejected. The migration was not executed; legacy writers still require migration to the shared service before SEC-015 can be marked complete.

Shop purchases, daily rewards, Lucky Wheel spins, and Dice Slot debit/payout paths now also call `WalletService`. Their existing user-row locks and business guards remain in place. Tournament, match settlement, achievements, and admin absolute adjustments still need migration to the same ledger protocol.

Tournament entry fees, refunds, configured prizes, and entry-fee pool payouts now use `WalletService` with locked recipient rows and tournament references. Match settlement and achievement/reward writers remain to be migrated before the ledger invariant is complete.

Physical product purchases (single/cart) and the one-time welcome reward now use the same service. Welcome grant retains its row-lock/idempotency guard; remaining direct writers are match settlement, achievement rewards, Lucky Wheel reward fulfillment, and admin absolute balance changes.

Achievement unlock coin rewards and Lucky Wheel coin rewards now use `WalletService` with their achievement/reward references. The remaining direct economic writer is authoritative match settlement, plus admin absolute overwrites which require a ledger adjustment model rather than a credit/debit operation.

Authoritative match settlement now records loser debit and winner credit through `WalletService`, using the room as the economic reference while preserving escrow reservation release in the same transaction. The remaining ledger gap is admin absolute balance adjustment modeling and migration execution/reconciliation.

Admin REST, legacy panel, and Filament balance edits now call `WalletService::setBalance`; the target value is represented as a signed adjustment and cannot violate `coins_reserved`. The wallet ledger migration and production reconciliation are still intentionally pending.

Added read-only `wallet:reconcile` command. It compares each user balance with the append-only ledger projection and flags `reserved > balance` without modifying data. It fails closed when the ledger table is not present; no automatic repair or production migration was run.

## Current status correction (2026-09-21)

The original discovery checklist above intentionally preserves historical findings. Current implementation status is amended here: authoritative command receipts exist for `roll/move/cube/resign`; percentage stake snapshots and fail-closed settlement are active; stale cleanup retains unsettled rooms; validator diagnostics require admin access; wallet writers for payment, shop, rewards, tournaments, products, settlement, and admin adjustments route through `WalletService`. These controls do not replace the remaining database migration, production rollout, persisted command responses, or real parallel DB regression tests.

## Audit amendment — database integrity constraints prepared (2026-09-21)

**ID:** SEC-024 (prepared, not deployed)
**Severity:** HIGH
**Category:** Database invariants / concurrency support
**Affected file(s):** `backend/database/migrations/2026_09_21_235000_add_security_integrity_constraints.php`

A deployment-ready migration now adds database checks for distinct room players, terminal-only settled rooms, `coins_reserved <= coins`, and wallet ledger arithmetic. It also adds indexes used by active-room admission queries. Before adding any constraint it scans for violating rows and aborts with a descriptive error; it does not delete or repair data. The migration has **not** been executed in this audit session.

This does not create a database-enforced partial unique constraint for “one active money room per user”; that rule spans two nullable participant columns and room status, so the current application row-lock protocol remains necessary. A future participant/admission table or database-specific partial index is required for a complete database-only guarantee. Production schema support (MySQL version, existing violations, and rollout order) remains UNKNOWN until deployment inspection.
## Audit amendment — dependency and transport evidence (2026-09-21)

The repository root has no Composer manifest; the PHP manifest is under `backend/`. `composer audit` from that directory could not reach Packagist in this sandbox, so dependency vulnerability status is **UNKNOWN**, not PASS. The root and `validator/` JavaScript projects do not contain a lockfile, therefore `npm audit` cannot produce a reproducible advisory result; no lockfile was generated and no dependency was installed.

No Laravel WebSocket/Broadcasting server or socket command channel was found in the route/application inventory. Live match updates use authenticated HTTP polling/presence endpoints. WebSocket-specific controls are therefore **N/A for the current codebase**, while any future socket service must reuse `RoomAccess`, command IDs, and server-authoritative state handlers rather than accept broadcast events as mutations.

## Audit amendment — command result version receipt (2026-09-21)

After a claimed authoritative `roll`, `move`, cube, or `resign` transaction commits, the corresponding `room_commands.result_version` is now populated from the canonical response. This gives retries and forensic review the exact server revision reached by the command. The command receipt still returns a replay response rather than the original JSON body; full response replay remains a later compatibility enhancement.

## Audit amendment — regression suite compatibility findings (2026-09-21)

The focused Feature security suite was executed against SQLite without running migrations: 38 tests, 104 assertions, with 11 failures and 1 error. The failures are fixture compatibility failures after the security contract was tightened: legacy test requests omit required `command_id`/`expected_version`, and several fixtures reference numeric room users that are not authenticated test users, so `RoomAccess` correctly returns `403`. Additional dice/cube fixtures still assume legacy client state. These failures must be fixed in the test harness by creating real users, authenticating them, and generating UUID command IDs plus the current state version; relaxing production authorization would be incorrect. The existing isolated unit security suite remains green at 89 tests / 204 assertions.

## Audit amendment — wallet ledger fail-closed (2026-09-21)

`WalletService` now rejects every economic write when `wallet_transactions` is unavailable and `WALLET_REQUIRE_LEDGER` is enabled (the default). The balance row is checked before it is saved, so an un-migrated deployment cannot silently mutate coins without an immutable ledger record. Setting the environment flag to `false` is an explicit, temporary security downgrade for a controlled migration shadow period and must not be used for money production.

## Audit amendment — repeated Lucky Wheel reward ledger reference (2026-09-21)

Focused wallet tests exposed a legitimate-repeat collision: coin rewards used the static `LuckyWheelReward` row as their unique ledger reference, so winning the same configured reward twice violated the ledger uniqueness key. The spin receipt is now created first and its unique `LuckyWheelSpin` ID is used as the economic reference. `LuckyWheelTest` passes 13 tests / 132 assertions after the correction.

## Audit amendment — product coin purchase receipt ordering (2026-09-21)

Single and cart coin purchases previously debited the wallet with a null `ProductOrder` reference before creating the order, leaving economic rows without an immutable business reference. They now create pending order receipts inside the same transaction, debit using the order ID (the first order ID for a cart), then mark the receipts paid. Stock, order, wallet, and ledger writes roll back together on failure. A client retry still needs an explicit checkout idempotency key to become a no-op. `ProductOrderTest` and `LuckyWheelTest` pass 23 tests / 176 assertions.

An optional UUID `idempotency_key` is now accepted for single and cart coin checkout. It is scoped to the authenticated user and stored on the order; repeated requests with the same key return the existing order set without another debit or stock change. The unexecuted migration adds the supporting unique index, and the regression test covers the single-order retry path. Requests that omit a key retain existing compatibility behavior and should be given a key by the frontend for network retries.

The production frontend now generates and sends a checkout key for the cart coin flow. TypeScript/Vite build succeeded and the ProductOrder feature suite remains green at 11 tests / 49 assertions. The backend still accepts omitted keys for backward compatibility; those callers do not receive replay protection until they adopt the key.

## Audit amendment — tournament entry/refund ledger references (2026-09-21)

Tournament entry and refund writes no longer use the static tournament ID as a unique wallet reference. A user may legitimately leave and later rejoin the same open tournament, while the locked player list already prevents duplicate entry and makes repeated leave a no-op. Prize and pool settlement references remain tournament-scoped and idempotent.

Achievement and Dice Slot regression coverage was also run: 31 tests / 235 assertions completed, with one legacy `AchievementTest` fixture still expecting a client-supplied rating result path that now correctly returns `409` without a verified authoritative room result. No wallet duplicate or payout collision was found in these flows.

## Audit amendment — migration rollout runbook (2026-09-21)

`SECURITY_MIGRATION_RUNBOOK.md` now documents the non-destructive production rollout sequence, backup requirement, migration order, reconciliation checks, feature flags, smoke tests, and rollback boundaries. No migration or production data operation was executed during this audit.

## Audit amendment — opening-roll command envelope (2026-09-21)

The opening authoritative roll previously returned before the command receipt guard, allowing a manual request without `command_id`. The guard now runs before every authoritative roll branch, including opening and reused-dice responses. Stale-version validation runs before claiming the receipt, and the payload hash excludes `expected_version` so a network retry may refresh its optimistic version without becoming a payload mismatch. `RoomCommandIdempotencyTest` passes 2 tests / 12 assertions.

The regression now also proves that a stale request leaves zero command receipts and the same command ID can succeed after the client refreshes to the current version. The suite passes 3 tests / 16 assertions.

Cube offer and resign are covered by the same missing-command rejection test; the complete command envelope suite now passes 4 tests / 21 assertions.

## Audit amendment — full suite compatibility inventory (2026-09-21)

The complete Laravel suite was executed in SQLite: **497 tests / 7,576 assertions**, with 87 failures, 5 errors, and 4 skipped. The failures cluster around legacy fixtures that do not create/authenticate room users, omit `command_id` or `expected_version`, submit client-owned dice/state to now-authoritative endpoints, or expect pre-hardening rating/no-show behavior. The new security checks are intentionally returning `403`, `409`, and `428` in these cases. No production authorization or server-authoritative check will be weakened to satisfy these fixtures; the test harness must be migrated in a dedicated batch.

## Audit amendment — security fixture migration plan (2026-09-21)

The required test-harness migration is documented in [`SECURITY_TEST_FIXTURE_MIGRATION.md`](SECURITY_TEST_FIXTURE_MIGRATION.md). It defines the fixture contract for authenticated room ownership, UUID command envelopes, server-issued state/dice, verified settlement, and checkout idempotency. The plan is intentionally documentation-only in this phase: no test fixture or production source was changed, no migration was executed, and no production data was touched.

The first four authoritative feature groups were rerun independently: **55 tests / 96 assertions, 45 failures, 5 errors**. Every failure is consistent with the tightened contract: legacy fixtures use nonexistent numeric user IDs, omit the required command envelope, or attempt to seed client-owned dice/state. This confirms the suite is not evidence of a production bypass; it is evidence that the fixtures must be migrated in the batch order above. The focused unit/security suites and wallet/product suites remain green as recorded earlier.

## Audit amendment — out-of-turn roll replay guard (2026-09-21)

While migrating the authoritative loop fixture, a real edge case was reproduced: after a valid roll, a different seat could call `roll` and receive the already-issued dice with HTTP 200. The board did not change, but accepting the command and creating a receipt violated the turn boundary and exposed normal-turn dice to the wrong actor. `RoomController::roll()` now checks the authoritative turn before the normal-roll reuse response; opening-roll reuse remains available for the initial two-client race. `RoomServerAuthTest` and `AuthoritativeLoopTest` pass **14 tests / 98 assertions** after the guard.

`RoomDiceAuthorityTest` fixtures now create real users, authenticate through Sanctum, and declare the explicit `friendly` legacy mode required for the independent dice-authority path. The suite passes **12 tests / 77 assertions** without weakening server dice validation.

`RoomCubeTest` authoritative offer/respond/move/resign calls now use authenticated users with fresh UUID command IDs and current server versions. The cube suite passes **29 tests / 95 assertions**; the two intentional non-authoritative endpoint rejection checks remain guest-compatible.

The next `ServerMoveTest` batch was inspected but intentionally not committed: its fixtures pre-seed a partially opened authoritative state while asserting the older roll-reuse/opening semantics. Adding command IDs alone produces contradictory version/turn expectations. It requires a dedicated state-builder migration (server-issued roll, current `server_version`, and validator state) before the tests can be changed safely. Production authorization and turn checks were left unchanged.

That state-builder migration is now complete for `ServerMoveTest` and `ServerMatchTest`. Test commands select `rooms.version` for the independent dice-authority path and `server_version` for full authoritative rooms, while using fresh command IDs. The two suites pass **13 tests / 36 assertions**. The no-dice retry expectation now asserts the existing idempotent `ignored: true` response rather than treating a non-mutating retry as a new rejection.

`BotRoomTest` human move and cube commands now carry fresh command IDs and the current bot-room `server_version`. Bot HTTP slot rejection tests remain unchanged. The bot suite passes **12 tests / 59 assertions**.

Settlement/escrow/forfeit fixtures are now aligned with the hardened contract. `RoomSettleTest` authenticates both claimant users; `ForfeitLossTest` seeds the authoritative clock directly instead of using a blocked ranked-room client state update; and its late rating report expects the intentional `409` unverified-result response. Stale `playing + escrowed` cleanup now asserts that the room and reservations remain until settlement/reconciliation. The combined batch passes **15 tests / 67 assertions**.

`GameLogTest` now authenticates online room ownership and asserts that client-supplied online `status`, `winner`, and `score` are ignored until a verified server result exists. The game-log suite passes **10 tests / 55 assertions**. `AchievementTest` and `LuckV1EndToEndTest` still contain legacy report calls without an authoritative finished room; their `409 verified-match-required` responses remain intentional and require a dedicated room-result fixture.

The dedicated fixtures are now in place: achievement rating reports use a finished authoritative ranked room, and Luck V1 uses a server-match winner before queue analysis. The offline no-room path explicitly asserts `409 verified-match-required` and creates no result row. `AchievementTest` plus `LuckV1EndToEndTest` pass **13 tests / 88 assertions**.

`MatchBackstopTest` completed-room fixtures now include the authoritative `server_match` winner and score. This allows late client reports to enrich an existing bare row without reopening client-controlled result authority. The suite passes **5 tests / 28 assertions**.

## Audit amendment — full suite after fixture batches (2026-09-21)

The complete Laravel suite was rerun after the authoritative fixture migrations: **497 tests / 7,835 assertions**, with **21 failures** and **4 skipped**. This is down from the earlier 87 failures. The remaining failures are concentrated in legacy Lucky Wheel admin authentication, RoomClock/LivePreview ownership fixtures, one active-money admission expectation, and an outdated tournament no-show expectation. No production authorization guard was weakened to satisfy them; they remain the next dedicated fixture batch.

`RoomLivePreviewTest` now authenticates both member preview writers and the non-member rejection path with Sanctum users. The cosmetic preview suite passes **3 tests / 13 assertions** and still verifies that `version` is not bumped.

`RoomClockTest` now uses real user ownership, authenticated matchmaking, and the supported friendly legacy state path for clock-only coverage. The spectator no-contest case clears stale test authentication before polling. The clock suite passes **14 tests / 86 assertions**.

`LuckyWheelAdminTest` now grants admin access explicitly through the `users.is_admin` database field before issuing Sanctum requests. The suite passes **8 tests / 29 assertions**. The remaining full-suite discrepancy is documented: the free-match-while-money-match test receives the current active-match guard response, and the tournament no-show fixture reports an unexpected successful walkover when an opponent is present; neither was weakened in production.

The two remaining discrepancies are resolved. `Room::userHasActiveMoneyMatch()` and matchmaking admission now reserve the single slot only for economic rooms (`stake`, `bet_pct`, or escrow), so a zero-stake match remains allowed while a money match is active. `TournamentNoShowTest` now authenticates the second entrant as the actual opponent, proving that a present opponent blocks walkover. `RoomStakeGuardTest` passes **3 tests / 3 assertions** and `TournamentNoShowTest` passes **2 tests / 12 assertions**.

## Audit amendment — full suite green (2026-09-21)

After all fixture and invariant corrections, the complete Laravel suite passes **497 tests / 7,925 assertions with 0 failures**. Four tests remain skipped by their existing environment guards. No migration was executed and no production data was changed during this validation.

Final static validation also passed: `npm run build` completed TypeScript and Vite production compilation successfully; PHP lint passed for the changed Room, RoomController, and TournamentController files; and `git diff --check` reported no whitespace errors. Vite emitted only existing large-chunk performance warnings.

The isolated Playwright authoritative E2E passed: **1 test passed** for two-player matchmaking, server-authoritative dice, both-player moves, and turn rotation. The harness recreated only its separate `e2e` SQLite database. Production migration/pull/push was performed externally by the operator and was not executed by this audit session.

The complete Laravel suite was rerun after canonical command-response replay changes: **493 passed, 4 skipped, 7,926 assertions, 0 failures**. The skipped tests are existing environment guards; validator parity tests skip when `VALIDATOR_URL` is not configured.

## Audit amendment — validator TLS deployment check (2026-09-21)

With `VALIDATOR_URL=https://validator.tavlatv.com`, the live `/health` endpoint returned **200 OK**, but the host certificate chain failed client verification with `SEC_E_UNTRUSTED_ROOT`. Consequently, the default `verify_tls=true` path correctly treated the service as unreachable. Running the parity suite with only the test process configured as `VALIDATOR_VERIFY_TLS=false` produced **4 passing tests / 9 assertions**, confirming the validator endpoints and game-engine responses work. Production must install a publicly trusted certificate chain; disabling TLS verification remains a security downgrade and was not committed.
