# Rive Avatar Frames — Tasarım & Entegrasyon Spec'i

> **Durum (güncel):** `@rive-app/react-canvas ^4.32.1` kurulu. **Epic / Legendary / Mythic
> `.riv` dosyaları Rive MCP (`riv_create`) ile ÜRETİLDİ** ve `RiveLayer.tsx`'e bağlandı;
> `/cerceve-lab` demosunda canlı. Dosyalar: `src/assets/rive/avatar-frames/{epic,legendary,mythic}.riv`
> (tek artboard/dosya, artboard adı = rarity, state machine `Frame`, 5 input hazır).
> Her frame **5 animasyon authored**: idle / hover / selected / reduced (loop) + celebrate (oneShot),
> hepsi create→render→critique ile koyu zeminde doğrulandı.
>
> **Reaksiyon mimarisi:** `riv_create`'in ürettiği state machine'de `bool=false` geçişi (hover-bırak /
> selected-kaldır) GÜVENİLİR ATEŞLENMİYOR (probe ile kanıtlandı; "hover'da tut, bırakınca dön" kurulamaz).
> Bu yüzden reaksiyonlar SM grafiğiyle DEĞİL, `RiveLayer.tsx`'te **runtime `rive.play/stop`** ile sürülür
> (tam-animasyon-swap; öncelik reduced>selected>hover>idle; celebrate one-shot→setTimeout ile tabana dön;
> `intensity`→canvas opacity). Görsel doğrulama: `/cerceve-lab` demosu (boyut + yoğunluk + reduced +
> Hover/Selected/Celebrate). Not: kontrat tek-dosya-çok-artboard öngörüyordu; MCP dosya başına tek artboard
> ürettiği için şimdilik 3 ayrı dosya (RiveLayer `src` başına yükler).
>
> **1. teslim (brief §25):** Epic, Legendary, Mythic. Onaydan sonra Common + Rare + production.

---

## 0. ORTAK `.riv` KONTRATI (kod buna bağlanır — değiştirme)

**Tek dosya, çok artboard** (brief §20: bakım + performans). Her rarity ayrı `.riv` değil.

- **Dosya:** `public/frames/avatar-frames.riv`
- **Artboard adları (birebir):** `Common`, `Rare`, `Epic`, `Legendary`, `Mythic`
- **State Machine adı (her artboard'da aynı):** `Frame`
- **Input'lar (her state machine'de aynı isim/tip):**
  | Input | Tip | Anlam |
  |---|---|---|
  | `isHover` | Boolean | Fare üstünde → enerji %10–20 artar |
  | `isSelected` | Boolean | Kullanıcının aktif çerçevesi → kalıcı "seçili" vurgusu |
  | `celebrate` | Trigger | Kısa kutlama (level-up/başarı); loop YAPMAZ |
  | `intensity` | Number (0–100) | Global yoğunluk; boyut/performans/reduced-motion'a göre kod ayarlar |
  | `reduced` | Boolean | true → particle/aura durur, sadece minimal highlight kalır |

- **Artboard boyutu:** 200×200, arka plan **transparan**.
- **Avatar deliği (KRİTİK — brief §15):** Merkezde görünmez "safe zone" dairesi, çap **artboard'ın %72'si (144px)**. Çerçeve sanatı yalnızca bu dairenin DIŞINDA yaşar. Hiçbir katman bu dairenin içine taşmaz → yüz asla kapanmaz. Avatar fotoğrafı kod tarafında bu delikte, Rive katmanının ALTINDA render edilir.
- **Origin/pivot:** Merkez (100,100). Tüm rotate/scale merkez etrafında.
- **Fit:** Kod `Fit.Contain`, `Alignment.Center` kullanır (RiveLayer'da zaten böyle).

### State machine iskeleti (her artboard için ortak graf)
```
[Entry] → Idle (loop)
Idle  ──(isHover=true)──▶  Hover (loop, enerji +%15)
Hover ──(isHover=false)─▶  Idle
Any   ──(isSelected)────▶  Selected katmanı (ayrı layer, blend; state'i kesmez)
Any   ──(celebrate)─────▶  Celebrate (one-shot) ──(bitince)──▶ önceki state
intensity → tüm blend/opacity/particle-rate'lere çarpan (Data Bind / Blend State)
reduced  → particle & aura layer'larını 0 opacity'e kilitler
```
> Not: `isSelected` ve `celebrate` **ayrı layer**'larda (Rive'da bir state machine'de çoklu
> layer). Böylece "selected iken hover", "hover iken celebrate" çakışmadan bileşik çalışır.

