// Maritime (Nautical) board — 12 uluslararası deniz SİNYAL FLAMASI (ICS pennant), point
// üçgenine BOZULMADAN (distort YOK) gömülür. Referans: gerçek ahşap denizci tavla.
//
// DISTORT FIX: hane ::before kutusu ~0.296 en/boy (W:H = 1:3.38, viewport-bağımsız sabit).
// SVG viewBox'ı AYNI orana (100×338) çizildiği için background-size:100% 100% düzgün (scaleX≈
// scaleY) → daireler YUVARLAK kalır, hiçbir desen ezilmez. Motifler TABANA (rail) yakın; üçgen
// ucu SİVRİ (clip-path base'den). Asimetrik motifler için üst/alt (top/bottom) ayrı varyant.
//
// KURAL: tek sayılı point (1,3,..,23) BOŞ ahşap; çift sayılı (2,4,..,24) bayraklı. Point no =
// data-point + 1 → flamalar data-point 1,3,..,23 (=shade-b). Her flama YALNIZ 1 kez.

const R = '%23e00d13' // kırmızı
const W = '%23ffffff' // beyaz
const Y = '%23ffd400' // sarı
const B = '%230047b6' // mavi
const K = '%23161616' // siyah
const H = 338 // viewBox yüksekliği (en/boy 100:338 = hane oranı)

// Şerit/haç flamaları: PAR='none' -> içerik kutuya GERİLİR (background 100% 100% ile birlikte; aspect-toleranslı).
const svg = (inner: string): string =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 ${H}' preserveAspectRatio='none'%3E${inner}%3C/svg%3E`
// DAİRELİ/baklava flamaları: PAR YOK (varsayılan) -> SVG'nin İÇSEL en-boy oranı korunur; böylece
// CSS 'background-size: cover' ÜNİFORM ölçekler (scaleX=scaleY) -> daire her bağlamda YUVARLAK.
// (PAR='none' içsel oranı siler; o zaman cover '100% 100%' gibi davranıp daireyi ovalleştiriyordu.)
const svgR = (inner: string): string =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 ${H}'%3E${inner}%3C/svg%3E`
// Tam-boy DİKEY band (uzun eksen boyunca; üst/alt SİMETRİK — flip'ten bağımsız)
const band = (x: number, w: number, f: string) => `%3Crect x='${x}' y='0' width='${w}' height='${H}' fill='${f}'/%3E`
const circle = (cy: number, r: number, f: string) => `%3Ccircle cx='50' cy='${cy}' r='${r}' fill='${f}'/%3E`
const rect = (x: number, y: number, w: number, h: number, f: string) => `%3Crect x='${x}' y='${y}' width='${w}' height='${h}' fill='${f}'/%3E`
const poly = (pts: string, f: string) => `%3Cpolygon points='${pts}' fill='${f}'/%3E`

// f = tabandan (rail) uca doğru oran (0=taban, 1=uç). Üst hane: taban y=0; alt hane: taban y=H.
function flagsFor(flip: boolean): string[] {
  const yb = (f: number) => Math.round(flip ? H - f * H : f * H)
  const half = Math.round(H / 2)
  // Beyaz/renkli daireli flama: solid zemin + tabana yakın KÜÇÜK daire (svgR + cover -> yuvarlak kalır)
  const disc = (field: string, dot: string) => svgR(band(0, 100, field) + circle(yb(0.17), 24, dot))
  // Nordic haç: tam-boy dikey kol + tabana yakın yatay kol
  const cross = (field: string, arm: string) => {
    const cy = yb(0.16)
    return svg(band(0, 100, field) + rect(38, 0, 24, H, arm) + rect(0, cy - 13, 100, 26, arm))
  }
  // 4 çeyrek (Niner): taban yarısı iki renk, uç yarısı iki renk
  const quad = () => {
    const baseY = flip ? half : 0
    const tipY = flip ? 0 : half
    return svg(rect(0, baseY, 50, half, W) + rect(50, baseY, 50, half, K) + rect(0, tipY, 50, half, R) + rect(50, tipY, 50, half, Y))
  }
  // Kullanıcı sıralaması (1.webp..12.webp) = point 2,4,..,24 (data-point 1,3,..,23).
  return [
    svg(band(0, 100, Y) + rect(0, Math.round(H / 3), 100, Math.round(H / 3), R)), // 1 90° ÇEVRİK: sarı/kırmızı/sarı YATAY band -> pt2 dp1
    disc(W, R),                                                      // 2  (beyaz + kırmızı DAİRE)       -> pt4  dp3
    disc(B, W),                                                      // 3  (mavi + beyaz DAİRE)          -> pt6  dp5
    svg(band(0, 100, R) + band(33, 34, W) + band(67, 33, B)),        // 4  (kırmızı/beyaz/mavi)         -> pt8  dp7
    cross(R, W),                                                     // 5  (kırmızı + beyaz haç)        -> pt10 dp9
    svg(band(0, 50, Y) + band(50, 50, B)),                           // 6  (sarı | mavi)                -> pt12 dp11
    svg(band(0, 50, K) + band(50, 50, W)),                           // 7  (siyah | beyaz)              -> pt14 dp13
    svg(band(0, 50, Y) + band(50, 50, R)),                           // 8  (sarı | kırmızı)             -> pt16 dp15
    cross(W, R),                                                     // 9  (beyaz + kırmızı haç)        -> pt18 dp17
    quad(),                                                          // 10 (beyaz/siyah–kırmızı/sarı)   -> pt20 dp19
    svg(band(0, 100, R) + band(20, 20, W) + band(60, 20, W)),        // 11 Answer (kırmızı/beyaz şerit) -> pt22 dp21
    svgR(band(0, 100, B) + poly(`50,${yb(0.04)} 84,${yb(0.16)} 50,${yb(0.28)} 16,${yb(0.16)}`, Y)), // 12 Repeat (mavi+sarı) -> pt24 dp23
  ]
}

export const NAUTICAL_FLAGS_TOP = flagsFor(false)
export const NAUTICAL_FLAGS_BOTTOM = flagsFor(true)

// data-point (0-tabanlı) -> flama. Yalnız TEK index (çift point no) bayraklı.
export const NAUTICAL_FLAG_TOP_BY_DP: Record<number, string> = Object.fromEntries(NAUTICAL_FLAGS_TOP.map((u, k) => [2 * k + 1, u]))
export const NAUTICAL_FLAG_BOTTOM_BY_DP: Record<number, string> = Object.fromEntries(NAUTICAL_FLAGS_BOTTOM.map((u, k) => [2 * k + 1, u]))
