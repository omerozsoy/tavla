import { describe, it, expect } from 'vitest'
import { LESSONS, getQuestions } from './trainingCurriculum'
import { generateMoves, hasNoMove } from '../engine/moves'
import type { GameState } from '../engine/types'

// Her soru: 15 beyaz + 15 siyah (legal), beyazin sirasi, zar atilmis ve en az 2 farkli legal hamle.
function countCheckers(s: GameState, sign: 1 | -1): number {
  let n = s.bar[sign === 1 ? 'white' : 'black'] + s.off[sign === 1 ? 'white' : 'black']
  for (const v of s.points) if (Math.sign(v) === sign) n += Math.abs(v)
  return n
}

describe('Tavla Egitimi mufredati (10 seviye)', () => {
  it('10 seviye var, hepsi 10 soruluk', () => {
    expect(LESSONS.length).toBe(10)
    for (const l of LESSONS) expect(l.count).toBe(10)
  })

  it('her seviyenin uretilen 10 sorusu legal + beyaz sirasi + zarli + gercek karar (>=2 hamle)', () => {
    for (const l of LESSONS) {
      const qs = getQuestions(l.id)
      expect(qs.length).toBe(10)
      for (const q of qs) {
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
