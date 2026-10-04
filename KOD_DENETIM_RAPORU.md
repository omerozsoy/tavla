# TavlaTV — Güvenlik / Bütünlük Kod Denetimi (1. parti)

Tarih: 2026-10-04 · Commit: `4604765` · Kod DEĞİŞTİRİLMEDİ (yalnız denetim).

## 0. DÜZELTME DURUMU (2026-10-04)

A-01…A-16'nın **tamamı düzeltildi**. Her düzeltmenin bir regresyon testi var ve her test düzeltme
olmadan **kırmızı**, düzeltmeyle **yeşil** doğrulandı. Garanti entegrasyonu henüz canlı değil; A-01/A-07
yine de düzeltildi (canlıya alınmadan önce banka test ortamında gerçek dönüşle ayrıca denenmeli).

| Bulgu | Düzeltme | Commit | Test |
|---|---|---|---|
| A-01 P0 | Karar alanları (`mdstatus`, `procreturncode`, `response`) + sipariş no imzalı alanlarda olmak zorunda; mükerrer ad red; `oid`=`orderid` | `f35ca98` | `GarantiCallbackSecurityTest` |
| A-02 P1 | In-flight `_acted` kalkanı en fazla 30 sn (`MatchClock::INFLIGHT_MAX`) | `22f41ac` | `MatchClockTest` (+2) |
| A-03 P1 | `WalletService::spendable` = coins − rezerv − açık %-bahis görüntüsü; isteğe bağlı harcamalar (çark/slot/dükkân/ürün/sepet/turnuva) buna bakar | `90eea9f` | `PctStakeSpendLockTest` |
| A-04 P1 | Davetsiz, turnuva dışı `/enter` odası `mode='friendly'` (24 saat aynı-rakip limiti) | `f284967` | `RoomEnterIntegrityTest` |
| A-05 P1 | Turnuva odasında koltuk yalnız tablodaki iki oyuncuya (`roomPlayersKey`), `enter` + `join` | `f284967` | `RoomEnterIntegrityTest` |
| A-06 P1 | `throttle:5,1` + `login-fails` kilidi + tek tip hata | `73fe808` | `PanelLoginSecurityTest` |
| A-07 P2 | Yalnız banka imzalı red ödemeyi `failed` yapar; sipariş no kriptografik rastgele | `f35ca98` | `GarantiCallbackSecurityTest` |
| A-08 P2 | Kod, kilitli tx'te; son 24 saatteki bekleyen ödemeler kullanım sayılır | `ad5e569` | `PromoCodeTest` (+3) |
| A-09 P2 | İade = kaydedilen `fee_paid` (eski kayıtlarda güncel ücret) | `e1d4ba6` | `TournamentRefundTest` |
| A-10 P2 | `uid` bir odaya aitse mode'dan bağımsız oda yetkisi | `48581e5` | `GameLogTest` (+2) |
| A-11 P2 | Doğrulanmamış hesaba Google ile bağlanınca şifre sıfırlanır, tüm token'lar silinir | `86c30d8` | `GoogleLoginTakeoverTest` |
| A-12 P2 | Terk/süre/AFK = pes ile aynı: konum değeri (1/2/3) × küp | `fdc9ee3` | `ForfeitGammonValueTest` |
| A-13 P3 | Kod gönderildiği e-postaya bağlı; e-posta değişince kod silinir | `bb336e3` | `EmailCodeBindingTest` |
| A-14 P3 | `leave()` kilitli tx; `tickClock` yazma gerekirse satırı kilitleyip taze veriden yeniden hesaplar | `532e407` | `RoomTickLockTest` |
| A-15 P3 | `join()` koşullu UPDATE ile atomik koltuk; kaybeden 409 | `1695817` | `RoomJoinAtomicTest` |
| A-16 P3 | Rövanş cevabı kilitli satıra yazılır (sürüm artışı kaybolmaz, karar taze veriden) | `15b91b6` | `RoomRematchRaceTest` |

Davranış değişiklikleri (bilinçli): terk eden oyuncu artık mars/katmerli mars durumunda 2×/3× öder;
davetsiz kod odaları dereceli değil arkadaş maçı sayılır; %-bahisli açık maçı olan oyuncu, kilitli
tutarı çark/slot/dükkân/turnuva için kullanamaz.

> §5'teki kalan denetim partileri hâlâ yapılmadı — denetim kapsamı değişmedi.

