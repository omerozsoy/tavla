import { describe, expect, it } from 'vitest'
import { cubeActionEquities, offerLoss, takeLoss } from './cubeEquity'

// Gammonsuz olasılık vektörü: p kazanma, 1−p kaybetme (gammon/backgammon yok).
const gl = (p: number): number[] => [p, 0, 0, 1 - p, 0, 0]

describe('cubeEquity — para oyunu doubling modeli (XG-style yaklaşım)', () => {
  it('%50: teklif obvious no-double (küp gündemde değil) -> paydaya girmez', () => {
    const r = offerLoss(gl(0.5), 'no-double')
    expect(r.bestAction).toBe('no-double')
    expect(r.normalizedEquityLoss).toBeCloseTo(0, 6)
    expect(r.countsForPR).toBe(false) // bariz VE doğru -> PR paydasını sulandırmaz
  })

  it('%78: en iyi DOUBLE; no-double kaçırmak equity kaybı (sayılır)', () => {
    const r = offerLoss(gl(0.78), 'no-double')
    expect(r.bestAction).toBe('double')
    expect(r.normalizedEquityLoss).toBeGreaterThan(0.1)
    expect(r.countsForPR).toBe(true)
    // Doğru double -> kayıp 0
    expect(offerLoss(gl(0.78), 'double').normalizedEquityLoss).toBeCloseTo(0, 6)
  })

  it('%90: en iyi DOUBLE (rakip pas); double doğru', () => {
    const r = offerLoss(gl(0.9), 'double')
    expect(r.bestAction).toBe('double')
    expect(r.normalizedEquityLoss).toBeCloseTo(0, 6)
  })

  it('TAKE kararı: %30 (take point ~%22 üstü) -> TAKE en iyi', () => {
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

  it('take point (~%22) civarı KAPALI karardır -> paydaya GİRER', () => {
    const r = takeLoss(gl(0.25), 'take')
    expect(r.countsForPR).toBe(true) // beceri gerektiren karar
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

// ---- REGRESYON: küp sahipliğinin değeri (eski model bunu SIFIR sayıyordu) ----
// Eski modelde ownedFrac ≡ nonOwnerFrac idi -> "katla" %43'ten itibaren en iyi görünüyordu;
// çok katlayan oyuncunun küp hatası hep 0 çıkıyor, sonuç ekranında Küp PR 0.00 oluyordu.
describe('cubeEquity — katlama/nakit/take noktaları (referans değerler)', () => {
  it('nakit noktası %75 (gammonsuz simetrik)', () => {
    expect(cubeActionEquities(gl(0.6)).cashPoint).toBeCloseTo(0.75, 3)
  })

  it('katlama noktası ~%70: altında NO-DOUBLE, üstünde DOUBLE', () => {
    expect(offerLoss(gl(0.66), 'no-double').bestAction).toBe('no-double')
    expect(offerLoss(gl(0.74), 'no-double').bestAction).toBe('double')
  })

  it('ERKEN KATLAMA GERÇEK HATADIR: %55 ve %50 katlama cezalanır ve paydaya girer', () => {
    const r55 = offerLoss(gl(0.55), 'double')
    expect(r55.bestAction).toBe('no-double')
    expect(r55.normalizedEquityLoss).toBeGreaterThan(0.2)
    expect(r55.countsForPR).toBe(true) // bariz olsa da HATA -> bedava değil
    expect(offerLoss(gl(0.5), 'double').normalizedEquityLoss).toBeGreaterThan(0.3)
  })

  it('canlı küp take point ~%21-22 (ölü küp %25 değil)', () => {
    expect(takeLoss(gl(0.2), 'take').bestAction).toBe('pass')
    expect(takeLoss(gl(0.23), 'take').bestAction).toBe('take')
  })

  it('bariz + doğru TAKE (%32) paydaya girmez; hatalı pas girer', () => {
    expect(takeLoss(gl(0.32), 'take').countsForPR).toBe(false)
    expect(takeLoss(gl(0.32), 'pass').countsForPR).toBe(true)
  })

  it('küp sahipliğinin değeri > 0: take equity, aynı p için no-double equity ürününden ayrışır', () => {
    // %50'de: küpü ALAN (sahiplik onda) 2× küpte pozitif; TEKLİF eden ise sahipliği verdiği
    // için kaybeder -> double equity, no-double'ın ALTINDA kalmalı.
    const e = cubeActionEquities(gl(0.5))
    expect(e.double).toBeLessThan(e.noDouble)
  })
})
