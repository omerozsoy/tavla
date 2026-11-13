import { describe, it, expect } from 'vitest'
import { LESSONS, getQuestions } from './trainingCurriculum'
import { generateMoves, hasNoMove, boardKey } from '../engine/moves'
import type { GameState } from '../engine/types'

// Her soru: 15 beyaz + 15 siyah (legal), beyazin sirasi. Taş-hamlesi sorularinda ayrica zar + >=2 karar.
function countCheckers(s: GameState, sign: 1 | -1): number {
  let n = s.bar[sign === 1 ? 'white' : 'black'] + s.off[sign === 1 ? 'white' : 'black']
  for (const v of s.points) if (Math.sign(v) === sign) n += Math.abs(v)
  return n
}

describe('Tavla Egitimi mufredati', () => {
  it('12 ders (10 zorluk + Cube + Gercek Pozisyonlar)', () => {
    expect(LESSONS.length).toBe(12)
    expect(LESSONS[LESSONS.length - 1].id).toBe('real')
    for (const l of LESSONS) {
      if (l.id === 'real') expect(l.count).toBeGreaterThan(10)
      else expect(l.count).toBe(10)
    }
  })

  it('her dersin sorulari legal; tas sorularinda zar + >=2 karar (real haric), kup sorularinda zar yok', () => {
    for (const l of LESSONS) {
      const qs = getQuestions(l.id)
      if (l.id === 'real') expect(qs.length).toBeGreaterThan(10)
      else expect(qs.length).toBe(10)
      for (const q of qs) {
        const s = q.state
        expect(countCheckers(s, 1)).toBe(15)
        expect(countCheckers(s, -1)).toBe(15)
        expect(s.turn).toBe('white')
        if (q.cube) {
          expect(s.dice.length).toBe(0) // kup karari: zar atilmaz
          continue
        }
        expect(s.dice.length).toBeGreaterThan(0)
        // real pozisyonlarda forced/tek-hamle olabilir; uretilmis seviyelerde >=2 karar sart.
        if (l.id !== 'real') {
          const moves = generateMoves(s)
          expect(hasNoMove(moves)).toBe(false)
          expect(new Set(moves.map((m) => m.resultKey)).size).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  it('bir seviyede ayni soru (board + zar) iki kez gelmez', () => {
    for (const l of LESSONS) {
      const qs = getQuestions(l.id)
      const keys = qs.map((q) => boardKey(q.state) + '|' + [...q.state.dice].sort().join('-'))
      expect(new Set(keys).size, l.id).toBe(keys.length)
    }
  })
})
