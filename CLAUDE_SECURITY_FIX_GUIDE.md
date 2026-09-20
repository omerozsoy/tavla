# Claude için TavlaTV güvenlik düzeltme talimatı

Bu dosyayı `SECURITY_AUDIT.md` ile birlikte oku. Audit kanıt kaynağıdır; bu dosya bulguları uygulanabilir düzeltme görevlerine çevirir. Audit'teki 24 bulgunun tamamı aşağıda açıklanmıştır. Bu talimatı hazırlarken uygulama kodu değiştirilmedi.

## Claude'a görev ve çalışma sınırı

TavlaTV, Laravel backend ve React frontend ile çalışan, kullanıcıların coin karşılığında tavla oynayabildiği bir uygulamadır. Amacın audit bulgularını, kullanıcı uygulama aşamasını başlatmanı istediğinde, küçük ve doğrulanabilir değişikliklerle kapatmaktır. Sadece frontend kontrolleri eklemek yeterli değildir.

Önce `SECURITY_AUDIT.md`, repository talimatları, güncel git durumu ve ilgili kaynakları oku. Audit sırasında kaynak kod başka bir çalışma tarafından değişmişti. Satır numaralarını kesin kabul etme; metotları ve route zincirini güncel kodda yeniden bul. Bir açık zaten kapatılmışsa tekrar kod yazmak yerine kanıtını ve testini göster. Audit'teki UNKNOWN veya koşullu riskleri kesinleşmiş production exploit gibi sunma.

Bu belge tek başına production, deployment veya migration çalıştırma izni değildir. Önceki kullanıcı kısıtları geçerlidir:

- Production verisini, gerçek hesapları, coin/bakiyeleri değiştirme; gerçek ödeme gönderme.
- Migration, seed, `migrate:fresh`, reset veya destructive test çalıştırma. Şema önerisini önce somutlaştır; migration dosyası hazırlamak ile migration çalıştırmak ayrı eylemlerdir ve uygulama kapsamına göre ele alınmalıdır.
- Secrets, token, parola, kart verisi veya `.env` değerlerini çıktıya yazma.
- Başkasının değişikliklerini geri alma; ilgisiz refactor yapma.
- Zaten yetkilendirilmiş yerel çalışma için her dosyada tekrar izin sorma. Gerçek bir yetki sınırı varsa yalnız o sınırı, nedenini ve somut yapılacak işlemi açıkla.
- İzole test veritabanı ve sahte hesaplar kanıtlanmadan DB değiştiren testleri çalıştırma. Test ortamını kurmak migration gerektiriyorsa mevcut çalıştırmama kısıtını aşma; testleri hazırla ve çalıştırılamayan kısmı belirt.

Şu anda kullanıcı yalnız bu açıklama dosyasının hazırlanmasını istemiştir. Bu dosyanın oluşturulması, bu oturumda uygulama kodunu düzeltmeye başlandığı anlamına gelmez.

## Değişmez güvenlik sözleşmesi

Browser yalnız INTENT gönderir: roll, move, double, take, pass/drop, resign, join, leave. Server authenticated kullanıcıdan oyuncuyu bulur; client `user_id` seçemez. Server zar, sıra, legal move, board, skor, gammon/backgammon, cube, kazanan, AFK/timeout, rating, ödül, bahis ve settlement sonucunu hesaplar.

Client istediği alanları request'e ekleyebilir, React'i değiştirebilir, eski request'i tekrarlayabilir ve iki cihazdan aynı anda komut gönderebilir. Buna rağmen şu kurallar bozulmamalıdır:

1. Aynı user_id aynı anda en fazla bir aktif money match'te oyuncudur.
2. Aynı user aynı match'in iki seat'ini alamaz; bir seat iki kullanıcıya atanamaz.
3. Bir ekonomik sonuç yalnız bir defa muhasebeleşir.
4. Bir command yalnız bir defa uygulanır; eski command yeni oyuna taşınmaz.
5. Client sonuç, bakiye, reward veya zar belirleyemez; gelecekteki zarı öğrenemez.
6. Reserved coin başka bir debit ile harcanamaz.
7. Terminal maç yeniden aktif olamaz; açıklanmış seed ile oyun devam edemez.

İki tabın açık olması tek başına açık değildir. İki tabın aynı intent'i iki kere işletebilmesi veya stale state ile yeni oyunu değiştirebilmesi açıktır. İstersen birden çok authenticated bağlantıyı destekle; hepsi aynı server revision ve command idempotency kurallarına tabi olmalıdır. Tek aktif bağlantı politikası seçilirse server-side session generation ile eski bağlantıyı iptal et; sadece frontend mesajı yeterli değildir.

## Uygulama sırası

