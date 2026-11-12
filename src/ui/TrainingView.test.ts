import { describe, it, expect } from 'vitest'
import { LESSONS } from './trainingCurriculum'
import { generateMoves, hasNoMove } from '../engine/moves'
import type { GameState } from '../engine/types'

// Her soru: 15 beyaz + 15 siyah (legal), beyazin sirasi, zar atilmis ve en az 2 farkli legal hamle.
function countCheckers(s: GameState, sign: 1 | -1): number {
  let n = s.bar[sign === 1 ? 'white' : 'black'] + s.off[sign === 1 ? 'white' : 'black']
  for (const v of s.points) if (Math.sign(v) === sign) n += Math.abs(v)
  return n
}

describe('Tavla Egitimi mufredati (3 seviye)', () => {
  it('her seviyede 10 soru var', () => {
    expect(LESSONS.map((l) => l.id)).toEqual(['easy', 'medium', 'hard'])
    for (const l of LESSONS) expect(l.questions.length).toBe(10)
  })

  it('her soru legal + beyaz sirasi + zarli + gercek karar (>=2 hamle)', () => {
    for (const l of LESSONS) {
      for (const q of l.questions) {
        const s = q.state
        expect(countCheckers(s, 1)).toBe(15)
        expect(countCheckers(s, -1)).toBe(15)
        expect(s.turn).toBe('white')
        expect(s.dice.length).toBeGreaterThan(0)
        const moves = generateMoves(s)
        expect(hasNoMove(moves)).toBe(false)
        expect(new Set(moves.map((m) => m.resultKey)).size).toBeGreaterThanOrEqual(2)
      }
    }
  })
})
