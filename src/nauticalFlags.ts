// Denizci (Nautical) board — 12 uluslararası deniz sinyal FLAMASI (ICS numeral pennants
// + Answer + Repeat One). Referans görsellerinden birebir renk/desen olarak SVG data-URI
// üretilir. Point üçgenine gömülür: her desen ÜÇGENİN uzun eksenine göre çizilir; dikey
// bandlar/merkezli motif -> üst ve alt hanede AYNI okunur (dikey-simetrik).
//
// KURAL (kullanıcı): 24 haneden TEK sayılılar (1,3,..,23) BOŞ ahşap; ÇİFT sayılılar
// (2,4,..,24) bayraklı. Point numarası = data-point index + 1. Yani flama'lar
// data-point 1,3,5,...,23'e (index tek) düşer. Her flama YALNIZ 1 kez, tekrar yok.

// Renkler (referans flama paletine yakın canlı tonlar)
const R = '%23e00d13' // kırmızı
const W = '%23ffffff' // beyaz
const Y = '%23ffd400' // sarı
const B = '%230047b6' // mavi
const K = '%23161616' // siyah

// viewBox 0 0 100 100, preserveAspectRatio='none' -> point kutusuna gerilir; clip-path üçgen yapar.
const svg = (inner: string): string =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'%3E${inner}%3C/svg%3E`

const rect = (x: number, w: number, fill: string, y = 0, h = 100) =>
  `%3Crect x='${x}' y='${y}' width='${w}' height='${h}' fill='${fill}'/%3E`
const circ = (fill: string, r = 27, cx = 50, cy = 50) => `%3Ccircle cx='${cx}' cy='${cy}' r='${r}' fill='${fill}'/%3E`
const poly = (pts: string, fill: string) => `%3Cpolygon points='${pts}' fill='${fill}'/%3E`

// Sıra = point 2,4,6,...,24 (yani data-point 1,3,5,...,23). 12 FARKLI flama.
export const NAUTICAL_FLAGS: string[] = [
  // f01 — "Answer": kırmızı/beyaz 5 dikey band
  svg(rect(0, 100, R) + rect(20, 20, W) + rect(60, 20, W)),
  // f02 — Pennant 0: sarı/kırmızı/sarı
  svg(rect(0, 100, Y) + rect(33, 34, R)),
  // f03 — Pennant 1: beyaz zemin + kırmızı daire
  svg(rect(0, 100, W) + circ(R)),
  // f04 — Pennant 2: mavi zemin + beyaz daire
  svg(rect(0, 100, B) + circ(W)),
  // f05 — Pennant 3: kırmızı/beyaz/mavi
  svg(rect(0, 100, R) + rect(33, 34, W) + rect(67, 33, B)),
  // f06 — Pennant 4: kırmızı zemin + beyaz haç
  svg(rect(0, 100, R) + rect(40, 20, W) + rect(0, 100, W, 40, 20)),
  // f07 — Pennant 5: sarı | mavi
  svg(rect(0, 50, Y) + rect(50, 50, B)),
  // f08 — Pennant 6: siyah | beyaz
  svg(rect(0, 50, K) + rect(50, 50, W)),
  // f09 — Pennant 7: sarı | kırmızı
  svg(rect(0, 50, Y) + rect(50, 50, R)),
  // f10 — Pennant 8: beyaz zemin + kırmızı haç
  svg(rect(0, 100, W) + rect(40, 20, R) + rect(0, 100, R, 40, 20)),
  // f11 — Pennant 9 ("Niner"): beyaz/siyah üstte, kırmızı/sarı altta (4 çeyrek)
  svg(rect(0, 50, W, 0, 50) + rect(50, 50, K, 0, 50) + rect(0, 50, R, 50, 50) + rect(50, 50, Y, 50, 50)),
  // f12 — "Repeat One": mavi zemin + sarı üçgen (uca doğru)
  svg(rect(0, 100, B) + poly('18,12 82,12 50,74', Y)),
]

// data-point (0-tabanlı index) -> flama data-URI. Yalnız TEK index'ler (çift point no) bayraklı.
export const NAUTICAL_FLAG_BY_DATAPOINT: Record<number, string> = Object.fromEntries(
  NAUTICAL_FLAGS.map((uri, k) => [2 * k + 1, uri]),
)