| Aşama | Amaç | İlgili bulgular |
|---|---|---|
| PHASE 0 | Açık exploit girişlerini kapat: legacy state, sahte sonuç, email-admin, yetkisiz money action | 001–004, 007 |
| PHASE 1 | Ortak authoritative action handler, terminal guard, command/revision; clock ve canonical log | 001, 009, 010, 014, 016 |
| PHASE 2 | Aktif kullanıcı claim'i, seat admission ve DB concurrency | 005, 006; 009–010'un DB kısmı |
| PHASE 3 | Wallet/hold/ledger, settlement, payment, Elo ve reward idempotency | 008, 011–013, 015; 002–003'ün kalıcı çözümü |
| PHASE 4 | Auth/session, internal servis ve privacy sınırları | 007, 017, 018, 021, 023, 024 |
| PHASE 5 | Abuse, compute limitleri, dependency düzeltmeleri | 019, 022 |
| PHASE 6 | Domain audit, redaction ve recovery monitoring | 020; 011, 012, 015 |
| PHASE 7 | Gerçek concurrency ve güvenlik regresyon matrisi | Tüm bulgular |

Testleri PHASE 7'ye kadar erteleme; her düzeltmenin testi aynı değişiklikte hazırlanmalı. Fazlar teslim sırasıdır. Örneğin DB command uniqueness hazırlanmadan idempotency düzeltmesine tamamlandı deme.

## SEC-001 — Client'ın authoritative state ve zar seed'ine müdahalesini kapat

**Sorun:** `RoomController::update` legacy `state/status` kabul ediyor. `Room::toClient` yalnız `status=finished` gördüğünde seed açıklayabiliyor. Böylece gerçek maç bitmeden seed öğrenilebilir. Client state, `MatchClock::onUpdate` üzerinden saati de etkiliyor.

**Değiştirilecek yerler:** `backend/app/Http/Controllers/RoomController.php` içindeki update/roll/tickClock/applyClockEnd; `backend/app/Models/Room.php`; `backend/app/Services/MatchClock.php`; ilgili `src/api.ts` çağrıları.

**Yapılacaklar:**

1. Ekonomik/ranked/authoritative odalarda client `state`, `status`, `score`, `winner`, `clock`, `dice` yazımını server'da reddet. Oda tipini client payload'ı belirlemesin. Legacy mod para/ödül üreten akışa sonradan bağlanamasın.
2. Gerekli kullanıcı metadata'sını açık allowlist ile ayrı işlemde tut; bu işlem canonical oyun alanlarını değiştiremesin.
3. Seed reveal yalnız server'ın geri döndürülemez terminal kararından sonra olsun. Açıklanmış seed ile tekrar roll veya resume imkânsız olsun; mutable status tek başına reveal şartı olmasın.
4. Clock'u client `matchOver/turnsPlayed/turn` alanlarından değil server state transition'larından güncelle.

**Kabul testi:** Aktif maçta finished/state spoof reddedilir, seed görünmez; rakip saati durduramaz; terminal maçta playing/roll/move reddedilir. Frontend PUT göndermiyor olması test değildir.

## SEC-002 — Rating ve achievement için client result fallback'ini kaldır

**Sorun:** `reportRating` gerçek server sonucu bulunamadığında client `won` ve diğer alanları kullanabiliyor; Elo, WXP ve achievement coin etkileniyor.

**Dosyalar:** `AuthController::reportRating/serverResultForRoom`, `backend/app/Support/RoomResult.php`, `backend/app/Services/Achievements/StatsUpdater.php`, `AchievementService.php`, `backend/app/Services/WxpService.php`, `backend/config/achievements.php`.

**Yapılacaklar:** Server-finalized canonical match ve authenticated participant zorunlu olsun. Missing/unknown/unfinished/other-user room için fallback yerine red ver. `won`, `opponent_rating`, gammon/backgammon ve achievement flags server olaylarından türesin. Client analiz/telemetrisi saklanabilir ama değer üretmesin. AI veya offline etiketi kullanılarak bu kural bypass edilemesin; ekonomik ödül verilecekse doğrulanabilir server oyun kaydı gereksinimi açık olsun. Elo/WXP/coin ödülünü unique source claim ve transaction ile bağla.

**Kabul testi:** Oda olmadan, başkasının odasıyla veya sahte flags ile Elo/WXP/coin değişmez. Aynı tamamlanmış maç 100 kez raporlandığında tek ekonomik etki oluşur.

## SEC-003 — Turnuva kazananını yalnız canonical server result'tan al

**Sorun:** Bracket oyuncusu olmak doğrulanıyor ama gerçek sonuç bulunmayınca client `winner_id` kabul ediliyor. Resolver legacy room state okuyor.

**Dosya:** `backend/app/Http/Controllers/TournamentController.php`: report, winnerIdFromRoom, applyWinnerToBracket, payPrizes, matchRoom.

**Yapılacaklar:** Client winner fallback'ini kaldır. Turnuva round/bracket ile doğru canonical room/result ilişkisini doğrula; oda tamamlanmış, oyuncular eşleşmiş ve sonuç aynı bracket için tüketilmemiş olsun. İlerleme ve ödül unique source ile transaction içinde bir kez uygulansın. No-show/admin hükmü ayrı yetkili, audit edilen server kararı olsun; bu karar genel client result kapısı açmasın.

