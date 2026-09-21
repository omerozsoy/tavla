# Güvenlik düzeltmeleri — ilerleme

## Faz 0 — yerel kod değişiklikleri uygulandı; tam entegrasyon doğrulaması bekliyor

Bu çalışma yalnız ilk kritik açık kapatma paketidir. Bütün audit bulguları kapanmış değildir. Deployment, migration, seed veya gerçek hesap/coin işlemi yapılmadı. Kullanıcının mevcut `backend/public/.htaccess` değişikliğine dokunulmadı.

| Bulgu | Bu pakette yapılan | Kalan doğrulama / kapsam |
|---|---|---|
| SEC-001 | Legacy PUT locked transaction içinde authoritative/bot/staked/ranked/terminal veya server state taşıyan odada reddediliyor. Seed ve roll log yalnız authoritative terminal sonuçta açıklanıyor. Roll/move/cube/resign terminal durumda reddediliyor. | Bütün clock/poll/scheduler writer'larının ortak concurrency protokolü Faz 3'te. Tam DB/HTTP testi çalıştırılmadı. |
| SEC-002 | Rating report yalnız authenticated katılımcının tamamlanmış authoritative odasını kabul ediyor. Kazanan/skor/mod/uzunluk/rakip snapshot bilgisi odadan türetiliyor. Client log/PR/luck/flags achievement hesabına verilmiyor. Bot/friendly raporu WXP/achievement üretmiyor. | Sonuç/rating transaction idempotency, canonical log ve tarihsel kirlenmiş kayıtların reconciliation'ı sonraki fazlarda. PR/analiz çıktısı bu paketle bütünüyle authoritative yapılmadı. |
| SEC-003 | Turnuva report client winner fallback'i ve isim eşleştirmesi kaldırıldı. Locked room'un terminal server sonucu ve iki bracket oyuncusunun user ID eşleşmesi aranıyor. | Turnuva admission/no-show/recovery ve gerçek DB yarış testleri sonraki kapsam. |
| SEC-004 | Admin accessor yalnız explicit DB is_admin grant kullanıyor. Config email tek başına yetki vermiyor; profile email değişiminde verification temizleniyor. | Production explicit admin grant durumu sorgulanmadı/değiştirilmedi. Yayın öncesi yetkili admin erişim geçişi kontrol edilmeli. |

## Değişen dosyalar

- `backend/app/Models/Room.php`: legacy state admission, terminal result/action kontrolleri ve seed projection.
- `backend/app/Support/RoomResult.php`: live report için strict verified result giriş noktası. Eski `resolve` bakım/legacy tüketicileri için değiştirilmedi.
- `backend/app/Http/Controllers/RoomController.php`: legacy update transaction/lock ve action terminal guard'ları.
- `backend/app/Http/Controllers/AuthController.php`: verified result şartı, server metadata, reward input ayrımı, email doğrulama reset'i.
- `backend/app/Http/Controllers/TournamentController.php`: server winner ve katılımcı eşleştirme.
- `backend/app/Models/User.php`: explicit admin grant.
- `backend/tests/Unit/SecurityPhaseZeroTest.php`: DB bağlantısı olmadan gerçek controller/model negatif testleri ve resolver pozitif testleri.
- `backend/tests/Feature/MatchResultAuthoritativeTest.php`: canonical room fixture, fallback ret beklentileri, metadata/achievement input ve üçüncü kullanıcı testleri.

API route adları ve request/response alanları yeniden tasarlanmadı. Yeni güvenlik şartını sağlamayan eski istekler artık 409 alıyor. UI/CSS, dependency ve şema dosyaları değiştirilmedi.

## Bilinçli davranış değişiklikleri