> **Kapsam uyarısı — denetim TAMAMLANMADI.** İstenen "tüm depo, %100 dosya" denetimi bu partide
> yapılmadı. Bu parti üç hedefli, salt-okur denetimden oluşur (aşağıda §4). Kalan alanlar §5'te
> kontrol listesi olarak verilmiştir; tam kapsam için partiler halinde devam edilmelidir.

**Doğrulama düzeyi:** Tüm bulgular kod izlenerek doğrulandı (tahmin değil). Canlı ortamda yeniden
üretilmedi. ✔ işaretliler ayrıca ana oturumda kod okunarak çapraz doğrulandı.

## 1. Özet

| Önem | Adet |
|---|---:|
| P0 — Kritik | 1 |
| P1 — Yüksek | 5 |
| P2 — Orta | 6 |
| P3 — Düşük | 4 |

**Soru: "Uygulama, her istemcinin kötü niyetli olabileceği varsayımıyla gerçek zamanlı coin'li
maçları güvenle çalıştırabilir mi?"** — **Bu haliyle hayır.** Oyun motoru ve hamle/zar otoritesi
sağlam (bkz §3), ancak ödeme doğrulamasında doğrudan coin üretmeye izin veren bir açık (P0), saat
dondurma (P1), yüzde-bahis ödememe (P1) ve rating çiftliği (P1) gibi maç/ekonomi açıkları var.

## 2. DOĞRULANMIŞ BULGULAR

### P0

**A-01 ✔ — Garanti 3D ödeme dönüşü sahte "başarılı" yapılabilir (bedava coin/üyelik)**
- Kategori: Ödeme / ekonomi · Dosya: `backend/app/Services/GarantiService.php` `verifyCallback()` (≈123-139); `backend/app/Http/Controllers/PaymentController.php` `callback()` (≈426-486)
- Sorun: Hash'lenecek alan listesi istekteki `hashparams`'tan alınıyor (saldırgan kontrolünde) ve `hashparams`'ın kendisi hash'e girmiyor. Karar alanları (`orderid`, `mdstatus`, `response`, `procreturncode`, `txnamount`) hash'te bulunmak zorunda değil.
- Neden: Yalnız birleştirilmiş değerler hash'lenir; alan dizilimi serbest olduğundan bankanın imzaladığı herhangi bir dizi başka alan adıyla yeniden kullanılabilir.
- Yeniden üretme: (1) ucuz bir ödemede gerçek banka dönüşünü (reddedilmiş olsa da) al — tarayıcı otomatik POST'u olduğu için `hashparams`, `hash` ve değerler kullanıcıya görünür; S = değerlerin `hashparams` sırasıyla birleşimi. (2) büyük bir coin ödemesi başlat (`pending`). (3) `POST /pay/callback` (CSRF muaf): `hashparams=x`, `x=S`, `hash=<orijinal>`, `orderid=<büyük sipariş>`, `mdstatus=1`, `response=Approved`, `procreturncode=00`. `hash_ok=true` olur ve ödeme `paid` + coin/üyelik verilir. `txnamount` gönderilmezse `strict_amount=false` (varsayılan) olduğundan tutar kontrolü de geçilir.
- Etki: Sınırsız coin / Premium. Garanti canlıda yapılandırılmışsa doğrudan istismar edilebilir.
- Öneri: Hash'e girmesi ZORUNLU alan kümesini sunucuda sabitle (bankanın dokümanındaki sıra; en az `clientid, oid, authcode, procreturncode, response, mdstatus, cavv, eci, md, rnd`), `hashparams`'ı bu sabit listeyle karşılaştır, karar alanlarını yalnız hash'lenmiş değerlerden oku; `GARANTI_STRICT_AMOUNT=true` zorunlu; mümkünse banka sorgu API'siyle (inquiry) sunucudan teyit.

### P1

