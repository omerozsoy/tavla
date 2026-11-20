# Eğitim Yarışmaları — 4 Canlı Mod (Tasarım)

Tarih: 2026-11-20

## Niyet / neden
Kullanıcı eğitim bölümünü "yarışma" haline getirmek istiyor: her biri **can/kalp**
mekaniğiyle oynanan, **ayrı rekor tablolu**, "Dersler ve Eğitim" sol menüsü altında
**4 ayrı sayfa**. Amaç: tekrar oynanabilir, rekabetçi, hata yaptıkça baskı artan
(kalp azalan) bir pratik akışı. DASH Gammon benzeri skor/accuracy ekranı referans.

## 4 mod
| # | Ad | Slug | Can | Süre | İçerik |
|---|----|------|-----|------|--------|
| 1 | Doğru Hamle mi? | `/dogru-hamle-mi` | 3 ❤️ | yok | Oynanmış pozisyon → "En İyi Hamle / Hatalı Hamle" tahmini **+ küp** (Katla/Katlama) |
| 2 | Zamana Karşı | `/zamana-karsi` | **yok** | 3 dk | Pozisyonu **oyna** (hamleyi gir); yanlış → sonraki soru; yalnız 3 dk'da biter, max skor |
| 3 | Küp Kararı | `/kup-karari` | 3 ❤️ | yok | Yalnız küp (Katla/Katlama) |
| 4 | Tek Can | `/tek-can` | **1 ❤️** | yok | Mod 1'in zoru: tek can, best/blunder tahmini (+ küp) |

## Hedefler
- Tek config-sürücülü motor, 4 route.
- Her modda kalp göstergesi; yanlış → 1 kalp eksil (animasyon); 0 kalp → oyun biter.
- 4 ayrı rekor tablosu (backend `mode` anahtarı: `judge3` / `time` / `cube3` / `tekcan`).
- 4 menü girişi (Dersler ve Eğitim) + 4 web.php allowlist slug.

## Hedef-değil / anti-hedef
- Mevcut `/soru-maratonu` (Pul/Küp sınırsız) **silinmez** — sınırsız pratik olarak kalır,
  bu 4 mod "yarışma" olarak yanına eklenir. (Kullanıcı aksini derse override.)
- Mod 2/3 mekaniği yeni içerik üretmez — mevcut oyna-havuzu + CUBE_POOL yeniden kullanılır.

## Yaklaşımlar
- **A (seçildi): Tek config'li motor.** `QuizMarathon` → `GameConfig { key, lives,
  timeLimitSec, content: 'judge'|'play'|'cube', withCube }`. 4 route config besler.
  En az kod, tek bakım noktası.
- **B (elendi): 4 ayrı bileşen.** Kopya-yapıştır, 4× bakım, harness zaten esnek → gereksiz.

## Kararlar (benim çağrım, override edilebilir)
- **Kalp:** Mod 1=3, Mod 3=3, Mod 4 (Tek Can)=1. **Zamana Karşı (Mod 2) can YOK** —
  yalnız 3 dk süre; yanlış → kalp kaybı yok, direkt sonraki soru; oyun yalnız süre dolunca biter.
- **Puanlama:** Mevcut zorluk-bazlı puan (10/20/25/50/100) + 3'lü seri ×2 korunur.
  Tek Can modu tek canlı olduğu için skor doğal olarak daha kısa/zor.
- **Scope:** `/soru-maratonu` korunur (yukarıda).

## En ağır iş — "Doğru Hamle mi?" içeriği (Mod 1 & 4)
Şu an sorular yalnız **en iyi hamleyi** saklıyor. "Bu hamle hata mı?" diye sormak için
best/blunder karışık kart havuzu gerekli:
- **Kart = { pozisyon, gösterilen_hamle, isBlunder, zorluk }.**
- Üretim (sunucu gnubg batch):
  - *best kartı*: saklı en iyi hamle gösterilir → `isBlunder=false`.
  - *blunder kartı*: legal bir alternatif hamle üretilir; `equity(best) − equity(alt) ≥ eşik`
    (örn. ≥0.08) ise `isBlunder=true` olarak etiketlenir (net blunder değilse atılır).
- ~50/50 karışım, hedef ~200–400 kart, `src/ui/judgePositions.ts`'e donmuş veri
  (cubePositions.ts deseni gibi — kod stabil, cevap gnubg-doğru).
- Küp kartları (Mod 1 & 3): mevcut `CUBE_POOL` (Katla/Katlama `cubeAnswer`) yeniden kullanılır.

## Backend
- `mode` kolonu (bekleyen migration, string+index) yeterli — yeni şema YOK.
- `QuizScoreController` doğrulaması `in:checker,cube,judge3,time,cube3,tekcan`'a genişler.
- 4 leaderboard = 4 mode anahtarı. Cache anahtarı zaten `quiz_lb:{mode}:{limit}`.

## Builder'a kalan
- Kalp animasyonu/CSS detayı; timer UI; GameOver ekranında accuracy/streak/en-zor/ort-süre
  (DASH referansı) alanlarının hangi modda gösterileceği; judge kartı board render'ı
  (oynanmış hamle gösterimi) mevcut board bileşeniyle.

## Teslim akışı
Frontend: `npm run deploy:build` → commit → push → QD. Backend-only değil (yeni sayfalar).
Bu paket, bekleyen küp/pul deploy'uyla birlikte "Deploy Now"da iner.