1. Oda belirtmeyen, silinmiş odayı kullanan, bitmemiş/legacy odayı raporlayan veya oyuncu olmayan hesapların rating raporu reddedilir. Yerel eski PvB raporunun geçmişe kaydı da bu endpoint üzerinden artık gerçekleşmez; server bot maçı canonical oda ile raporlanabilir. Mevcut kayıtlara dokunulmadı.
2. Authoritative olmayan ranked/staked oda legacy PUT ile sürdürülemez. Global authoritative kapalı kurulumlarda bu eski akışın kullanılmaması gerekir. Canlı flag'ler veya aktif odalar bu çalışma tarafından değiştirilmedi.
3. Parasız legacy friendly state akışı oynayan odada korunur. Terminal legacy oda yeniden playing yapılamaz. Legacy dice-only modunda doğrulanmış server terminal sonucu olmadığı için seed reveal yapılmaz.
4. PR, luck ve client olay loguna dayanan achievement'lar canonical kanıt üreten ayrı akış kurulana kadar bu report yolundan verilmez. Gerçek ranked server sonucundan gelen temel galibiyet/istatistik ödülleri korunur.
5. Yalnız ADMIN_EMAILS eşleşmesi ile admin olan ama DB is_admin grant'i olmayan hesaplar admin erişimi alamaz. Otomatik production rol ataması yapılmadı. Liste operasyonel bildirim ve explicit admin korumasında kullanılmaya devam eder.
6. Mevcut yanlış rakip sonuç satırını düzeltme davranışı yalnız doğrulanmış server sonucu ve gerçek rakibin ID'si için korunur. Tarihsel bütün verinin doğruluğu bu paketle garanti edilmez.

## Çalıştırılan kontroller

| Kontrol | Sonuç |
|---|---|
| `SecurityPhaseZeroTest` — PHPUnit, no configuration, vendor autoload, cache kapalı | **30 test / 40 assertion geçti** |
| Mevcut `MatchClockTest` — aynı izole PHPUnit çalışma şekli | **25 test / 97 assertion geçti** |
| Vitest: validateTurn, moves, resign, fairDice, online/authSync | **5 dosya / 86 test geçti** |
| Değişen 6 uygulama PHP dosyası ve 2 test dosyasında `php -l` | Geçti |

Toplam **141 test geçti**. Yeni testlerde controller'lar ve validation/model kodu gerçektir, persistence sorguları mock'tur; PDO bağlantısı/yazım ve dış servis çağrısı yapılmaz. Bu testler gerçek row lock, unique constraint, middleware veya 50 paralel HTTP request garantisi değildir.

**Çalıştırılmayanlar:** Laravel feature suite ve Playwright. Feature testleri RefreshDatabase/migration gerektirir; migration çalıştırmama talimatı nedeniyle çalıştırılmadı. Diğer eski feature fixture'larında client fallback, config-email admin veya legacy state varsayımları bulunabilir; tüm suite'in yeni güvenlik sözleşmesiyle uyumu henüz doğrulanmadı. Hazırlanan feature testlerinin geçtiği iddia edilmez.

## Sonraki fazlar

1. **Faz 1:** Temel auth/seat/account düzeltmeleri uygulandı; aşağıdaki entegrasyon ve oturum sınırları açık.
2. **Faz 2:** Uygulama tarafı tek aktif money-match admission'ı güçlendirildi; DB claim/constraint migration'ı bekliyor.
3. **Faz 3:** Explicit `expected_version` kontrolü uygulandı; kalıcı command ID/ledger ve timeout/leave/scheduler ortak protokolü bekliyor.
4. **Faz 4:** Settlement claim/finalization atomikliği ve reserved coin ile wheel/slot debit kontrolü kısmen uygulandı; ortak wallet ledger ve yüzde stake snapshot bekliyor.
5. **Faz 5:** Atomik ve retry edilebilir settlement/payment/rating/reward; reconciliation ve güvenli cleanup.
6. **Faz 6:** Session/internal service/upload/privacy/abuse/dependency/RNG bias düzeltmeleri.
7. **Faz 7:** Canonical event trail, redaction ve gerçek izole DB üzerinde concurrency/recovery testleri.

Tek aktif money-match, duplicate action ve tüm ekonomi için exactly-once etki invariant'ları bu paket sonunda **hâlâ tamamlanmış değildir**. Migration gerektiren adımlarda dosya hazırlama ile çalıştırma ayrı tutulmalıdır.

## Faz 1 — hesap ve oyuncu koltuğu yetkilendirmesi