**Kabul testi:** Maç bitmeden winner bildirimi, başka round sonucu ve duplicate final ödülü başarısız olur. Meşru final bir kez ilerler ve bir kez ödeme yapar.

## SEC-004 — Email'den admin rolü türetme

**Sorun:** Kullanıcının değiştirebildiği email config listesiyle eşleşirse doğrulanmadan admin olabiliyor. Exploit, listedeki adresin DB'de boşta olması gibi önkoşullara bağlıdır.

**Dosyalar:** `backend/app/Models/User.php::getIsAdminAttribute`, `AuthController::register/updateProfile`, `backend/config/services.php`, `EnsureAdmin`, Filament erişim kontrolü.

**Yapılacaklar:** Yetkiyi yalnız explicit DB role/permission grant üzerinden ver. Public register/profile email'i ayrıcalık kaynağı olmasın. Email değişince verification durumunu sıfırla. Mevcut adminlerin yalnız config fallback ile erişip erişmediğini hassas veri dökmeden değerlendir; canlı hesaplara otomatik rol atama. Güvenli admin geçişini ayrı uygulanabilir plan olarak sun. Bütün admin girişleri aynı role ve ban politikasını kullansın.

**Kabul testi:** Synthetic allowlist email ile doğrulanmamış kayıt/profil admin olamaz; gerçek explicit admin erişimi korunur; email değiştirmek rol vermez.

## SEC-005 — Bir kullanıcı için tek aktif money match'i DB'de garanti et

**Sorun:** `exists()` kontrolü atomik claim değildir. İki request aynı anda geçebilir. Ayrıca A'nın iki waiting odasına B/C katılınca host A iki aktif maça girebilir; sadece yeni katılanı kontrol etmek eksiktir.

**Dosyalar:** `RoomController::matchmaking/join/enter/rematch/openRematchRoom`, ilgili turnuva girişleri; mevcut room migrations ve hazırlanacak admission/claim modeli.

**Yapılacaklar:**

1. Bütün start yollarını ortak admission servisine yönlendir; hem host hem rakibi kontrol et.
2. Önerilen DB modeli `active_money_seats(user_id PRIMARY KEY, room_id FK)` veya eşdeğer atomik user ownership modelidir. İsim öneridir; mevcut şemaya göre tasarla. Ayrı p1/p2 UNIQUE index aynı sorunu çözmez.
3. Ortak transaction'da fresh state oku, katılımcıları sabit sırayla kilitle, aktif claim'leri al, stake hold'larını kur ve maçı başlat. Her writer için tek lock sırası belirle; bir yerde room→user, diğer yerde user→room yapma.
4. Claim çatışırsa hiçbir seat/hold/start değişikliği kalmasın. Sadece cache lock veya frontend active-room kontrolünü güvenlik garantisi sayma.
5. Claim'i ekonomik yükümlülük kapanmadan düşürme; terminal/settlement/cancel lifecycle'ını tanımla. WAITING için claim politikası açık olsun, fakat ACTIVE başlangıcında iki oyuncu da kesin claim almalı.

**Kabul testi:** İki ayrı DB connection/process ile aynı kullanıcı için iki odanın start'ını bariyerle çakıştır. Yalnız biri aktif olur. İki waiting host odası, join+rematch, matchmaking+join, farklı seat ve yüzde/fixed bahis kombinasyonlarını da dene. Ardışık unit test veya SQLite testi production row-lock garantisi değildir.

## SEC-006 — Seat alma, self-match ve rezervsiz giriş yollarını birleştir

**Sorun:** join/enter p2 boşluğunu kilitsiz kontrol ediyor; aynı user iki seat alabiliyor; kodla giriş ekonomik admission'ı atlayabiliyor.

**Dosyalar:** `RoomController::join/enter/matchmaking`; `TournamentController::matchRoom`; participant/room şeması.

**Yapılacaklar:** Locked room state üzerinde allowed status, distinct authenticated users, expected invitee ve hold şartlarını doğrula. Matchmaking rakibini token farklılığıyla değil user kimliğiyle ayır. Money room'a guest girişini reddet. Reconnect mevcut sahipliği doğrulasın, yeniden seat/hold oluşturmasın. Normalize participant modeli seçilirse `UNIQUE(room_id,user_id)` ve `UNIQUE(room_id,seat)` ile FK uygula; iki kolon korunuyorsa distinct-user CHECK ve admission garantisini birlikte tasarla. Turnuva room oluşturma da tek atomik claim olsun.

**Kabul testi:** Aynı user farklı token'larla kendine rakip olamaz. İki eşzamanlı p2 adayı için yalnız biri kazanır. Direct join, guest veya invite dışı giriş rezerv şartını bypass edemez.

## SEC-007 — Money action kimliğini authenticated hesaba bağla

**Sorun:** Client'ın seçtiği kalıcı room token'ı hesap session'ından bağımsız; logout sonrasında da komut gönderilebiliyor.