**A-02 ✔ — Saat dondurma: oyuncu kendi süresini sonsuza dek durdurup maçı kilitleyebilir**
- Kategori: Maç bütünlüğü / saat · Dosya: `backend/app/Services/MatchClock.php` `maybeEnd()` (`$effNow = ($acted > $start && $acted < $now) ? $acted : $now;`); `RoomController::stampActed()` (roll/move/cubeOffer/cubeRespond/resign başında)
- Sorun: `stampActed`, komut sonra 409/422 ile reddedilse veya hiçbir şey yapmasa da `pN_acted=now` yazar. Tur başladıktan sonra yazılan tek bir damga `effNow`'u o ana sabitler; TIMEOUT ve AFK_TIMEOUT hiç tetiklenmez.
- Yeniden üretme: Sıram; zar atarım (`started_at` sıfırlanır). Aynı turda `/roll`'u tekrar çağırırım (`reused:true`) veya geçersiz bir `/move` gönderirim. Sonra hiç oynamam ve `GET /rooms/{code}` ile poll ederek "bağlı" kalırım → maç asla bitmez.
- Etki: Rakip ya `/leave` ile (kaybederek) çıkmak ya da beklemek zorunda; bahisli/turnuva maçlarında yıpratma ile kazanma.
- Öneri: `_acted` yalnız komut gerçekten KABUL edildiğinde veya en fazla küçük bir pencere (ör. 5 sn) için geçerli olsun: `effNow = min(now, acted + GRACE_MAX)`; ya da reddedilen komutta damgayı geri al.

**A-03 — Yüzde-bahis (bet_pct) maçında kaybeden ödemeden kaçabilir**
- Kategori: Ekonomi · Dosyalar: `RoomController::settle()` (≈584-626), `Room::userInPctStakedPlaying` (Room.php ≈76), `LuckyWheelService` (≈335-395), `DiceSlotService` (≈337-413), Shop/Product/Tournament join
- Sorun: Yüzde bahiste emanet (escrow) tutulmaz; `settle` kaybedenin bakiyesi anlık görüntünün altındaysa 409 atar. Harcama kilidi yalnız `status='playing'` iken ve yalnız bazı uçlarda; çark/slot ücretli çevirmeleri hiç kontrol etmiyor. `/resign` sonrası oda `finished` olunca kilit tamamen kalkar.
- Yeniden üretme: Kaybeden `/resign` → kazanan istemci `settle` çağırmadan önce coin'leri dükkân/ürün/turnuva/çark/slot ile harcar → `settle` sürekli 409, kazanan hiç ödeme almaz.
- Öneri: Yüzde bahiste de maç başında `stake × max çarpan` kadar rezerv/escrow; ya da settle sunucu tarafında maç biter bitmez (applyGameResult/applyClockEnd ile aynı tx) yapılsın; çark/slot/dükkân rezervi düşerek bakiye hesaplasın.

**A-04 — Rating çiftliği: herhangi iki hesap sınırsız "dereceli" oda kurabilir**
- Kategori: Maç bütünlüğü / rating · Dosya: `RoomController::enter()` (≈1370-1381 `Room::firstOrCreate`), `RatingPolicy::isRanked` (≈85)
- Sorun: Davet olmadan `enter` yeni bir kodla oda kurar ve `mode` NULL kalır. `isRanked`, `mode !== 'friendly'` olanı dereceli sayar → arkadaş maçlarındaki 24 saatlik aynı-rakip sınırı atlanır.
- Yeniden üretme: A `/rooms/YENIKOD/enter`, alt hesap B aynı kodla `enter`, B teslim olur, A puan kazanır; yeni kodlarla tekrarla.
- Öneri: `enter` ile davetsiz oluşturulan odalar `mode='friendly'` (veya unrated) olsun; `isRanked` beyaz liste ile (`ranked`/`tournament`) çalışsın, NULL dereceli sayılmasın.

**A-05 — Turnuva maç odasına yabancı oturup eşleşmeyi kilitleyebilir**
- Kategori: Yetki / turnuva · Dosya: `RoomController::enter()` (≈1386-1428), `join()` (≈1274-1313); `TournamentController::winnerIdFromRoom` (≈910)
- Sorun: `enter`/`join`, çağıranın o turnuva maçının iki oyuncusundan biri olduğunu denetlemiyor. Oda kodları `GET /tournaments/{id}` ile herkese açık.
- Yeniden üretme: Bir misafir/hesap tablodaki oda koduyla ikinci oyuncu gelmeden `enter` çağırır → gerçek oyuncu "Oda dolu" (409) alır; no-show "rakip odaya girdi" ile reddedilir; rapor 409 → maç takılır.
- Öneri: Oda bir turnuva maçına bağlıysa (`roomTargetKey` cache / bracket) `enter`/`join`'de koltuk yalnız tablodaki iki kullanıcıya verilsin.