Yerel düzeltmeler uygulandı. Production, migration, gerçek hesap/bakiye işlemi yapılmadı. Bu bölüm Faz 0 sonuçlarına ek olarak okunmalıdır; tüm güvenlik denetiminin kapandığı anlamına gelmez.

### Değişiklikler ve dosyalar

- `backend/app/Support/RoomAccess.php`: hesapla ilişkili koltuk yalnız authenticated user ID ile seçilir. Oda token'ını bilmek o hesabın yerine oynamaya yetmez. Aynı hesabın yeni cihazdan kendi koltuğuna erişimi korunur. İki koltuğu aynı hesaba bağlayan mevcut bozuk satırlar erişim kontrolünde reddedilir; DB oluşum garantisi henüz yoktur. Misafir token'ı yalnız hesaba bağlı olmayan, parasız/ranked olmayan insan koltuğunda geçerlidir.
- `backend/app/Http/Controllers/RoomController.php`: tüm `slotOf` çağrıları ve settlement girişi ortak hesap kontrolünü kullanır. Kuyruk arama/iptal işlemi oda token'ı yerine hesap ID'sine bağlandı; kendi hesabıyla eşleşme aday sorgusunda dışlanır. Eşleşme metadata'sı hesaptan alınır, banlı/silinmiş bekleyen rakip atlanır. Ekonomik/ranked odaya kod üzerinden yeni koltuk alma kapatıldı; mevcut sahip yeniden bağlanabilir. Admission yarışlarının tamamı Faz 2 kapsamındadır.
- `backend/app/Http/Controllers/TournamentController.php`: no-show talebi bracket üyeliğine ek olarak aynı hesabın oda koltuğuna sahip olmasını gerektirir.
- `backend/app/Http/Middleware/EnsureActiveAccount.php` ve `backend/routes/api.php`: oda/oyun, chat/live/watch ve authenticated API grubunda ban kontrolü. Sanctum tarafından geçersiz sayılan bearer token misafir erişimine düşmez. Matchmaking ve iptali login gerektirir. Logout, authentication şartını koruyarak ban kontrolünden hariç tutuldu; banlı hesap da token'ını iptal edebilir.
- `src/api.ts`: oda poll token'ı URL query yerine `X-Room-Token` header'ında gönderilir; bearer ve site gate header'ları korunur. Eski frontend uyumu için backend query fallback'i hâlâ vardır; geçmiş URL/log token'ları temizlenmedi.
- `backend/tests/Unit/RoomAccessSecurityTest.php`, `backend/tests/Unit/SecurityPhaseZeroTest.php`, `src/api.roomSecurity.test.ts`: yetki matrisi, gerçek route tanımları, middleware, controller retleri ve frontend taşıma testleri.

### Doğrulama

| Kontrol | Sonuç |
|---|---|
| PHPUnit: RoomAccessSecurityTest + SecurityPhaseZeroTest + MatchClockTest | **88 test / 199 assertion geçti** |
| Vitest: api.roomSecurity + authSync + validateTurn + moves + resign + fairDice | **6 dosya / 90 test geçti** |
| TypeScript: `tsc -p tsconfig.app.json --noEmit --incremental false` | Geçti |

Bu birleşik çalıştırmada önceki 178 testlik pakete ek olarak stale-version regression testi geçti. Güncel seçili toplam **179 test** olarak raporlanır. Controller testleri gerçek handler/validation kullanır; persistence mock'tur ve beklenmeyen DB yazımları yasaktır. Route testi uygulamayı boot etmeden gerçek route dosyasını yükler. Middleware testinde Sanctum user resolver mock'tur: gerçek token tablosunda expiry/revocation ve tam HTTP middleware zinciri doğrulanmış sayılmaz. Frontend logout testi yerel credential kaldırmayı doğrular, sunucudaki token silme işlemini doğrulamaz.

### Uyumluluk ve açık kalan sınırlar

