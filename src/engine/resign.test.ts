import { describe, it, expect } from 'vitest'
import {
  ResignationType,
  RESIGN_MULTIPLIER,
  calculateResignationPoints,
  resignMultiplier,
  isResignationType,
} from './resign'

describe('RESIGN — merkezi puan kuralı (kesin ve değişmez)', () => {
  // Kullanıcı spec test tablosu (Test 1..7)
  it('Test 1: cube=1 SINGLE -> 1', () => {
    expect(calculateResignationPoints(ResignationType.SINGLE, 1)).toBe(1)
  })
  it('Test 2: cube=1 GAMMON -> 2', () => {
    expect(calculateResignationPoints(ResignationType.GAMMON, 1)).toBe(2)
  })
  it('Test 3: cube=1 BACKGAMMON -> 3', () => {
    expect(calculateResignationPoints(ResignationType.BACKGAMMON, 1)).toBe(3)
  })
  it('Test 4: cube=2 SINGLE -> 2', () => {
    expect(calculateResignationPoints(ResignationType.SINGLE, 2)).toBe(2)
  })
  it('Test 5: cube=2 GAMMON -> 4', () => {
    expect(calculateResignationPoints(ResignationType.GAMMON, 2)).toBe(4)
  })
  it('Test 6: cube=2 BACKGAMMON -> 6', () => {
    expect(calculateResignationPoints(ResignationType.BACKGAMMON, 2)).toBe(6)
  })
  it('Test 7: cube=4 BACKGAMMON -> 12', () => {
    expect(calculateResignationPoints(ResignationType.BACKGAMMON, 4)).toBe(12)
  })

  it('çarpanlar SABİT: SINGLE=1, GAMMON=2, BACKGAMMON=3', () => {
    expect(resignMultiplier(ResignationType.SINGLE)).toBe(1)
    expect(resignMultiplier(ResignationType.GAMMON)).toBe(2)
    expect(resignMultiplier(ResignationType.BACKGAMMON)).toBe(3)
    expect(RESIGN_MULTIPLIER[ResignationType.SINGLE]).toBe(1)
    expect(RESIGN_MULTIPLIER[ResignationType.GAMMON]).toBe(2)
    expect(RESIGN_MULTIPLIER[ResignationType.BACKGAMMON]).toBe(3)
  })

  it('cube 8 tüm türler', () => {
    expect(calculateResignationPoints(ResignationType.SINGLE, 8)).toBe(8)
    expect(calculateResignationPoints(ResignationType.GAMMON, 8)).toBe(16)
    expect(calculateResignationPoints(ResignationType.BACKGAMMON, 8)).toBe(24)
  })

  it('geçersiz cube -> hata (sessiz yanlış puan YOK)', () => {
    expect(() => calculateResignationPoints(ResignationType.SINGLE, 0)).toThrow()
    expect(() => calculateResignationPoints(ResignationType.SINGLE, -1)).toThrow()
    expect(() => calculateResignationPoints(ResignationType.SINGLE, 1.5)).toThrow()
  })

  it('geçersiz tür -> hata', () => {
    // @ts-expect-error kasıtlı geçersiz
    expect(() => resignMultiplier('mega')).toThrow()
  })

  it('isResignationType tip koruması', () => {
    expect(isResignationType('single')).toBe(true)
    expect(isResignationType('gammon')).toBe(true)
    expect(isResignationType('backgammon')).toBe(true)
    expect(isResignationType('double')).toBe(false)
    expect(isResignationType(null)).toBe(false)
  })
})
