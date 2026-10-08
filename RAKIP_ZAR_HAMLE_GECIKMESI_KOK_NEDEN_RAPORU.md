# Rakip Zar & Hamle Gecikmesi — Kök Neden Raporu

**Tarih:** 2026-10-08
**Belirti (≈20 kullanıcı):** "Rakibin zarı ekranda çok geç görünüyor. Zar görünene kadar rakip
hamlelerini yapmış oluyor. Taşların nasıl oynandığını takip edemiyorum."
**Sınıf:** Oyun akışı / gösterim sırası defekti (zar adaleti DEĞİL).
**Yöntem:** Olay zinciri uçtan uca koddan izlendi; kök neden deterministik birim testiyle YENİDEN
ÜRETİLDİ; saf istemci düzeltmesi uygulandı; test + tsc + lint + tam vitest ile doğrulandı. Canlı
prod'a dokunulmadı; deploy edilmedi.

---

## 1. Kanıtlanan kök neden

### Mimari gerçek: push state TAŞIMAZ, yalnız "poll et" der
`src/online/realtime.ts:2-3, 92` — Reverb push SADECE "hemen poll et" sinyali verir; tüm state
uygulaması tek yerde, poll'da olur. Poll (`src/App.tsx:5700`) sunucunun **EN TAZE** sürümünü çeker:
`applyServerBoard(rv.server_state, rv.server_match)`. Poll, aradaki sürümleri **oynatmaz** — sürüm
geçmişi çekilmez, yalnız o anki `server_state` uygulanır.

Bir rakip turunda sunucuda tipik olarak iki ayrı sürüm oluşur:
- **V+1:** rakip zar attı (tahta aynı, `turn=rakip`, `dice=rakip zarı`) — "atıldı ama oynanmadı"
- **V+2:** rakip oynadı ve onayladı (tahta değişti, `turn=ben`)

Rakip **bir poll turundan (≈1.2 sn, gerçekte HTTP gidiş-dönüşü ≈150–300 ms) kısa sürede** hem atıp
hem oynarsa (hızlı oyuncu, **bot**, ya da **çift zar** = tek turda 3-4 adım), istemci V+1'i HİÇ
uygulamaz; doğrudan V+1→V+2 yerine V(önceki)→V+2 geçişini görür.

### Düzeltilmemiş kalan asıl defekt: replay tabanı `prev.dice`'a bağlıydı
Önceki oturumlarda eklenen **§5.2 adım-adım replay** (snap yerine rakibin hamlesini tek tek oynatma)
tabanı şuraya bağlıydı: `prev = srvTurnStartRef.current` (ekrandaki son otoriter tur-başı). Ve
`reconstructOppMove` sert koşulu (`src/online/oppMove.ts:27`): **`if (!prev.dice?.length) return null`**.

Eski kapı (düzeltme öncesi `App.tsx` ~5248):
```
prev.turn !== myColor && (prev.dice?.length ?? 0) > 0 && (gs.turn !== prev.turn || ended)
```

**V+1 kaçtığında `prev` rakibin zarını TAŞIMAZ** (`prev.dice = []`). Dolayısıyla:
- Kapıdaki `prev.dice.length > 0` → **false** → blok HİÇ çalışmaz → `reconstructOppMove` çağrılmaz
  → **replay yok → tahta SNAP eder** (son konuma sıçrar).
- Ama rakip zar echo'su (`oppRoll`, `App.tsx:5315-5322`) `sm.lastMove.dice`'tan **bağımsızca** set
  edilir → zar, **snap'lenmiş son tahtayla aynı anda** görünür.

Sonuç tam olarak kullanıcının tarifi: **"zar geç geldi, geldiğinde rakip zaten oynamıştı, taşların
nasıl oynandığını göremedim."** §5.2 replay yalnız rakibin zarlı ara-durumu şans eseri bir poll'a
denk geldiğinde (yavaş insan rakip) devreye giriyordu; hızlı rakip/bot/çift-zarda devreye GİRMİYORDU.

