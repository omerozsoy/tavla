import { describe, it, expect } from 'vitest'
import { BOT_PR_RANGES, PR_TARGET_LABELS, randomBotPr } from './botPr'

// Bot PR uretimi: her seviye icin uretilen deger o seviyenin araligi ICINDE olmali.
describe('randomBotPr — seviye araligi', () => {
  it('her difficulty (1..10) icin aralik icinde uretir', () => {
    for (let d = 1; d <= 10; d++) {
      const [lo, hi] = BOT_PR_RANGES[d - 1]
      for (let i = 0; i < 200; i++) {
        const v = randomBotPr(d)
        expect(v).toBeGreaterThanOrEqual(lo)
        expect(v).toBeLessThanOrEqual(hi)
      }
    }
  })

  it('aralik disi difficulty degerlerini uca kirpar (asla ~0.0 dondurmez, Beginner haric)', () => {
    // 0 ve negatif -> ilk seviye (Beginner 35–50); 99 -> son seviye (Neural AI 0–0.5)
    expect(randomBotPr(0)).toBeGreaterThanOrEqual(35)
    expect(randomBotPr(-5)).toBeGreaterThanOrEqual(35)
    expect(randomBotPr(99)).toBeLessThanOrEqual(0.5)
  })

  it('1 ondalik basamaga yuvarlanmis dondurur', () => {
    for (let i = 0; i < 50; i++) {
      const v = randomBotPr(5)
      expect(Math.round(v * 10) / 10).toBe(v)
    }
  })

  it('etiketler araliklardan turer ve MatchSetup sirasiyla ayni', () => {
    expect(PR_TARGET_LABELS).toEqual([
      '35–50', '25–35', '18–25', '12–18', '8–12',
      '5–8', '3–5', '1.5–3', '0.5–1.5', '0–0.5',
    ])
  })
})
