import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { WHITE, BLACK, lossMultiplier } from './board'

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

// PES ETME: oyun BITMEDEN "simdi teslim olursam kac kat?" — dialog bu carpani gosterir,
// yerel (pvb/pvp) skorlama bunu uygular; otoriter online'da SUNUCU ayni kurali uygular
// (backend App\Support\Backgammon::gamePoints).
describe('lossMultiplier (pes etme carpani, oyun bitmemis olabilir)', () => {
  it('tek oyun (1x): teslim olan en az 1 tas topladi', () => {
    const s = emptyBoard()
    s.off.white = 2
    s.points[12] = -15
    expect(lossMultiplier(s, WHITE)).toBe(1)
  })

  it('gammon (2x): hic tas toplamadi, barda/rakip evinde tasi yok', () => {
    const s = emptyBoard()
    s.points[12] = 15 // beyaz 13. ucgende — siyahin evi (18-23) DEGIL
    expect(lossMultiplier(s, WHITE)).toBe(2)
  })

  it('backgammon (3x): barda tas', () => {
    const s = emptyBoard()
    s.bar.white = 1
    s.points[12] = 14
    expect(lossMultiplier(s, WHITE)).toBe(3)
  })

  it('backgammon (3x): RAKIBIN evinde tas (beyaz teslim -> siyahin evi 18-23)', () => {
    const s = emptyBoard()
    s.points[20] = 1 // beyaz tas siyahin ev bolgesinde
    s.points[12] = 14
    expect(lossMultiplier(s, WHITE)).toBe(3)
  })

  it('siyah icin ayna: beyazin evi 0-5', () => {
    const s = emptyBoard()
    s.points[3] = -1 // siyah tas beyazin ev bolgesinde
    s.points[12] = -14
    expect(lossMultiplier(s, BLACK)).toBe(3)
    const g = emptyBoard()
    g.points[12] = -15 // beyazin evinde degil -> gammon
    expect(lossMultiplier(g, BLACK)).toBe(2)
  })

  it('tas toplamak backgammon konumunu da 1x yapar (once off kontrolu)', () => {
    const s = emptyBoard()
    s.off.white = 1
    s.bar.white = 1 // barda tas VAR ama tas toplamis -> normal
    expect(lossMultiplier(s, WHITE)).toBe(1)
  })
})
