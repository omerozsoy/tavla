import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { WHITE, BLACK } from './board'
import { contactInputs, raceInputs, toWildPos } from './encoding'

// wildbg inputs.rs testlerindeki birebir beklenen vektorler
const CONTACT_DIRECT =
  '0;13;0;0;0;0;1;0;0;0;0;1;0;0;0;0;1;0;0;0;1;1;0;0;1;2;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;1;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;1;0;0;0'

const CONTACT_SWITCHED =
  '13;0;1;0;0;0;1;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;1;2;0;0;1;1;0;0;1;0;0;1;0;0;1;0;0;0'

const RACE_DIRECT =
  '0;14;1;0;0;0;0;1;0;0;0;0;1;0;0;0;1;1;0;0;1;2;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;1;0;0;0'

const RACE_SWITCHED =
  '14;0;1;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;0;1;2;0;0;1;1;0;0;1;0;0;1;0;0;1;0;0;0'

function parse(s: string): number[] {
  return s.split(';').map(Number)
}

// Contact test pozisyonu: x 1:1,2:2,3:3,4:4,5:5 ; o 24:1, O_BAR:1
function contactState(): GameState {
  const points = new Array(24).fill(0)
  points[0] = 1
  points[1] = 2
  points[2] = 3
  points[3] = 4
  points[4] = 5
  points[23] = -1 // siyah 24. ucgende
  return {
    points,
    bar: { white: 0, black: 1 },
    off: { white: 0, black: 13 },
    turn: WHITE,
    dice: [],
    diceUsed: [],
  }
}

// Race test pozisyonu: x 1:1,2:2,3:3,4:4,5:5 ; o 24:1
function raceState(): GameState {
  const points = new Array(24).fill(0)
  points[0] = 1
  points[1] = 2
  points[2] = 3
  points[3] = 4
  points[4] = 5
  points[23] = -1
  return {
    points,
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 14 },
    turn: WHITE,
    dice: [],
    diceUsed: [],
  }
}

describe('wildbg girdi kodlamasi (birebir dogrulama)', () => {
  it('contact - x perspektifi', () => {
    const inp = Array.from(contactInputs(toWildPos(contactState(), WHITE)))
    expect(inp).toEqual(parse(CONTACT_DIRECT))
  })

  it('contact - o perspektifi (taraf cevrilmis)', () => {
    const inp = Array.from(contactInputs(toWildPos(contactState(), BLACK)))
    expect(inp).toEqual(parse(CONTACT_SWITCHED))
  })

  it('race - x perspektifi', () => {
    const inp = Array.from(raceInputs(toWildPos(raceState(), WHITE)))
    expect(inp).toEqual(parse(RACE_DIRECT))
  })

  it('race - o perspektifi (taraf cevrilmis)', () => {
    const inp = Array.from(raceInputs(toWildPos(raceState(), BLACK)))
    expect(inp).toEqual(parse(RACE_SWITCHED))
  })
})
