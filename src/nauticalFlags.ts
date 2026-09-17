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
  // YATAY band (uzun eksene DİK; 90° çevrik şerit). f0..f1 = tabandan uca oran (0=taban,1=uç).
  const hband = (f0: number, f1: number, fill: string) => rect(0, Math.min(yb(f0), yb(f1)), 100, Math.abs(yb(f1) - yb(f0)), fill)
  // 4 çeyrek, 90° SAAT YÖNÜ çevrik (Niner): taban sol=R sağ=W, uç sol=Y sağ=K.
  const quadCW = () => {
    const baseY = flip ? half : 0
    const tipY = flip ? 0 : half
    return svg(rect(0, baseY, 50, half, R) + rect(50, baseY, 50, half, W) + rect(0, tipY, 50, half, Y) + rect(50, tipY, 50, half, K))
  }
  // Beyaz/renkli daireli flama: solid zemin + tabana yakın KÜÇÜK daire (svgR + cover -> yuvarlak kalır)
  const disc = (field: string, dot: string) => svgR(band(0, 100, field) + circle(yb(0.17), 24, dot))
  // Nordic haç: tam-boy dikey kol + tabana yakın yatay kol
  const cross = (field: string, arm: string) => {
    const cy = yb(0.16)
    return svg(band(0, 100, field) + rect(38, 0, 24, H, arm) + rect(0, cy - 13, 100, 26, arm))
  }
  // Kullanıcı sıralaması (1.webp..12.webp) = point 2,4,..,24 (data-point 1,3,..,23).
  return [
    svg(band(0, 100, Y) + rect(0, Math.round(H / 3), 100, Math.round(H / 3), R)), // 1 90° ÇEVRİK: sarı/kırmızı/sarı YATAY band -> pt2 dp1
    disc(W, R),                                                      // 2  (beyaz + kırmızı DAİRE)       -> pt4  dp3
    disc(B, W),                                                      // 3  (mavi + beyaz DAİRE)          -> pt6  dp5
    svg(hband(0, 0.34, B) + hband(0.34, 0.67, W) + hband(0.67, 1, R)), // 4 90° CCW: kırmızı/beyaz/mavi YATAY (taban→uç B/W/R) -> pt8 dp7
    cross(R, W),                                                     // 5  (kırmızı + beyaz haç)        -> pt10 dp9
    svg(hband(0, 0.5, B) + hband(0.5, 1, Y)),                        // 6 90° CCW: sarı/mavi YATAY (taban→uç B/Y) -> pt12 dp11
    svg(band(0, 50, W) + band(50, 50, K)),                           // 7 180° çevrik (beyaz | siyah)   -> pt14 dp13
    svg(band(0, 50, R) + band(50, 50, Y)),                           // 8 180° çevrik (kırmızı | sarı)  -> pt16 dp15
    cross(W, R),                                                     // 9  (beyaz + kırmızı haç)        -> pt18 dp17
    quadCW(),                                                        // 10 90° CW: 4 çeyrek (Niner)      -> pt20 dp19
    svg(band(0, 100, R) + hband(0.2, 0.4, W) + hband(0.6, 0.8, W)),  // 11 90° CW: Answer YATAY şerit    -> pt22 dp21
    svg(band(0, 100, B) + poly(`50,${yb(0.05)} 74,${yb(0.55)} 26,${yb(0.55)}`, Y)), // 12 Repeat: mavi zemin + SARI ÜÇGEN ucu RAIL'e (dışa) doğru -> pt24 dp23
  ]
}

export const NAUTICAL_FLAGS_TOP = flagsFor(false)
export const NAUTICAL_FLAGS_BOTTOM = flagsFor(true)

// data-point (0-tabanlı) -> flama. Yalnız TEK index (çift point no) bayraklı.
export const NAUTICAL_FLAG_TOP_BY_DP: Record<number, string> = Object.fromEntries(NAUTICAL_FLAGS_TOP.map((u, k) => [2 * k + 1, u]))
export const NAUTICAL_FLAG_BOTTOM_BY_DP: Record<number, string> = Object.fromEntries(NAUTICAL_FLAGS_BOTTOM.map((u, k) => [2 * k + 1, u]))
