# 3 Haklı Swiss (Swiss Triple Elimination)

TavlaTV'ye eklenen turnuva türü. Bu dosya **TavlaTV'nin bu tür için ürün sözleşmesidir** — evrensel
bir federasyon standardı değildir. Mevcut tek-eleme (bracket) türü korunur; yeni tür mevcut altyapının
uzantı noktalarına takılır.

## 1. Kural sözleşmesi

- Her katılımcı **3 hakla** başlar (0 mağlubiyet). `kalan hak = max(0, 3 - mağlubiyet)`.
- 1. ve 2. maç mağlubiyetinde devam eder; **3. maç mağlubiyetinde elenir**. Mağlubiyetler ardışık olmak
  zorunda değildir. Kazanmak kaybedilen hakkı geri getirmez.
- Hak, **tamamlanmış bir turnuva maçının sonucu** ile azalır — tavla eli/mars/hedef puanla değil. Maçın
  5/7/… puanda oynanması kaybedene yalnız **bir** mağlubiyet yazar. Mars/katmerli mars ek hak düşürmez.
- **Beraberlik yoktur.** Elenen/çekilen/diskalifiye sonraki eşleştirmelere alınmaz. Başlangıçtan sonra
  yeni katılım/yeniden giriş yoktur. Sabit tur sayısı yoktur — **tek oyuncu kalana kadar** devam.
- Şampiyonun hiç yenilmemiş olması şart değildir. Çekilme/diskalifiye ayrı durumdur; yapay 3 mağlubiyet
  **yazılmaz**.

### Bay (bye)
Turnuva galibiyeti kazandırır, **mağlubiyet/hak kaybı yok**, gerçek maç galibiyeti sayılmaz, oyun odası
açılmaz, sahte skor yazılmaz. Bay seçimi (yalnız aktif oyuncular): 1) en az bay → 2) en çok mağlubiyet →
3) en az turnuva galibiyeti → 4) bayı en eski turda almış → 5) kayıtlı seed.

### Son iki oyuncu (final)
Varsayılan: **mevcut haklar korunarak son oyuncuya kadar devam.** Otomatik yarı final / tek maçlık final /
üçüncülük maçı **yoktur**. Son iki oyuncu, biri 3. mağlubiyete ulaşana kadar oynar (tekrar rakip
kaçınılmaz ve geçerli). Final hedef puanı ayarlıysa yalnız **aktif sayısı 2** olduğunda kullanılır;
başlamış maçın hedefi değiştirilmez.

### "Turnuva galibiyeti" vs "gerçek maç galibiyeti"
`wins` = ilerleme galibiyeti (bay + hükmen dahil). `realWins` = gerçekten oynanıp kazanılan. Ayrı tutulur.

## 2. Mimari ve durum

Depolama (mevcut `tournaments` tablosu):
- **`bracket`** (JSON): tur dizisi; her tur, mevcut tek-eleme ile **AYNI** maç hücresi şekli
  `{key,p1,p2,winner,score,room,target,minutes}`. Bay = çözülü hücre (`p2=null, winner=p1.id,
  score={bye:true}`). Böylece `matchRoom` / `report` / `reconcileVerifiedResults` / frontend maç render /
  bot `playMatch` **değişmeden** çalışır.
- **`swiss_state`** (JSON, yeni sütun): `{version, algo, seed, round, participants[], config(KİLİTLİ),
  reports[], note}`. `participants[]` = SwissEngine katılımcı nesneleri (haklar/galibiyet/bay/rakip
  geçmişi/eleme/durum).

Katmanlar:
- `App\Support\Swiss\SwissEngine` — **saf** (DB'siz, deterministik) motor: eşleştirme (lexicographic
  maliyet: küçük grupta exhaustive global-optimal, büyükte sezgisel + zaman bütçesi + fallback), bay
  politikası, sonuç uygulama, eleme, canlı+kesin sıralama. `ALGO_VERSION` ile sürümlenir.
- `App\Support\Swiss\SwissRuntime` — motor ↔ `Tournament` (bracket + swiss_state) köprüsü: başlatma, tur
  üretimi, sonuç uygulama, sonlandırma, ödül, serialize. Kural seti **başlangıçta kilitlenir** (`config`).
- `TournamentController` — tip dalları (`applyWinnerToBracket`, `startBracket`, `matchRoom`, `create`,
  `full`). `report`/`reconcile`/`no-show` ortak `applyWinnerToBracket`'ten geçtiği için Swiss'e tek dalla akar.

Durum makinesi:
- Turnuva: `open` → `running` → `finished` (mevcut). Kayıt açık iken katılımcılar; başladıktan sonra maç
  sonuçları rev'i değiştirir.
- Tur: her `bracket[]` girdisi bir Swiss turudur. Bir turdaki **tüm** hücreler (bay dahil) sonuçlanınca
  sonraki tur üretilir; `≤1 aktif` kalınca turnuva sonlandırılır (şampiyon veya `note='no_champion'`).

## 3. Sonucun tek kaynağı (idempotency)