1. Girişsiz matchmaking artık 401 alır; parasız özel misafir odaları korunur. Hesaba bağlı koltuğa yalnız eski oda token'ıyla girilemez; kullanıcı login olmalıdır.
2. Aynı hesabın birden fazla geçerli oturumu kendi koltuğuna erişebilir. Yeni cihaz eski geçerli oturumu otomatik iptal etmez. Tek oturum politikası ve stale-command/replay koruması bu paketle sağlanmadı.
3. Ban kontrolü request başlangıcındadır. Eşzamanlı ban/admission, önceki rövanş onayından sonra rakibin banlanması ve tüm admission yollarının kilitlenmesi henüz tamamlanmadı.
4. Aynı kullanıcıya birden fazla aktif money-match açılmasını engelleyen DB invariant'ı, duplicate action idempotency, wallet ledger ve settlement atomikliği hâlâ açık fazlardır. Bu kontroller **PASS değildir**.
5. Public spectating korunur. `show`/clock/scheduler state yazımlarının concurrency ve recovery güvenliği Faz 3'e kalır. WebSocket/tek bağlantı garantisi bu değişikliklerden çıkarılamaz.
6. Feature/Playwright/gerçek DB concurrency testleri çalıştırılmadı. Migration çalıştırmama sınırı korundu; tam login–logout–reconnect ve turnuva akışı için izole entegrasyon doğrulaması bekliyor.

## Faz 2 — tek aktif money/ranked match admission

`backend/app/Models/Room.php` artık `mm_waiting` ve `playing` durumlarında, ranked veya stake/bet/escrow içeren odalarda kullanıcı için aktif maç sorgusu yapıyor. `RoomController::matchmaking` içinde authenticated kullanıcı satırı `lockForUpdate()` ile kilitleniyor; aktif oda kontrolü ve yeni bekleme odası oluşturulması aynı transaction içinde gerçekleşiyor. Aynı hesabın eşzamanlı iki matchmaking isteği bu nedenle ikinci oda oluşturamıyor. Farklı stake seçimiyle mevcut bekleme odasını silip yarış penceresi açma davranışı da 409 ile kapatıldı.

Bekleyen aday oda satırı transaction içinde kilitleniyor; aynı aday iki rakibe atanamıyor. Adayın banlı/silinmiş veya başka aktif money/ranked odası olan hesabı eşleşmeye alınmıyor. Direct join/enter için önceki Faz 1 hesabı ve ekonomik oda admission kontrolleri korunuyor.

Bu, mevcut şema üzerinde uygulama transaction garantisidir. Aynı kullanıcı için veritabanının tek başına cross-row `UNIQUE` koruması henüz yoktur; `rooms` tablosundaki nullable iki kolonda doğrudan unique index bu invariant'ı ifade edemez. Migration hazırlarken mevcut duplicate/legacy satırlar temizlenmeden uygulanmamalı; ayrı `active_match_claims(user_id UNIQUE, room_id UNIQUE, kind, created_at)` tablosu veya veritabanına özgü partial unique index ve transaction içi claim önerilir. Migration çalıştırılmadı ve yazılmadı.

Bu fazın bilinçli sınırları: aday kullanıcı kilidi deadlock oluşturmamak için aday oda kilidinden sonra alınmıyor; mevcut oda satırı kilidi duplicate admission'ı önlüyor, fakat tarihsel bozuk kullanıcı kayıtlarının otomatik onarımı yapılmıyor. Settlement exactly-once, kalıcı command idempotency ve queue retry korumaları hâlâ sonraki fazlarda.

## Faz 3 — stale command sürüm kontrolü

`roll`, `move`, `cube/offer`, `cube/respond` ve `resign` endpoint'leri artık opsiyonel `expected_version` kabul ediyor. Alan gönderildiğinde oda transaction'ı içindeki güncel `server_version` (legacy yol için `version`) ile birebir karşılaştırılıyor; eski sekme veya aynı komutun tekrar gönderimi 409 `stale-version` ile reddediliyor. Oda satırı zaten `lockForUpdate()` ile tutulduğu için kontrol ve state write aynı kilitli transaction içinde. `src/api.ts` komut yardımcıları ve `src/App.tsx` bu sürümü gönderiyor; poll response'ları oda sürümünü güncelliyor.

Alan geriye dönük uyum için nullable bırakıldı. Eski üçüncü taraf istemci alanı göndermezse bu yeni kontrolü kullanmaz; bu yüzden migration tabanlı zorunlu command envelope ve `action_id`/`command_id` unique kaydı sonraki adımda yapılmalıdır. Version kontrolü finansal settlement veya queue retry exactly-once garantisi değildir.

