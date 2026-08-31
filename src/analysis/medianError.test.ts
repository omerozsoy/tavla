import { describe, it, expect } from 'vitest'
import { calculateMedianError, formatMedianError, type ErrorDecision } from './medianError'

// Kısayol: doğrudan error değerlerinden karar listesi kur.
const errs = (xs: number[]): ErrorDecision[] => xs.map((error) => ({ error }))
// Ortalama (median ile kıyas için — kodda YOK, sadece testte referans).
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

describe('calculateMedianError', () => {
  it('tek sayıda error → ortadaki değer', () => {
    // [0.015,0.002,0.009,0.004,0.006] → sıralı [0.002,0.004,0.006,0.009,0.015] → 0.006
    const r = calculateMedianError(errs([0.015, 0.002, 0.009, 0.004, 0.006]))
    expect(r.medianError).toBeCloseTo(0.006, 12)
    expect(r.analyzedDecisions).toBe(5)
    expect(r.excludedForcedMoves).toBe(0)
  })

  it('çift sayıda error → ortadaki iki değerin ortalaması', () => {
    // [0.002,0.004,0.006,0.008,0.015,0.030] → (0.006+0.008)/2 = 0.007
    const r = calculateMedianError(errs([0.002, 0.004, 0.006, 0.008, 0.015, 0.03]))
    expect(r.medianError).toBeCloseTo(0.007, 12)
    expect(r.analyzedDecisions).toBe(6)
  })

  it('tek karar → o kararın hatası', () => {
    const r = calculateMedianError(errs([0.042]))
    expect(r.medianError).toBe(0.042)
    expect(r.analyzedDecisions).toBe(1)
  })

  it('tüm error değerleri 0 → medyan 0', () => {
    const r = calculateMedianError(errs([0, 0, 0, 0]))
    expect(r.medianError).toBe(0)
    expect(r.analyzedDecisions).toBe(4)
  })

  it('forced move içeren veri → hariç tutulur ve sayılır', () => {
    const decisions: ErrorDecision[] = [
      { error: 0.002 },
      { error: 0.5, forced: true }, // zorunlu → medyana girmez
      { error: 0.004 },
      { error: 0.9, forced: true },
      { error: 0.006 },
    ]
    const r = calculateMedianError(decisions)
    // Yalnız [0.002,0.004,0.006] → medyan 0.004; forced 2 hariç
    expect(r.medianError).toBeCloseTo(0.004, 12)
    expect(r.analyzedDecisions).toBe(3)
    expect(r.excludedForcedMoves).toBe(2)
  })

  it('null/invalid analiz → atlanır', () => {
    const decisions = [
      { error: 0.01 },
      null,
      { bestEquity: 0.4 }, // playedEquity yok → geçersiz
      { playedEquity: 0.2 }, // bestEquity yok → geçersiz
      {}, // hiçbir alan → geçersiz
      { error: 0.03 },
    ] as unknown as ErrorDecision[]
    const r = calculateMedianError(decisions)
    // Yalnız [0.01,0.03] → medyan 0.02
    expect(r.medianError).toBeCloseTo(0.02, 12)
    expect(r.analyzedDecisions).toBe(2)
    expect(r.excludedForcedMoves).toBe(0)
  })

  it('aşırı büyük blunder → medyanı bozmaz (average bozar)', () => {
    const xs = [0.001, 0.002, 0.003, 0.004, 0.1]
    const r = calculateMedianError(errs(xs))
    expect(r.medianError).toBeCloseTo(0.003, 12) // medyan sağlam
    expect(mean(xs)).toBeCloseTo(0.022, 12) // average blunder'dan şişer (kıyas)
    expect(r.medianError!).toBeLessThan(mean(xs))
  })

  it('hiç geçerli karar yok → null', () => {
    expect(calculateMedianError([]).medianError).toBeNull()
    expect(calculateMedianError(null).medianError).toBeNull()
    expect(calculateMedianError(undefined).medianError).toBeNull()
    const onlyForced = calculateMedianError([{ error: 0.1, forced: true }])
    expect(onlyForced.medianError).toBeNull()
    expect(onlyForced.analyzedDecisions).toBe(0)
    expect(onlyForced.excludedForcedMoves).toBe(1)
  })

  // --- Ek sağlamlık ---
  it('bestEquity - playedEquity ile hesaplar; negatif → 0', () => {
    const r = calculateMedianError([
      { bestEquity: 0.5, playedEquity: 0.48 }, // 0.02
      { bestEquity: 0.3, playedEquity: 0.35 }, // negatif → 0
      { bestEquity: 0.4, playedEquity: 0.36 }, // 0.04
    ])
    // errors [0, 0.02, 0.04] → medyan 0.02
    expect(r.medianError).toBeCloseTo(0.02, 12)
    expect(r.analyzedDecisions).toBe(3)
  })

  it('NaN/Infinity hata değerleri reddedilir', () => {
    const r = calculateMedianError([
      { error: Number.NaN },
      { error: Number.POSITIVE_INFINITY },
      { error: 0.01 },
      { bestEquity: Number.POSITIVE_INFINITY, playedEquity: 0 },
      { error: 0.03 },
    ])
    expect(r.medianError).toBeCloseTo(0.02, 12)
    expect(r.analyzedDecisions).toBe(2)
  })

  it('cube kararları checker medyanına katılmaz', () => {
    const r = calculateMedianError([
      { error: 0.01, type: 'checker' },
      { error: 0.9, type: 'cube' }, // farklı ölçek → hariç
      { error: 0.03, type: 'checker' },
    ])
    expect(r.medianError).toBeCloseTo(0.02, 12)
    expect(r.analyzedDecisions).toBe(2)
  })

  it('full precision saklanır; formatMedianError 3 ondalık gösterir', () => {
    const r = calculateMedianError(errs([0.0061234, 0.0061234]))
    expect(r.medianError).toBeCloseTo(0.0061234, 12) // yuvarlanmadan
    expect(formatMedianError(r.medianError)).toBe('0.006')
    expect(formatMedianError(null)).toBe('—')
  })
})
