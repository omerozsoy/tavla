import type { Move, Player, Step } from './types'
import { WHITE } from './board'

// Bir konumun oyuncu perspektifinden ucgen numarasi (1-24), veya bar/off.
function locName(loc: number | 'bar' | 'off', player: Player): string {
  if (loc === 'bar') return 'bar'
  if (loc === 'off') return 'off'
  // Beyaz numaralari oldugu gibi; siyah kendi perspektifinden (ayna).
  return String(player === WHITE ? loc + 1 : 24 - loc)
}

// Hamle notasyonu: or. "8/5 6/5", "bar/22 13/7", cift taslar "24/18(2)"
export function moveNotation(move: Move, player: Player): string {
  if (move.steps.length === 0) return 'pas'
  const parts = move.steps.map((s: Step) => `${locName(s.from, player)}/${locName(s.to, player)}`)
  const counts = new Map<string, number>()
  for (const p of parts) counts.set(p, (counts.get(p) ?? 0) + 1)
  return [...counts].map(([p, n]) => (n > 1 ? `${p}(${n})` : p)).join(' ')
}