**Dosyalar:** `backend/routes/api.php`, `RoomController::slotOf` ve tüm action handler'ları, `AuthController::logout`, `src/api.ts`.

**Yapılacaklar:** Ekonomik komutlarda Sanctum auth, güncel ban/revocation kontrolü ve `request.user.id ∈ room.players` zorunlu olsun. Seat'i request user_id'den seçme. Guest capability gerekiyorsa parasız domain ile açıkça sınırla; server-generated scoped credential kullan. Query string'e credential koyma. Account-bound reconnect ve varsa session generation aynı action guard'ını kullansın. Frontend auth/header değişikliklerini backend ile birlikte yap.

**Kabul testi:** Room token'ını bilse bile bearer olmayan veya başka kullanıcı olan caller oynayamaz. Logout/revoke/ban sonrası eski session reddedilir. Yetkili aynı kullanıcı reconnect yapabilir; eski command tekrar uygulanmaz.

## SEC-008 — Reserved coin'i bütün harcamalarda koru

**Sorun:** Spin servisleri toplam coins kontrol ediyor; reserved coin harcanabiliyor. Yüzde stake settlement anındaki bakiye ile yeniden hesaplanıyor.

**Dosyalar:** `backend/app/Services/LuckyWheel/LuckyWheelService.php`, `backend/app/Services/DiceSlot/DiceSlotService.php`, `RoomController::settle`, `Room::userInPctStakedPlaying`; Shop/Product ve diğer debit yazarları.

**Yapılacaklar:** `available = balance - active_holds` kuralını merkezi WalletService'te uygula. Tüm debit'ler aynı locked transaction protokolünden geçsin. Yüzde bahis için başlangıç anındaki kesin tutarı server hesaplasın, iki tarafın ekonomik sözleşmesine kaydetsin ve reserve etsin. Maç içi harcama/gelir bu tutarı değiştirmesin. Mevcut açık maçlar için geçmiş stake'i tahmin edip değiştirme; ayrı geçiş planı gerekir. Eksik bakiyeyi `min(stake,balance)` ile sessizce normal settlement sayma; tutarsızlık reconciliation gerektirir.

**Kabul testi:** Balance 100, hold 80 iken 30 debit reddedilir; 20 debit mümkündür. Spin, shop, admin adjustment ve settlement eşzamanlı iken hold korunur. Finished fakat unsettled maçta da hold aktiftir.

## SEC-009 — Clock, timeout, leave ve scheduler aynı write protokolünü kullansın

**Sorun:** Move lock alırken polling/leave/timeout eski model snapshot'ını kilitsiz kaydedebiliyor.

**Dosyalar:** `RoomController::show/leave/tickClock/reapStaleRoom/finalizeDead/applyClockEnd`, `backend/app/Console/Commands/ReapStaleRooms.php`, `TickBotClocks.php`, `MatchClock.php`.

**Yapılacaklar:** Canonical state yazan tüm yolları aynı transaction + fresh locked read veya tutarlı revision CAS üzerinden geçir. Deadline'ı server zamanı ve kilitli state ile değerlendir. Tercihen GET yalnız projection dönsün; tick gerekiyorsa aynı command servisini kullansın. `withoutOverlapping` HTTP writer'ları kilitlemez. Timeout ile son hamle çakıştığında hangi server zaman kuralının uygulanacağını açıkça belirle.

**Kabul testi:** Son hamle/timeout, leave/move ve scheduler/HTTP yarışlarında tek terminal sonuç, monoton revision ve tutarlı clock oluşur; stale model yeni state'i ezemez.

## SEC-010 — Command idempotency, revision ve game scope ekle

**Sorun:** Aynı resign tekrar gönderilince sonraki oyuna da uygulanabiliyor. State uygunluğu tek başına command kimliği değildir.

**Dosyalar:** `RoomController::resign/applyGameResult/roll/move/cubeOffer/cubeRespond`; `src/api.ts`, ilgili online action çağrıları; command persistence şeması.

**Önerilen sözleşme:** `command_id`, `expected_revision`, `game_no` ve gerekiyorsa `turn_id` + yalnız intent payload. Client bu scope'u bildirir; doğruluğunu server kendi state'iyle karşılaştırır. Revision için mevcut `version/server_version` ayrımını incele; presence/chat poll gibi değişiklikler game revision'ını gereksiz arttırmasın.

**İşleme sırası:** Authenticate/authorize → command kimliğini ve payload hash'ini kontrol et → daha önce tamamlanmış aynı command ise saklanan sonucu dön → fresh state altında revision/game/turn/terminal doğrula → engine uygula → command sonucu, canonical state ve event'i aynı transaction'da kaydet. Aynı ID farklı payload ile gelirse conflict ver. Yeni command stale revision taşıyorsa conflict + güncel projection dön. Doğru retry eski expected_revision taşısa bile önceki command sonucunu alabilmeli.

