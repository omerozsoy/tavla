# TavlaTV — Oyun Akışı & Senkronizasyon Denetim Raporu

**Tarih:** 2026-10-07
**Kapsam:** Zar, sayaç, rakip hamle gösterimi, tur senkronu — sunucu/DB/gerçek-zaman/istemci.
**Yöntem:** Kod akışı uçtan uca haritalandı; otoriter saat + senkron kararları + canlı-hamle kanalı
incelendi; iddialar koda ve testlere karşı DOĞRULANDI (varsayım değil). İki-istemci E2E ve birim
testleri çalıştırıldı. Canlı kullanıcı/prod verisine dokunulmadı.

> **Dürüst özet:** Bildirilen 5 belirtinin büyük kısmı, bu denetimden saatler önce (bugün, 07 Eki)
> yapılan commit'lerle zaten ele alınmıştı (zar tumbling illüzyonu `a7ecd164`; tur-başına-tek-delay
> sayaç regresyonu `20373aab` revert → `bc9369fd`; oyunlar-arası banka sıçraması `bc9369fd`). Bu
> denetimde o düzeltmelerin **geçerli ve tutarlı** olduğu doğrulandı; ek olarak gerçek defektler
> bulunup düzeltildi. Alt-ajanların işaret ettiği "kritik backend yarış koşullarının" çoğu, mevcut
> kilit/sürüm kapıları nedeniyle **gerçekten tekrar üretilemez** (aşağıda gerekçesiyle elendi).
> Belirtilerin bugünkü **baskın kök nedeni kod hatası değil, taşıma katmanıdır**: push (Reverb) devre
> dışıyken her şey 1.2sn polling'e düşer.
>
> **GÜNCELLEME (07 Eki, 2. oturum — "hepsini tek tek çözelim"):** Snap (Belirti 4) için **§5.2 ONAYLI
> RAKİP HAMLESİ REPLAY uygulandı** (cosmetic, otoriteye dokunmaz, pure-tested + güvenlik temizliği).
> Artık rakibin onayladığı hamle, canlı önizleme gelmese BİLE otoriter delta'dan adım adım oynanır →
> "bir anda tamamlanmış geldi" ve çoğu "göremedim" vakası giderildi.
>
> **GÜNCELLEME (07 Eki, 3. oturum — Reverb prod DOĞRULANDI):** "Push kapalı olabilir" HİPOTEZİM
> YANLIŞMIŞ. Prod'da canlı doğrulandı: Reverb daemon 6 gündür ayakta (0.0.0.0:8080), `BROADCAST_
> CONNECTION=reverb` AÇIK, `/api/realtime-config` → `{enabled:true, key:...}`, nginx `/app` ws proxy →
> `101 Switching Protocols` + `X-Powered-By: Laravel Reverb`. **Push 6 gündür CANLI.** Dolayısıyla
> Belirti 1/3/4'ün kökü "transport kapalı" DEĞİL: (a) **snap** push'tan bağımsız bir istemci-render
> sorunuydu → §5.2 çözer; (b) "zar geç" anları ancak o istemcinin **ws'i düştüğünde** (mobil/flaky ağ
> → poll fallback; realtime.ts ~15sn'de toparlar). ASIL İYİLEŞTİRME deploy edilmemiş §5.2 bundle'ında.

---

## 1. Oyun akışı haritası (otorite nerede?)

- **Teknoloji:** Frontend React+TS (Vite, tek dev `src/App.tsx` ~10.8k satır). Backend Laravel
  (`RoomController` ~4.4k satır), MariaDB. Gerçek-zaman: **HTTP polling (~1200ms)** + opsiyonel
  **push** (`RoomUpdated` → Reverb, `BROADCAST_CONNECTION` ile gated).
- **Modlar (ortak altyapı = authoritative oda):** YZ'ye karşı (bot), online/rakip, maç oyunu,
  Tek Oyun (para), Kız Tavlası, turnuva maçı. Hepsi aynı `server_state`/`server_version`/`clock`
  omurgasını kullanır (Kız Tavlası ayrı motor ama aynı oda/sayaç omurgası).
- **Yetkili durum:** SUNUCU. `rooms.server_state` (tahta), `rooms.server_version` (her başarılı
  eylemde +1), `rooms.server_match` (skor/küp/tur), `rooms.clock` (MatchClock JSON), `rooms.live`
  (yalnız cosmetic önizleme). İstemci optimistik oynamaz; aksiyon gönderir, sunucu durumunu yansıtır.
- **Geçiş tetikleyici:** `/roll`, `/move`, `/cube`, `/resign` → kilitli transaction içinde
  `server_version+1` + `MatchClock::onUpdate` + (push açıksa) `broadcastRoom`. Poll kilitsizdir
  (okuma), yazımlar `lockForUpdate` ile serileşir.
- **İstemci gösterimi:** Saat `clock` demirinden ~250ms'de aradeğerlenir; tahta
  `applyPlayed(turnStart, played | oppLive)`; rakip hamlesi `room.live` adımlarından 450ms/adım
  animasyonla; onaylı hamle poll ile `server_state` olarak gelir.

---

## 2. Belirti belirti: kanıtlanan kök neden

### Belirti 1 — "Zarlar bazen erken, bazen geç"
- **Kendi zarım:** `/roll` yanıtında anında gelir (`doRollAuthoritative`, App.tsx ~3437). Doğru.
- **Rakip zarı:** `room.live` ya da poll'daki `server_match.lastMove` ile gelir (App.tsx ~5204) →
  push kapalıyken **en geç ~1.2sn gecikir** = "geç görünme". Kök = taşıma (polling), kod değil.
- **"6-4 geldi 4-1'e döndü" illüzyonu:** `a7ecd164`'te zaten çözülmüş (sahte rastgele tumbling →
  spinner). **Doğrulandı:** poll, taze atılan zarı EZEMEZ — `shouldApplyServerState` sürüm kapısı
  (`authSync.ts:44`, `server_version <= applied → false`) ve `doRollAuthoritative` sürümü hemen
  kaydeder (App.tsx ~3434). Alt-ajanın "poll zar üzerine yazıyor" iddiası **elendi (gerçek değil)**.

### Belirti 2 — "Sayaç yanlış / anlamsız saniyeler"
- Bu, bugün eklenen "tur-başına-tek-delay" özelliğinin regresyonuydu (sayaç birleşik/garip değer).
  `20373aab` revert + `bc9369fd` yeniden-doğru-kurulum + oyunlar-arası `resume` sıfırlaması ile
  giderilmiş. **Doğrulandı:** 36 MatchClock birim testi geçiyor; `clientView` matematiği
  `max(0, …)` + `round` ile sınırlı (NaN/negatif üretmez).
- **Bulunan artık defekt (DÜZELTİLDİ):** İstemcideki OFFLINE delay-sıfırlama effect'i (App.tsx ~4434)
  ONLINE modda da çalışıyordu; online saat tamamen sunucu demirinden türetilmeliyken tur değişiminde
  bir an YEREL preset delay'ini flaşlıyordu → moda/hold'a göre yanlış sayı titremesi.
- **Sertleştirme (DÜZELTİLDİ):** Aradeğerleme artık saf `interpClock` ile yapılıyor; ağdan gelen
  bozuk/eksik bir alan (NaN/undefined) ekrana **"anlamsız saniye"** olarak düşemez → 0'a sabitlenir.

### Belirti 3 — "Rakibin hamlelerini bazen göremiyorum"
- Rakibin adımları yalnız **o turun ortasında bir poll yakalarsa** `room.live`'dan görünür. Push
  kapalıyken ve rakip hızlı oynayıp onaylarsa, araya poll girmez; yalnız onaylı son durum (snap)
  gelir. Ayrıca `postLive` sessiz başarısız olabilir (cosmetic, yutulur). Kök = polling + canlı
  önizlemenin yarış doğası. (Tasarım sınırı; §5'te kalıcı çözüm önerisi.)

### Belirti 4 — "Taş hareketleri adım adım değil, bir anda tamamlanmış geliyor" — **ÇÖZÜLDÜ (§5.2)**
- **Kök:** Tahta `boardDisplay` adım-adım animasyonu YALNIZ canlı-önizleme (`oppLive`) sırasında
  çizerdi. Rakip ONAYLAYINCA `applyServerBoard` `turnStart`'ı sonraki duruma atar + `oppLive`
  temizlenir → onaylı hamle replay edilmez, tahta son konuma SIÇRAR. Önizleme zamanında gelmezse snap.
- **UYGULANAN ÇÖZÜM:** `applyServerBoard` bir rakip turunu kapatırken, `reconstructOppMove`'un
  ürettiği adımları (zaten loglama için hesaplanıyor) **cosmetic bir replay katmanında** (`oppReplay`)
  adım adım oynatır: tahta kısa süre `base(=rakip tur-başı)+adımlar` gösterir, bitince otoriter
  sonuca döner. Otoriteye (turnStart/skor/saat) DOKUNMAZ. Canlı önizleme (`room.live`) zaten
  gösterdiyse `replayStartIndex` ile ATLANIR/DEVAM eder (çift oynatma yok). Bot hariç (kendi
  reveal'ı var). Her koşulda güvenlik zamanlayıcısı + yeni-otoriter-durum/oda-değişim/ayrılma
  temizliğiyle biter (TAKILMA engeli). Replay sırasında oto-zar bastırılır, bitince devam eder.
- Bu, Belirti 3'ün ("göremedim") büyük kısmını da çözer: artık önizleme hiç gelmese bile rakibin
  hamlesi her zaman adım adım görünür.

### Belirti 5 — "Oyun takılıyor / kimin sırası belirsizleşiyor"
- Desync kalkanları çok katmanlı ve testli: `shouldApplyServerState` (sürüm kapısı + yalnız-kendi-
  turumda mid-move kalkanı), `openingNeedsResync`, `serverSyncRoomChanged` (oda-kimliği bazlı reset),
  komut idempotency (`RoomCommand` unique `(room_id,command_id)` + replay), `staleCommand` sürüm
  reddi. **Yeni, tekrar-üretilebilir bir takılma kök nedeni bulunamadı.** Geçmiş vakalar (mavi ekran,
  hayalet galibiyet, küp drop kilidi, bayat sürüm AFK) ayrı commit'lerle kapanmış.

### Elenen alt-ajan iddiaları (gerçek değil — gerekçeli)
- *"Move ön-doğrulama bayat state'e uygulanıyor"* → `preResult` yalnız `server_version ==
  preExpectedVer` iken (kilit altında) kullanılır; sürüm yalnız commit'li transaction'da değişir →
  bayat yeniden-kullanım imkânsız. **Elendi.**
- *"Timeout ↔ move sürüm yarışı state'i bozuyor"* → `tickClock` ve `move` ikisi de aynı satırda
  `lockForUpdate` ile serileşir. **Elendi.**
- *"live endpoint turu bozuyor"* → `live` yalnız cosmetic `rooms.live` kolonunu yazar; `server_state`
  ayrı; istemci `seq != turnsPlayed` ile bayatı eler (App.tsx 6101). Turu bozamaz. **Elendi.**

---

## 3. Değiştirilen dosyalar ve uygulanan çözüm

| Dosya | Değişiklik | Belirti |
|---|---|---|
| `src/online/clockView.ts` (YENİ) | Saf `interpClock(anchor, now)` — online saat aradeğerlemesi; **trust-boundary NaN/negatif koruması** (bozuk alan → 0, ekrana "anlamsız saniye" düşmez). | 2 |
| `src/online/clockView.test.ts` (YENİ) | 10 birim test: delay/over/hold/aktif-taraf + NaN/undefined/negatif + bozuk `at`. | 2 |
| `src/App.tsx` (saat aradeğerleme) | Satır-içi matematik → `interpClock` çağrısı (saf + testli). | 2 |
| `src/App.tsx` (delay-reset effect) | `if (online) return` — online delay YALNIZ sunucu demirinden; tur değişiminde yerel-preset flaş titremesi kalktı. | 2 |
| `src/App.tsx` (oda-değişim reset effect) | Oda kodu değişince `oppLiveShownRef`/`pendingOppFlightRef`/`lastOppRollVRef` + `oppLive`/`oppRoll` temizlenir — rövanş/yeni odada bayat canlı-önizleme adımlarının "hayalet" oynaması / atlanması / ilk rakip zarının görünmemesi engellendi. | 3, 4 |
| `src/online/liveMoves.ts` + test | `replayStartIndex(shown, full)` saf fn — onaylı hamle replay'inin kaçıncı adımdan başlayacağı (önizleme devamı / çift-oynatma engeli); 5 birim test. | 4 |
| `src/App.tsx` (§5.2 replay) | `oppReplay` state + `maybeReplayOppMove`/`clearOppReplay`; `boardDisplay` replay katmanı; flight layout-effect dep; oto-zar + `showRoll`/`autoRollPending` gate; room-change + `handleLeaveRoom` temizliği. Onaylı rakip hamlesini adım adım oynatır (cosmetic, güvenlik temizlikli). | 4 (+3) |

**Not:** Backend'e DOKUNULMADI (saat/senkron zaten testli ve doğru bulundu). Değişiklikler saf
istemci + yeni saf modül; otoriteyi değiştirmez.

---

## 4. Çalıştırılan testler ve sonuçları

| Test | Komut | Sonuç |
|---|---|---|
| Backend saat birim | `php artisan test --filter=MatchClock` | **36/36 geçti** |
| Backend push sözleşme+gate | `test --filter="RoomUpdatedEventTest\|RealtimeConfigTest"` | **3/3 geçti** (kanal `room.{code}` + olay `room.updated` + gövde; `realtime-config` reverb=enabled, log=disabled, secret sızmaz) |
| Frontend birim (tam) | `npx vitest run` | **415 geçti / 1 skip** (clockView 10 + replayStartIndex 5 + oppReplay yakınsama 6 dahil) |
| Hedefli birim | `vitest run src/online/{clockView,liveMoves,authSync}.test.ts` | hepsi geçti (clockView 10, liveMoves 11, authSync) |
| TypeScript | `npx tsc -b` | **Temiz (0 hata)** |
| Üretim build | `npx vite build` | **Başarılı** (yalnız bilinen büyük-chunk uyarısı) |
| Lint (değişenler) | `npx oxlint …` | **Temiz** |
| **İki-istemci E2E** | `playwright test e2e/authoritative.spec.ts` | **GEÇTİ** (ilk 20.6s; §5.2 replay sonrası tekrar **19.5s**) — 2 oyuncu eşleşti, **beyaz VE siyah hamle yaptı, sıra döndü** |
| Zar görünürlüğü E2E | `playwright test --config=playwright.dice.config.ts` | **3/3 geçti** |

---

## 5. Kalıcı çözümler

1. **Push'u (Reverb) prod'da etkinleştir** — [OPS; KOD HAZIR + TESTLİ] Belirti 1 ("geç") + residual
   3'ün kök nedeni. Kod tarafı bu oturumda **runnable testlerle** doğrulandı: push sözleşmesi
   (`RoomUpdatedEventTest`: public `room.{code}` + `room.updated` + gövde) ve istemci-enable gate
   (`RealtimeConfigTest`: `broadcasting.default==='reverb'`→enabled+key, `log`→disabled, secret
   sızmaz). `broadcastRoom` 5 oyun aksiyonunda da çağrılıyor (roll/move/cube/resign/saat-sonu).
   İstemci (`src/online/realtime.ts`) host/port'u `window.location`'dan türetir + key'i sunucudan
   alır → **rebuild gerekmez** (runbook'taki `VITE_REVERB_*` değişkenleri artık KULLANILMIYOR,
   eski doc). **Tek kalan ops:** prod `.env` → `REVERB_APP_ID/KEY/SECRET` + systemd
   (`deploy/tavla-reverb.service`) + nginx `/app` wss proxy + EN SON `BROADCAST_CONNECTION=reverb`.
   Tam adımlar: `deploy/README.md` §Reverb. **Repo dışı `.env`; bu denetimden açılamaz.**
2. **Onaylı rakip hamlesini otoriter delta'dan replay et** — [UYGULANDI, §2 Belirti 4] Cosmetic
   `oppReplay` katmanı + `replayStartIndex` (pure, testli) + güvenlik temizliği; iki-istemci E2E ile
   regresyonsuz doğrulandı. Transporttan BAĞIMSIZ: push kapalı olsa bile adım adım gösterir.

---

## 6. Düzeltilmeyen / doğrulanamayan noktalar (dürüst kayıt)

- **5 tam insan-insan 2-oyunculu canlı maç + ağ bozma (gecikme/kesinti):** YAPILMADI. Gerekçe:
  canlı prod'a dokunmamam istendi; yerel E2E harness'ı 2-istemci + 3-servis soğuk başlatmada
  dökümante timeout yaşıyor (önceki `BULGU-004/006`). Bunun yerine **otoriter 2-istemci E2E** (gerçek
  iki tarayıcı oturumu, backend+validator+DB) çalıştırıldı ve geçti; ama bu "beyaz+siyah hamle+sıra
  dönüşü" düzeyindedir, 5 tam oyun + ağ-bozma senaryosu DEĞİL.
- **Gerçek cihaz / mobil / PWA geri-dönüş:** Test edilmedi (statik analiz dışında).
- **Prod push durumu:** `BROADCAST_CONNECTION` prod değeri repo dışı (`.env`, Plesk); bu denetimden
  doğrulanamadı. Belirti 1 ("geç") büyüklüğü buna bağlı — istemci tarafı hazır, kalan ops.
- **§5.2 replay'in doğrulaması:** DOĞRULUK/YAKINSAMA deterministik kanıtlandı (`oppReplay.test.ts`,
  gerçek motor): kare dizisi başlangıçtan bitişe TEK TEK ilerler, ara kareler uçlardan farklıdır
  (snap DEĞİL), SON kare otoriter tahtaya TAM eşittir (tamamlanma ölçütü). İki-istemci E2E de senkronu
  bozmadığını gösterdi. **Yapılmayan:** subjektif "görsel akıcılık"ı (easing/450ms his) gerçek iki
  tarayıcıda GÖZLE izleme — bu otomatik assert edilemez; deploy sonrası sende kalır ya da istenirse
  headed-browser ekran görüntüsü harness'ı ayrıca kurulabilir.
- **Deploy:** Frontend bundle `backend/public`'e yazılıp commit EDİLMEDİ (deploy kullanıcıya ait,
  canlı kullanıcı etkisi olduğundan). Bu değişiklikler canlıya çıkmak için `npm run deploy:build`
  + `backend/public` commit + push ister.

---

## Tamamlanma ölçütü değerlendirmesi

| Ölçüt | Durum |
|---|---|
| İki oyuncu aynı tahta/zar/sıra | Otoriter model + E2E ile doğrulandı (tek gerçek kaynak = sunucu) |
| Rakip hamleleri doğru sırayla | §5.2 ile onaylı hamle her zaman adım adım oynanır (otoriter delta); canlı önizleme ile çift oynatma engellenir |
| Sayaç kurallara uygun | 36 test + yeni NaN koruması + online flaş düzeltmesi ile sağlam |
| Yeniden bağlanma güncel durumu getirir | `serverSyncRoomChanged` + version kapısı + opening resync ile korunur |
| Tekrarlanan/geciken olay oyunu bozmaz | Sürüm kapısı + idempotency + mid-move kalkanı ile korunur |
