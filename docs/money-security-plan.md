# Para-Maçı Güvenliği — Sunucu-Otoriter Mimari Planı

**Amaç:** Gerçek parayla (coin) oynanan online maçlarda değiştirilmiş bir istemcinin
**zar, hamle veya sonuç** üzerinde hile yapmasını imkânsız kılmak.

**Kök sorun (denetim, 2026-09-04):** Oyun motoru tamamen tarayıcıda çalışır; sunucu tek
bir zarı/hamleyi bile simüle/doğrulamaz. "Sunucu-otoriter" sanılan tüm kontroller aslında
istemcinin gönderdiği `rooms.state` blob'unu okur (`RoomController::update` → `state`
körü körüne kaydeder; `serverResultForRoom`, `winnerIdFromRoom` bu blob'u okur).

**Zaten sağlam (DOKUNMA):**
- Coin transferi `settle()` — iki-taraf mutabakatı + atomik + tek seferlik. Tek taraflı çekim yok.
- Garanti ödeme — hash + tutar + idempotency.
- `coins` User `$fillable` dışında; kendi bakiyesini keyfi set edecek uç yok.

---

## Hedef mimari (özet)

Staked/ranked online maçta **otoriter oyun durumu SUNUCUDA** tutulur. Sunucu:
1. **Zarı üretir** (commit-reveal ile provably-fair) — istemci seçemez.
2. **Her hamleyi kendi durumuna göre doğrular** — yasa dışı geçiş reddedilir.
3. Durumu ilerletir; **kazananı yalnız kendi durumundan** belirler.
4. `settle`/rating/coin **yalnız sunucu-türetilmiş sonucu** kullanır (istemci `won`/`winner_id`'ye güven YOK).

pvb (bota karşı) para içermez → istemci-taraflı kalır (yalnız pvb'de rating politikası ayrıca gözden geçirilir).

---

## Faz 1 — Sunucu-Otoriter ZAR (commit-reveal)

**Ne:** Online maçta zar artık sunucuda üretilir; istemci her el için sunucudan ister.

**Provably-fair (commit-reveal):**
- Oyun başında sunucu `serverSeed` üretir (crypto), `commit = SHA256(serverSeed)` odaya yazar
  ve iki istemciye `commit`'i gönderir. İstemci `clientSeed` gönderir.
- El `k` zarı = `HMAC_SHA256(serverSeed, clientSeed + ":" + k)` → ilk baytlardan 2 zar (1-6).
  Deterministik + sunucu belirler; istemci etkileyemez.
- Oyun bitince sunucu `serverSeed`'i **reveal** eder → iki taraf da `commit` ve tüm zarları doğrular.

**Uç:** `POST /api/rooms/{code}/roll` → sıradaki el için `{index, dice:[d1,d2]}`. Sunucu:
`roll_index`'i odada tutar, yalnız **sıradaki oyuncu** ister, aynı index tekrar istenirse aynı zar döner (replay-safe).

**Dokunulan:**
- `rooms` migration: `dice_commit`, `server_seed`(gizli, reveal'e kadar), `client_seed`, `roll_index`, `rolls`(json log).
- `RoomController::roll()` + rota. Var olan `src/engine/fairDice.ts` şeması **ama seed sunucuda**.
- Frontend online zar: `secureDie()` yerine online'da `POST /roll`'dan gelen zar kullanılır.
  (Offline/pvb `secureDie` kalır.) `src/engine/game.ts` + online akış (`App.tsx`).

**Kapatır:** Zar seçme hilesi (KRİTİK). **Kapatmaz:** Hamle sahteciliği (Faz 2).

**Risk:** Orta. Online zar akışı değişir; dikkatli test + geri-uyum (eski odalar).

---

## Faz 2 — Sunucu-Otoriter HAMLE + DURUM

**Ne:** Otoriter tahta sunucuda. İstemci **tüm state'i değil, HAMLEyi** gönderir
(sıradaki zar için checker oynayışı). Sunucu yasallığı doğrular, uygular, yeni durumu döner.

**Motor doğrulama — karar gerekli (aşağıda):**
- **A) PHP port:** `generateMoves`/`applyMove`/`gameWon` alt kümesini PHP'ye taşı. Tek yığın,
  ek servis yok. Risk: TS↔PHP mantık ikilemesi (sapma bug'ı). Gerekli alt küme AI'sız → küçük.
- **B) Node validator servisi:** Mevcut TS motorunu (`src/engine`) küçük bir Node servisinde
  yeniden kullan; PHP `/validate-move` ile çağırır. En doğru (aynı motor), sapma yok.
  Risk: Plesk'te kalıcı Node süreci (board-cv Python servisi gibi mümkün ama işletme yükü).

**Uç:** `POST /api/rooms/{code}/move` `{steps}` → sunucu doğrular+uygular → `{state, version}`.
`PUT /rooms/{code}` (kör state) staked/ranked maçta **devre dışı**; yalnız casual/eski akışta kalır.

**Dokunulan:** `rooms.server_state` (otoriter), `RoomController::move()`, seçilen motor (A/B),
frontend online: hamle gönder → sunucu state'ini uygula (optimistic + reconcile).

**Kapatır:** Sahte tahta/kazanan durumu (YÜKSEK). **Sunucu artık gerçek otorite.**

**Risk:** YÜKSEK (en büyük faz). Motor sapması = oyun bozulur → kapsamlı test (TS testleri PHP/Node'a ayna).

---

## Faz 3 — Sonuç/Rating/Coin yalnız SUNUCUDAN

**Ne:** `settle`, `reportRating`, turnuva ödülü **yalnız sunucu-hesaplı** kazananı kullanır.
- `serverResultForRoom` / `winnerIdFromRoom` → istemci `state` yerine **`server_state`** okur.
- `reportRating`: `room_code` olan maçta istemci `won` **yok sayılır** (sunucu belirler).
  Odasız/pvb rating politikası netleştirilir (pvb rating'i ya sunucu-loglu ya kaldırılır).
- Turnuva `report`: `winner_id` fallback KALDIRILIR; kazanan yalnız sunucu maçından.
- **Ek sertleştirme:** oda/settle/rating uçlarına `isBanned()`; `update`/`move` sıra-sahipliği;
  settle için zaman aşımı çözümü (kaybeden onaylamazsa donmasın).

**Risk:** Düşük-Orta (Faz 1-2 bitince mantıksal). Politika kararları içerir.

---

## Ucuz ara-sertleştirmeler (Faz 2 beklerken, bağımsız yapılabilir)
- `reportRating`: `room_code` yokken RANKED rating basma (odasız farm engeli).
- Turnuva `winner_id` fallback kaldır.
- Oda/settle/rating uçlarına ban + (mümkünse) auth.
- Bunlar zar hilesini çözmez ama farm/forge yüzeyini daraltır.

## Rollout
Staked (para) maçlar önce → sonra tüm ranked. pvb istemci-taraflı kalır (para yok).
Her faz canlıya ayrı çıkar; geri-uyum: eski/casual odalar eski akışta çalışmaya devam eder.

## KARAR (2026-09-04): Faz 2 motoru = **B) Node validator (TS motoru yeniden kullanılır)**
Kullanıcı seçti. Mevcut `src/engine` TS motoru küçük bir Node servisinde çalışır; PHP
`/validate-move` ile çağırır. Aynı motor → TS↔PHP sapması YOK. Plesk'te kalıcı Node süreci
(board-cv Python servisi gibi) işletilir. Faz 1 (sunucu zarı) bundan bağımsız, önce yapılır.
