import { describe, it, expect } from 'vitest'
import { pickNext } from './QuizMarathon'
import { MARATHON_POOL, questionId } from './trainingCurriculum'

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
