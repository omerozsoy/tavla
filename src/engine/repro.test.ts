import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { WHITE } from './board'
import { legalNextSteps } from './game'

// Regresyon: dedup nedeniyle gecerli ilk-adimlarin kaybolmasi hatasi.
// Ayni sonuca goturen farkli ilk-adimlar (bir tasi yurutmek vs ev taslarini
// oynamak) hepsi legalNextSteps'te gorunmeli.

function emptyBoard(dice: number[]): GameState {
  return {
    points: new Array(24).fill(0),
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 },
    turn: WHITE,
    dice,
    diceUsed: dice.map(() => false),
  }
}

describe('regresyon: gecerli ilk-adimlar dedup ile kaybolmamali', () => {
  it('10. ucgen tek tas, zar 2,2,2,2 -> idx9 oynanabilir', () => {
    const s = emptyBoard([2, 2, 2, 2])
    s.points[9] = 1 // pt10 tek tas
    s.points[6] = 6 // pt7
    s.points[5] = 2
    s.points[4] = 2
    s.points[3] = 2
    s.points[2] = 2
    s.points[0] = -2
    s.points[18] = -2
    s.points[19] = -2
    s.points[20] = -2
    s.points[21] = -2
    s.points[22] = -2
    s.points[23] = -2
    s.points[12] = -1
    const froms = new Set(legalNextSteps(s, []).map((st) => st.from))
    expect(froms.has(9)).toBe(true)
  })

  it('bear-off, pt6 tas, zar 3,3,3,3 -> idx5 (6->3) oynanabilir', () => {
    const s = emptyBoard([3, 3, 3, 3])
    s.points[5] = 1 // pt6
    s.points[4] = 4 // pt5
    s.points[3] = 1 // pt4
    s.off.white = 9
    s.points[22] = -1 // siyah pt23
    s.off.black = 14
    const froms = new Set(legalNextSteps(s, []).map((st) => st.from))
    expect(froms.has(5)).toBe(true)
  })
})
