// Tavla motoru - temel tipler
//
// Tahta konvansiyonu (kod boyunca sabit):
//   points: 24 elemanlı dizi. index 0 = 1. üçgen ... index 23 = 24. üçgen.
//   Pozitif deger  = beyaz (white) taslari.
//   Negatif deger  = siyah (black) taslari.
//
// Yon:
//   WHITE, index yuksekten dusuge dogru ilerler (24 -> 1), yani dir = -1.
//     - Ev (home) bolgesi: index 0..5  (1..6 ucgenleri)
//     - Toplama (bear off): index 0'in altina cikinca off.white++
//     - Bar'dan giris: index = 24 - zar  (zar 1 -> 23, zar 6 -> 18)
//   BLACK, index dusukten yuksege dogru ilerler (1 -> 24), yani dir = +1.
//     - Ev bolgesi: index 18..23  (19..24 ucgenleri)
//     - Toplama: index 23'un ustune cikinca off.black++
//     - Bar'dan giris: index = zar - 1  (zar 1 -> 0, zar 6 -> 5)

export type Player = 'white' | 'black'

export interface GameState {
  points: number[] // uzunluk 24
  bar: Record<Player, number>
  off: Record<Player, number>
  turn: Player
  dice: number[] // guncel atis, or. [3,5] veya cift ise [4,4,4,4]
  diceUsed: boolean[] // her zarin kullanilip kullanilmadigi
}

// Bir tasin tek zarlik hareketi.
// from: 0..23 (ucgen index) veya 'bar'
// to:   0..23 (ucgen index) veya 'off'
export interface Step {
  from: number | 'bar'
  to: number | 'off'
  die: number
}

// Bir tur boyunca yapilan tam hamle (bir veya birden fazla step).
export interface Move {
  steps: Step[]
  // Uygulandiktan sonraki tahta parmak izi (dedupe icin)
  resultKey: string
}