**A-06 ✔ — `/panel/login`: hız sınırı ve kilitleme yok; şifre doğruluğunu ele veriyor**
- Kategori: Kimlik doğrulama · Dosyalar: `backend/routes/web.php` (panel `POST /login`, throttle yok); `PanelController::login()` (≈26-43)
- Sorun: Hiç throttle yok; API login'deki hesap kilitleme (`login-fails:*`) kullanılmıyor. Yanlış şifre "E-posta veya şifre hatalı.", doğru şifre + yönetici değil "Bu hesap yönetici değil." → herhangi bir oyuncunun şifresi kaba kuvvetle doğrulanabilir.
- Öneri: `throttle:5,1` + `login-fails` kilidi; tek tip hata mesajı.

### P2

**A-07 — Sahte callback ile başkasının bekleyen ödemesi "failed" yapılabilir (gerçek ödeme kredilenmez)**
- `PaymentController::callback()` (≈490-501): hash geçersizken de `pending` ödeme `failed` yapılıyor; sonra gelen gerçek banka dönüşü `status !== pending` diye reddediliyor (kart çekilir, coin gelmez). Sipariş numaraları tahmin edilebilir (`prefix + ymdHis + mt_rand(100,999)`).
- Öneri: Hash geçersizse ödeme durumuna DOKUNMA; sipariş numarasını kriptografik rastgele yap.

**A-08 — Tek kullanımlık / max_uses promosyon kodu birden çok ödemede kullanılabilir**
- `PromoCode::usable` (≈49-65) yalnız `paid` ödemeleri sayar ve yalnız checkout'ta kontrol edilir; ödeme tamamlanırken `bumpUse` 0 dönse de yok sayılır (`PaymentController` ≈152, 517, 549, 668).
- Öneri: Checkout'ta kodu kullanıcı+ödeme ile rezerve et (unique kısıt); fulfillment'ta `bumpUse` başarısızsa indirimi geri al/iptal et.

**A-09 — Turnuva iadesi, ödenen değil GÜNCEL giriş ücretini öder**
- `TournamentModeration.php` (≈37-42) `$t->entry_fee`'yi iade eder; ödenen tutar kaydedilmez (`TournamentController` ≈227); ücret kayıt açıkken yönetici panelinden değiştirilebilir; oluşturan ücret ödemeden eklenir (≈175).
- Öneri: Katılımda ödenen tutarı oyuncu kaydında/ledger referansında sakla; iade o tutar ve ledger anahtarıyla (idempotent).

**A-10 — Kimliksiz istek, canlı maçın oyun günlüğünü `mode=pvb` ile ezebilir**
- `GameLogController::store()` (≈22-123): oda koltuk kontrolü yalnız `mode==='online'` gönderilince çalışıyor; `pvb/local` ile mevcut kaydın olayları, kazananı ve skoru istemciden yazılıyor. Oda kodları `/live-matches` ile açık. Replay, `.mat`, şans analizi bozulur.
- Öneri: `uid` ile bir `Room` varsa istemcinin `mode`'una bakmadan oda erişimi zorunlu; sonuç alanları istemciden asla alınmasın.

**A-11 — Google girişi ile hesap ön-ele geçirme (pre-hijack)**
- `AuthController::googleLogin()` (≈122-212): e-postası doğrulanmamış mevcut hesaba bağlanıp `markEmailAsVerified` yapıyor; önceki şifre ve token'lar geçerli kalıyor. Saldırgan kurbanın e-postasıyla önceden hesap açarsa, kurban Google ile girdiğinde saldırganın hesabına girer, saldırgan erişimini korur.
- Öneri: Doğrulanmamış hesaba Google ile bağlanırken şifreyi sıfırla + tüm token'ları sil (veya bağlamayı reddet).

**A-12 — Para oyununda terk/süre dolması teslim olmaktan ucuz**
- `RoomController::applyClockEnd()` (≈2333) `score[winner] = max(target, score + max(1, cubeVal))` → mars/katmerli mars durumundaki kaybeden `/leave` ile yalnız küp değerini öder; `/resign` ise `resignationValue × küp` (1-3×).
- Öneri: Terk/süre dolmasında da `Backgammon::resignationValue` (tahtaya göre 1/2/3) × küp uygulansın (en az teslim kadar).

### P3