Maç sonucunun otoritesi **sunucu oyun motorudur** (`Room.server_match` → `RoomResult::resolve`). Swiss,
mevcut `winnerIdFromRoom` ile aynı otoriteyi tüketir:
- `report` (istemci beyanı **değil**, oda otoritesi), `reconcileVerifiedResults` (her poll'da self-heal),
  `no-show` (hükmen). Hücre `winner` alanı yazıldıktan sonra tekrar uygulama **engellenir** (idempotent).
- Bağlantı kopması tek başına yeni mağlubiyet yaratmaz; süre/yeniden bağlanma kararı oyun motorunundur.

## 4. Veritabanı / migration

- `2026_09_30_030000_add_type_to_tournaments.php` — `type` (`bracket`|`swiss_triple`, default `bracket`).
- `2026_09_30_040000_add_swiss_state_to_tournaments.php` — `swiss_state` JSON (nullable).
- Geri dönüş: her iki migration `down()` sütunu düşürür. Mevcut turnuvalar `type='bracket'` → davranış
  değişmez. **Deploy'da `php artisan migrate --force` şart** (Plesk deploy.sh çalıştırır).

## 5. API / gerçek zamanlı

Mevcut turnuva uçları tip-bağımsız çalışır (`join/leave/report/no-show/match-room/viewers/show`).
Serileştirme `full()` içine `type` + `swiss` (canlı durum) eklenir. Gerçek zamanlı = **polling** (rev/204);
yeni tur eklenince/kazanan yazılınca rev değişir → istemci snapshot ile toparlanır.

## 6. Yönetim paneli

Filament → Oyun → Turnuvalar → **Turnuva tipi = "Swiss Triple Elimination"**. Süreler/hedef puanlar
(match_length, final_length, round_minutes, final_minutes) mevcut alanlardan; başlangıçta kilitlenir.
**Başlat** aksiyonu tipe göre Swiss motorunu çağırır (kura + 1. tur). Feature flag:
`config/tournament.php → swiss.enabled` (`FEATURE_SWISS_TRIPLE`, default açık).

## 7. Worker / cron

Ek cron gerekmez: `autoStartDue()` her liste/detay poll'unda tembel çalışır (otomatik başlatma +
`reconcileVerifiedResults` self-heal). Botlu turnuvalarda mevcut `tavla:tourney-bots` scheduler'ı Swiss
maçlarını da oynatır (maç hücresi API'si tip-bağımsız).

## 8. İzleme / kurtarma / sonuç düzeltme

- Sunucu yeniden başlarsa durum DB'de (`bracket`+`swiss_state`); poll'da kaldığı yerden devam.
- Eşleştirme raporları `swiss_state.reports[]` (optimal mi, tekrar rakip, max fark). Optimal
  kanıtlanamazsa `optimal=false` loglanır.
- `note='no_champion'` → hiç aktif kalmadı; hayali şampiyon ilan edilmez (yönetici incelemesi).

## 9. Test / simülasyon (çalıştırılan)

- `tests/Unit/SwissEngineTest.php` — 18 test / 14135 assertion: kurallar (1/2/3 mağlubiyet, kazanç hakkı
  geri getirmez, hedef puan hak düşürmez, bay), eşleştirme (2,3,4,5,7,8,16,31,32,64,128 — tam kapsama,
  tek/çift bay, öncelikler, exhaustive oracle, determinizm), final (son 2/3, 0-2/1-2/2-2, tek/sıfır
  oyuncu), property + büyük alan bütçesi.
- `tests/Feature/SwissTournamentTest.php` — 7 test: başlatma+kural kilidi, tek bay hücresi, uçtan uca
  tamamlanma (2..16), 3. mağlubiyet eleme + son-iki final uzunluğu, ödül havuzu, sıralama, aynı turda
  iki kez yer almama. Bracket regresyonu: mevcut 30 turnuva testi geçer.
- Çalıştır: `cd backend && php artisan test --filter "Swiss|Tournament"`.

## 10. Kurulum / deploy / geri dönüş

1. `git pull` (Plesk) → `deploy.sh` → `migrate --force` (iki yeni sütun) + FPM reload.
2. Frontend build `backend/public/assets` içinde (bu commit'lerde). Ctrl+F5.
3. Geri dönüş: migration `down()` + `type` filtreleri Swiss'i devre dışı bırakır; `bracket` turnuvaları
   etkilenmez.

## 11. Kalan işler (bu sürümde YOK — açıkça belirtilir)

Sözleşmenin şu maddeleri henüz uçtan uca bağlanmadı; çekirdek + entegrasyon + testler tamamdır:
- **Check-in aşaması** (kayıt → check-in → başlangıç) ve check-in UI. Şu an: kayıt donar, admin/otomatik
  başlatır.
- **Çekilme/diskalifiye/sonuç-düzeltme API + Filament aksiyonları** (motor `applyWithdraw/applyDisqualify`
  + `SwissRuntime::withdraw` HAZIR; HTTP/panel uçları bağlanacak).
- **Çift no-show inceleme politikası** paneli (motor `applyDoubleLoss` HAZIR).
- **CSV dışa aktarım** ve genişletilmiş yönetici audit görünümü.
Bunlar mevcut çekirdeği bozmadan eklenebilir; bkz. `SwissEngine`/`SwissRuntime` hazır metotları.
