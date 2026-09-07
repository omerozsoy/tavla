import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { WHITE, BLACK, gameOutcome } from './board'
import {
  canDouble,
  matchWinner,
  newMatch,
  scoreGame,
  setupNextGame,
  shouldAutoRoll,
} from './match'

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
    const m = { ...newMatch(7), cube: { value: 2, owner: 'white' as const } }
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
    // Geride olan (siyah, 5 puan uzakta) kupu teklif edebilir; kup geri geldi.
    expect(canDouble(m, 'black', false)).toBe(true)
    // 1 puan kala olan (beyaz) icin kup OLU ama teklif ENGELLENMEZ (gercek tavla: legal,
    // sadece anlamsiz).
    expect(canDouble(m, WHITE, false)).toBe(true)
  })

  it('Crawford oyununda kup teklif edilemez', () => {
    const m = { ...newMatch(5), isCrawford: true }
    expect(canDouble(m, WHITE, false)).toBe(false)
  })
})

describe('otomatik zar (kup secenegi yoksa)', () => {
  const turnsPlayed = 3 // ilk elden sonra (kup teklifi mumkun olabilir)

  it('1 puanlik oyunda kup yok -> her zaman otomatik atar', () => {
    const m = newMatch(1)
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(true)
    expect(shouldAutoRoll(m, BLACK, turnsPlayed)).toBe(true)
  })

  it('olu kup ARTIK engel degil -> katla cikar, otomatik atmaz', () => {
    // 3 hedefli macta skor 2/3: kalan 1, kup 1 -> olu kup ama teklif LEGAL (kullanici direktifi)
    const m = { ...newMatch(3), score: { white: 2, black: 0 } }
    expect(canDouble(m, WHITE, false)).toBe(true)
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(false)
  })

  it('5 puanlik macta kup 4 bende, skor 1-0 -> KATLA cikar (eski olu-kup hatasi)', () => {
    const m = {
      ...newMatch(5),
      score: { white: 1, black: 0 },
      cube: { value: 4, owner: 'white' as const },
    }
    expect(canDouble(m, WHITE, false)).toBe(true)
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(false)
  })

  it('Crawford oyununda kup yok -> otomatik atar', () => {
    const m = { ...newMatch(5), isCrawford: true }
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(true)
  })

  it('rakip kupu tutuyorsa teklif edemem -> otomatik atar', () => {
    const m = { ...newMatch(7), cube: { value: 2, owner: 'black' as const } }
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(true)
    // Kup sahibi (siyah) hala teklif edebilir -> beklenir (otomatik atmaz)
    expect(shouldAutoRoll(m, BLACK, turnsPlayed)).toBe(false)
  })

  it('kup 64 tavanda -> otomatik atar', () => {
    const m = { ...newMatch(128), cube: { value: 64, owner: null } }
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(true)
  })

  it('ilk elde (turnsPlayed=0) kup yok -> otomatik atar', () => {
    const m = newMatch(7)
    expect(shouldAutoRoll(m, WHITE, 0)).toBe(true)
  })

  // 7lik macta kup 8: bu oyunu kim kazanirsa maci kazanir -> katlamak HICBIR seyi
  // degistirmez. Teklif sunulmaz, zar dogrudan atilir.
  it('7lik macta kup 8 (iki taraf icin de olu) -> teklif YOK, otomatik atar', () => {
    const m = { ...newMatch(7), cube: { value: 8, owner: 'white' as const } }
    expect(canDouble(m, WHITE, false)).toBe(false)
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(true)
  })

  // Kup TEK tarafi bitiriyorsa olu SAYILMAZ: rakip icin hala anlamli.
  it('7lik macta 6-0 onde, kup 1 -> rakip icin anlamli, KATLA cikar', () => {
    const m = { ...newMatch(7), score: { white: 6, black: 0 } }
    expect(canDouble(m, WHITE, false)).toBe(true) // beyaza 1 kaldi ama siyaha 7
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(false)
  })

  it('7lik macta 6-6 berabere, kup 1 -> ikisine de 1 kaldi, otomatik atar', () => {
    const m = { ...newMatch(7), score: { white: 6, black: 6 } }
    expect(canDouble(m, WHITE, false)).toBe(false)
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(true)
  })
  it('kup teklif edilebilirken beklenir (Zar At / Katla butonu cikar)', () => {
    const m = newMatch(7)
    expect(canDouble(m, WHITE, false)).toBe(true)
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(false)
  })

})
