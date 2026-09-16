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

// AÇIK notasyon: her ZAR ayrı hop gösterilir (bar/20 20/15 ...) -> gnubg'nin sıkıştırdığı
// "bar/15" (aslında bar→20→15) net görünür: kırık pul ÖNCE girer, sonra devam eder. Vuruş (*)
// bilgisi gnubg notasyon string'inden korunur (steps'te yok). steps yoksa gnubg string'e düşer.
export function explicitNotation(steps: Step[] | undefined, player: Player | undefined, gnubgNotation?: string): string {
  if (!steps || steps.length === 0) return gnubgNotation ?? 'pas'
  const pl: Player = player ?? WHITE
  const hitDests = new Set<string>()
  if (gnubgNotation) {
    for (const m of gnubgNotation.matchAll(/\/([a-z0-9]+)\*/gi)) hitDests.add(m[1]) // ".../N*" -> N
  }
  const parts = steps.map((s: Step) => {
    const to = locName(s.to, pl)
    return `${locName(s.from, pl)}/${to}${hitDests.has(to) ? '*' : ''}`
  })
  const counts = new Map<string, number>()
  for (const p of parts) counts.set(p, (counts.get(p) ?? 0) + 1)
  return [...counts].map(([p, n]) => (n > 1 ? `${p}(${n})` : p)).join(' ')
}