**DB şartı:** Scoped unique command key; caller/room bağlantısı ve payload fingerprint. Eşzamanlı insert conflict tüm transaction'ı doğru rollback etmeli. In-memory map veya yalnız Redis TTL yeterli değil.

**Kabul testi:** Aynı command 2/10/100 kez ve paralel gönderildiğinde tek state değişimi; resign yeni oyuna taşınmaz; eski take yeni teklife uygulanmaz; terminal maçta roll/move reddedilir. Frontend retry yeni UUID üretmez, aynı intent'in ID'sini korur.

## SEC-011 — Finalization ve settlement'ı recovery ile tamamla

**Sorun:** Mevcut payout içindeki CAS/debit/credit/commission transaction'ı olumlu korumadır. Eksik olan, authoritative sonuçtan otomatik settlement'a ve cleanup'a uzanan bütünlüktür.

**Dosyalar:** `RoomController::settle/releaseEscrow/cleanupStale`, `backend/routes/console.php`, `backend/app/Support/MatchBackstop.php`, `ForfeitLoss.php`; hazırlanacak finalization/settlement/hold/outbox bileşenleri.

**Yapılacaklar:** Locked canonical state'ten immutable result üret. Unique settlement claim, hold tüketimi, loser debit/winner credit/fee ve finalized statüsü aynı yerel DB transaction'ında tutarlı olsun. Rating/reward aynı TX'de değilse immutable result'a bağlı transactional outbox ve idempotent consumer ile eventual durumu açıkça modelle; bunu tek atomik transaction diye sunma. Client settle çağrısı zorunlu tetikleyici olmasın. Retry/reconciliation pending kayıtları tamamlasın. Settlement ile release aynı kilit altında birbirini dışlasın; aynı hold iki kez serbest kalmasın. Cleanup açık hold veya ödenmemiş yükümlülüğü olan room'u silemesin.

**Kabul testi:** Her write noktasında yapay hata ile ya tam rollback ya da açıkça retry edilebilir pending durum kalır. İki settle yalnız bir ledger sonucu üretir. İki client kapalıyken maç sonuçlanır ve ödeme tamamlanır. Restart ve cleanup borç/hold kaybettirmez.

## SEC-012 — Payment fulfillment ile paid durumunu ayırma

**Sorun:** Pending→paid claim commit olduktan sonra fulfillment hata verirse retry teslimatı atlayabiliyor. Failure callback başarılı sonucu ezebilir.

**Dosyalar:** `PaymentController::callback/fulfillDemo/fulfillCart/fulfillProductOrder/activateMembership`, `backend/app/Models/Payment.php`; payment/fulfillment unique kayıtları.

**Yapılacaklar:** Mevcut banka hash, signed checkout ve server price doğrulamasını koru. Doğrulanmış banka event'ini unique identity ile kabul et; payment row lock altında yerel fulfillment, wallet ledger ve completed/paid transition'ını atomik yap. Birden çok ürün varsa tüm yerel teslimat aynı TX veya açık idempotent item modeliyle işlensin. Harici banka işlemi DB rollback ile geri alınamaz; dış servis için reconciliation gerekir. Failure callback tamamlanmış başarılı durumu geriye çeviremesin.

**Kabul testi:** Sadece synthetic callback/fake gateway ile success/success, success/failure ve fulfillment ortası crash testleri; tek teslimat, doğru status, güvenli retry. Gerçek bankaya istek gönderme.

## SEC-013 — Elo/result güncellemelerini aynı atomik kaynağa bağla

**Sorun:** Rating önce yazılıp sonra unique match-result insert'i hata verirse rating değişimi kalabiliyor. Cache lock hatasında fail-open davranışı var.

**Dosyalar:** `AuthController::reportRating`, `backend/app/Support/ForfeitLoss.php`, `MatchBackstop.php`, sonuç/rating servisleri ve match_results şeması.

**Yapılacaklar:** Canonical match sonucu için unique claim ile iki oyuncunun rating değişimini tutarlı transaction'a taşı. Bütün rating writer'ları aynı deterministic lock sırasını kullansın. Başlangıç rating ve uygulanan delta audit edilebilir olsun. Cache lock erişilemiyorsa güvenlik koşulunu atlama; doğruluğu DB sağlamalı. Unique violation yakalayıp önceki bağımsız save'i başarılı sayma.

**Kabul testi:** Rapor/backstop/forfeit aynı sonuç için yarışırken rating yalnız bir kez değişir. Unique conflict ve DB exception her iki oyuncunun rating/result tutarlılığını korur.

## SEC-014 — Canonical oyun logunu client'a yazdırma

**Sorun:** Public GameLog API caller'ın seçtiği uid/slot üzerinden başka maçın replay verisini ezebiliyor.

**Dosyalar:** `backend/app/Http/Controllers/GameLogController.php`, `AnalyzeMatchLuckJob` ve canonical MAT export tüketicileri; command event persistence.

