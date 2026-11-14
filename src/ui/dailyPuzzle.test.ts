import { describe, it, expect } from 'vitest'
import { dailyQuestion, dailyDayIndex, DAILY_POOL_SIZE } from './trainingCurriculum'

const DAY = 86_400_000

describe('dailyQuestion', () => {
  it('has a non-empty pool', () => {
    expect(DAILY_POOL_SIZE).toBeGreaterThan(0)
  })

  it('is stable within a calendar day but advances the next day', () => {
    const t = 19675 * DAY - 3 * 60 * 60 * 1000 // TR yerel gece yarısına HİZALI (GMT+3)
    expect(dailyQuestion(t)).toBe(dailyQuestion(t + DAY - 1)) // aynı gün = aynı pozisyon
    expect(dailyQuestion(t)).not.toBe(dailyQuestion(t + DAY)) // ertesi gün = sıradaki (indeks ilerler)
  })

  it('rolls the day at local TR midnight (00:00 GMT+3), not UTC midnight', () => {
    // 2026-11-15 00:00:00 +03:00 == 2026-11-14T21:00:00Z
    const localMidnight = Date.UTC(2026, 10, 14, 21, 0, 0)
    expect(dailyDayIndex(localMidnight - 1)).toBe(dailyDayIndex(localMidnight) - 1) // 1ms önce = dünkü gün
    expect(dailyDayIndex(localMidnight)).toBe(dailyDayIndex(localMidnight + DAY - 1)) // gün boyu sabit
    expect(dailyDayIndex(localMidnight + DAY)).toBe(dailyDayIndex(localMidnight) + 1) // ertesi gün +1
  })

  it('wraps around the pool deterministically', () => {
    expect(dailyQuestion(0)).toBe(dailyQuestion(DAY * DAILY_POOL_SIZE)) // tam tur = aynı indeks
  })

  it('always returns a playable position (state with checkers)', () => {
    const q = dailyQuestion(1_700_000_000_000)
    expect(q.state).toBeTruthy()
    expect(q.state.points.length).toBe(24)
  })

  // Çift zar display'i (TrainingView faces) dice.length===4 dalına dayanır: bir double ASLA 2 zarla
  // kodlanmamalı (yoksa 4 yerine 2 hamle + "bozuk" görünüm). Tüm havuzu gez.
  it('encodes every double as 4 dice across the whole pool', () => {
    for (let i = 0; i < DAILY_POOL_SIZE; i++) {
      const { dice } = dailyQuestion(i * DAY).state
      if (dice.length >= 2 && dice.every((d) => d === dice[0])) {
        expect(dice.length).toBe(4)
      }
    }
  })
})
