import { describe, expect, it } from 'vitest'
import { chiSquareUniform, rollFaces, summarize } from './diceStats'

describe('diceStats', () => {
  it('chiSquareUniform: mukemmel uniform -> chi2 ~ 0, p ~ 1', () => {
    const { chi2, df, pValue } = chiSquareUniform([1000, 1000, 1000, 1000, 1000, 1000])
    expect(chi2).toBeCloseTo(0, 6)
    expect(df).toBe(5)
    expect(pValue).toBeGreaterThan(0.99)
  })

  it('chiSquareUniform: asiri carpik -> buyuk chi2, kucuk p', () => {
    const { chi2, pValue } = chiSquareUniform([6000, 0, 0, 0, 0, 0])
    expect(chi2).toBeGreaterThan(1000)
    expect(pValue).toBeLessThan(1e-6)
  })

  it('chiSquareUniform: bilinen deger (NIST) dogrulugu', () => {
    // gozlenen [16,18,16,14,12,12], toplam=88, beklenen ~14.667
    // chi2 = Σ(o-e)^2/e ≈ 2.0; df=5 -> p ≈ 0.849
    const { chi2, pValue } = chiSquareUniform([16, 18, 16, 14, 12, 12])
    expect(chi2).toBeCloseTo(2.0, 1)
    expect(pValue).toBeGreaterThan(0.8)
    expect(pValue).toBeLessThan(0.9)
  })

  it('summarize: yuzde/ortalama/most/least tutarli', () => {
    const r = summarize([100, 200, 300, 400, 500, 600])
    expect(r.total).toBe(2100)
    expect(r.mostFace).toBe(6)
    expect(r.leastFace).toBe(1)
    expect(r.percentages[5]).toBeCloseTo((600 / 2100) * 100, 6)
    expect(r.expectedPct).toBeCloseTo(16.6667, 3)
  })

  it('rollFaces: GERCEK secureDie ile toplam dogru + kaba uniform', () => {
    const counts = rollFaces(12000)
    expect(counts.reduce((a, b) => a + b, 0)).toBe(12000)
    const exp = 2000
    for (const c of counts) {
      expect(c).toBeGreaterThan(exp * 0.8)
      expect(c).toBeLessThan(exp * 1.2)
    }
  })
})
