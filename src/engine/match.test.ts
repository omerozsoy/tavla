import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { WHITE, BLACK, gameOutcome } from './board'
import { canDouble, matchWinner, newMatch, scoreGame, setupNextGame } from './match'

function emptyBoard(): GameState {
  return {
    points: new Array(24).fill(0),
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 },
    turn: WHITE,
    dice: [],
    diceUsed: [],
  }
}

describe('gameOutcome (carpan)', () => {
  it('normal: kaybeden en az 1 tas topladi', () => {
    const s = emptyBoard()
    s.off.white = 15
    s.off.black = 3
    expect(gameOutcome(s)).toEqual({ winner: WHITE, multiplier: 1 })
  })

  it('gammon: kaybeden hic toplamadi, evde/bar tas yok', () => {
    const s = emptyBoard()
    s.off.white = 15
    s.points[12] = -15 // siyah 13. ucgende (beyazin evi degil)
    expect(gameOutcome(s)).toEqual({ winner: WHITE, multiplier: 2 })
  })

  it('backgammon: kaybeden kazananin evinde', () => {
    const s = emptyBoard()
    s.off.white = 15
    s.points[2] = -15 // siyah beyazin ev bolgesinde (index 0-5)
    expect(gameOutcome(s)).toEqual({ winner: WHITE, multiplier: 3 })
  })

  it('backgammon: kaybedenin bar da tasi var', () => {
    const s = emptyBoard()
    s.off.white = 15
    s.bar.black = 1
    s.points[12] = -14
    expect(gameOutcome(s)).toEqual({ winner: WHITE, multiplier: 3 })
  })
})

describe('mac skoru', () => {
  it('skor ekleme ve mac kazanma', () => {
    let m = newMatch(5)
    m = scoreGame(m, WHITE, 2)
    expect(m.score.white).toBe(2)
    expect(matchWinner(m)).toBeNull()
    m = scoreGame(m, WHITE, 3)
    expect(matchWinner(m)).toBe(WHITE)
  })
})

describe('kup', () => {
  it('merkez kupu her iki oyuncu da teklif edebilir', () => {
    const m = newMatch(7)
    expect(canDouble(m, WHITE, false)).toBe(true)
    expect(canDouble(m, BLACK, false)).toBe(true)
  })

  it('sahipli kupu sadece sahip teklif eder', () => {
    const m = { ...newMatch(7), cube: { value: 2, owner: WHITE as const } }
    expect(canDouble(m, WHITE, false)).toBe(true)
    expect(canDouble(m, BLACK, false)).toBe(false)
  })

  it('cevap beklerken teklif edilemez', () => {
    const m = newMatch(7)
    expect(canDouble(m, WHITE, true)).toBe(false)
  })
})

describe('Crawford kurali', () => {
  it('biri hedefe 1 kala sonraki oyun Crawford olur', () => {
    let m = newMatch(5)
    m = scoreGame(m, WHITE, 4) // 4/5 -> hedefe 1 kala
    m = setupNextGame(m)
    expect(m.isCrawford).toBe(true)
  })

  it('Crawford oyunundan sonra kup geri gelir', () => {
    let m = { ...newMatch(5), score: { white: 4, black: 0 }, isCrawford: true }
    m = setupNextGame(m)
    expect(m.isCrawford).toBe(false)
    expect(m.crawfordDone).toBe(true)
    expect(canDouble(m, WHITE, false)).toBe(true)
  })

  it('Crawford oyununda kup teklif edilemez', () => {
    const m = { ...newMatch(5), isCrawford: true }
    expect(canDouble(m, WHITE, false)).toBe(false)
  })
})
