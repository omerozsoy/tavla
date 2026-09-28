import { describe, it, expect } from 'vitest'
import {
  DIVISIONS,
  MAIN_DIVISIONS,
  applyPrThresholds,
  applyRankThresholds,
  divisionOf,
  divisionOfPR,
  prThresholds,
  rankThresholds,
} from './badges'
import { rankOf } from './ranks'

// Rutbe esiklerinin CALISMA ZAMANI hidrasyonu (admin: Ayarlar > Rating Ayar).
// Kritik invaryant: BOZUK SIRALI ayar toptan reddedilir -> canli site varsayilanda kalir.
describe('rutbe esigi hidrasyonu', () => {
  it('gecerli rating esikleri uygulanir, RANKS getter ile senkron kalir', () => {
    expect(applyRankThresholds({ 'div.i2': 1550, 'div.i1': 1600 })).toBe(true)
    expect(divisionOf(1550).key).toBe('div.i2')
    expect(rankOf(1550).divKey).toBe('div.i2') // RANKS.min getter -> bayat degil
    expect(rankThresholds()['div.i2']).toBe(1550)
  })

  it('artan olmayan rating esigi TOPTAN reddedilir', () => {
    const before = rankThresholds()
    expect(applyRankThresholds({ 'div.i2': 9999 })).toBe(false) // i1'i gecer
    expect(rankThresholds()).toEqual(before)
  })

  it('MAIN_DIVISIONS aile taban kademesini izler', () => {
    applyRankThresholds({ 'div.a3': 1650 })
    expect(MAIN_DIVISIONS.find((m) => m.key === 'div.advanced')!.min).toBe(1650)
  })

  it('PR esikleri azalan olmali; rookie sonsuz kalir', () => {
    expect(applyPrThresholds({ 'div.novice': 45, 'div.beginner': 28 })).toBe(true)
    expect(divisionOfPR(28).key).toBe('div.beginner')
    expect(DIVISIONS[0].prMax).toBe(Infinity)
    expect(prThresholds()['div.rookie']).toBeUndefined() // JSON'a yazilmaz
  })

  it('azalan olmayan PR esigi TOPTAN reddedilir', () => {
    const before = prThresholds()
    expect(applyPrThresholds({ 'div.m1': 99 })).toBe(false)
    expect(prThresholds()).toEqual(before)
  })
})
