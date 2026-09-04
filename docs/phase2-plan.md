# Faz 2 — Sunucu-Otoriter HAMLE + TAHTA (detaylı uygulama planı)

**Amaç:** Faz 1 zar **değerini** kapattı (istemci 6-6 seçemez). Faz 2 **hamle yasallığını +
tahta durumunu + kazananı** sunucuya taşır → sahte tahta / sahte kazanan **imkânsız**.
Otorite = `authoritative=true` odalar: zar+hamle+tahta+skor **sunucuda**. İstemci tüm state
yerine yalnız **HAMLE** (tam-tur step dizisi) gönderir; sunucu doğrular, uygular, yeni durumu döner.

**Karar (verildi):** Motor = **Node validator** — `src/engine` TS motoru küçük bir Node
servisinde çalışır, PHP `/validate` ile sorar. UI motoru = doğrulama motoru → **TS↔PHP sapması YOK**.

---

## Mevcut durum: ~%80 KODLU ama DORMANT (prod'da `authoritative` asla true)

**✅ Hazır (yazılı + testli, canlı akışa dokunmaz):**
- Node validator: `validator/server.ts` + esbuild bundle `validator/dist/server.mjs` (motor inline,
  0 runtime dep). Uçlar: `POST /validate {state,steps}`, `POST /legal-moves {state}`, `GET /health`.
- `src/engine/validateTurn.ts` — UI motoruyla AYNI (`legalNextSteps` + `isTurnComplete` adım adım).
- `MoveValidatorService` (PHP→HTTP, erişilemezse **FAIL-CLOSED**) + `config/validator.php`.
- `RoomController::roll()` authoritative dalı (server_state, **re-roll engeli**, sıra kapısı p1=white/p2=black).
- `RoomController::move()` — validate → apply → `winner` → `gamePoints` → `server_match` skoru →
  maç bitmediyse otomatik yeni oyun → bitince `server_winner`+`done`.
- `Support/Backgammon` (initialState, winner off==15, gamePoints 1/2/3 **küp çarpanı HARİÇ**).
- `rooms.server_state / server_version / server_winner / server_match / authoritative`.
- Frontend dallar (hepsi `authoritativeRef` gated): `doRollAuthoritative`, `serverMove` (optimistic),
  `applyServerBoard`, poll server_state (mid-move ezme koruması `srvTurnStartRef`/`srvPlayedRef`),
  authoritative iken legacy PUT atla.
- `RoomResult::resolve` + `settle resolveWinnerSlot` authoritative iken **server_match'ten** (forge-red).
- Testler: ServerMoveTest(5) + ServerMatchTest(7) yeşil.

