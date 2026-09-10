import { describe, it, expect } from 'vitest'
import { initialState } from './board'
import type { GameState } from './types'
import {
  ResignationType,
  RESIGN_MULTIPLIER,
  calculateResignationPoints,
  resignMultiplier,
  isResignationType,
  resignationValue,
  resignationTypeForValue,
} from './resign'

function st(o: Partial<GameState>): GameState {
  return {
    points: new Array(24).fill(0),
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 },
    turn: 'white',
    dice: [],
    diceUsed: [],
    ...o,
  }
}

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

  // ---- SİSTEM-belirlenen değer (resignationValue) ----
  it('AÇILIŞ konumunda pes = SINGLE (hayalet backgammon YOK)', () => {
    // Açılışta beyazın geri taşları siyahın evinde ama siyah bear-off DEĞİL -> 1.
    expect(resignationValue(initialState(), 'white')).toBe(1)
  })

  it('kazanan bear-off + kaybeden 0 toplamış, geri taş yok -> GAMMON (2)', () => {
    const p = new Array(24).fill(0)
    p[7] = 15 // beyaz (kaybeden) hepsi dış saha (siyah evi 18-23 DIŞI)
    for (let i = 18; i < 24; i++) p[i] = -2 // siyah (kazanan) evinde 12 taş
    const s = st({ points: p, off: { white: 0, black: 3 } }) // siyah bear-off başladı
    expect(resignationValue(s, 'white')).toBe(2)
  })

  it('kazanan bear-off + kaybedenin taşı kazananın evinde -> BACKGAMMON (3)', () => {
    const p = new Array(24).fill(0)
    p[11] = 14
    p[20] = 1 // beyaz taş siyahın evinde (18-23) -> backgammon
    p[18] = -3
    p[19] = -3
    p[21] = -3
    p[22] = -3 // siyah 12 taş (20'ye DOKUNMA -> beyaz taşı ezme) + off 3 = 15
    const s = st({ points: p, off: { white: 0, black: 3 } })
    expect(resignationValue(s, 'white')).toBe(3)
  })

  it('kaybeden 1 taş topladıysa -> SINGLE (1)', () => {
    const p = new Array(24).fill(0)
    p[3] = 14
    for (let i = 18; i < 24; i++) p[i] = -2
    const s = st({ points: p, off: { white: 1, black: 3 } })
    expect(resignationValue(s, 'white')).toBe(1)
  })

  it('GUARD: kazanan bear-off DEĞİL + geri taş -> yine SINGLE (hayalet yok)', () => {
    const p = new Array(24).fill(0)
    p[20] = 1 // beyaz taş siyah evinde
    p[11] = 14
    p[5] = -8 // siyah (kazanan) dış sahada (bear-off DEĞİL)
    p[15] = -7
    const s = st({ points: p, off: { white: 0, black: 0 } })
    expect(resignationValue(s, 'white')).toBe(1) // karar aşaması değil -> single
  })

  it('resignationTypeForValue eşleşmesi', () => {
    expect(resignationTypeForValue(1)).toBe(ResignationType.SINGLE)
    expect(resignationTypeForValue(2)).toBe(ResignationType.GAMMON)
    expect(resignationTypeForValue(3)).toBe(ResignationType.BACKGAMMON)
  })

  it('isResignationType tip koruması', () => {
    expect(isResignationType('single')).toBe(true)
    expect(isResignationType('gammon')).toBe(true)
    expect(isResignationType('backgammon')).toBe(true)
    expect(isResignationType('double')).toBe(false)
    expect(isResignationType(null)).toBe(false)
  })
})
