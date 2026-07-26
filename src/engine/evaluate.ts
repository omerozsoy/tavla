import type { GameState, Player } from './types'
import { countAt, opponent, WHITE } from './board'

// Bir oyuncunun pip sayisi (bear off'a kadar toplam adim). Dusuk = iyi.
//   beyaz: index i'deki tas -> i+1 pip, bar -> 25
//   siyah: index i'deki tas -> 24-i pip, bar -> 25
export function pipCount(state: GameState, player: Player): number {
  let total = state.bar[player] * 25
  for (let i = 0; i < 24; i++) {
    const n = countAt(state.points, i, player)
    if (n === 0) continue
    const pip = player === WHITE ? i + 1 : 24 - i
    total += n * pip
  }
  return total
}

// Verilen blot'a (index i) rakibin direkt vurus sayisi (36 zar kombinasyonundan kaci).
// Sadece tek zarlik (direkt) vuruslar - basit ama etkili yaklasim.
function directShots(state: GameState, blotIndex: number, owner: Player): number {
  const opp = opponent(owner)
  const shotDistances = new Set<number>()
  for (let d = 1; d <= 6; d++) {
    // Rakip owner'in blot'unu d mesafeden vurabilir mi?
    // owner beyazsa rakip (siyah) dusuk->yuksek gider: vurucu index = blot - d
    // owner siyahsa rakip (beyaz) yuksek->dusuk gider: vurucu index = blot + d
    const hitterIndex = owner === WHITE ? blotIndex - d : blotIndex + d
    if (hitterIndex < 0 || hitterIndex > 23) continue
    if (countAt(state.points, hitterIndex, opp) > 0) {
      shotDistances.add(d)
    }
  }
  // En az bir gereken zar gelen kombinasyon sayisi = 36 - (6-|S|)^2
  const s = shotDistances.size
  if (s === 0) return 0
  return 36 - (6 - s) * (6 - s)
}

// Oyuncunun ev bolgesinde yaptigi kapi (2+ tas) sayisi
function homePoints(state: GameState, player: Player): number {
  const [start, end] = player === WHITE ? [0, 6] : [18, 24]
  let count = 0
  for (let i = start; i < end; i++) {
    if (countAt(state.points, i, player) >= 2) count++
  }
  return count
}

// Statik pozisyon degerlendirmesi. Yuksek = `player` icin iyi.
// (Bu basit botun beynidir; gnubg gucunde degil ama makul oynar.)
export function evaluatePosition(state: GameState, player: Player): number {
  const opp = opponent(player)
  const myPip = pipCount(state, player)
  const oppPip = pipCount(state, opp)

  // Yaris avantaji (temel etken)
  let score = oppPip - myPip

  // Toplanan taslar cok degerli
  score += 12 * state.off[player]
  score -= 12 * state.off[opp]

  // Bar'da tas olmak kotu
  score -= 8 * state.bar[player]

  // Ev bolgesi kapilari iyi (rakibi hapsetme potansiyeli)
  score += 3 * homePoints(state, player)

  // Kendi blot'larimizin vurulma riski
  for (let i = 0; i < 24; i++) {
    if (countAt(state.points, i, player) === 1) {
      const shots = directShots(state, i, player)
      // Vurulursa kaybedilecek pip ~ pozisyona bagli; riski shots oraninda cezalandir
      score -= (shots / 36) * 8
    }
    // Rakibin blot'unu vurabilme firsati (kucuk bonus)
    if (countAt(state.points, i, opp) === 1) {
      const shots = directShots(state, i, opp)
      score += (shots / 36) * 4
    }
  }

  return score
}