---

## 1. EPIC — "Arcane"

**Palet:** violet `#7C3AED`, deep purple `#4C1D95`, electric blue `#3B82F6`, rune parıltısı `#C4B5FD`, taban metal `#1E1B2E`.

### Geometri (statik iken bile premium — brief Test 2)
- **İki ayrı halka (iç + dış frame birbirinden ayrık — brief §8):**
  - **Dış halka:** çap 196, kalınlık 10. Düzgün daire değil — **8 köşeli hafif çokgen** (arcane mühür hissi), köşelerde küçük içe kıvrımlar.
  - **İç halka:** çap 156, kalınlık 4, dış halkadan **6px boşlukla ayrık**. İnce, keskin.
  - Aradaki boşlukta **4 adet arcane rune** (kuzey/güney/doğu/batı, 45°'lerde değil — asimetriyi kır), her biri farklı glyph. Rune'lar ince çizgi (stroke 1.5), taban halka renginden bir ton açık.
- **Katmanlar (z sırası, alttan üste):** taban metal halka → oyulmuş rune oluğu (koyu inner-shadow) → rune glyph çizgileri → dış kenar ince ışık hattı (violet→blue gradient stroke) → glow layer (blur, ayrı, düşük opacity).
- **Materyal:** mat koyu metal + üstte hafif violet fresnel (kenarlarda açılan renk). Parlak plastik DEĞİL.

### Animasyon (Idle) — brief §8: kontrollü, sürekli hızlı rotation YOK
- **Rune breathing:** 4 rune, **stagger** ile (0 / 0.4 / 0.9 / 1.3 sn ofset), opacity 0.35↔0.85, easeInOutSine, periyot ~3.2 sn. Hepsi aynı anda değil.
- **Enerji akışı:** iç halka boyunca **tek bir parlak segment** (yay uzunluğu ~40°) dış halkanın stroke'unda saat yönünde dolaşır — halkanın KENDİSİ dönmez, sadece bu ışık segmenti gezer (masked gradient), periyot ~6 sn, hafif ivmeli (başta yavaş-ortada hızlı-sonda yavaş).
- **Particle:** rune'lardan ara ara (düzensiz timing) 1–2 küçük violet parçacık doğar, yukarı-dışa süzülüp 0.8 sn'de kaybolur. Aynı anda en fazla ~4 parçacık.
- **Glow:** çok hafif nefes (scale 1.0↔1.03, opacity 0.15↔0.25), periyot 4 sn.

### Hover
`isHover=true`: enerji segmenti hızı ×1.2, rune opacity tavanı +0.1, glow +%15, dış halka fresnel biraz belirginleşir. Geçiş 0.25 sn easeOut.

### Selected
İç halka rengi sabit "aktif" tonuna kilitlenir (electric blue), dış kenarda ince kalıcı ikinci hat belirir. Yanıp sönme yok — durağan ama net.

### Celebrate (one-shot ~1.4 sn)
Dört rune sırayla (stagger 0.08 sn) kısa "flare" (opacity→1, scale→1.15, overshoot), ardından iç halkada tek bir hızlı enerji turu, 6–8 particle burst (düzensiz), sonra Idle'a yumuşak dönüş.

### Boyut adaptasyonu
- <64px: particle kapalı, rune breathing var, enerji segmenti var.
- ≥96px: tam detay.

---

## 2. LEGENDARY — "Royal Gold"

**Palet:** antique gold `#C9971F`, champagne `#F5E1A4`, dark bronze `#6B4A16`, ruby accent `#9B111E`, specular beyaz `#FFF7E0`. **Sarı neon YOK — gerçek metal.**

### Geometri (gerçekten pahalı görünmeli — brief §9)
- **İşlenmiş metal halka:** çap 196, kalınlık 12. Düz değil — **beveled** (dış kenar açık champagne, iç kenar dark bronze; ortada antique gold gövde) → hacim hissi gradient ile.
- **Ornamental simetri:** üst-orta ve alt-ortada **küçük taç benzeri kabartma** (crown motif — 3 sivri uç, oyulmuş). Sol-sağ eksende **filigran/engraving** (ince kıvrık altın oymalar), simetrik.
- **Prestige detail (brief §9):** üstteki taç motifinin ortasında **tek küçük ruby** (çap ~10px), facet'li (birkaç üçgen yüzey, biri specular).
- **Katmanlar:** koyu bronz taban → beveled altın gövde (gradient) → engraving oyukları (koyu inner-shadow çizgiler) → kabartma highlight'ları (champagne, üst kenarlarda) → ruby → specular sweep layer (mask).
- **Materyal:** fırçalanmış/işlenmiş altın. Anahtar: **beveled gradient + koyu oluk + champagne highlight** = metal. Tek düz sarı = ucuz (yapma).

### Animasyon (Idle) — brief §9: gerçek metal hissi
- **Specular sweep:** metal gövde boyunca **dar bir parlak ışık şeridi** (champagne→beyaz→champagne, ~25° genişlik) yavaşça geçer (soldan sağa değil — halka çevresinde saat yönünde bir tur), periyot ~7 sn, easeInOutSine. Metalin döndüğü değil, ışığın gezdiği hissi.
- **Ruby breathe + sparkle:** ruby çok hafif nabız (opacity/parlaklık), ~3 sn; ara ara (düzensiz, ~her 5–9 sn) tek bir keskin **star sparkle** (4-uçlu, 0.4 sn, overshoot).
- **Aura:** çok hafif sıcak altın hale (dış kenarda, opacity 0.1↔0.18), 5 sn nefes.
- **Highlight burst (brief §9 "zaman zaman kısa highlight burst"):** ~her 10–14 sn'de bir, kabartma kenarlarında çok kısa (0.3 sn) champagne parlama dalgası (üstten alta stagger).

### Hover
Specular sweep hızı ×1.15, ruby sparkle olasılığı artar, aura +%15. Geçiş 0.25 sn.

### Selected
Dış kenarda ince kalıcı champagne hat + ruby biraz daha parlak sabit. Durağan prestij.

### Celebrate (~1.5 sn)
Hızlı çift specular sweep, taç kabartmalarından yukarı 4–6 altın sparkle (düzensiz), ruby tek güçlü flash, kısa altın aura genişlemesi → Idle.

### Boyut adaptasyonu
- <64px: engraving detayları basitleşir (oymalar tek çizgiye düşer), sparkle kapalı, sweep + ruby breathe kalır.
- ≥96px: tam engraving + ruby facet + burst.

---

## 3. MYTHIC — "Celestial Void"

**Palet:** deep space blue `#0B1026`, void violet `#3B0A6B`, magenta accent `#D946EF`, cyan highlight `#22D3EE`, stellar beyaz `#FFFFFF`. En özel frame (brief §10).

### Geometri (çok katmanlı, kompleks ama asimetrik görünmeden — brief §10)
- **Üç eşmerkezli katman:**
  1. **İç sınır halkası:** çap 150, ince (2px), cyan→magenta gradient stroke.
  2. **Ana void gövde:** çap 176, kalınlık 14, **derin uzay gradient** (radyal: merkeze yakın void violet, dışa deep space blue). İçinde çok küçük stellar noktalar (statik yıldız alanı, düşük opacity).
  3. **Dış enerji halkaları:** gövdenin dışında **2 ince, kopuk yay** (tam daire değil — birer ~120° yay, karşılıklı), enerji halkası hissi; cyan/magenta.
- **Celestial ornament:** dış çeperde 3 adet **floating energy shard** (küçük, uzun elmas/kristal formu), eşit aralıklı DEĞİL (asimetriyi kır: ~30°, ~160°, ~250°), her biri gövdeden hafif AYRIK yüzer.
- **Katmanlar (z):** yıldız alanı (en arka) → void gövde gradient → iç sınır halkası → kopuk dış enerji yayları → energy shard'lar → enerji wisp'ler (akan) → aura glow (en dış, blur).
- **Materyal:** ışık yayan cam/enerji + derin uzay. Fresnel kenarlar (kenarlarda cyan/magenta açılır).

### Animasyon (Idle) — brief §10: yavaş, hafif, derinlikli; disko/ekran-kaplayan YOK
- **Cosmic energy flow:** void gövde gradient'i içinde renk çok yavaş kayar (violet↔blue faz), periyot ~10 sn.
- **Orbiting details:** 3 energy shard, gövde çevresinde **çok yavaş** yörünge (birbirinden farklı hız: 22 / 30 / 40 sn tam tur) — hepsi aynı hızda değil. Her shard hafif kendi ekseninde salınır (secondary motion).
- **Parallax/depth (brief §10):** yıldız alanı, gövde ve shard'lar **farklı hızlarda** çok küçük mikro-hareket (hover/idle'da pointer'a hafif tepki opsiyonel) → derinlik.
- **Stellar particles:** düzensiz timing'le arada bir tek bir yıldız "twinkle" (0.5 sn parlar-söner); nadiren (her ~6 sn) bir küçük stellar parçacık gövdeden dışa süzülür.
- **Energy wisps:** iç sınır halkası boyunca 1–2 ince ışık iplikçiği akar (masked gradient), periyot ~8 sn, düzensiz.
- **Aura breathing:** dış hale çok yavaş nefes (scale 1.0↔1.04, opacity 0.12↔0.2), 6 sn.
- **Kopuk dış yaylar:** yavaşça zıt yönlerde döner (halkanın kendisi değil bu iki yay), 24 sn.

### Hover
Shard yörünge hızı ×1.15, wisp yoğunluğu +1, aura +%20, fresnel kenarlar belirginleşir. Geçiş 0.3 sn.

### Selected
İç sınır halkası kalıcı parlak cyan'a kilitlenir + shard'lar hafif daha parlak sabit. Sakin ama "aktif".

### Celebrate (~1.8 sn — en gösterişli ama kontrollü)
Üç shard dışa doğru kısa flare + geri; gövdede tek yavaş enerji dalgası merkezden dışa; 8–10 stellar particle burst (düzensiz, ekranı kaplamadan); aura tek nefes genişlemesi → Idle.

### Boyut adaptasyonu
- <64px: yıldız alanı + parallax kapalı, shard sayısı 3→2, wisp kapalı; gövde flow + aura + tek shard yörünge kalır.
- ≥128px: tam katman.

---

## 4. FARKLILAŞMA — brief §22 self-test'leri

**Test 1 (gri tonlama):** Epic = 8-köşeli mühür + ayrık iç/dış halka + 4 rune; Legendary = beveled kalın metal + taç kabartma + ruby + engraving; Mythic = 3 eşmerkezli katman + kopuk dış yaylar + 3 yüzen shard + yıldız alanı. **Renk olmasa bile geometriden ayrılırlar.** ✓
**Test 2 (animasyon kapalı):** Üçü de statik iken premium (metal bevel / oyulmuş rune / çok katmanlı void). Sadece efekte dayanmaz. ✓
**Test 3 (avatar önüne geçme):** Tüm sanat %72 safe-zone DIŞINDA; particle'lar dışa doğru, içe taşmaz. ✓

---

## 5. KOD ENTEGRASYONU (dosyalar gelince ben kurarım — kontrat hazır)

`.riv` teslim edilince şu kod tarafını yazacağım (tasarımdan bağımsız, kontrata bağlı):

1. **`RiveLayer.tsx` yükseltme:** `useStateMachineInput` ile `isHover/isSelected/celebrate/intensity/reduced` bind; artboard'ı `rarity`'den seç; `celebrate` trigger fonksiyonunu dışa ver.
2. **`AvatarFrame` API:** brief §19 — `<AvatarFrame rarity size avatarUrl selected onCelebrate/ref />`; ≥40px + `.riv` varsa RiveLayer, yoksa mevcut SVG fallback (yalnızca dosya yokken).
3. **Demo sayfası (brief §21):** 5 rarity yan yana; her birinde Idle / Hover / Selected / Celebrate butonu; 48/64/96/128px size selector. Route: `/cerceve-lab` (mevcut gizli `/cerceve-demo` deseni gibi).
4. **Performans (brief §17):** IntersectionObserver → offscreen'de `rive.pause()`; liste bağlamında `intensity` düşür / particle kapat; küçük boyutta artboard-level detay azalt.
5. **Reduced-motion (brief §18):** `matchMedia('(prefers-reduced-motion)')` → `reduced=true` input.
6. **`avatarFrames.ts`:** ilgili frame id'lerinin `rive:` alanına `'/frames/avatar-frames.riv'` + artboard adı yazılır.

---

## 6. SONRAKİ ADIM

Bu spec'e göre `.riv` üretmek için 2 yol (senin seçimin):
- **(a)** Sen / bir tasarımcı Rive editöründe bu 3 artboard'ı üretir → bana `avatar-frames.riv`'i verirsin → §5'i kurar, demo'da gösteririm.
- **(b)** Rive şartını gevşetirsek, aynı 3 tasarımı **WebGL/procedural shader** ile koddan ben üretirim (CSS/SVG değil; gerçek shader-driven metal/enerji/celestial) ve demo'da gösteririm.

> Onayınla Common ("Forged Steel") + Rare ("Azure Energy") spec'lerini de eklerim; ardından production entegrasyonu.
