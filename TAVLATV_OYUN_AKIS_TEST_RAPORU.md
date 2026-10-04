# TavlaTV — Oyun Akışı Uçtan Uca Test Raporu

> Durum: **TAMAMLANDI (sınırlarıyla)** — aşağıdaki her "BAŞARILI" satırı bu ortamda gerçekten
> çalıştırılmış bir teste dayanır. Çalıştırılamayan alanlar §9'da ayrıca listelenmiştir.

## 1. Sürüm, ortam, tarih

| Alan | Değer |
|---|---|
| Tarih | 2026-10-04 |
| Başlangıç commit'i | `20775d7` (dal: `claude/cloud-session-credits-9nd4yl`, = `main`) |
| Ortam | Bulut konteyner (Linux), Node 22.22, PHP 8.3.6, Playwright Chromium 1194 (headless) |
| Backend | Laravel 12, `APP_ENV=e2e`, **ayrı SQLite** (`backend/database/e2e.sqlite`) — canlı veriye dokunulmadı |
| Validator | `validator/dist/server.mjs` (:8091) — backend'in hamle doğrulayıcısı |
| gnubg | Ubuntu paketi **GNU Backgammon 1.07.001** (:8092). Üretimde daha yeni derleme var; 1.07'de olmayan `gnubg.setgnubgid` için yalnız yerel kopyaya (depoya girmeyen) uyumluluk katmanı eklendi |
| Frontend | Vite dev (:5199), backend'e proxy |
| Test hesapları | `php artisan e2e:seed --users=8` → W, B, P3…P8 (yalnız e2e DB). W'ye yalnız e2e DB'de yönetici yetkisi verildi (turnuva açmak için) |

## 2. Keşfedilen oyun türleri ve giriş noktaları

| Oyun türü | Giriş noktası (istemci → sunucu) | Motor / doğrulama | Not |
|---|---|---|---|
| YZ'ye karşı (seviye 1–12) | `createBotRoom` → `POST /bot/rooms`; bot `maybeDriveBot`/`driveBot`, kurtarma `POST /rooms/{code}/bot` | Sunucu-otoriter; bot hamlesi gnubg (`BotMoveService`) | 11–12 yalnız Premium; `SERVER_BOT=true` (yerel YZ yolu kapalı) |
| Rastgele eşleşme — Tek Oyun | `POST /matchmaking` (`targets:[1]`, `stake`/`stakes[]`) | Sunucu-otoriter, validator | Bahisli: stake×48 rezerv, aynı anda tek bahisli maç |
| Rastgele eşleşme — Maç oyunu | `POST /matchmaking` (`targets:[3,5,…]`) | Sunucu-otoriter | Küp, Crawford |
| Arkadaş odası (kod) | `POST /rooms` + `POST /rooms/{code}/join` | Sunucu-otoriter | `mode=friendly`, hedef 1–25 |
| Davetle oyun | `POST /friends/{id}/invite` → `/rooms/{code}/enter` → davetli `/ping` → `POST /invites/{id}/respond` → `/enter` | Sunucu-otoriter | Davet `/ping`'de 2 dk görünür; 10 dk sonra silinir |
| Turnuva (eleme + Swiss) | `POST /tournaments`, `/join`, `/start`, `/match-room`, `/report` | Sunucu-otoriter odalar; rapor sunucu sonucuyla doğrulanır | Swiss (`swiss_triple`) kapalı olabilir |
| Kız Tavlası | `/kiz-tavlasi` (yalnız istemci, bilgisayara karşı) | `src/kiz/engine.ts`, `src/kiz/ai.ts` | Sunucu tarafı yok |
| Yerel (aynı cihaz) | `mode='pvp'` (App.tsx) | İstemci motoru | Sunucuya gitmez |
| İzleme / rövanş / terk | `/rooms/{code}/watch`, `/rematch`, `/leave` | — | Terk = hükmen kayıp |