**Not — Faz 1 ile ilişki:** Faz 1 (`dice_authority`, CANLIDA gölge) yalnız zarı sunucuya alır,
hamle/tahta legacy kalır. `authoritative=true` bunu **kapsar** (zar da server_state'ten gelir):
authoritative iken frontend legacy PUT'u hiç atmaz → `update()` çalışmaz → dice_authority enforcement
devre dışı kalır, çakışma yok. Bir oda için **ya** dice_authority (Faz 1) **ya** authoritative (Faz 2).

---

## 🔴 KRİTİK BOŞLUKLAR — para maçında AÇMADAN önce ŞART

### 1. KÜP (doubling cube) — KARAR: **KÜPLÜ (sunucuya taşınır)** ✅ (2026-09-04 kullanıcı)
`server_match`'te küp yok; `move()` `gamePoints`'i küp çarpanını **hariç** tutar (hep ×1). Kullanıcı
**tam tavla (küplü)** seçti → küp SUNUCUYA taşınacak (Adım D). Kapsam:
- `server_match.cube = {value:1, owner:null|'white'|'black'}` (başta 1/ortada).
- Uçlar: `POST /rooms/{code}/cube/offer` (sıra sahibi, zar ATMADAN önce, `canDouble` kuralı sunucuda),
  `POST /rooms/{code}/cube/respond {take|drop}`. Sunucu doğrular (kimin küpü, değer, sıra), uygular.
- `drop` → oyun biter, kazanan mevcut cube.value puanı alır (server_match skoru); `take` → cube.value×2,
  owner=alan. **Redouble** owner kontrolüyle.
- `gamePoints` sonucu **× cube.value** (gammon/backgammon çarpanı ayrı) → server_match skoruna.
- Küp motordan (hamle) BAĞIMSIZ → **validator'a dokunmaz**; ayrı durum + uçlar.
- v1 kapsam sınırı: basit offer/take/drop + redouble. **Crawford** (maç sonu 1-away) opsiyonel v1.5;
  beaver/otomatik-çift YOK (para maçında istenmez). Kullanıcıyla Crawford'u netleştir.
- Frontend: authoritative iken küp UI (`cubePending`/`canDouble`) offer/respond uçlarına bağlanır
  (şu an lokal state); `applyServerBoard` server_match.cube → match.cube senkronu.

### 2. Node validator Plesk'te KURULU DEĞİL
`VALIDATOR_URL` boş → authoritative açılırsa her hamle FAIL-CLOSED **reddedilir** → maç oynanamaz.
Kurulum (memory'de detay): `validator.tavlai.com` subdomain → Plesk Node.js (Application Root
`httpdocs/validator`, Startup `dist/server.mjs`, Node 18/20, production) → `VALIDATOR_SECRET` →
Restart. backend/.env: `VALIDATOR_URL` + `VALIDATOR_SECRET` (aynı) + `VALIDATOR_REQUIRED=true` → config:clear.
**IP restriction:** `VALIDATOR_LOG_IP=1` ile backend'in çıkış IP'sini logla → Plesk nginx `location /{ allow <IP>; deny all }` → dışarıdan 403 doğrula. TUZAK: yanlış IP = kendi backend'ini kilitler.

### 3. `authoritative=true` SET etme yolu YOK
Hiçbir kod true yapmıyor. Eklenecek: `matchmaking()` env-gated — `config('game.server_authoritative')`
+ staked (stake>0 || bet_pct>0) → `authoritative=true` (Faz 1'deki `dice_authority` yerine).
Kademeli: önce staked, sonra tüm ranked. Rollback = env false.

### 4. Açılış zarı / başlayan authoritative'de
`Backgammon::initialState()` hep `turn='white'`. Adil açılış (iki taraf 1 zar, yüksek başlar) yok.
İki yol: (a) açılışı sunucuya taşı (`FairDiceService::single` zaten var, ilk roll'da başlayanı belirle),
veya (b) Faz 1'deki deterministik `seededOpening`'i koru + `roll()` ilk el server_state.turn'ünü ona göre kur.
(a) daha temiz (tam otorite). Çift açılış olamaz (single farklı derive).

### 5. Frontend authoritative tamamlanmamış
`applyServerBoard` yalnız **board** uygular (turnStart). Eksik: `server_match` → match/skor state,
`gameEnd` (oyun-sonu animasyon/mesaj), resign/drop UI, clock senkronu, otomatik yeni-oyun geçişi,
(küp seçilirse) küp teklif/yanıt UI. Optimistic + reconcile: `serverMove` reddederse poll server_state
ile düzelt (mid-move ezme koruması mevcut). Açılış reveal ekranı authoritative ile uyumlu olmalı.

### 6. Resign / drop / timeout authoritative
Legacy'de resign istemci state'inden. Authoritative'de: resign/drop sunucuya (`/rooms/{code}/resign`?)
→ server_match forfeit skoru (küp çarpanıyla, B seçilirse). Timeout zaten server-otoriter (MatchClock) →
authoritative maçta forfeit'i server_match'e de yansıt (şu an legacy state.gameEnd'e yazıyor).

### 7. 2-istemcili staging testi — HİÇ yapılmadı
Açılış → zar → çok checker hamle → hit/bar/bear-off → oyun-sonu → yeni oyun → maç-sonu →
(küp) → resign → timeout → refresh/geri-yükleme → ağ kesintisi/reconcile. İki gerçek tarayıcı.

### 8. Reveal / provably-fair authoritative'de
Faz 1'deki reveal (dice_seed + dice_rolls mac bitince) authoritative roll()'da da dolsun (şu an
authoritative roll dice_rolls'a yazıyor mu doğrula) → iki taraf zarları doğrulayabilsin.

---

## Adımlar (önerilen sıra)

- **Adım 0 — KÜP KARARI:** ✅ VERİLDİ = **küplü (B, sunucuya taşı)**. Kapsam Adım D.
- **Adım A — Validator Plesk deploy** ✅ TAMAM (2026-09-04): prod'da ayakta; yerel bundle da doğrulandı (`/health` OK, `/legal-moves` başlangıç+[3,1] doğru tam-tur hamleleri, auth 401).
- **Adım B — Enable yolu** ✅ TAMAM (commit c3b474a, DORMANT): `config/game.php` `server_authoritative`(env, def false) + `authoritative_users` TEST allow-list. matchmaking EŞLEŞME anında `shouldAuthoritative` (global staked VEYA iki-oyuncu-allow-list) → `authoritative=true` (dice_authority yerine). Schema guard.
- **Adım C — Açılış/başlayan sunucuya** ⏳ KALDI (FairDiceService::single ile ilk el + turn; frontend reveal ile birlikte, Adım E'ye yakın).
- **Adım D — KÜP** ✅ TAMAM (commit c3b474a, DORMANT): `server_match.cube{value,owner,pending}` (JSON, migration yok); `cubeOffer`/`cubeRespond`(take x2+devir / drop mevcut değer) + `resign`; roll/move pending'de bloklu; `move` gamePoints × cube.value; `applyGameResult` ortak helper. RoomCubeTest(14) + suite 175 yeşil. **KALAN: Crawford** (maç-sonu 1-away oyunda çift yok) — açmadan önce; beaver yok (kasıtlı).
- **Adım E — Frontend authoritative tamamla** ⏳ KALDI (kullanıcının GameLog WIP'i bitince): `applyServerBoard` → match/skor/gameEnd/clock/**küp UI (offer/respond)**/resign; optimistic+reconcile; açılış reveal uyumu; otomatik yeni oyun.
- **Adım F — Resign authoritative** ✅ TAMAM (resign ucu → server_match forfeit, cube değeriyle). Timeout authoritative-forfeit → server_match yansıtma KALDI (şu an legacy state.gameEnd).
- **Adım G — 2-istemcili staging testi** ⏳ KALDI (Adım E sonrası; `SERVER_AUTHORITATIVE_USERS=<id1>,<id2>` ile yalnız o çift). GEÇMEDEN prod'da açma.
- **Adım H — Kademeli açılış** ⏳ KALDI: `SERVER_AUTHORITATIVE=true` yalnız staked → gözlem → tüm ranked.

## Riskler
- **Validator uptime = maç uptime** (fail-closed). Monitoring + otomatik restart (Passenger) + alarm gerek.
- **Latency:** her hamle loopback HTTP (~ms). Optimistic UI zorunlu; reconcile mid-move ezmemeli (koruma var).
- **server_state ↔ UI GameState format uyumu** — validateTurn UI motorunu kullanıyor ama serileştirme (dice/diceUsed/bar/off/points) birebir olmalı; kapsamlı test.
- **Küp karmaşıklığı** (B) — Crawford, otomatik çift, beaver? Kapsamı sınırla (v1: basit offer/take/drop, redouble; Crawford opsiyonel).
- **Kademeli geçiş:** açık maçlar legacy/dice_authority'de kalır; yalnız YENİ authoritative odalar etkilenir (blast radius küçük).

## Test matrisi (özet)
Backend: move (legal/illegal/fail-closed/dice-first) ✓ mevcut; +cube uçları, +açılış/başlayan, +resign/forfeit,
+server_match çok-oyun/çarpan, +reveal. Frontend: authoritative apply (board/skor/gameEnd/küp), reconcile,
mid-move koruma. E2E: 2-istemcili staging (Adım G).