### Neden her kullanıcı değil, ~20 kullanıcı
V+1'in yakalanması zamanlamaya bağlı: yavaş düşünen insan rakip zarını atıp uzun süre düşününce poll
araya girer (sağlıklı yol, §5.2 çalışır). Hızlı/seri oynayan rakip, bot ve çift zar (anında oto-oyna)
ara-durumu düzenli kaçırır → bu rakiplerle oynayanlar belirtiyi sürekli yaşar.

---

## 2. İlgili dosyalar ve fonksiyonlar

| Yer | Rol |
|---|---|
| `src/online/realtime.ts:92-100` `subscribeRoom` | Push yalnız "poll et" sinyali (state taşımaz) |
| `src/App.tsx:5700` poll → `applyServerBoard(server_state, server_match)` | Tek apply noktası; **en taze** sürümü uygular (ara sürüm oynatılmaz) |
| `src/App.tsx:5228-5301` `applyServerBoard` | Rakip hamlesini geri üretip loglar + §5.2 replay'i tetikler |
| `src/online/oppMove.ts:26-33` `reconstructOppMove` | `!prev.dice?.length → null` (zar yoksa üretmez) |
| `src/App.tsx:5184-5223` `maybeReplayOppMove` | Adım-adım cosmetic replay (450 ms/adım) |
| `src/App.tsx:5315-5322` `oppRoll` set | Zar echo'su `sm.lastMove.dice`'tan (replay'den bağımsız) |
| `backend/.../RoomController.php:3392-3396` `lastMove` | Sunucu hamlenin TAM zarını (çift zar=4 eleman) kaydeder |

---

## 3. Yeniden üretme adımları

**Deterministik birim testi (tarayıcısız, kesin):** `src/online/oppReplay.test.ts`
→ *"rakip ara-durum kaçtığında (snap kökü)"* bloğu. Gerçek motorla, belirtiye yol açan state
dizisini birebir kurar:

1. Rakip (siyah) `[3,3,3,3]` atar, çok adımlı maksimal hamleyi oynar → otoriter `next` (sıra bana).
2. **Ara-durum kaçtı** senaryosu: `prev` zarsız (`dice:[]`), çünkü V+1 poll'a denk gelmedi.
3. **BUG:** `reconstructOppMove(prevNoDice, next)` → `null` (test bunu assert eder = snap kanıtı).
4. **FIX:** `oppMoveBase(prevNoDice, next, lastMove, 'white')` tabanı kurar → `reconstructOppMove` ADIMLARI
   üretir ve son kare otoriter tahtaya TAM eşittir.

Eski kapının snap ürettiği ayrıca komut satırında da gösterildi (kapı skip-case'te `false` döner).

**Canlı 2-istemci:** Fast-path reprodüksiyonu (rakibin ara-durumunu kaçırmak) hassas zamanlama ister;
yerel 2-istemci+3-servis E2E harness'ı dökümante soğuk-start timeout yaşıyor ve canlıya dokunmam
yasak. Bu yüzden kök neden, belirtiye yol açan state dizisini birebir kuran **deterministik testle**
kanıtlandı (aşağıda "doğrulanamayan" bölümüne bak).

---

## 4. Sorunlu turun zaman çizelgesi (koddan türetilmiş)

Rakip = siyah, ben = beyaz. Sunucu saati otorite; istemci saatleri hesaba katılmadı (saf sürüm-sırası).

| t | Sunucu | Push | Benim istemcim | Ekranım |
|---|---|---|---|---|
| t0 | V: ben oynadım, `turn=siyah` | — | V uygulandı: `turnStart=(tahta B, turn=siyah, dice=[])` | sıra rakipte |
| t1 | **V+1:** siyah zar attı (B, dice=5-3) | room.updated → poll(true) | poll başlar (HTTP ~200 ms) | — |
| t2 (t1+~120 ms) | **V+2:** siyah oynadı+onayladı (tahta C, turn=beyaz) | room.updated → poll(true) | **t1 poll'u V+2'yi getirir (V+1 ATLANDI)** | — |
| t3 | — | — | `applyServerBoard(C)`: `prev=(B,siyah,dice=[])` → eski kapı `prev.dice>0` **false** → replay YOK | **tahta C'ye SNAP** |
| t3 | — | — | `oppRoll`=5-3 (lastMove'dan) set edilir | zar 5-3 **snap ile aynı anda** görünür (geç) |

**Gecikme nerede?** Sunucuda değil (V+1 ve V+2 anında üretildi, `lockForUpdate` serileşik). İletimde
değil (push çalışıyor; 6 gündür canlı — önceki denetim). **İstemcinin olay-işleme/animasyon
katmanında:** istemci yalnız en taze sürümü uyguladığı için ara zar durumu kayboluyor VE replay
tabanı zara bağlı olduğundan adım-adım gösterim hiç başlamıyor → zar yalnız son tahtayla birlikte
beliriyor.

---

## 5. Yapılan düzeltme

**Hedef davranış:** rakibin zarı, hamleleri gösterilmeden ÖNCE görünsün; hamleler gerçekleştiği
sırayla adım adım oynansın; replay bitince tahta otoriter durumla aynı olsun. Rastgele bekleme
EKLENMEDİ; oyuncunun saatinden bir şey düşülmedi (replay saf cosmetic, otoriteye dokunmaz).

### Değişen dosyalar
| Dosya | Değişiklik |
|---|---|
| `src/online/oppMove.ts` | **YENİ saf `oppMoveBase(prev, next, lastMove, myColor, ended)`** — replay/log tabanını türetir. Zar artık `prev.dice`'a bağlı DEĞİL: yakalandıysa `prev.dice`, kaçtıysa otoriter `lastMove.dice` (tahta düzeni zaten hamle-öncesi; zar atmak taş oynatmaz). Güvenlik kapıları: yalnız rakibin hamlesi, `prev` yoksa null, hamle tamamlanmadıysa (`next.turn===rakip && !ended`) null. |
| `src/App.tsx` (`applyServerBoard`) | Eski `prev.dice>0` kapısı → `oppBase = oppMoveBase(...)`. `sig`/`reconstructOppMove`/matchLog `pos`+`dice`/`rec.events.d`/`maybeReplayOppMove` hepsi `oppBase` kullanır. Taban yanlışsa (çok-tur atlama/reconnect) `reconstructOppMove` zaten null → **güvenli snap** (uydurma hamle YOK). |
| `src/online/oppReplay.test.ts` | Kök nedeni YENİDEN ÜRETEN + fix'i doğrulayan 5 test. |

### Neden "dice önce" garantisi
`maybeReplayOppMove(oppBase, ...)` tabanı = rakibin zarlı tur-başı; replay'in 0. karesi = tahta + zar
(henüz adım yok), sonra 450 ms/adım. Ayrıca `oppRoll` echo'su solda zarı gösterir. Yani zar, ilk
adımdan ÖNCE ekrandadır → kullanıcı "zarı gördüm, sonra taşlar tek tek gitti" der.

### Kapsanmayan (bilinçli): çok-tur atlama / reconnect
Birden fazla rakip turu kaçarsa (uygulama arka planda, uzun kopukluk) `prev.points` artık son
hamlenin öncesi değildir → `reconstructOppMove` null döner → **güvenli şekilde güncel duruma geçilir**
(hamle uydurulmaz). Bu, canlı hamle akışından farklı bir senaryodur ve kasıtlı olarak snap bırakılır.

---

## 6. Önce/sonra ölçümleri ve test sonuçları

**Önce (bug):** skip-case'te eski kapı `false` → replay yok (snap); `reconstructOppMove(prevNoDice,next)=null`.
Kanıt: `node` tek-satır simülasyonu + `oppReplay.test.ts` "BUG YENİDEN ÜRETİMİ" testi.

**Sonra (fix):** aynı skip-case'te `oppMoveBase` taban kurar, reconstruct adımları üretir, son kare
otoriter tahtaya **TAM eşit**; çift zar 4 eleman korunur; sağlıklı yol (prev zarlı) regresyonsuz.

| Test | Komut | Sonuç |
|---|---|---|
| Kök neden reprodüksiyon + fix | `vitest run src/online/oppReplay.test.ts` | **Geçti** (yeni 5 test dahil) |
| oppMove birim | `vitest run src/online/oppMove.test.ts` | **Geçti** |
| Online modül (tümü) | `vitest run src/online` | **99/99 geçti** |
| Tam frontend suite | `vitest run` | **420 geçti / 1 skip** (önce 415 → +5 yeni) |
| TypeScript | `tsc -b` | **Temiz (0 hata)** |
| Lint (değişenler) | `oxlint oppMove.ts oppReplay.test.ts App.tsx` | **Temiz** |

**≥5 test maçı / canlı gözlem:** Otomatik 420 test + deterministik state-dizisi reprodüksiyonu
yapıldı. Gerçek iki tarayıcıda 5 tam maç + ağ-bozma gözlemi YAPILMADI (aşağı bak).

---

## 7. Test edilemeyen senaryolar ve kalan belirsizlikler (dürüst kayıt)

- **Canlı 2-istemci / 5 tam maç / ağ gecikmesi-kesintisi / mobil-PWA / sekme arka plan:** GERÇEK
  cihazda ÇALIŞTIRILMADI. Gerekçe: canlı prod'a dokunmam yasak; yerel E2E harness'ı 2-istemci+3-servis
  soğuk başlatmada dökümante timeout yaşıyor. Bunun yerine belirtiye yol açan state dizisi deterministik
  testle birebir üretildi. **Subjektif "akıcılık"** (easing hissi) otomatik assert edilemez; deploy
  sonrası gözle doğrulama sende kalır.
- **Bot akışı:** Bot kendi `botAnim` reveal'ını kullanır (replay bot'ta çalışmaz — `maybeReplayOppMove`
  `room?.bot` guard'ı). Bot hızlı oynadığında zar/hamle gösterimi AYRI bir yol (`applyBotTurn`); bu
  raporun fix'i insan-rakip (online) yoluna yöneliktir. Bot için "çok hızlı" belirtisi görülürse ayrı
  incelenmeli (bu fix kapsamı dışında — dürüst sınır).
- **Deploy EDİLMEDİ:** Fix saf istemci kaynağında. Canlıya çıkması için `npm run deploy:build` +
  `backend/public` commit + push gerekir (frontend sunucuda build edilmez). Kullanıcı kararına bırakıldı.

---

## 8. "İnternet yüzünden" DEĞİL — net sonuç

Kök neden kesin: **istemci yalnız en taze sunucu sürümünü uyguluyor; rakibin zar-atıldı-ama-oynanmadı
ara durumu hızlı oyunda atlanıyor; ve §5.2 replay tabanı `prev.dice`'a bağlı olduğundan ara-durum
atlanınca replay hiç başlamıyor → tahta snap ediyor, zar son tahtayla geç beliriyor.** Elenen
ihtimaller: zar adaleti (ilgisiz), sunucu gecikmesi (`lockForUpdate` serileşik, anında üretir),
transport kapalı (Reverb 6 gündür canlı), backend yarışları (önceki denetimde kilit/sürüm kapılarıyla
elendi). Eksik veri: gerçek-cihaz/5-maç canlı zaman çizelgesi (yasak + flaky harness) — kök neden
bundan bağımsız olarak koddan ve deterministik testten kanıtlandı.
