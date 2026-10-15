import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { WHITE, BLACK, lossMultiplier, hasContact } from './board'

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

describe('hasContact (saf yaris mi?)', () => {
  it('iki taraf da kendi evinde bear-off -> temas yok (yaris)', () => {
    const s = emptyBoard()
    s.points[5] = 3 // beyaz pt6 (index5)
    s.points[0] = 2 // beyaz pt1
    s.points[18] = -3 // siyah ev (index18)
    s.points[23] = -2
    expect(hasContact(s)).toBe(false)
  })

  it('NR5GJ: beyaz evde, siyah BARDA -> temas var (vurabilir)', () => {
    const s = emptyBoard()
    s.points[5] = 1 // beyaz pt6
    s.points[0] = 5
    s.bar.black = 2 // siyah bar'dan beyazin evine girip blot vurabilir
    expect(hasContact(s)).toBe(true)
  })

  it('beyaz en geride (index10) siyah ilerideyse hala temas', () => {
    const s = emptyBoard()
    s.points[10] = 2 // beyaz hala index10'da
    s.points[8] = -2 // siyah index8 -> maxWhite(10) > minBlack(8) = temas
    expect(hasContact(s)).toBe(true)
  })

  it('gecmisler: beyaz hepsi <index, siyah hepsi >index -> yaris', () => {
    const s = emptyBoard()
    s.points[4] = 2 // beyaz index4
    s.points[10] = -2 // siyah index10 -> maxWhite(4) <= minBlack(10)
    expect(hasContact(s)).toBe(false)
  })
})