**Yapılacaklar:** Authoritative hamle/event logunu başarılı server command transaction'ında append et. Export ve ödül/analiz kaynağı bunu kullansın. Client telemetry ayrı namespace ve trust etiketiyle saklansın; canonical winner/score/events'i overwrite edemesin. Legacy/offline upload gerekiyorsa sahiplik ve scoped server credential doğrula, ekonomik sonuç kaynağı yapma.

**Kabul testi:** Anonymous, üçüncü kullanıcı ve diğer slot overwrite girişimleri reddedilir. Aynı command duplicate log yaratmaz. Server replay canonical state ile uyuşur.

## SEC-015 — Coin muhasebesini ve admin adjustment'ı merkezileştir

**Sorun:** Dağınık doğrudan balance UPDATE'leri ve eksik immutable coin ledger muhasebe garantisini bozuyor. WXP ledger coin ledger değildir.

**Dosyalar:** `AdminController::updateUser`, `PanelController::userUpdate`, `backend/app/Filament/Resources/UserResource.php`, `UserResource/Pages/EditUser.php`; coin yazan payment, spin, tournament, shop, achievement ve settlement yolları.

**Yapılacaklar:** Ortak wallet service + immutable transaction/entry + per-match hold modeli kur. Kaydın transaction_id, user/account, amount, before/after balance, type, reference, actor, command ve timestamp ilişkileri bulunsun. Coin üretimi/yok edilmesi gerekiyorsa sistem kaynak hesabı/türü açık olsun; reconciliation matematiği tanımlansın. Unique economic reference ile duplicate etki engellensin. Admin düzeltmesi reason/actor ile ledger adjustment olsun; mutlak balance overwrite veya reserved altına indirme yapmasın. Değiştirilmiş ledger düzeltmesi eski satırı silmek yerine reversal/adjustment olsun.

**Geçiş notu:** Geçmişte olmayan hareketleri uydurma. Mevcut bakiyeler için onaylı opening-balance/reconciliation stratejisi hazırla; production'a kendin uygulama. FK/unique/check eklemeden önce eski veri uyumsuzluklarını salt okunur inceleme planı oluştur; otomatik silme yapma.

**Kabul testi:** Her coin writer aynı ledger'dan geçer; available/hold invariant korunur; admin adjustment ile payout yarışında veri kaybı olmaz; ledger toplamı balance ile uzlaşır.

## SEC-016 — Zar modulo bias'ını gider, algoritmayı sürümle

**Dosyalar:** `backend/app/Services/FairDiceService.php`, `src/engine/fairDice.ts`, RNG testleri.

**Sorun ve düzeltme:** 256 değerli bir baytı `%6` almak eşit dağılım üretmez. HMAC tabanlı deterministik byte stream içinde 252–255 değerlerini reddet; kabul edilen 0–251 için `%6+1` uygula. Stream biterse domain-separated counter ile yeni blok üret. Opening/normal dice/index ayrımını belgele ve algorithm version sakla. Client verifier server ile aynı algoritmayı kullansın; client zar üretme yetkisi kazanmasın. Aktif eski maçın RNG algoritmasını ortasında sessizce değiştirme.

**Kabul testi:** Sabit test vectors, 251/252/255 sınırları, ardışık rejection, stream expansion ve server/client parity. İstatistik testi yardımcıdır, tek ispat değildir. Seed secrecy SEC-001'de ayrıca kapanmalıdır.

## SEC-017 — Internal validator güvenli olmayan config ile açılmasın

**Dosyalar:** `validator/server.ts`, `backend/app/Services/MoveValidatorService.php`, `backend/config/validator.php`, `gnubg-service/gnubg_service.py`.

**Yapılacaklar:** Production/internal servis için nonempty secret zorunluluğu ve explicit loopback/private bind tanımla. Missing/wrong secret isteklerini reddet. TLS verification varsayılan açık olsun; local HTTP ve uzak TLS senaryolarını ayır. Restart kontrolünü normal validation yetkisinden ayır veya public erişimden çıkar. Servis ulaşılamadığında client state'e fallback yapma. Response schema ve state bütünlüğünü doğrula.

**Kabul testi:** Empty secret güvenli biçimde startup/config hatası üretir; yanlış key, geçersiz TLS ve yetkisiz restart reddedilir. Gerçek production port exposure audit'te UNKNOWN'dur; açıkmış gibi raporlama.

## SEC-018 — Session, SSO, ban ve email lifecycle'ını birleştir

**Dosyalar:** `backend/routes/web.php`, `PanelController::enter/login`, `EnsureAdmin`, `backend/config/sanctum.php`, Filament user editing, `AuthController` profil/logout/reset yolları.

**Yapılacaklar:** Uzun ömürlü PAT'yi URL query ile SSO'ya taşıma. Gerekirse kısa ömürlü, tek kullanımlık, intended audience/session'a bağlı exchange kodu kullan; consume atomik olsun. Token expiry, revocation, ban ve session-generation kontrollerini bütün admin/API yollarında uygula. Form üzerinden ban ile özel ban endpoint'i aynı revocation servisini kullansın. Email değişimi verification'ı temizlesin. Panel login throttle ve cookie Secure/HttpOnly/SameSite politikası gerçek auth akışına uygun olsun; CORS/CSRF istisnalarını genişletme.

