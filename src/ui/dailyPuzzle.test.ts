import { describe, it, expect } from 'vitest'
import { dailyQuestion, DAILY_POOL_SIZE } from './trainingCurriculum'

const DAY = 86_400_000

describe('dailyQuestion', () => {
  it('has a non-empty pool', () => {
    expect(DAILY_POOL_SIZE).toBeGreaterThan(0)
  })

  it('is stable within a calendar day but advances the next day', () => {
    const t = 19675 * DAY // gün sınırına HİZALI bir an (t..t+DAY-1 tek gün)
    expect(dailyQuestion(t)).toBe(dailyQuestion(t + DAY - 1)) // aynı gün = aynı pozisyon
    expect(dailyQuestion(t)).not.toBe(dailyQuestion(t + DAY)) // ertesi gün = sıradaki (indeks ilerler)
  })

  it('wraps around the pool deterministically', () => {
    expect(dailyQuestion(0)).toBe(dailyQuestion(DAY * DAILY_POOL_SIZE)) // tam tur = aynı indeks
  })

  it('always returns a playable position (state with checkers)', () => {
    const q = dailyQuestion(19675 * DAY)
    expect(q.state).toBeTruthy()
    expect(q.state.points.length).toBe(24)
  })
})
