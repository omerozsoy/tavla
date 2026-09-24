import { describe, it, expect } from 'vitest'
import { initialState, cloneState } from '../engine/board'
import { applyStep } from '../engine/moves'
import { validLivePrefix, boardSig } from './spectateAnim'
import type { GameState, Step } from '../engine/types'

const apply = (base: GameState, steps: Step[]): GameState => {
  const s = cloneState(base)
  for (const st of steps) applyStep(s, st, base.turn)
  return s
}

describe('validLivePrefix (spectate no-ghost guard)', () => {
  it('yasal beyaz 3-1 turunu (8/5, 6/5) kabul eder ve tahtayı yeniden kurar', () => {
    const base: GameState = { ...initialState(), dice: [3, 1] }
    const live: Step[] = [
      { from: 7, to: 4, die: 3 }, // 8/5
      { from: 5, to: 4, die: 1 }, // 6/5
    ]
    const valid = validLivePrefix(base, live)
    expect(valid.length).toBe(2)
    const after = apply(base, valid)
    expect(after.points[4]).toBe(2) // 5. üçgen = 2 beyaz
    expect(after.points[7]).toBe(2) // 8. üçgen 3->2
    expect(after.points[5]).toBe(4) // 6. üçgen 5->4
  })

  it('bayat/yasadışı live adımı REDDEDER (boş kaynak) -> ghost yok', () => {
    const base: GameState = { ...initialState(), dice: [3, 1] }
    const bogus: Step[] = [{ from: 3, to: 0, die: 3 }] // 4. üçgende beyaz taş yok
    expect(validLivePrefix(base, bogus)).toEqual([])
  })

  it('ilk yasadışı adımda durur (kısmi geçerli önek)', () => {
    const base: GameState = { ...initialState(), dice: [3, 1] }
    const mixed: Step[] = [
      { from: 7, to: 4, die: 3 }, // yasal
      { from: 3, to: 2, die: 1 }, // yasadışı (boş kaynak)
    ]
    const valid = validLivePrefix(base, mixed)
    expect(valid.length).toBe(1)
    expect(valid[0].from).toBe(7)
  })

  it('die eksikse tüm zar değerlerini dener', () => {
    const base: GameState = { ...initialState(), dice: [3, 1] }
    const noDie = [{ from: 7, to: 4 }] as unknown as Step[]
    const valid = validLivePrefix(base, noDie)
    expect(valid.length).toBe(1)
    expect(valid[0].die).toBe(3)
  })

  it('boardSig taş/sıra/zar değişince değişir', () => {
    const a: GameState = { ...initialState(), dice: [3, 1] }
    const b: GameState = { ...initialState(), dice: [6, 2] }
    expect(boardSig(a)).not.toBe(boardSig(b))
    expect(boardSig(a)).toBe(boardSig({ ...initialState(), dice: [3, 1] }))
  })
})
