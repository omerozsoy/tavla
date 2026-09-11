import { describe, expect, it } from 'vitest'
import {
  XG_OBVIOUS_CHECKER_EQUITY_SPREAD,
  checkerDecision,
  cubeDecision,
  onePointFactor,
  pooledPR,
  prMatchEquity,
  prValue,
  summarize,
  type PrDecision,
} from './pr'

// XG spec §24 test vakaları (A–F) + ek kurallar.
describe('XG-style PR — spec test cases', () => {
  it('TEST A — kusursuz oyun: 4 karar, hepsi 0 loss -> PR 0', () => {
    const d = Array.from({ length: 4 }, () => checkerDecision(0.2, 0.2, -0.2, 5, 3))
    expect(summarize(d).overall.pr).toBe(0)
    expect(summarize(d).overall.decisions).toBe(4)
  })

  it('TEST B — losses 0.02,0,0.04,0 / 4 karar -> PR 7.5', () => {
    const d = [
      checkerDecision(0.02, 0.0, -0.2, 5, 3),
      checkerDecision(0.2, 0.2, -0.2, 5, 3),
      checkerDecision(0.04, 0.0, -0.2, 5, 3),
      checkerDecision(0.2, 0.2, -0.2, 5, 3),
    ]
    const s = summarize(d)
    expect(s.overall.decisions).toBe(4)
    expect(s.overall.equityLost).toBeCloseTo(0.06, 10)
    expect(s.overall.pr).toBeCloseTo(7.5, 10)
  })

  it('TEST C — zorunlu hamle paydaya girmez', () => {
    const d = [
      checkerDecision(0.1, 0.05, -0.1, 1, 3), // 1 yasal hamle -> sayılmaz
      checkerDecision(0.1, 0.1, -0.1, 5, 3),
      checkerDecision(0.1, 0.1, -0.1, 5, 3),
      checkerDecision(0.1, 0.1, -0.1, 5, 3),
    ]
    expect(summarize(d).overall.decisions).toBe(3) // zorunlu hariç
  })

  it('TEST D — anlamlı kusursuz karar paydaya GİRER', () => {
    const d = [checkerDecision(0.3, 0.3, -0.1, 5, 3)] // loss 0 ama anlamlı
    const s = summarize(d)
    expect(s.overall.decisions).toBe(1)
    expect(s.overall.pr).toBe(0)
  })

  it('TEST E — 1-puanlık maç: ×1.5 KALDIRILDI, prAdjusted = raw (XG/gnubg ile tutarlı)', () => {
    // 2026-09-11: eski ×1.5 faktörü XG'de/gnubg yolunda yoktu ve 1-puanlık PR'ı %50 şişiriyordu.
    const d = checkerDecision(0.04, 0.0, -0.2, 5, 1)
    expect(d.normalizedEquityLoss).toBeCloseTo(0.04, 10)
    expect(d.prAdjustedEquityLoss).toBeCloseTo(0.04, 10) // faktör yok -> raw ile aynı
    expect(onePointFactor(1)).toBe(1)
    expect(onePointFactor(3)).toBe(1)
  })

  it('MONEY oyunu: target=1 (faktör nötr; para oyununda da 1)', () => {
    const d = checkerDecision(0.04, 0.0, -0.2, 5, 1, true) // isMoney=true
    expect(d.prAdjustedEquityLoss).toBeCloseTo(0.04, 10)
    expect(onePointFactor(1, true)).toBe(1)
  })

  it('prMatchEquity — 1-puanlık maçta win-prob (gammon HARİÇ), çok-puanlıkta money equity', () => {
    // probs = [wn, wg, wb, ln, lg, lb]. Gammon şansı olan bir konum:
    const probs = [0.5, 0.2, 0.05, 0.15, 0.08, 0.02] // P(kazan)=0.75, P(kaybet)=0.25
    const money = probs[0] - probs[3] + 2 * (probs[1] - probs[4]) + 3 * (probs[2] - probs[5]) // ~0.68
    // 1-puanlık: gammon SAYILMAZ -> Σwin − Σlose = 0.75 − 0.25 = 0.50 (2p−1)
    expect(prMatchEquity(probs, money, 1, false)).toBeCloseTo(0.5, 10)
    // Çok-puanlık maç: money equity (gammon dahil) korunur
    expect(prMatchEquity(probs, money, 3, false)).toBeCloseTo(money, 10)
    // Money oyunu: 1 hedef olsa bile money equity (para oyununda gammon sayılır)
    expect(prMatchEquity(probs, money, 1, true)).toBeCloseTo(money, 10)
    // probs yoksa money'ye düş
    expect(prMatchEquity(undefined, money, 1, false)).toBeCloseTo(money, 10)
  })

  it('TEST F — agregasyon: (0.1+1.0)/(10+100)×500 = 5.0', () => {
    expect(pooledPR(0.1 + 1.0, 10 + 100)).toBeCloseTo(5.0, 10)
  })

  it('§13 — havuzlama ≠ maç-PR ortalaması (10 karar PR2 + 100 karar PR10)', () => {
    // matchA: 10 karar, PR 2 -> loss 0.04; matchB: 100 karar, PR 10 -> loss 2.0
    const lossA = (2 / 500) * 10 // 0.04
    const lossB = (10 / 500) * 100 // 2.0
    const pooled = pooledPR(lossA + lossB, 110)! // (2.04/110)×500 = 9.27...
    const naiveAvg = (prValue(lossA, 10)! + prValue(lossB, 100)!) / 2 // (2+10)/2 = 6
    expect(pooled).toBeCloseTo(9.2727, 3)
    expect(naiveAvg).toBe(6)
    expect(pooled).not.toBeCloseTo(naiveAvg, 1) // 100-kararlık maç çok daha ağır basmalı
  })
})

