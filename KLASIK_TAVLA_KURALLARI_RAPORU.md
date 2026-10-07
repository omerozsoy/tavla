# Klasik Tavla — Kural Uygulama Raporu

Tarih: 2026-10-07 · Kapsam: "Klasik Tavla" modunun kuralları (sunucu oyun kuralları + hamle
doğrulaması + kullanıcıya gösterilen kurallar) birbiriyle uyumlu hale getirildi; mod ayrımı korundu.

---

## 1. Özet ve yaklaşım

**Kritik bulgu:** Spec'te tarif edilen tahta/dizilim, zar, zorunlu zar kullanımı, kapılar, bara
giriş ve taş toplama kuralları **standart (uluslararası) tavla** kurallarıdır ve bu projenin
**paylaşılan oyun motoru** (`src/engine/*`) ile **zaten birebir uygulanmaktadır**. Aynı motor hem
istemci UI'sini hem de Laravel backend'in çağırdığı **Node validator**'ı (`validator/server.ts`,
`/validate`) besler — yani hareket yasallığı tek kaynaktan ve sunucu-otoriter doğrulanır.

Dolayısıyla Klasik Tavla'nın normal maçtan **gerçek kural farkı yalnızca ikidir**:

1. **Katlama küpü YOK.**
2. **Puanlama: normal galibiyet = 1, mars = 2; 3 puanlık backgammon YOK** (kaybedenin barda ya da
   kazananın evinde taşı kalması marsı 3'e çıkarmaz).

Geri kalan her şey (hareket, zorunlu maksimum zar kullanımı, büyük-zar zorunluluğu, çift zar,
bara giriş, taş toplama, oyun sonu tespiti) normal maçla **aynı koddan** gelir ve değiştirilmemiştir.
Mod ayrımı bir `classic` bayrağıyla taşınır; diğer modların davranışı korunmuştur.

---

## 2. Hareket/zorunlu-zar kurallarının zaten uygulandığının doğrulanması

Spec §3, §4, §5, §6, §7'deki kurallar paylaşılan motorda enforce edilir (istemci + validator):

| Kural (spec) | Nerede | Not |
|---|---|---|
| Başlangıç dizilimi 24/13/8/6 = 2/5/3/5 | `src/engine/board.ts::initialState`, `backend/app/Support/Backgammon.php::initialState` | İkisi birebir aynı; sunucu ters dizilimi reddeder |
| İki zarın da oynanması zorunlu | `src/engine/moves.ts::maximalTerminals` | En uzun (maks) hareket dizileri filtrelenir |
| Yalnız bir zar oynanıyorsa **büyük** zar | `src/engine/moves.ts` (maxLen==1 & iki farklı zar → büyük) | |
| Çift zarda maksimum hareket | `src/engine/game.ts` (çift → [d,d,d,d]) + maximalTerminals | |
| Turun TÜM dizileri değerlendirilir (az zarla bitirilemez) | `src/engine/game.ts::isTurnComplete` | Oynanan, maks diziyle birebir eşleşmeli |
| Ara hane kapalıysa toplamla atlama yasak | `legalNextSteps` adım-adım üretim | |
| Kapılar / tek taş kırma | `src/engine/board.ts::isBlocked`,`placeChecker` | |
| Bara giriş (zar1→24 … zar6→19) + bar boşalmadan oynama yok | `src/engine/moves.ts` (bar öncelikli) | |
| Taş toplama (tam zar / yoksa büyük zarla en yüksek) | `src/engine/moves.ts` bear-off dalı | |
| Oyun sonu (15 taş) | `board.ts::winner`, `Backgammon::winner` | |

Sunucu bu kuralları `RoomController::move` → `MoveValidatorService::validate` → Node validator
(`validateTurn`) ile **otoriter** doğrular; istemcinin gönderdiği tahta/sonuç doğrudan kabul edilmez
(spec §9 zaten karşılanıyor). Bu kurallar Klasik Tavla'da **değişmez**, bu yüzden onlara
dokunulmamış, yalnızca mevcut testlerle (`moves.test.ts`, `validateTurn.test.ts`) doğrulanmıştır.

---

## 3. Yapılan değişiklikler (gerçek kural farkları + mod bayrağı)

### 3.1 Puanlama: mars=2, backgammon-3 yok
- `src/engine/board.ts` — `lossMultiplier(state, loser, classic=false)` ve `gameOutcome(state, classic=false)`:
  `classic` iken kaybeden hiç toplamadıysa **her zaman 2** döner (bar/ev taşı 3'e çıkarmaz).
- `backend/app/Support/Backgammon.php` — `gamePoints($state,$winner,$classic=false)` ve
  `resignationValue(...,$classic=false)`: `classic` iken 3 yerine **2** (frontend ile birebir).
- `src/engine/resign.ts` — `resignationValue(state, loser, classic=false)` pes değerini de 2 ile sınırlar.

### 3.2 Küp yok
- `src/engine/match.ts` — `MatchState.classic`, `newMatch(target, classic=false)`,
  `cubeAvailability` en başta `classic` ise `CLASSIC_NO_CUBE` ile reddeder (`shouldAutoRoll` buna bağlı
  → klasikte zar hep otomatik atılır, küp beklenmez).
- `backend/RoomController::cubeAvailability` — oda `classic` ise `CLASSIC_NO_CUBE` döner (frontend ile
  birebir); `cubeOffer` bu kapıdan 409 + `reason:CLASSIC_NO_CUBE` ile reddedilir. Türkçe mesaj eklendi.

### 3.3 `classic` bayrağının taşınması (mod ayrımı)
- **DB:** `2026_10_07_120000_add_classic_to_rooms_and_invites.php` → `rooms.classic`, `game_invites.classic`
  (boolean, default false). `Room` modeli fillable+cast+`toClient` güncellendi.
- **Skor çağrıları:** `RoomController`'daki 4 `gamePoints`/`resignationValue` çağrısına `(bool)$room->classic`
  geçirildi (move game-end, bot/authoritative loop game-end, clock-forfeit, resign).
- **Eşleşme havuzu ayrımı:** `matchmaking` artık `classic`'i hem bekleyen-oda hem aday filtresinde
  kullanır → **klasik yalnız klasikle eşleşir** (kolon yoksa `Schema::hasColumn` ile güvenli atlanır).
- **Oluşturma yolları:** `create` (arkadaş), `createBotRoom` (bota karşı), `enter` (davetten `classic`
  alır), `matchmaking` waiting-room → hepsi `classic` saklar.
- **Davet:** `PresenceController::invite` (`game_invites.classic`), `respond` (yanıtta `classic`),
  ping gelen-davet listesi (`classic`).
- **Okuma uçları:** `liveMatches` ve `seekers` yanıtlarına `classic` eklendi (rozet için).
- **api.ts:** `matchmake`, `inviteFriend`, `createRoom`, `createBotRoom`, `respondInvite` payload/tipleri
  + `RoomView`, `LiveMatch`, `Seeker`, `GameInvite` tipleri `classic` taşır.

### 3.4 Frontend match.classic tek-kaynak aynalama
- `App.tsx` — `RoomState.classic` eklendi; **tek efekt** `room.classic` → `match.classic` aynalar
  (matchmaking/arkadaş/bot tüm yollar + poll). Küp UI'si `match.classic` okuyarak gizlenir;
  yerel (legacy arkadaş) oyun-sonu ve pes puanı `!!match.classic` ile mars=2'ye sınırlanır.

### 3.5 UI (menü, kurulum, rozet)
- **Sol menü:** `pages.ts` → "Tavla Oyna" grubunun **en altına** `klassik` öğesi (`/klasik-tavla`).
- **Kurulum:** `MatchSetup` `classic` prop'u — başlık "Klasik Tavla", "küp yok · mars 2" notu,
  **rakip türü seçici** (Çevrimiçi Rakip Ara / Bota Karşı), uzunluk 5/7/9, payload'a `classic`.
  `App.tsx` `/klasik-tavla` rotası bu kurulumu açar (`CLASSIC_TARGETS=[5,7,9]`).
- **Arkadaş:** `FriendGameSetup` Maç Oyunu sekmesinde "Klasik Tavla" seçici → davet/oda `classic`.
- **Rozet "her yerde":** Canlı Maçlar (`.lm-type-classic`), Oyun Arayanlar (`.seek-classic`),
  gelen davet kartı (`.invite-chip-classic`) → `t('classic.badge')`. Arayana "eşleş" ile katılım da
  aynı moda girer (`handleJoinSeeker` `classicRef`).
- **i18n:** `menu.klassik` + `classic.badge/title/note/opponent/oppOnline/oppBot` 8 dilde (tr/en tam set;
  diğer 6 dilde `menu.klassik` yerel, kalan `classic.*` İngilizce fallback).

### 3.6 Kullanıcı kuralları metni
- `backend/database/seeders/ClassicTavlaRulesSeeder.php` → `/bilgi/klasik-tavla-kurallari` bilgi sayfası
  (sade Türkçe, admin-düzenlenebilir, "Eğitim" footer kolonunda). **Metin kodun uyguladığı kurallarla
  birebir** (küp yok, mars=2, başlangıç başlatıcı kuralı, zorunlu maks zar, bara giriş, toplama).

---

## 4. Kullanıcı kararları (bu rapora yansıyan)

Kullanıcı onayıyla: Klasik Tavla **puanlıdır** (normal maç gibi ELO/PR + liderlik), **yüzde bahis**
seçenekleri vardır ve **üç giriş** de açıktır: rakip arama (5/7/9), arkadaş daveti, bota karşı.

---

## 5. Mevcut sistemden farklar / açıkça belgelenen davranışlar

- **Başlangıç oyuncusu (spec §2 sonu):** Kod, **her oyunun başında** açılış zarını yeniden attırır;
  büyük zarı atan başlar (sıralı/"kaybeden başlar" kuralı YOK). Eşit zar → yeniden at. Bu davranış
  sessizce değiştirilmedi; kurallar metnine de aynen yazıldı.
- **Backgammon-3 (spec §8):** Normal modda kod 3 puanlık backgammon uygular; Klasik modda bu
  **bilerek 2'ye indirilir** (mars). Diğer modlar etkilenmez.
- **Süre aşımı / terk / bağlantı (spec §8 sonu):** Doğal oyun sonu + mars hesabından ayrıdır.
  Platform kuralı: süresi biten/terk eden hükmen kaybeder; forfeit puanı da `resignationValue(...,$classic)`
  üzerinden klasikte 2 ile sınırlıdır (küp=1). "Hayalet galibiyet" (hiç oynamayan tarafın hükmen
  kazanması) için mevcut emniyet kuralları aynen geçerlidir.

---

## 6. Testler ve sonuçları

### Eklenen testler
- `src/engine/classic.test.ts` (frontend, **8 test**): normal=1, mars=2, klasikte bar/ev backgammon → 2
  (normalde 3), `gameOutcome` klasik çarpanı, pes değeri klasikte 2, `cubeAvailability` klasikte
  `CLASSIC_NO_CUBE`, normal maçta küp açık (regresyon), klasikte `shouldAutoRoll` true.
- `backend/tests/Unit/ClassicScoringTest.php` (**5 test**): `gamePoints`/`resignationValue` klasik/normal
  karşılaştırması (bar + kazananın evi dahil).
- `backend/tests/Feature/ClassicTavlaTest.php` (**2 test**, uçtan uca otoriter): klasik odada küp teklifi
  409 + `CLASSIC_NO_CUBE`; kaybeden **barda** iken kazanan skoru **2** (normalde 3 olurdu).

### Sonuçlar
- Frontend: `npx vitest run` → **409 geçti, 1 skip** (classic.test.ts dahil; regresyon yok).
- Backend klasik: `php artisan test --filter="ClassicTavlaTest|ClassicScoringTest"` → **7 geçti (19 assertion)**.
- Backend regresyon: `ForfeitGammonValueTest | AuthoritativeLoopTest | MatchMoveMatTest |
  MatchmakeCubeE2ETest | MatchResultAuthoritativeTest` → **hepsi geçti** (küp/skor imza değişiklikleri geriye uyumlu).
- Tip kontrolü: `npx tsc -p tsconfig.json --noEmit` → **temiz**. PHP `php -l` → tüm dosyalar temiz.

### Spec §10 test listesi — kapsam
| Senaryo | Durum |
|---|---|
| İki zarı kullanmak için doğru sıra | Mevcut `validateTurn.test.ts` / `moves.test.ts` (paylaşılan motor) |
| Yalnız tek zarda büyük zar zorunluluğu | Mevcut `moves.test.ts` |
| Çift zarın tamamı/bir kısmı | Mevcut `moves.test.ts` |
| Bara giriş / kapalı giriş / girişte kırma | Mevcut `moves.test.ts` / `board.test.ts` |
| Aynı taşla ara hane kapalı | Mevcut `legalNextSteps` testleri |
| Tam/büyük zarla toplama + hatalı düşük toplama reddi | Mevcut `moves.test.ts` bear-off testleri |
| Toplama sırasında kırılan taş | Motor `allHome` yeniden şart koşar (mevcut davranış) |
| Normal galibiyet / mars / maç hedefi aşımı | **Yeni** `classic.test.ts` + `ClassicScoringTest` + `ClassicTavlaTest` |

Not: Yukarıdaki "Mevcut" satırlar Klasik'te AYNI motoru kullandığı için ayrıca klasik-özel test
yazılmadı; klasik-özel FARK (küp + mars) için yeni testler eklendi.

---

## 7. Yapılamayan / ertelenen / dikkat edilmesi gerekenler

- **Gerçek cihaz / tarayıcı testi YAPILMADI** (yalnız otomatik testler + tsc/php -l). İki tarayıcılı
  canlı klasik maç akışı elle doğrulanmadı.
- **Migration + seeder PROD'da çalıştırılmadı.** Deploy'da gerekli:
  1. `php artisan migrate --force` (rooms/game_invites `classic` kolonu).
  2. `php artisan db:seed --class=ClassicTavlaRulesSeeder` (kurallar sayfası yayınlanır).
  3. **Frontend bundle**: proje kuralı gereği sunucuda build EDİLMEZ — `npm run deploy:build` +
     `backend/public` commit şarttır (aksi halde salt `src/` değişikliği canlıyı değiştirmez).
- **Resume (kayıtlı oyundan devam) yolu:** `App.tsx:7267` resume `setRoom` bloğunda `classic` alanı
  saved-record'dan set EDİLMEDİ (saved şekilde alan yok); online/bot resume'da `classic` ilk poll ile
  (≤~1.2 sn) `match.classic`'e aynalanır. Pratikte sorun yok ama ilk ~1 sn küp butonu görünebilir.
- **Oyun-içi HUD rozeti:** Rozet lobi/liste/davet yüzeylerine eklendi; oyun ekranı (board HUD) içine
  ayrı "Klasik" etiketi EKLENMEDİ (kapsam dışı tutuldu). İstenirse eklenebilir.
- **Diğer 6 dildeki `classic.note/opponent/...`** İngilizce fallback ile görünür (tr/en tam çeviri).
- **Eski (migration öncesi) odalar:** `classic` default false → mevcut tüm maçlar normal davranır
  (geriye dönük güvenli).

---

## 8. Dokunulan başlıca dosyalar

**Engine/kural:** `src/engine/board.ts`, `match.ts`, `resign.ts`, `backend/app/Support/Backgammon.php`
**Backend:** `RoomController.php` (cube/skor/matchmaking/create/bot/enter/live/seekers),
`PresenceController.php` (invite/respond/ping), `Models/Room.php`, migration, seeder.
**Frontend:** `App.tsx` (match.classic aynalama + handler plumbing + setup rota + davet rozeti),
`api.ts`, `pages.ts`, `i18n.tsx`, `ui/MatchSetup.tsx`, `ui/FriendGameSetup.tsx`, `ui/HomePanels.tsx`, `App.css`.
**Test:** `src/engine/classic.test.ts`, `backend/tests/Unit/ClassicScoringTest.php`,
`backend/tests/Feature/ClassicTavlaTest.php`.