## Rövanş admission düzeltmesi

`RoomController::rematch` artık `playing` veya settlement bekleyen bir odadan yeni oda açmıyor. Money/ranked rövanş için eski oda tamamlanmış ve `settled=true` olmalı. Yeni oda transaction'ında iki participant user satırı deterministik sırayla kilitleniyor; eksik/duplicate/banlı hesap veya başka aktif money/ranked oda varsa rezervasyon ve yeni oda oluşturma rollback oluyor.

## Ödeme callback atomikliği

`PaymentController` demo ve Garanti callback akışlarında payment satırı `lockForUpdate()` ile claim ediliyor; kullanıcı satırı da kilitlenerek payment status değişimi ile coin, üyelik, ürün veya sepet fulfillment'ı aynı transaction içinde yapılıyor. Fulfillment hata verirse payment `paid` olarak kalmıyor ve callback yeniden güvenle denenebiliyor. Daha önceki `pending -> paid` yazımı ile coin/üyelik yazımının ayrı olması nedeniyle oluşabilecek partial failure penceresi kapatıldı.

## Admin ban savunması

`EnsureAdmin`, `PanelController` login/SSO girişleri ve `AdminController` savunma kontrolleri banlı admin hesabını reddediyor. Sanctum token'ları ban sırasında silinse bile mevcut web session'ı artık panel middleware'inden geçemiyor. Admin panel erişimi yalnız `is_admin` DB grant'i ve aktif hesapla mümkün.

## Faz 4 — settlement ve reserved coin koruması

`RoomController::settle` artık client'ın `won` beyanını settlement state'ine yazmıyor; authoritative odalarda kazanan yalnız `server_match.done/winner` üzerinden çözülüyor. `settled=false` claim'i, room'un `finished` işaretlenmesi, kullanıcı kilitleri ve coin transferi aynı transaction içinde. Debit/credit hatasında ekonomik claim ve finalization birlikte rollback olur. İlk claim sonrası tekrar istek coin transferi yapmadan mevcut bakiye yanıtı döndürür.

`LuckyWheelService` ve `DiceSlotService`, ücretli spin öncesi `coins - coins_reserved` kullanılabilir bakiyesini kontrol ediyor. Böylece money match escrow'u varken ayrılmış coin tekrar harcanamıyor; debit işlemi kilitli user satırı üzerinde gerçekleşiyor.

Ortak immutable wallet ledger, yüzde bahis tutarının maç başında snapshot/hold edilmesi, tüm coin debit yazarlarının tek servise taşınması ve settlement replay audit kaydı bu fazda yapılmadı; migration/ledger şeması gerektiriyor. `coins` alanında mevcut negatiflik ve tarihsel düzeltme koşulları production verisi okunmadan doğrulanamaz.

## Replay/game-log yazma sınırı

`POST /api/game-logs` online modda oda mevcutsa yazanın koltuğunu `RoomAccess` ile doğrular. Hesap koltuğu authenticated user ID ile, misafir koltuğu yalnız oda token'ı ile kabul edilir; client'ın gönderdiği `slot` yetki kararı değildir. Oda silindikten sonra gelen orphan telemetry, geriye dönük en iyi çaba uyumluluğu için kabul edilir ancak authoritative result/settlement kanıtı değildir. Online `winner`, `score` ve `status` alanları yok sayılır; yalnız tamamlanmış doğrulanmış `server_match` sonucu log metadata'sına yazılır. `pvb`/`local` logları misafir uyumluluğu için bırakılmıştır ancak settlement/rating kanıtı değildir. Migration veya production log temizliği yapılmadı.

## RNG bias düzeltmesi

`FairDiceService::roll` ve `single` artık HMAC çıktısını `% 6` ile doğrudan eşlemiyor; 252 ve üzeri baytları reddeden deterministic rejection sampling kullanıyor. Böylece 1–6 yüzleri eşit dağılıma sahip oluyor. Commit/reveal seed kayıtları ve historical roll kayıtları değiştirilmedi; yeni algoritma için server test vector'ları eklenmesi gerekir.
