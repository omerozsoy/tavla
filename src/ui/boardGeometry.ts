// Merkezi board geometrisi — fotograftan-pozisyon icin normalize (tepeden-duz) board
// uzerindeki SABIT bolgeler. Magic number YOK; tum oranlar burada. Perspektif
// duzeltme sonrasi goruntu bu orana getirilir; Phase 2 point-assignment bu polygonlari
// kullanir. KANONIK numbering engine ile ayni: point 1..24 -> points[point-1], +beyaz/-siyah.

// Normalize board olcusu (tavla oranina yakin; ~1.47:1). Homografi hedef dikdortgeni.
export const BOARD_NORMALIZED_WIDTH = 1120
export const BOARD_NORMALIZED_HEIGHT = 760

// Yatay bolunme (normalize 0..1): sol yari | orta bar | sag yari.
export const BAR_X_START = 0.47
export const BAR_X_END = 0.53
// Dikey: ust ucgenler asagi bakar (ustten ~%42), alt ucgenler yukari (alttan ~%42).
export const TRIANGLE_HEIGHT_RATIO = 0.42

// Bir hanenin (point) normalize dikdortgen bolgesi (0..1). Ucgen degil, sutun kutusu:
// checker-assignment icin kutu + stack yonu yeterli (ucgen kenari sart degil).
export interface PointRegion {
  point: number // 1..24 (engine label; points[point-1])
  x0: number
  y0: number
  x1: number
  y1: number
  stackDir: 'down' | 'up' // ust haneler asagi istifler, alt haneler yukari
  half: 'left' | 'right'
  row: 'top' | 'bottom'
}

// Bir yarinin 6 sutununu soldan saga uret.
function columns(xStart: number, xEnd: number): [number, number][] {
  const w = (xEnd - xStart) / 6
  return Array.from({ length: 6 }, (_, i) => [xStart + i * w, xStart + (i + 1) * w])
}

// Board.tsx GORSEL diziliminie birebir uyum (ust: 13..18 | 19..24, alt: 12..7 | 6..1).
// Sol yari sutunlari (soldan saga) ve sag yari sutunlari.
const LEFT = columns(0, BAR_X_START)
const RIGHT = columns(BAR_X_END, 1)
const TOP_LEFT_POINTS = [13, 14, 15, 16, 17, 18]
const TOP_RIGHT_POINTS = [19, 20, 21, 22, 23, 24]
const BOTTOM_LEFT_POINTS = [12, 11, 10, 9, 8, 7]
const BOTTOM_RIGHT_POINTS = [6, 5, 4, 3, 2, 1]

function buildRegions(): PointRegion[] {
  const out: PointRegion[] = []
  const topY0 = 0, topY1 = TRIANGLE_HEIGHT_RATIO
  const botY0 = 1 - TRIANGLE_HEIGHT_RATIO, botY1 = 1
  const add = (
    pts: number[], cols: [number, number][], row: 'top' | 'bottom', half: 'left' | 'right',
  ) => {
    pts.forEach((p, i) => {
      out.push({
        point: p,
        x0: cols[i][0], x1: cols[i][1],
        y0: row === 'top' ? topY0 : botY0,
        y1: row === 'top' ? topY1 : botY1,
        stackDir: row === 'top' ? 'down' : 'up',
        half, row,
      })
    })
  }
  add(TOP_LEFT_POINTS, LEFT, 'top', 'left')
  add(TOP_RIGHT_POINTS, RIGHT, 'top', 'right')
  add(BOTTOM_LEFT_POINTS, LEFT, 'bottom', 'left')
  add(BOTTOM_RIGHT_POINTS, RIGHT, 'bottom', 'right')
  return out
}

export const POINT_REGIONS: PointRegion[] = buildRegions()

// Orta bar bolgesi (0..1): ust yari = bir oyuncu, alt yari = diger (yon Phase 2'de netlesir).
export const BAR_REGION = { x0: BAR_X_START, x1: BAR_X_END, y0: 0, y1: 1 }

// NOT: Bu gorsel dizilim (sutun -> point numarasi) Phase 2 point-assignment'ta
// Board.tsx ile bire bir dogrulanacak; supheli durumda Board.tsx GERCEKtir.
