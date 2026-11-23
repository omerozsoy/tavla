import { describe, it, expect } from 'vitest'
import { initialState } from './board'
import { generateMoves } from './moves'
import type { GameState } from './types'

// Bloke zar: 6-5'te 6 HİÇBİR şekilde oynanamıyorsa (App.tsx deadDieValues bunu kullanır)
// generateMoves çıktısındaki zar birleşiminde 6 hiç geçmez -> ölü -> UI'da soluk.
function deadDice(state: GameState): number[] {
  const playable = new Set<number>()
  for (const m of generateMoves(state)) for (const st of m.steps) playable.add(st.die)
  return state.dice.filter((d) => !playable.has(d))
}

describe('dead die (bloke zar)', () => {
  it('6-5: 6 her yönden kapalıyken sadece 5 oynanır -> 6 ölü', () => {
    const s = initialState()
    s.points = new Array(24).fill(0)
    s.points[10] = 1 // beyaz
    s.points[17] = 1 // beyaz
    s.points[4] = -2 // siyah blok: 10->4 (zar 6)
    s.points[6] = -2 // siyah blok: 12->6 (5 sonrası zar 6)
    s.points[11] = -2 // siyah blok: 17->11 (zar 6)
    s.turn = 'white'
    s.dice = [6, 5]
    expect(deadDice(s)).toEqual([6])
  })

  it('normal açılış 6-5: iki zar da oynanır -> ölü zar yok', () => {
    const s = initialState()
    s.turn = 'white'
    s.dice = [6, 5]
    expect(deadDice(s)).toEqual([])
  })
})
