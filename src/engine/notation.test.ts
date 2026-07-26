import { describe, expect, it } from 'vitest'
import type { Move } from './types'
import { WHITE, BLACK } from './board'
import { moveNotation } from './notation'

function move(steps: [number | 'bar', number | 'off', number][]): Move {
  return { steps: steps.map(([from, to, die]) => ({ from, to, die })), resultKey: '' }
}

describe('hamle notasyonu', () => {
  it('beyaz 8/5 6/5 (5-kapisi)', () => {
    // index 7 -> point 8, index 4 -> point 5; index 5 -> point 6
    const m = move([
      [7, 4, 3],
      [5, 4, 1],
    ])
    expect(moveNotation(m, WHITE)).toBe('8/5 6/5')
  })

  it('ayni step iki kez -> (2)', () => {
    const m = move([
      [23, 17, 6],
      [23, 17, 6],
    ])
    expect(moveNotation(m, WHITE)).toBe('24/18(2)')
  })

  it('bar ve off', () => {
    const m = move([
      ['bar', 21, 3],
      [2, 'off', 3],
    ])
    expect(moveNotation(m, WHITE)).toBe('bar/22 3/off')
  })

  it('siyah kendi perspektifinden numaralanir', () => {
    // siyah index 0 (point 1) -> kendi perspektifinde 24; index 2 -> 22
    const m = move([[0, 2, 2]])
    expect(moveNotation(m, BLACK)).toBe('24/22')
  })

  it('pas', () => {
    expect(moveNotation(move([]), WHITE)).toBe('pas')
  })
})
