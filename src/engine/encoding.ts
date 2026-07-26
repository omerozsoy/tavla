// wildbg sinir agi girdi kodlamasi - crates/engine/src/inputs.rs birebir cevirisi.
// Dogrulama: wildbg'nin kendi test vektorleriyle (encoding.test.ts) eslesir.
import type { GameState, Player } from './types'
import { countAt, WHITE } from './board'

// wildbg pozisyon gosterimi (oyuncu-on-roll = "x" perspektifinden).
//   pips[0]  = O_BAR (rakip bar), negatif
//   pips[1..24] = x perspektifinden ucgenler; x pozitif, o negatif
//   pips[25] = X_BAR (x bar), pozitif
//   x, 24'ten 0'a dogru ilerler.
export interface WildPos {
  pips: number[] // uzunluk 26
  xOff: number
  oOff: number
}

// Bir ucgen icin 4 girdi (TD-Gammon / GnuBG stili).
//   n<=0 (rakip veya bos) -> [0,0,0,0]
//   n==1 -> [1,0,0,0]; n==2 -> [0,1,0,0]; n>=3 -> [0,0,1,n-3]
function td(n: number): [number, number, number, number] {
  if (n <= 0) return [0, 0, 0, 0]
  if (n === 1) return [1, 0, 0, 0]
  if (n === 2) return [0, 1, 0, 0]
  return [0, 0, 1, n - 3]
}

// Benim tahta gosterimimi wildbg WildPos'una cevir (verilen oyuncu on-roll = x).
export function toWildPos(state: GameState, onRoll: Player): WildPos {
  // Once beyaz-perspektifli dizi (W): beyaz = x
  const pips = new Array(26).fill(0)
  pips[0] = -state.bar.black // O_BAR
  pips[25] = state.bar.white // X_BAR
  for (let p = 1; p <= 24; p++) {
    pips[p] = state.points[p - 1] // beyaz +, siyah -
  }
  const white: WildPos = { pips, xOff: state.off.white, oOff: state.off.black }

  if (onRoll === WHITE) return white

  // Siyah on-roll: taraflari cevir (sides_switched): pips2[i] = -pips[25-i]
  const switched = new Array(26).fill(0)
  for (let i = 0; i < 26; i++) switched[i] = -pips[25 - i]
  return { pips: switched, xOff: white.oOff, oOff: white.xOff }
}

// Contact neti girdileri (202 uzunlugunda)
export const CONTACT_INPUTS = 202
export function contactInputs(pos: WildPos): Float32Array {
  const out = new Float32Array(CONTACT_INPUTS)
  out[0] = pos.xOff
  out[1] = pos.oOff
  // X_BAR (pips[25]) -> index 2..6
  const bar = td(pos.pips[25])
  out[2] = bar[0]
  out[3] = bar[1]
  out[4] = bar[2]
  out[5] = bar[3]
  // x pips 1..24 -> index 6..102
  for (let k = 0; k < 24; k++) {
    const t = td(pos.pips[1 + k])
    const s = 6 + k * 4
    out[s] = t[0]
    out[s + 1] = t[1]
    out[s + 2] = t[2]
    out[s + 3] = t[3]
  }
  // o pips 0..24 (rakip = -pip) -> index 102..202
  for (let k = 0; k < 25; k++) {
    const t = td(-pos.pips[k])
    const s = 102 + k * 4
    out[s] = t[0]
    out[s + 1] = t[1]
    out[s + 2] = t[2]
    out[s + 3] = t[3]
  }
  return out
}

// Race neti girdileri (186 uzunlugunda). Bar ve en uzak nokta kodlanmaz.
export const RACE_INPUTS = 186
export function raceInputs(pos: WildPos): Float32Array {
  const out = new Float32Array(RACE_INPUTS)
  out[0] = pos.xOff
  out[1] = pos.oOff
  // x pips 1..23 -> index 2..94
  for (let k = 0; k < 23; k++) {
    const t = td(pos.pips[1 + k])
    const s = 2 + k * 4
    out[s] = t[0]
    out[s + 1] = t[1]
    out[s + 2] = t[2]
    out[s + 3] = t[3]
  }
  // o pips 2..24 (rakip = -pip) -> index 94..186
  for (let k = 0; k < 23; k++) {
    const t = td(-pos.pips[2 + k])
    const s = 94 + k * 4
    out[s] = t[0]
    out[s + 1] = t[1]
    out[s + 2] = t[2]
    out[s + 3] = t[3]
  }
  return out
}

export type Phase = 'contact' | 'race'

// Faz belirleme: en uzak kendi tasi > en uzak rakip tasiysa contact, degilse race.
export function phaseOf(pos: WildPos): Phase {
  let lastOwn = -1
  let lastOpp = -1
  for (let i = 0; i < 26; i++) {
    if (pos.pips[i] > 0) lastOwn = i // en buyuk index (rposition)
  }
  for (let i = 0; i < 26; i++) {
    if (pos.pips[i] < 0) {
      lastOpp = i // ilk (en kucuk) index (position)
      break
    }
  }
  return lastOwn > lastOpp ? 'contact' : 'race'
}

// 6 olasilik dizisinden equity (x perspektifi):
// wn - ln + 2(wg - lg) + 3(wb - lb)
export function equityFrom(p: Float32Array | number[]): number {
  return p[0] - p[3] + 2 * (p[1] - p[4]) + 3 * (p[2] - p[5])
}

// Bear off tamamlanmis mi (mover 15 tas topladi)?
export function pipTotal(state: GameState, player: Player): number {
  let total = state.bar[player] * 25
  for (let i = 0; i < 24; i++) {
    const n = countAt(state.points, i, player)
    if (n > 0) total += n * (player === WHITE ? i + 1 : 24 - i)
  }
  return total
}
