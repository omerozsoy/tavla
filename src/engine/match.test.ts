import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { WHITE, BLACK, gameOutcome } from './board'
import {
  canDouble,
  cubeAvailability,
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
    // 1 puan kala olan (beyaz) icin kup OLU -> teklif SUNULMAZ (katlamanin kazanci yok).
    expect(canDouble(m, WHITE, false)).toBe(false)
  })

  // Kullanici raporu: "3'luk YZ macinda 2-0 iken Crawford goremedim". Motor mod-bagimsiz;
  // 2-0'da (hedef-1) sonraki oyun Crawford OLMALI ve kup iki tarafa da kapanmalidir.
  it('3 puanlik macta 2-0 -> sonraki oyun Crawford (kup iki tarafa da kapali)', () => {
    let m = newMatch(3)
    m = scoreGame(m, WHITE, 2) // 2-0: hedefe 1 kala
    m = setupNextGame(m)
    expect(m.isCrawford).toBe(true)
    expect(canDouble(m, WHITE, false)).toBe(false)
    expect(canDouble(m, 'black', false)).toBe(false)
  })

  it('3 puanlik macta gammon ile 0-2 (siyah onde) -> yine Crawford', () => {
    let m = newMatch(3)
    m = scoreGame(m, 'black', 2) // tek oyunda mars -> 0-2
    m = setupNextGame(m)
    expect(m.isCrawford).toBe(true)
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

  it('teklif edene olu kup -> KATLA cikmaz, otomatik atar', () => {
    // 3 hedefli macta skor 2/3: beyaza 1 kaldi, kup 1 -> kazanmak zaten maci bitiriyor.
    const m = { ...newMatch(3), score: { white: 2, black: 0 } }
    expect(canDouble(m, WHITE, false)).toBe(false)
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(true)
    // Geride olan (siyah, 3 puan uzakta) icin kup hala anlamli.
    expect(canDouble(m, 'black', false)).toBe(true)
  })

  it('5 puanlik macta kup 4 bende, skor 1-0 -> kup benim icin OLU, KATLA cikmaz', () => {
    const m = {
      ...newMatch(5),
      score: { white: 1, black: 0 },
      cube: { value: 4, owner: 'white' as const },
    }
    expect(canDouble(m, WHITE, false)).toBe(false) // beyaza 4 kaldi, kup zaten 4
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(true)
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

  // Olu kup TEKLIF EDENE gore: onde olana kapali, geride olana acik.
  it('7lik macta 6-0 onde, kup 1 -> onde olana KATLA cikmaz, geride olana cikar', () => {
    const m = { ...newMatch(7), score: { white: 6, black: 0 } }
    expect(canDouble(m, WHITE, false)).toBe(false) // beyaza 1 kaldi -> kup olu
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(true)
    expect(canDouble(m, 'black', false)).toBe(true) // siyaha 7 kaldi -> anlamli
  })

  // Kullanici raporu: 7lik macta 6-1 ondeyken rakip katladi (kup 2). Bu oyunu kazanmak
  // maci bitiriyor -> 4e cekmek kazanc saglamaz, sadece rakibe 4 puan riski yazar.
  it('7lik macta 6-1 ondeyken rakip katladi (kup 2) -> 4e cekemem', () => {
    const m = {
      ...newMatch(7),
      score: { white: 6, black: 1 },
      cube: { value: 2, owner: 'white' as const },
    }
    expect(canDouble(m, WHITE, false)).toBe(false)
    expect(shouldAutoRoll(m, WHITE, turnsPlayed)).toBe(true)
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

// cubeAvailability: net GEREKCE (reason) kodlari — backend cubeAvailability ile ayni kume.
describe('cubeAvailability (reason kodlari)', () => {
  it('merkez kup teklif edilebilir -> allowed', () => {
    expect(cubeAvailability(newMatch(7), WHITE, false)).toEqual({ allowed: true })
  })

  it('cevap beklerken -> DOUBLE_ALREADY_PENDING', () => {
    expect(cubeAvailability(newMatch(7), WHITE, true)).toEqual({
      allowed: false,
      reason: 'DOUBLE_ALREADY_PENDING',
    })
  })

  it('Crawford oyunu -> CRAWFORD_GAME', () => {
    const m = { ...newMatch(5), isCrawford: true }
    expect(cubeAvailability(m, WHITE, false)).toEqual({ allowed: false, reason: 'CRAWFORD_GAME' })
  })

  it('1 puanlik mac -> ONE_POINT_MATCH', () => {
    expect(cubeAvailability(newMatch(1), WHITE, false)).toEqual({
      allowed: false,
      reason: 'ONE_POINT_MATCH',
    })
  })

  it('kup 64 tavanda -> CUBE_AT_MAX', () => {
    const m = { ...newMatch(128), cube: { value: 64, owner: null } }
    expect(cubeAvailability(m, WHITE, false)).toEqual({ allowed: false, reason: 'CUBE_AT_MAX' })
  })

  it('kup rakibin elinde -> NOT_CUBE_OWNER', () => {
    const m = { ...newMatch(7), cube: { value: 2, owner: 'black' as const } }
    expect(cubeAvailability(m, WHITE, false)).toEqual({ allowed: false, reason: 'NOT_CUBE_OWNER' })
  })

  it('olu kup (deger >= gereken puan) -> DEAD_CUBE', () => {
    // 5 puanlik mac 4-3: beyaza 1 kaldi, kup 1 -> katlamak kazanc saglamaz.
    const m = { ...newMatch(5), score: { white: 4, black: 3 } }
    expect(cubeAvailability(m, WHITE, false)).toEqual({ allowed: false, reason: 'DEAD_CUBE' })
    // Geride olan (siyah, 2 uzakta) icin CANLI.
    expect(cubeAvailability(m, BLACK, false)).toEqual({ allowed: true })
  })

  it('canDouble = cubeAvailability.allowed (birebir)', () => {
    const m = { ...newMatch(7), cube: { value: 2, owner: 'white' as const } }
    expect(canDouble(m, WHITE, false)).toBe(cubeAvailability(m, WHITE, false).allowed)
    expect(canDouble(m, BLACK, false)).toBe(cubeAvailability(m, BLACK, false).allowed)
  })
})