Gerçek zamanlı: Reverb yayını yapılandırılmışsa WebSocket, değilse (e2e: `BROADCAST_CONNECTION=log`) 1.2 sn'lik **poll**.
Saat: `MatchClock` (banka/puan: casual 180, normal 60, speed 24 sn; gecikme 15/10/8 sn; AFK 60 sn; terk 45 sn).

## 3. Test yaklaşımı

- **API tam-akış (e2e/flows/*.spec.ts):** Test, gerçek istemci gibi `/roll` ve `/move` gönderir. Sunucunun döndürdüğü her durumu istemci TS motoruyla **bağımsız** denetler: her ply'da 15+15 taş, iki oyuncunun aynı sürüm/durumu görmesi, oyun bitişinde sunucu puanı = motor sonucu (tek/mars/katmerli) × küp, kaybedenin skorunun değişmemesi. Hamle seçimi tohumlu RNG ile tekrar üretilebilir.
- **Kontrollü kural senaryoları:** Sabit tahta + sabit zar, backend'in kullandığı **çalışan validator servisine** gönderilir. Üretime test kancası veya sabit zar eklenmedi.
- **Tarayıcı:** iki ayrı Chromium oturumu (masaüstü + Pixel 7 emülasyonu), UI'dan eşleşme; tahta DOM'u sunucu tahtasıyla karşılaştırılır.


## 4. Senaryo sonuçları (kapsam tablosu)

Durum: ✅ BAŞARILI (çalıştırıldı, geçti) · ❌ BAŞARISIZ · ⛔ ENGELLİ/TEST EDİLEMEDİ · 🔧 hata bulundu → düzeltildi → yeniden geçti

| # | Oyun türü / alan | Senaryo | Durum | Kanıt |
|---|---|---|---|---|
| 1 | Rastgele eşleşme — Tek Oyun | 5 tam oyun; taş sayısı, iki oyuncu senkronu, puan=motor sonucu×küp | ✅ | `test-kanitlari/flows/matchmaking-single.json` |
| 2 | Rastgele eşleşme — Maç (hedef 3) | 5 maç (8 oyun), maç sonu, sonraki elin başlaması | ✅ | `matchmaking-match3.json` |
| 3 | Arkadaş odası (kodla) | 5 maç (hedef 1×3, hedef 5×2; 8 oyun) | ✅ | `friend-room.json` |
| 4 | Bahisli Tek Oyun (stake 100) | 5 oyun; coin bir kez el değiştirir (kazanan +95 / kaybeden −100, mars ×2), `settle` tekrarına karşı korumalı | ✅ | `stake-single.json` |
| 5 | Davetle oyun | 5 kabul edilmiş davet → tam oyun; ret; iptal; başkasının daveti; kendini davet | ✅ | `invites.json` |
| 6 | Davet — davet eden ayrıldı / süresi geçti | sahibi ayrılan odaya davet kabulü | 🔧 (H-2, H-3) | `InviteLifecycleTest`, `invites.spec` |
| 7 | YZ seviye 1–10 | her seviyede tam oyun (10 oyun) + seviye 5, 9 maç (hedef 3) | ✅ | `bots.json`, `bots-match.json` |
| 8 | YZ seviye 11–12 | Premium kapısı (403 `premium_required`), geçersiz seviye 0/13 → 422 | ✅ (yalnız kapı) | `bots.spec` |
| 9 | Turnuva (8 kişilik eleme) | katılım, başlatma, maç odası yönlendirme, dışarıdan erişim 403, 7+1 maç (3.'lük dahil), kazanan raporu, sahte rapor, final açılış gecikmesi, şampiyon | ✅ | `tournament.json` |
| 10 | Kız Tavlası (bilgisayara karşı) | masaüstü 5 + mobil 2 tam oyun, sonuç ekranı, taşma yok | ✅ / 🔧 (H-5) | `kiz-*.json`, `kiz-*-oyun-*.png` |
| 11 | Rövanş | bitmemişte 409; tek taraflı kabulde oda yok; iki taraf → yeni oda; tekrar kabul aynı kod; eski odaya komut 409; yeni odada tam oyun; ret | ✅ | `rematch.spec` |
| 12 | .mat dışa aktarım | oyun sayısı, oyun başı puan ve toplam skor = sunucu sonucu | ✅ | `mat-*.mat` |
| 13 | Kurallar (kontrollü tahta/zar → validator) | iki zar zorunluluğu; yalnız biri oynanabiliyorsa büyük zar; çift zar 4 hamle; hamle varken pas yok / yokken pas; bar önceliği; kırma → bar; kapalı hane; rakip taşı / ters yön; toplama koşulu; büyük zarla toplama; son taş; siyah yön/giriş | ✅ (11/11) | `rules-validator.spec` |
| 14 | Mars / katmerli mars puanı | rastgele oyunlarda oluşan 2'lik ve 3'lük oyunlar motorla doğrulandı (toplam 31 oyunda: tek 12, mars 11, katmerli mars 8) | ✅ | tüm `*.json` `games[].points` |
| 15 | Küp | teklif → kabul (küp 2, sahiplik); teklif varken zar yok; sahibi olmayan teklif edemez; teklif → ret (teklif eden küp değerini alır, yeni oyunda küp 1); botun küp teklifine yanıt | ✅ | `security-races.spec` (küp), `bots.spec` |
| 16 | Teslim olma | teslim → maç biter, kazanan doğru, sonra roll/resign 409 | ✅ | `security-races.spec` |
| 17 | Sırası olmayan oyuncu | roll: 200 + `not_turn` (zar üretmez, sürüm sabit); hamle: reddedilir, tahta değişmez | ✅ | `security-races.spec` |
| 18 | Yetki | başka hesap / misafir / çalıntı oda tokenı → 403; üçüncü kişi oda okuyunca token ve zar tohumu sızmıyor | ✅ | `security-races.spec` |
| 19 | Geçersiz hamle | 422, tahta değişmez | ✅ | `security-races.spec` |
| 20 | Çift gönderim (aynı command_id) | birebir tekrar → saklanan yanıt; farklı içerik → 409 | 🔧 (H-1) | `RoomCommandIdempotencyTest`, `security-races.spec` |
| 21 | Eşzamanlı işlemler | aynı sürüme 4 paralel hamle → tam 1 kabul | ✅ | `security-races.spec` |
| 22 | Eski sürüm (stale) | 409 | ✅ | `security-races.spec` |
| 23 | Sahte puan raporu | bitmemiş maç için 409; tekrar rapor puanı tekrar artırmaz | ✅ | `security-races.spec` |
| 24 | Saat — gecikme / doğru oyuncu | gecikme içinde oynayanın bankası azalmaz; sırası olmayanın saati akmaz | ✅ | `timers.spec` |
| 25 | Saat — süre dolması | hızlı modda ~32 sn sonra TIMEOUT, süresi biten kaybeder, saat durur, komut 409 | ✅ | `timers.spec` |
| 26 | Terk (bağlantı kopması) | 45 sn görünmezlik → ABANDON, rakip kazanır | ✅ | `timers.spec` |
| 27 | Tarayıcı — masaüstü | UI eşleşme; her ply'da iki arayüz tahtası = sunucu; yenileme; aynı hesap 2. sekme; 5 sn çevrimdışı; gizli→görünür; maç sonu ekranı; konsol hatası yok | ✅ | `browser-desktop.json`, `browser-desktop-result-*.png` |
| 28 | Tarayıcı — mobil (Pixel 7 emülasyonu) | 4 tur UI'dan: otomatik zar, taşa dokunma, Onayla (104×40 px) → sunucuya ulaştı, iki arayüz senkron; yatay taşma 0; maç sonu kartı 372 px (ekrana sığıyor) | ✅ | `browser-mobile.json`, `browser-mobile-*.png` |
| 29 | Önceki turdan: senkron kilidi | kendi turunda bayat yerel durum, sunucu sırayı rakibe geçirince eski tahtada takılma | 🔧 (bu oturumun önceki işi, `authSync`) | `authSync.test.ts`, `ui-five-game-audit.spec` |

### Tamamlanan oyun/maç sayıları

| Oyun türü | Maç | Oyun | Not |
|---|---:|---:|---|
| Rastgele eşleşme — Tek Oyun | 5 | 5 | + bahisli 5 maç / 5 oyun |
| Rastgele eşleşme — Maç (hedef 3) | 5 | 8 | |
| Arkadaş odası | 5 | 8 | + rövanş 2 maç, .mat 1 maç |
| Davet | 5 | 5 | |
| YZ (sunucu botu) | 12 | ≥12 | seviye 1–10 birer Tek Oyun + seviye 5 (0-4) ve 9 (0-6) maç |
| Turnuva | 8 | 8 | 8 kişilik eleme (3.'lük + final dahil) |
| Kız Tavlası | 7 | 7 | masaüstü 5, mobil 2 (+ düzeltme sonrası mobil 2) |
| Tarayıcı UI (masaüstü + mobil) | 2 | 2+ | iki gerçek Chromium oturumu; her ply'da arayüz = sunucu |
| Yerel (aynı cihaz, `pvp`) | 0 | 0 | ⛔ bu turda koşulmadı (§9) |

## 5. Doğrulanmış hatalar (yeniden üretildi → kök neden → düzeltildi → yeniden test edildi)

### H-1 — Yüksek: Aynı komutun birebir tekrarı (ağ yeniden denemesi) 409 "stale-version" alıyordu
- **Yeniden üretme:** Oyun ortasında `POST /rooms/{code}/move` (veya `roll`) `{command_id: X, expected_version: V}` ile başarılı gönder; aynı gövdeyi (aynı `command_id`, aynı `V`) tekrar gönder.
- **Beklenen:** Sunucu, kayıtlı makbuzun yanıtını aynen döndürür (kodda bu amaçla `room_commands.response_json` saklanıyor; yorum "network retry" senaryosunu açıkça anıyor).
- **Gerçekleşen:** 409 `stale-version`. Yanıtı ağda kaybolan istemci, kendi kabul edilmiş hamlesi için hata alıyor. Aynı kimlik farklı içerikle geldiğinde de `command-payload-mismatch` yerine `stale-version` dönüyordu.
- **Kök neden:** Beş komut işleyicisinde (`roll`/`move`/`cubeOffer`/`cubeRespond`/`resign`) sürüm kapısı (`staleCommand`), makbuz denetiminden (`claimAuthoritativeCommand`) **önce** çalışıyor; birebir tekrar her zaman eski sürüm taşıdığı için replay yolu hiç çalışmıyordu.
- **Düzeltme:** `RoomController::staleCommand` sürüm uyuşmadığında önce makbuzu salt-okunur arar (`replayedCommand`): makbuz varsa saklanan yanıtı ya da `command-payload-mismatch` döner. Yeni makbuz oluşturmaz, yeni komutlar için sürüm kapısı aynen çalışır.
- **Regresyon:** `RoomCommandIdempotencyTest::test_exact_retry_with_original_version_replays_receipt_mid_game` (düzeltmesiz başarısız, düzeltmeyle geçer) + `e2e/flows/security-races.spec` "aynı komutun tekrarı".

### H-2 — Orta: Davet eden bekleyen odadan ayrıldığında davet geçerli kalıyordu
- **Yeniden üretme:** A, B'yi davet eder ve `/rooms/{code}/enter` ile bekleyen odayı açar. A `POST /rooms/{code}/leave` çağırır (yanıt `ok`). B `POST /invites/{id}/respond {accept:true}` → 200 ve oda kodu.
- **Beklenen:** Sahibi ayrılmış odaya davet kabul edilemez (409, davet `expired`). `/ping` ve `respond` içindeki yorumlar da bunu amaçlıyor.
- **Gerçekleşen:** `leave` bekleyen odada hiçbir şey yapmıyordu (yalnız `playing` için terk işliyor). Oda `waiting` kaldı, B odaya girdi. Maç başlayınca A, 45 sn görünmezlik sonrası "terk" ile kaybedip puan yitiriyordu.
- **Kök neden:** `RoomController::leave` bekleyen oda için durum değiştirmiyordu.
- **Düzeltme:** Sahip (p1) rakipsiz bekleyen odadan ayrılınca oda silinir ve o odanın bekleyen davetleri `expired` yapılır (`matchmakingCancel` ile aynı desen). Başkasının token'ı 403 almaya devam eder.
- **Regresyon:** `InviteLifecycleTest` (owner_leaving…, leave_by_non_owner…) + `invites.spec` "davet eden odadan ayrılınca davet geçersiz".

### H-3 — Orta/Düşük: Davet yanıtında yaş ve durum denetimi yoktu
- **Yeniden üretme:** 2 dakikadan eski bir davet (`/ping`'de artık görünmez) ya da reddedilmiş bir davet için `respond {accept:true}`.
- **Gerçekleşen:** Oda hâlâ `waiting` ise kabul ediliyordu (davetlinin göremediği / reddettiği davet).
- **Düzeltme:** `PresenceController::INVITE_TTL_MINUTES = 2` (`/ping` ile aynı pencere); süresi geçen davet `expired` + 409; `pending` olmayan davet kabul edilemez. Zaten `accepted` olanın tekrarı (ağ yeniden denemesi) aynı kodu döndürür.
- **Regresyon:** `InviteLifecycleTest` (older_than_ttl…, declined…_idempotent).

### H-4 — Düşük: Kız Tavlası sayfa açıklaması olmayan bir modu vaat ediyordu
- **Gerçekleşen:** SEO açıklaması "İki kişi veya bilgisayara karşı ücretsiz oyna" diyor; Kız Tavlası yalnız bilgisayara karşı (`KizTavlasi.tsx`: "Bilgisayara Karşı").
- **Düzeltme:** `src/App.tsx` açıklaması "Bilgisayara karşı ücretsiz oyna." yapıldı.

### H-5 — Düşük: Kız Tavlası sonuç başlığı "Sen kazandı!"
- **Gerçekleşen:** Oyuncu kazanınca başlık "Sen kazandı!" (dilbilgisi hatası); tarayıcı testinin ekran görüntüsünde görüldü.
- **Düzeltme:** "Kazandın!" / "Bilgisayar kazandı!". Mobilde yeniden oynanıp "Kazandın! MARS! (iki kat)" görüldü (`kiz-mobil-oyun-1.png`).

### (Bu oturumun önceki işinden) Yüksek: senkron kilidi — `src/online/authSync.ts`
Hamle başka sekmeden/cihazdan geldiğinde ya da `/move` yanıtı kaybolduğunda istemci kendi turunda bayat zar/hamleyle kalıyor ve sonraki sunucu durumlarını uygulamıyordu. Kalkan artık yalnız sunucuda sıra hâlâ bendeyken çalışıyor (commit `2d81621`, regresyon `authSync.test.ts`). Bu turda masaüstü tarayıcı testinde "aynı hesap 2. sekme" ve "bağlantı kopması" senaryolarıyla yeniden doğrulandı.

## 6. Hata olmayan / tasarım gereği gözlemler (doğrulandı)

- **Açılış zarı tekrar istenebilir:** Rakip `/roll` çağırınca 200 + `reused:true` + aynı zarlar döner; sürüm değişmez (açılış kilidini önlemek için bilinçli).
- **Sırası olmayanın `/roll`'u:** 200 + `not_turn:true` + güncel durum (senkron yükü). Zar üretilmez, sürüm değişmez.
- **Turnuva raporu:** Sunucu `winner_id`'yi yok sayar, kazananı oda sonucundan hesaplar. Kaybedenin "ben kazandım" raporu 200 döner ama tabloya gerçek kazanan yazılır (hile mümkün değil).
- **Final açılış gecikmesi:** Üçüncülük maçı bitince final 1 dk sonra açılır (`opens_at`).
- **Otomatik zar:** Mobil/masaüstü istemci, sırası gelince zarı düğmesiz kendiliğinden atabiliyor (UI zarları gösteriyor).
- **Bahis komisyonu:** Kazanan stake×puan×0,95 alır; kaybeden stake×puan öder. `settle` tekrarında ikinci ödeme yok.
- **Performans notu:** `POST /rating/report` maç sonu PR'ını istek içinde senkron hesaplıyor (kod yorumu "validator PR max ~20s"); testte bu istekler 20–35 sn sürdü. İşlevsel hata değil ama istemcinin bekleme süresini uzatıyor. İleride kuyruk işine taşınması önerilir (yapılmadı: mimari değişiklik).
- **Hız sınırı:** Oda komutları 240/dk. API testleri gerçek oyuncudan hızlı olduğu için 429 alıp bekledi (ürün davranışı doğru).

## 7. Değiştirilen dosyalar

| Dosya | Değişiklik |
|---|---|
| `backend/app/Http/Controllers/RoomController.php` | H-1 `replayedCommand` + `staleCommand`; H-2 `leave` bekleyen oda |
| `backend/app/Http/Controllers/PresenceController.php` | H-3 `INVITE_TTL_MINUTES`, durum denetimi, idempotent kabul |
| `backend/tests/Feature/RoomCommandIdempotencyTest.php` | H-1 regresyon |
| `backend/tests/Feature/InviteLifecycleTest.php` | H-2/H-3 regresyon (yeni) |
| `src/App.tsx` | H-4 Kız Tavlası açıklaması |
| `src/ui/KizTavlasi.tsx` | H-5 sonuç başlığı |
| `backend/app/Console/Commands/E2eSeed.php` | `--users=N` (yalnız `APP_ENV=e2e`) |
| `backend/config/database.php` | SQLite `busy_timeout`/`journal_mode` env'den (varsayılan null; canlı MySQL'i etkilemez) |
| `e2e/flows/*.spec.ts`, `e2e/flows/helpers.ts`, `playwright.flows.config.ts` | Yeni uçtan uca oyun akışı testleri |
| `test-kanitlari/flows/*` | Kanıtlar (JSON özetler, .mat, ekran görüntüleri) |

Üretime hiçbir test kancası / sabit zar eklenmedi. Test hesapları ve yönetici yetkisi yalnız ayrı e2e SQLite veritabanında.

## 8. Çalıştırılan testler ve gerçek sonuçlar (son koşu)

| Komut | Sonuç |
|---|---|
| `npx playwright test -c playwright.flows.config.ts` — bots | 3/3 ✅ |
| — online-games (eşleşme tek, maç, arkadaş, bahisli) | 4/4 ✅ |
| — invites | 5/5 ✅ (H-2 düzeltmesinden önce 4/5; sonra 5/5) |
| — rules-validator | 11/11 ✅ |
| — security-races | 9/9 ✅ (H-1 düzeltmesinden önce "tekrar" testi ❌) |
| — tournament | 1/1 ✅ (8 maç, şampiyon = final kazananı DB'de doğrulandı) |
| — rematch | 1/1 ✅ |
| — mat-export | 1/1 ✅ |
| — timers | 3/3 ✅ |
| — kiz-tavlasi | 2/2 ✅ (masaüstü 5 oyun, mobil 2 oyun) |
| — browser (masaüstü, mobil) | 2/2 ✅ |
| `cd backend && vendor/bin/phpunit` | 788 test, OK, 4 skipped (validator entegrasyonu `VALIDATOR_URL` ister) |
| `npx vitest run` | 371 geçti, 1 skipped |
| `npx tsc -b` | temiz |
| `npx oxlint` | 0 hata (yalnız önceden var olan uyarılar) |

Not: Testlerin bir kısmı ilk denemede **test tarafı** nedenlerle başarısız oldu (eksik `/roll` açılışı, hız sınırı 429, SQLite kilidi, yanıt alan adları, otomatik zar, final 1 dk gecikmesi); bunlar test kodunda düzeltildi ve yeniden koşuldu. Ürün hataları yalnız §5'tekilerdir.

## 9. Test edilemeyen alanlar, engeller ve sınırlar

| Alan | Durum | Neden |
|---|---|---|
| Gerçek mobil cihaz / PWA standalone | ⛔ | Yalnız Chromium mobil emülasyonu (Pixel 7) ve `visibilitychange` benzetimi; gerçek iOS/Android ve ana ekrana eklenmiş PWA test **edilmedi**. Emülasyon gerçek PWA testi sayılmaz. |
| WebSocket (Reverb) | ⛔ | e2e'de `BROADCAST_CONNECTION=log` → istemci 1.2 sn poll'a düşer. Tüm senkron testleri poll yolunda; WS olay tekrarları/sıralaması test edilmedi. |
| gnubg sürümü | ⚠️ | Ubuntu gnubg 1.07 kullanıldı; servis 1.07'de olmayan `setgnubgid`'i çağırdığı için yalnız yerel kopyaya uyumluluk katmanı eklendi. Bot hamle **kalitesi** üretimdeki gnubg ile birebir aynı olmayabilir; akış/kurallar doğrulandı. |
| YZ seviye 11–12 oyunları | ⛔ | Premium gerekli; yalnız erişim kapısı doğrulandı. |
| Bot motoru hata durumu | kısmen | gnubg kapalıyken `bot_status: unavailable` + insan hamlesinin korunması gözlendi (ortam hatası sırasında); ayrı bir otomatik test yazılmadı. |
| Swiss turnuva (`swiss_triple`) | ⛔ | Yalnız eleme (bracket) turnuvası koşuldu. |
| Turnuva katılım/ilk zar süreleri, `tournaments:tick` cron, no-show | ⛔ | Zamanlanmış görevler e2e'de çalıştırılmadı. |
| Yerel (aynı cihaz) `pvp` modu | ⛔ | Sunucuya gitmeyen istemci modu; bu turda UI senaryosu yazılmadı (motor birim testleri kapsıyor). |
| AFK (60 sn hareketsizlik) ayrı senaryo | kısmen | Süre dolması (TIMEOUT) ve terk (ABANDON) koşuldu; yalnız AFK_TIMEOUT dalı ayrıca koşulmadı (`MatchClockTest` birim testleri var). |
| Crawford | kısmen | Maç akışlarında rastlantısal; özel bir senaryo koşulmadı (backend `ServerMatch`/`RoomCube` testleri kapsıyor). |
| Ağ kesintisi sırasında yanıt kaybı (H-1 senaryosu) | API ile | Gerçek ağ kaybı yerine aynı isteğin tekrarı ile üretildi. |
| Canlı veriler | — | Canlıya dokunulmadı, dağıtım yapılmadı (`main`'e gönderilmedi, `deploy:build` çalıştırılmadı). |

## 10. Nihai özet

- **Keşfedilen oyun türleri:** YZ (seviye 1–12), rastgele eşleşme (Tek Oyun, Maç, bahisli), arkadaş odası, davet, turnuva (eleme; Swiss kod tabanında), Kız Tavlası (bilgisayara karşı), yerel (aynı cihaz), rövanş/izleme.
- **Tamamlanan oyun döngüleri:** her çevrimiçi türde ≥5 maç — toplam **50 sunucu maçı** (eşleşme 10, bahisli 5, arkadaş 5, davet 5, YZ 12, turnuva 8, rövanş 2, .mat 1, tarayıcı 2) + **9 Kız Tavlası oyunu**; tümünde taş sayısı, iki istemci durumu ve puanlar bağımsız olarak doğrulandı, **anomali 0**.
- **Bulunan ürün hatası:** 5 (Yüksek 1, Orta 1, Orta/Düşük 1, Düşük 2) — **hepsi düzeltildi** ve regresyon testleri eklendi. Ayrıca bu oturumun önceki işinde 1 Yüksek senkron hatası düzeltilmişti (yeniden doğrulandı).
- **Kalan kritik sorun:** doğrulanmış kritik sorun **yok**. Açık riskler: gerçek cihaz/PWA ve WebSocket yolu test edilemedi; `rating/report` senkron PR hesabı 20–35 sn sürebiliyor (performans).
- **Yayın:** Değişiklikler yalnız `claude/cloud-session-credits-9nd4yl` dalında; canlıya alınmadı.
