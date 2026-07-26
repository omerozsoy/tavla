import type { GameState, Player } from './types'

export const WHITE: Player = 'white'
export const BLACK: Player = 'black'

export function opponent(p: Player): Player {
  return p === WHITE ? BLACK : WHITE
}

// Standart baslangic dizilimi (points index -> tas sayisi, +beyaz / -siyah)
// Beyaz 24->1 yonunde ilerler; klasik dizilim:
//   Beyaz: 24. ucgende 2, 13'te 5, 8'de 3, 6'da 5
//   Siyah: 1. ucgende 2, 12'de 5, 17'de 3, 19'da 5
export function initialState(): GameState {
  const points = new Array(24).fill(0)
  // Beyaz (pozitif)
  points[23] = 2 // 24. ucgen
  points[12] = 5 // 13. ucgen
  points[7] = 3 //  8. ucgen
  points[5] = 5 //  6. ucgen
  // Siyah (negatif) - beyazin ayna simetrigi
  points[0] = -2 //  1. ucgen
  points[11] = -5 // 12. ucgen
  points[16] = -3 // 17. ucgen
  points[18] = -5 // 19. ucgen

  return {
    points,
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 },
    turn: WHITE,
    dice: [],
    diceUsed: [],
  }
}

export function cloneState(s: GameState): GameState {
  return {
    points: s.points.slice(),
    bar: { ...s.bar },
    off: { ...s.off },
    turn: s.turn,
    dice: s.dice.slice(),
    diceUsed: s.diceUsed.slice(),
  }
}

// Bir index'te oyuncunun kac tasi var (kendi isaretine gore, her zaman >= 0)
export function countAt(points: number[], index: number, player: Player): number {
  const v = points[index]
  return player === WHITE ? Math.max(0, v) : Math.max(0, -v)
}

// O index oyuncu icin bloke mi? (rakibin 2+ tasi varsa bloke)
export function isBlocked(points: number[], index: number, player: Player): boolean {
  const v = points[index]
  return player === WHITE ? v <= -2 : v >= 2
}

// Bir index'e oyuncunun tek tasini koy (rakibin tek tasi varsa vurulur -> true doner)
export function placeChecker(state: GameState, index: number, player: Player): boolean {
  const sign = player === WHITE ? 1 : -1
  const opp = opponent(player)
  let hit = false
  if (countAt(state.points, index, opp) === 1) {
    // rakibin blot'u vuruldu
    state.points[index] = 0
    state.bar[opp] += 1
    hit = true
  }
  state.points[index] += sign
  return hit
}

// Oyuncunun tum taslari ev bolgesinde (ve bar'da yok) mu? -> bear off yapabilir
export function allHome(state: GameState, player: Player): boolean {
  if (state.bar[player] > 0) return false
  const range = player === WHITE ? [6, 24] : [0, 18] // ev DISI araligi kontrol et
  for (let i = range[0]; i < range[1]; i++) {
    if (countAt(state.points, i, player) > 0) return false
  }
  return true
}

// Oyuncunun evindeki en uzak (bear off'a en gec cikacak) tasin index'i
export function highestHomeIndex(state: GameState, player: Player): number {
  if (player === WHITE) {
    // beyaz ev: 0..5, en uzak = en buyuk index
    for (let i = 5; i >= 0; i--) if (countAt(state.points, i, player) > 0) return i
    return -1
  } else {
    // siyah ev: 18..23, en uzak = en kucuk index
    for (let i = 18; i <= 23; i++) if (countAt(state.points, i, player) > 0) return i
    return -1
  }
}

// Kazanan var mi?
export function winner(state: GameState): Player | null {
  if (state.off.white === 15) return WHITE
  if (state.off.black === 15) return BLACK
  return null
}

// Oyun sonucu: kazanan + carpan (1 normal, 2 gammon, 3 backgammon)
export interface GameOutcome {
  winner: Player
  multiplier: number
}
export function gameOutcome(state: GameState): GameOutcome | null {
  const w = winner(state)
  if (!w) return null
  const loser = opponent(w)
  if (state.off[loser] > 0) return { winner: w, multiplier: 1 } // normal
  // Kaybeden hic tas toplamadi -> gammon; kazananin evinde/bar'da tasi varsa backgammon
  const [hs, he] = w === WHITE ? [0, 6] : [18, 24] // kazananin ev bolgesi
  let backgammon = state.bar[loser] > 0
  if (!backgammon) {
    for (let i = hs; i < he; i++) {
      const v = state.points[i]
      if ((loser === WHITE && v > 0) || (loser === BLACK && v < 0)) {
        backgammon = true
        break
      }
    }
  }
  return { winner: w, multiplier: backgammon ? 3 : 2 }
}