describe('XG-style PR — obvious + cube + breakdown', () => {
  it('OBVIOUS checker (spread < 0.001) paydaya girmez', () => {
    const spread = XG_OBVIOUS_CHECKER_EQUITY_SPREAD / 2
    const d = [checkerDecision(0.5, 0.5 - spread, 0.5 - spread, 5, 3)]
    expect(d[0].countsForPR).toBe(false)
    expect(summarize(d).overall.decisions).toBe(0)
    expect(summarize(d).overall.pr).toBeNull() // karar yoksa null, 0 değil (§10)
  })

  it('cube kararı checker ile HAVUZLANIR; kırılım ayrı', () => {
    // §18 örneği: checker 0.284/48, cube 0.061/4, overall 0.345/52
    const decisions: PrDecision[] = []
    // 48 checker kararı, toplam loss 0.284 (biri 0.284, kalanı 0)
    decisions.push(checkerDecision(0.284, 0.0, -0.5, 5, 3))
    for (let i = 0; i < 47; i++) decisions.push(checkerDecision(0.3, 0.3, -0.5, 5, 3))
    // 4 cube kararı, toplam 0.061
    decisions.push(cubeDecision(0.061, 0.0, true, 3))
    for (let i = 0; i < 3; i++) decisions.push(cubeDecision(0.0, 0.0, true, 3))
    const s = summarize(decisions)
    expect(s.checker.decisions).toBe(48)
    expect(s.checker.pr).toBeCloseTo(2.9583, 3)
    expect(s.cube.decisions).toBe(4)
    expect(s.cube.pr).toBeCloseTo(7.625, 3)
    expect(s.overall.decisions).toBe(52)
    expect(s.overall.pr).toBeCloseTo(3.3173, 3)
  })

  it('obvious cube (countsForPR=false) paydaya girmez', () => {
    const d = [cubeDecision(0.0, 0.0, false, 3)]
    expect(summarize(d).cube.decisions).toBe(0)
  })

  it('prValue: 0 karar -> null (asla 0 döndürme)', () => {
    expect(prValue(0, 0)).toBeNull()
    expect(prValue(0.09, 5)).toBeCloseTo(9.0, 10) // §21
  })

  it('loss negatife düşmez (FP gürültüsü)', () => {
    const d = checkerDecision(0.2, 0.25, 0.1, 5, 3) // seçilen > best (gürültü)
    expect(d.normalizedEquityLoss).toBe(0)
  })
})