- **A-13** — E-posta doğrulama kodu e-postaya bağlı değil (`AuthController` resend ≈2029, updateProfile ≈268, verifyEmailCode ≈2065): kod alındıktan sonra e-posta değiştirilip eski kodla yeni adres "doğrulandı" yapılabilir. → Kodu e-posta hash'iyle sakla / e-posta değişince `eotp:{id}` sil.
- **A-14** — `leave()` kilitsiz okuma-yazma (≈1762-1800): eşzamanlı `/resign` sonrası eski okuma ile sonucu ezebilir (yalnız ayrılanın kendi aleyhine). `show()` içindeki `tickClock` aynı desen. → `lockForUpdate` ile oku.
- **A-15** — `join()` ikinci koltuğu atomik olmadan alıyor (≈1284-1312): eşzamanlı iki join'de ilki sessizce dışarıda kalır. → `enter()`'deki gibi koşullu update / kilit.
- **A-16** — `rematch()` (≈1547-1551) iki taraf aynı anda kabul ederse yeni oda açılmayabilir (bir sonraki çağrıya kadar). → Oda satırını kilitleyerek karar ver.

## 3. Sağlam bulunan alanlar (denetlendi)

- Zar commit-reveal; tohum maç bitene dek gizli; istemci zar/tahta/skor/kazanan/küp belirleyemez; eski `update()` kapalı; hamleler validator ile doğrulanır, validator yoksa hamle reddedilir.
- roll/move/küp/resign oda satırını kilitler, beklenen sürüm + tek kullanımlık command_id (bu oturumda H-1 ile replay düzeltildi).
- `settle` odayı tek kez talep eder (çift ödeme yok); `ForfeitLoss`/`MatchBackstop` oyuncu başı tek satır (E2E'de doğrulandı: tekrar 0).
- `WalletService::move` kullanıcı satırını kilitler, negatif bakiye kontrolü, ledger idempotency/reference unique.
- Ödeme talebi (claim) satır kilidi + yalnız `pending→paid`; dükkân/günlük ödül/ürün siparişleri kilitli; çark/slot idempotency anahtarı; sabit-bahis escrow+settle tek tx; turnuva ödülleri deterministik ledger + `prize_paid`.
- Toplu atama: `User::$fillable` içinde `is_admin/rating/coins/plan/email_verified_at` yok. Admin rotaları middleware + metod kontrolü. IDOR: adres, maç uçları, mesaj silme, davet yanıtı sahiplik kontrollü. Şifre sıfırlama Laravel broker'ı; reset URL Host başlığına dayanmıyor. Yükleme yolu güvenli. Blade'de `{!! !!}` yok. Ham SQL parametreli. CORS sabit liste.

## 4. Kapsam (bu parti)

| Alt sistem | Durum |
|---|---|
| Ekonomi: WalletService, Payment/Garanti, Shop, Product, PromoCode, LuckyWheel, DiceSlot, turnuva ücret/ödül, escrow/settle | denetlendi |
| Kimlik doğrulama / yetki / API / admin: AuthController, PanelController, routes, middleware, GameLog, Address, Message, BugReport, CORS | denetlendi |
| Oyun/maç akışı: RoomController (matchmaking, create/join/enter, roll/move/küp/resign, clock, leave, settle, rematch, bot), MatchClock, RatingPolicy, RoomResult, ForfeitLoss, MatchBackstop | denetlendi |

## 5. KALAN — denetlenmedi (sonraki partiler)

- [ ] `src/` ön yüz (App.tsx ~10k satır, ui/*, online/*, api.ts) — durum, yarış, sızıntı, yalnız-UI kontrolleri
- [ ] Gerçek zamanlı: `src/online/realtime.ts`, `app/Events/*`, `routes/channels.php`, Reverb yapılandırması
- [ ] `validator/` (server.ts, PR analizi) ve `gnubg-service/gnubg_service.py`
- [ ] `TournamentController` tamamı + `app/Support/Swiss/*` + `tournaments:tick`
- [ ] `app/Jobs/*`, `app/Console/Commands/*` (kuyruk/cron, çift çalışma)
- [ ] `app/Filament/*` yönetim paneli
- [ ] `database/migrations/*` — benzersiz kısıtlar / FK / indeksler (ör. match_results(room_code,user_id), room_commands, ledger)
- [ ] `PresenceController`, `ClubController`, `MessageController` tamamı, `ContentController`, SEO uçları
- [ ] `config/*`, `bootstrap/app.php`, `deploy.sh`, `deploy/*`, CSP/nginx
- [x] Düzeltmeler sonrası tam koşu: phpunit 821 OK/4 skip, vitest 371, tsc temiz, oxlint 0 hata

Kapsam sayıları: bu parti dosya bazında tam envanter çıkarılmadan hedefli yapıldığı için
"incelenen/toplam dosya" sayısı **verilemez** — denetim tamamlanmış sayılmamalıdır.
