import type { TMatch, TPlayer } from './api'

// Katilimci listesi rozeti: su an oynuyor (masa+canli skor) veya elendi. Normalde ikisi de yok.
export type PStatus = { out?: boolean; play?: { room: string; a: number; b: number; oppName?: string } }

/**
 * Her oyuncunun turnuva durumunu BRACKET'ten turetir (katilimci listesinde gostermek icin):
 *  - play: su an acik bir masada oynuyor -> a/b = kendi/rakip canli skoru (liveScores, bracket ile ayni kaynak).
 *  - out:  bir maci KAYBETMIS (veya cift-maglubiyet) VE acik (suren/bekleyen) hicbir maci yok -> elendi.
 * Tek taraf dolu (sonraki tur rakip bekliyor) = acik sayilir -> elenmedi. oynuyor, elendi'den onceliklidir.
 */
export function tournamentPlayerStatus(
  bracket: TMatch[][] | null | undefined,
  players: TPlayer[] | null | undefined,
  liveScores: Record<string, Record<string, number>>,
): Map<number, PStatus> {
  const result = new Map<number, PStatus>()
  const lost = new Set<number>()
  const open = new Set<number>()
  const play = new Map<number, { room: string; a: number; b: number; oppName?: string }>()
  for (const round of bracket ?? []) {
    for (const m of round) {
      const dbl = !!(m.double_loss || m.score?.double_loss)
      if (m.winner != null) {
        if (m.p1 && m.p1.id !== m.winner) lost.add(m.p1.id)
        if (m.p2 && m.p2.id !== m.winner) lost.add(m.p2.id)
      } else if (dbl) {
        if (m.p1) lost.add(m.p1.id)
        if (m.p2) lost.add(m.p2.id)
      } else if (m.p1 && m.p2) {
        open.add(m.p1.id)
        open.add(m.p2.id)
        if (m.room) {
          const ls = liveScores[m.room.toUpperCase()]
          const s1 = ls?.[String(m.p1.id)] ?? 0
          const s2 = ls?.[String(m.p2.id)] ?? 0
          play.set(m.p1.id, { room: m.room, a: s1, b: s2, oppName: m.p2.name })
          play.set(m.p2.id, { room: m.room, a: s2, b: s1, oppName: m.p1.name })
        }
      } else {
        if (m.p1) open.add(m.p1.id)
        if (m.p2) open.add(m.p2.id)
      }
    }
  }
  for (const p of players ?? []) {
    const pl = play.get(p.id)
    if (pl) result.set(p.id, { play: pl })
    else if (lost.has(p.id) && !open.has(p.id)) result.set(p.id, { out: true })
  }
  return result
}
