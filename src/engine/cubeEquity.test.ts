import { describe, expect, it } from 'vitest'
import { cubeActionEquities, offerLoss, takeLoss } from './cubeEquity'

// Gammonsuz olasılık vektörü: p kazanma, 1−p kaybetme (gammon/backgammon yok).
const gl = (p: number): number[] => [p, 0, 0, 1 - p, 0, 0]

describe('cubeEquity — para oyunu doubling modeli (XG-style yaklaşım)', () => {
  it('%50: teklif obvious no-double (aksiyonlar ~eşit) -> sayılmaz', () => {
    const r = offerLoss(gl(0.5), 'no-double')
    expect(r.bestAction).toBe('no-double')
    expect(r.normalizedEquityLoss).toBeCloseTo(0, 6)
    expect(r.countsForPR).toBe(false) // obvious
  })

  it('%70: en iyi DOUBLE; no-double kaçırmak equity kaybı (sayılır)', () => {
    const r = offerLoss(gl(0.7), 'no-double')
    expect(r.bestAction).toBe('double')
    expect(r.normalizedEquityLoss).toBeGreaterThan(0.1)
    expect(r.countsForPR).toBe(true)
    // Doğru double -> kayıp 0
    expect(offerLoss(gl(0.7), 'double').normalizedEquityLoss).toBeCloseTo(0, 6)
  })

  it('%90: en iyi DOUBLE (rakip pas); double doğru', () => {
    const r = offerLoss(gl(0.9), 'double')
    expect(r.bestAction).toBe('double')
    expect(r.normalizedEquityLoss).toBeCloseTo(0, 6)
  })

  it('TAKE kararı: %30 (take point ~%25 üstü) -> TAKE en iyi', () => {
    const r = takeLoss(gl(0.3), 'pass')
    expect(r.bestAction).toBe('take')
    expect(r.normalizedEquityLoss).toBeGreaterThan(0) // pas etmek hata
    expect(takeLoss(gl(0.3), 'take').normalizedEquityLoss).toBeCloseTo(0, 6)
  })

  it('TAKE kararı: %15 (take point altı) -> PASS en iyi; take büyük hata', () => {
    const r = takeLoss(gl(0.15), 'take')
    expect(r.bestAction).toBe('pass')
    expect(r.normalizedEquityLoss).toBeGreaterThan(0.2)
  })

  it('take point (~%25) civarı: take≈pass -> obvious (sayılmaz)', () => {
    const r = takeLoss(gl(0.25), 'take')
    expect(r.countsForPR).toBe(false)
    expect(r.normalizedEquityLoss).toBeCloseTo(0, 2)
  })

  it('kazanma% arttıkça mover no-double equity monoton artar', () => {
    const e = [0.3, 0.5, 0.7, 0.9].map((p) => cubeActionEquities(gl(p)).noDouble)
    for (let i = 1; i < e.length; i++) expect(e[i]).toBeGreaterThan(e[i - 1])
  })

  it('kayıp asla negatif değil (FP)', () => {
    expect(offerLoss(gl(0.7), 'double').normalizedEquityLoss).toBeGreaterThanOrEqual(0)
    expect(takeLoss(gl(0.4), 'take').normalizedEquityLoss).toBeGreaterThanOrEqual(0)
  })
})
