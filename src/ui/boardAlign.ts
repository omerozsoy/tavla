/**
 * Kilavuz cerceve otomatik cekim icin HAFIF hizalama olcusu (model yok, saf piksel isi).
 *
 * Fikir: tahta cerceveye oturdugunda cercevenin 4 kenarinda tahtanin dis kenari BOYUNCA surekli,
 * guclu bir parlaklik gecisi (cizgi) olur; orta cizgide de bar/mentese. Her kenar icin cerceve
 * cizgisi etrafindaki dar bantta, kenara paralel her satir/sutunda "kac pikselde guclu gradyan var"
 * orani (kapsama) hesaplanir, bant icindeki en iyi satir alinir. Rastgele sahnede 4 kenarin hepsi
 * birden yuksek kapsama vermez.
 *
 * Girdi gri (0..255) kucuk goruntu + ayni koordinatlarda cerceve dikdortgeni.
 */
export interface Gray {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export interface Align {
  edges: [number, number, number, number] // ust, sag, alt, sol kapsama (0..1)
  bar: number
  tri: number // uzun kenarlar boyunca ucgen/tas gecis sayisi (iki kenar toplami)
  ok: boolean
}

export const EDGE_MIN = 0.5
export const BAR_MIN = 0.35
export const TRI_MIN = 26 // olcum (canli fotolar): tam tahta 40-51; yarim tahta (her yarinin kendi cercevesi) ~18
const GRAD_T = 22 // guclu gecis esigi (0..255 farki)

/** RGBA ImageData -> gri (luma). */
export function toGray(img: { data: Uint8ClampedArray; width: number; height: number }): Gray {
  const n = img.width * img.height
  const out = new Uint8Array(n)
  const d = img.data
  for (let i = 0, j = 0; i < n; i++, j += 4) out[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8
  return { data: out, width: img.width, height: img.height }
}

// Yatay cizgi (y sabit) boyunca x0..x1 arasinda dikey gradyani guclu piksel orani
function rowCoverage(g: Gray, y: number, x0: number, x1: number): number {
  const { data, width, height } = g
  if (y < 1 || y >= height - 1) return 0
  let hit = 0
  let n = 0
  for (let x = Math.max(0, Math.round(x0)); x < Math.min(width, Math.round(x1)); x++, n++) {
    if (Math.abs(data[(y + 1) * width + x] - data[(y - 1) * width + x]) > GRAD_T) hit++
  }
  return n ? hit / n : 0
}

// Dikey cizgi (x sabit) boyunca y0..y1 arasinda yatay gradyani guclu piksel orani
function colCoverage(g: Gray, x: number, y0: number, y1: number): number {
  const { data, width, height } = g
  if (x < 1 || x >= width - 1) return 0
  let hit = 0
  let n = 0
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(height, Math.round(y1)); y++, n++) {
    if (Math.abs(data[y * width + x + 1] - data[y * width + x - 1]) > GRAD_T) hit++
  }
  return n ? hit / n : 0
}

// Cizgi boyunca (yatay: y sabit / dikey: x sabit) parlaklik GECIS sayisi (ardisik guclu gradyan
// pikselleri tek gecis sayilir). Ucgen dizisi + taslar cok gecis uretir; duz kenar/masa az.
function transitions(g: Gray, horiz: boolean, at: number, a0: number, a1: number): number {
  const { data, width, height } = g
  const c = Math.round(at)
  if (horiz ? c < 0 || c >= height : c < 0 || c >= width) return 0
  let cnt = 0
  let inRun = false
  const lo = Math.max(1, Math.round(a0))
  const hi = Math.min(horiz ? width - 1 : height - 1, Math.round(a1))
  for (let t = lo; t < hi; t++) {
    const d = horiz
      ? Math.abs(data[c * width + t + 1] - data[c * width + t - 1])
      : Math.abs(data[(t + 1) * width + c] - data[(t - 1) * width + c])
    const on = d > GRAD_T
    if (on && !inRun) cnt++
    inRun = on
  }
  return cnt
}

function bestRow(g: Gray, yc: number, band: number, x0: number, x1: number): number {
  let best = 0
  for (let y = Math.round(yc - band); y <= Math.round(yc + band); y++) best = Math.max(best, rowCoverage(g, y, x0, x1))
  return best
}
function bestCol(g: Gray, xc: number, band: number, y0: number, y1: number): number {
  let best = 0
  for (let x = Math.round(xc - band); x <= Math.round(xc + band); x++) best = Math.max(best, colCoverage(g, x, y0, y1))
  return best
}

/**
 * barVertical: bar cizgisi cercevede DIKEY mi (yatay ekran) yoksa YATAY mi (dik ekran, tahta donuk).
 * Kenar bantlari: cerceve boyutunun %10'u (kullanici tam cizgiye degil, yakinina oturtur; saha: %7
 * dar geldi, hizalamak uzun suruyordu).
 * Kenar boyunca uclarin %12'si atlanir (koseler/menteseler gurultusu).
 */
export function measureAlign(g: Gray, r: Rect, barVertical: boolean): Align {
  const band = Math.max(2, 0.1 * Math.min(r.w, r.h))
  const mx = r.w * 0.12
  const my = r.h * 0.12
  const top = bestRow(g, r.y, band, r.x + mx, r.x + r.w - mx)
  const bottom = bestRow(g, r.y + r.h, band, r.x + mx, r.x + r.w - mx)
  const left = bestCol(g, r.x, band, r.y + my, r.y + r.h - my)
  const right = bestCol(g, r.x + r.w, band, r.y + my, r.y + r.h - my)
  const bband = Math.max(2, 0.08 * (barVertical ? r.w : r.h))
  const bar = barVertical
    ? bestCol(g, r.x + r.w / 2, bband, r.y + my, r.y + r.h - my)
    : bestRow(g, r.y + r.h / 2, bband, r.x + mx, r.x + r.w - mx)
  const edges: [number, number, number, number] = [top, right, bottom, left]
  // Uzun kenarlar (ucgenlerin dizildigi kenarlar): yatay ekranda ust/alt, dik ekranda sol/sag.
  // Kenardan %10-%22 iceride paralel cizgilerde gecis say (en iyisi), iki kenari topla.
  let tri = 0
  for (const near of [0, 1]) {
    let best = 0
    for (const d of [0.1, 0.14, 0.18, 0.22]) {
      best = Math.max(
        best,
        barVertical
          ? transitions(g, true, near ? r.y + r.h * (1 - d) : r.y + r.h * d, r.x + r.w * 0.04, r.x + r.w * 0.96)
          : transitions(g, false, near ? r.x + r.w * (1 - d) : r.x + r.w * d, r.y + r.h * 0.04, r.y + r.h * 0.96),
      )
    }
    tri += best
  }
  return { edges, bar, tri, ok: edges.every((e) => e >= EDGE_MIN) && bar >= BAR_MIN && tri >= TRI_MIN }
}

/** Iki ardisik ornek arasi ortalama mutlak fark (0..255): kucuk = telefon sabit. */
export function frameDiff(a: Gray, b: Gray): number {
  if (a.width !== b.width || a.height !== b.height) return 255
  const n = a.data.length
  let s = 0
  for (let i = 0; i < n; i += 3) s += Math.abs(a.data[i] - b.data[i])
  return s / Math.ceil(n / 3)
}