**Kabul testi:** Expired/revoked token, banned mevcut session, tekrar kullanılan SSO kodu reddedilir. Meşru login session regenerate eder. Logout edilmiş credential oyun komutuna da yetmez.

## SEC-019 — Dependency bulgularını kontrollü kapat

**Dosyalar:** Root `package.json/package-lock.json`, `backend/package.json`, `validator/package.json` ve proje lockfile politikası.

**Yapılacaklar:** Audit tarihindeki vitest/@vitest/mocker/adm-zip bulgularını mevcut dependency tree üzerinde yeniden doğrula. Rapordaki maintainer advisory bağlantılarını ve patched sürümü esas al; o tarihte Vitest için 4.1.11 belirtilmiş olması gelecekte tek doğru hedef olduğu anlamına gelmez. Kullanılan feature'ın reachability'sini ayır. Yetkilendirilmiş dependency düzeltme aşamasında en küçük uyumlu yükseltmeyi yap; kör `audit fix --force` veya lockfile silme yapma. Alt projelerin lockfile eksikliğini tekrarlanabilir install/audit politikasıyla çöz.

**Kabul testi:** Güncel audit, build, typecheck ve ilgili testler; dev-only risk ile production reachable riski ayrı raporlanır. Paket audit severity sayısı uygulama bulgu sayısı değildir.

## SEC-020 — Güvenlik event trail ve secret redaction ekle

**Dosyalar:** `backend/app/Support/Shield.php`, `ShieldTracker`, `backend/bootstrap/app.php`, `AppServiceProvider` hata hook'ları; command/wallet/admin servisleri.

**Yapılacaklar:** LOGIN, MATCH_CREATED/JOINED/STARTED, ROLL/MOVE/DOUBLE/TAKE/PASS/RESIGN, DISCONNECT/RECONNECT, FINISHED, SETTLEMENT, WALLET_CHANGE ve ADMIN_ACTION için structured audit oluştur. user_id, room_id, command_id, timestamp, before/after revision ve outcome/reason ile correlate et. Finansal audit ilgili transaction'la tutarlı olsun. Full URL yerine credential-free path/allowlisted metadata kullan; exception, nested payload ve queue alert'lerinde redaction uygula. Reveal öncesi dice seed'i de secret'tır.

**Kabul testi:** Sentetik password/token/card/seed değerleri log/alert çıktısında bulunmaz. Başarılı command ve ledger/audit birbirine bağlanır; başarısız transaction sahte başarılı audit bırakmaz.

## SEC-021 — Upload bytes ve uzantıyı server doğrulasın

**Dosyalar:** `BugReportController::saveScreenshot`, `PanelController::contentSave`, storage/web-server yapılandırması ve `backend/public/.htaccess`.

**Yapılacaklar:** Data-URL etiketi ve original extension'a güvenme. Gerçek image decoder ile format/piksel/boyut doğrula, güvenli biçime re-encode et ve server allowlist uzantısı kullan. Rastgele server filename ve non-executable storage/ayrı origin politikası uygula. Boyut kontrolünü decode maliyetini de kapsayacak şekilde koy; kullanıcı quota/ownership tut. Apache .htaccess değişikliğinin Nginx için koruma sayılmadığını belirt.

**Kabul testi:** MIME-extension uyuşmazlığı, malformed base64, SVG/HTML ve aşırı piksel içeriği reddedilir. Zararlı kod çalıştırmadan inert fixture kullan. Audit koşullu RCE ihtimalini kanıtlanmış RCE diye sunmaz.

## SEC-022 — Ağır iş bütçesi ve queue retry davranışını düzelt

**Dosyalar:** `AnalysisController`, `RoomController::move/live/update`, `validator/server.ts`, GNUbg handler, `backend/config/queue.php`, `AnalyzeMatchPrJob.php`, `AnalyzeMatchLuckJob.php`.

**Yapılacaklar:** Request/dakika sınırına ek olarak kullanıcı başına concurrent job ve compute budget, global bounded queue ve body/deadline limitleri koy. Worker timeout ile retry_after/visibility timeout ilişkisini deployment ayarlarıyla birlikte düzelt; visibility job maksimum çalışma süresinden güvenli marjla büyük olsun. Jobs için source revision ve unique result claim kullan; retry eski analizi yeni sonucun üstüne yazmasın. Room lock dışında validator çağırmak istersen snapshot validation sonrası locked revision CAS zorunludur; lock'u kaldırıp stale sonucu save etme.

**Kabul testi:** İzole fake servis/two-worker testinde lease/retry/crash yinelenen etki üretmez; servis down durumu bounded süreyle kapanır. Production load/fuzz testi yapma.

## SEC-023 — Spectator ve private room verisini ayır

