# Swiss otomatik kura + "Kura Geri Sayımı" (yalnız otomatik mod)

Tarih: 2026-11-23

## Niyet / neden
Online Swiss turnuvada bir turun son maçı bitince sıradaki turun kurası HEMEN
çekilmesin; oyunculara "Kura Geri Sayımı" başlıklı 3 dk'dan geriye sayan bir sayaç
gösterilsin, süre dolunca kura otomatik çekilsin. Böylece oyuncular bir sonraki
maça hazırlanacak nefes alır.

Kök bağlam: bugün online Swiss'te turdan tura OTOMATİK kura yok —
`advanceIfRoundComplete` tur bitince sıradaki turu üretmiyor; her tur admin'in
Filament panelinden "Kura Çek"iyle çekiliyor. 1. tur da başlangıçta admin'le
çekiliyor. Dolayısıyla periyodik/gözetimsiz Swiss turnuvalar 1. turdan sonra
(aslında 1. turda bile) admin bekleyip takılıyor. Bu özellik otomatik modda
turdan-tura ilerlemeyi İLK KEZ ekler (3 dk tamponla) ve periyodik turnuvanın
gözetimsiz çalışmasını mümkün kılar.

## Hedefler
- Otomatik modda (online + `swiss_auto_draw=true`) tur bitince 3 dk sayaç sonrası
  kura otomatik çekilsin.
- Otomatik modda 1. tur (turnuva başlayınca) sayaçsız, hemen çekilsin.
- Oyunculara "Kura Geri Sayımı" + geriye sayan süre gösterilsin.

## Hedef olmayanlar / anti-hedefler
- Manuel-bye modu ve salon (outdoor) Swiss DEĞİŞMEZ — admin elle kura çeker.
- Eleme (bracket) turnuvaları etkilenmez.
- Saniye-kesin çekim hedeflenmez (bkz. kısıt).

## Kısıtlar
- Otomatik çekim mevcut running-tournament sweep'ine (`autoStartDue`, her dk
  `tournaments:tick` + oyuncu poll'ları) bağlı → kimse izlemiyorsa kura sayaç
  0'ı geçtikten ≤60sn sonra çekilir. Oyuncular sayfadayken poll anında çeker.
  Ceiling kabul; saniye-kesinlik gerekmiyor.

## Yaklaşımlar
Tek mantıklı yol: countdown anchor'ı `swiss_state.next_draw_at` zaman damgasında
tut, mevcut idempotent cron sweep'te tüket. Alternatifler elendi:
- Ayrı saniyelik cron/queue job: 1dk granülerliği aşmak için fazladan altyapı,
  kazanım küçük (oyuncu poll'u zaten anında çekiyor) → gereksiz.
- Round-completion anında event/job planlama: tur-tamamlama birden çok sonuç
  yolundan geçiyor (applyResult / resolveStalledSwiss / reconcile) → tek noktada
  yakalamak kırılgan; sweep'te "tur bitti mi" kontrolü zaten tek ve idempotent.

## Karar verilen tasarım
### Backend
1. `SwissRuntime::DRAW_COUNTDOWN_SECONDS = 180` sabiti.
2. `SwissRuntime::autoAdvanceDue(Tournament $t): bool` (yeni). Yalnız online +
   `swiss_auto_draw=true` (outdoor hariç):
   - not running / isComplete / katılımcı yok → false.
   - bracket boş (1. tur): `next_at=now` + `drawRound()` → hemen çek, sayaç yok.
   - son tur tamam + turnuva bitmemiş:
     - `next_draw_at` yoksa `now + DRAW_COUNTDOWN_SECONDS` damgala, true.
     - `now < next_draw_at` → false (sayıyor).
     - `now >= next_draw_at` → `next_at=now`, `next_draw_at=null`, `drawRound()`.
   - tur hâlâ oynanıyorsa stale `next_draw_at` temizle.
3. `TournamentController::autoStartDue` içindeki `status='running'` döngüsüne
   `SwissRuntime::autoAdvanceDue($t)` çağrısı eklenir (lockForUpdate transaction
   içinde, değişiklik olursa `$done`). Idempotent.
4. `SwissRuntime::serialize()` çıktısına `next_draw_at` eklenir.

### Frontend (`src/ui/Tournaments.tsx` ~1020 `awaiting_draw` rozeti)
- Otomatik mod + `sw.next_draw_at` varsa: statik "tur planlandı" metni yerine
  **"Kura Geri Sayımı"** + `<Countdown target={sw.next_draw_at} onExpire={refreshList}>`.
- i18n `swiss.drawCountdown` (TR: "Kura Geri Sayımı", EN: "Draw Countdown").

## Builder'a bırakılan
- `next_draw_at` serileştirme formatı diğer zaman alanlarıyla (ISO8601) tutarlı.
- Countdown bileşeninin mevcut `target`/`onExpire` sözleşmesine uy.

## Test
`SwissRuntime` testi: tur bitince `next_draw_at` damgalanır; `Carbon::setTestNow`
ileri alınca draw tetiklenir + yeni tur eklenir; manuel/outdoor modda no-op; 1.
tur sayaçsız hemen çekilir.
