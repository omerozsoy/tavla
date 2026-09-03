import { describe, it, expect } from 'vitest'
import { rankOf, RANKS } from './ranks'

// Rütbe eşikleri (badges.ts DIVISIONS) — sınır (boundary) testleri.
// Yeni eşikler: rating'in ulaştığı en yüksek kademeyi belirler.
describe('rankOf — sınır eşikleri', () => {
  const cases: Array<[number, string]> = [
    // [rating, beklenen kademe etiketi (familyKey[+code])]
    [1199, 'div.rookie'],           // Rookie üst sınır
    [1200, 'div.novice'],           // Novice başlar
    [1399, 'div.novice'],           // Novice üst sınır
    [1400, 'div.beginner'],         // Beginner başlar
    [1449, 'div.beginner'],         // Beginner üst sınır
    [1450, 'div.developing'],       // Developing başlar
    [1499, 'div.developing'],       // Developing üst sınır
    [1500, 'div.intermediate|I3'],  // Intermediate I3 başlar
    [1599, 'div.intermediate|I3'],  // Intermediate I3 üst sınır
    [1600, 'div.intermediate|I2'],  // Intermediate I2 başlar
    [2399, 'div.superGrandmaster|S3'], // Super Grandmaster S3 üst sınır
    [2400, 'div.superGrandmaster|S2'], // Super Grandmaster S2 başlar
    [2499, 'div.superGrandmaster|S2'], // Super Grandmaster S2 üst sınır
    [2500, 'div.superGrandmaster|S1'], // Super Grandmaster S1 başlar
  ]
  for (const [rating, expected] of cases) {
    it(`${rating} → ${expected}`, () => {
      const r = rankOf(rating)
      const got = r.code ? `${r.familyKey}|${r.code}` : r.familyKey
      expect(got).toBe(expected)
    })
  }

  it('2500+ daima zirvede (Super Grandmaster S1) kalır', () => {
    for (const rating of [2500, 2600, 3000, 4000]) {
      const r = rankOf(rating)
      expect(r.apex).toBe(true)
      expect(r.code).toBe('S1')
    }
  })

  it('eşikler kesinlikle artan (monoton) sıralı', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].min).toBeGreaterThan(RANKS[i - 1].min)
    }
  })
})