**Dosyalar:** `RoomController::show/liveMatches/watch`, `Room::toClient`, `GameLogController::mat`, room visibility/ACL modeli.

**Yapılacaklar:** Ürünün hangi maç/chat/replay verisini bilinçli public saydığını mevcut davranış ve talimattan belirle; belirlenemeyeni açık karar noktası olarak bırak. Public maç için spectator DTO minimum alanları içersin. Private/invite room için player/invite ACL uygula; list, show, chat ve replay aynı politikayı izlesin. Oda kodu public tanımlayıcıdır, güçlü credential sayılmaz. Her spectator'ı yasaklayarak mevcut public izleme özelliğini gereksiz bozma.

**Kabul testi:** Public spectator doğru sınırlı projection alır; private non-member code değiştirerek show/chat/replay okuyamaz. Participant gerekli veriyi almaya devam eder.

## SEC-024 — Public diagnostic route'u sınırla

**Dosyalar:** `backend/routes/api.php`, `RoomController::validatorCheck`.

**Yapılacaklar:** Production'da kaldır veya internal/admin yetkisine taşı. Liveness kontrolü pahalı gerçek game validation çalıştırmasın; response secret/config detayı sızdırmasın.

**Kabul testi:** Anonymous production diagnostic erişimi yoktur; yetkili health check sınırlı ve ucuzdur.

## Ortak teknik kabul kapısı

Her SEC için şu zinciri doğrula: route → middleware → authenticated actor → authorization → validation → engine/service → DB transaction/constraint → response/event → retry/recovery. Yalnız controller'a IF eklemek tamamlanmış düzeltme değildir.

| Test ailesi | Beklenen kanıt |
|---|---|
| BOLA/auth | Başka user/match/seat, bearer yok, revoked/banned session reddedilir |
| Authoritative state | Client board/dice/winner/score/status/coin/role alanları canonical veriyi değiştiremez |
| Active match/seat | Ayrı bağlantılarla paralel başlangıçta tek claim; distinct users ve tek seat sahibi |
| Replay | Aynı ID 100 kez: tek state/ledger etkisi; farklı payload aynı ID conflict |
| Stale state | Eski revision/game/turn reddedilir; eski tab yeni oyuna komut taşıyamaz |
| Settlement/payment | Duplicate delivery ve her ara yazımda fault injection; atomik veya kanıtlı retry edilebilir sonuç |
| Recovery | Client yokluğu, process restart, job retry, timeout ve cleanup ekonomik yükümlülük kaybettirmez |
| Wallet | Bütün debit/credit/hold/admin writer'ları ledger ile uzlaşır |
| Secret/privacy | Seed erken açıklanmaz; credential loglanmaz; private projection sızmaz |

Gerçek concurrency testi, production ile aynı transaction/constraint semantiğine sahip izole DB ve bağımsız connection/process kullanmalıdır. İki ardışık çağrı, mock transaction veya SQLite sonucunu MySQL row-lock kanıtı diye sunma. 10–50 paralel istek yalnız bu izole ortamda denenebilir. DB kurulumuna ilişkin mevcut çalıştırma izinlerini aşma.

Audit sırasında 86 engine/online test ve 25 MatchClock test geçti; bu yalnız o anki dar kapsamın kanıtıdır. Laravel feature suite migration kısıtı nedeniyle çalıştırılmadı. Önce test bootstrap'ını incele: `RefreshDatabase`, otomatik seed, `migrate:fresh`, gerçek servis çağrısı veya mevcut DB bağlantısı varsa güvenli izolasyon olmadan çalıştırma. Dependency yüklemeyi test önkoşulu diye sessizce yapma.

## Claude'un her adım sonunda vereceği çıktı

1. Ele alınan SEC numarası ve güncel kaynakta doğrulanan sorun.
2. Değişen dosyalar ve yeni server/DB garantisi.
3. Çalıştırılan testler ve somut sonuçları; çalıştırılmayanların nedeni.
4. Schema/config/deployment gereksinimleri; hazırlanmış olan ile uygulanmış olan açıkça ayrı.
5. Kalan risk ve sonraki bağımlı adım.

`SECURITY_FIX_STATUS.md` gibi ayrı ilerleme dosyası tutulabilir: SEC ID, OPEN/IN_PROGRESS/FIXED/VERIFIED/BLOCKED, değişen dosyalar, test kanıtı, kalan sınır. Orijinal `SECURITY_AUDIT.md` bulgularını silip geçmişi kaybetme. FIXED kod değişikliğini, VERIFIED yeterli test/constraint kanıtını ifade etsin; production'a uygulanmamış bir migration için canlı invariant'a PASS yazma.

**Son kabul:** Yedi temel invariant, bütün alternatif giriş yolları dahil DB/atomicity ve negatif testlerle doğrulanmadan “güvenlik tamamlandı” deme. Çalıştırılamayan veya ortamdan doğrulanamayan kısmı UNKNOWN/NOT RUN olarak açık bırak.
