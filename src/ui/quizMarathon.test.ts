import { describe, it, expect } from 'vitest'
import { pickNext, streakMultiplier } from './QuizMarathon'
import { MARATHON_POOL, questionId } from './trainingCurriculum'

describe('Soru Maratonu seri bonusu', () => {
  it('her 3. doğru cevap 2 kat, diğerleri 1 kat', () => {
    const mults = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(streakMultiplier)
    expect(mults).toEqual([1, 1, 2, 1, 1, 2, 1, 1, 2])
  })

  it('0 doğru çarpan vermez (başlangıç)', () => {
    expect(streakMultiplier(0)).toBe(1)
  })
})

describe('Soru Maratonu pickNext', () => {
  it('seen boşsa bir soru döner', () => {
    const q = pickNext(MARATHON_POOL, new Set())
    expect(q).not.toBeNull()
  })

  it('seen içindeki soruyu ASLA döndürmez', () => {
    const first = questionId(MARATHON_POOL[0])
    const seen = new Set([first])
    for (let i = 0; i < 50; i++) {
      const q = pickNext(MARATHON_POOL, seen)
      expect(q && questionId(q)).not.toBe(first)
    }
  })

  it('havuz tükenince null döner (tur sonu)', () => {
    const all = new Set(MARATHON_POOL.map(questionId))
    expect(pickNext(MARATHON_POOL, all)).toBeNull()
  })
})
