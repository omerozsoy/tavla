import { describe, it, expect } from 'vitest'
import { makePuzzle } from './TrainingView'
import { generateMoves, hasNoMove } from '../engine/moves'

// Trainer çekirdeği: her üretilen bulmaca OYNANABİLİR bir karar olmalı — beyazın sırası,
// zar atılmış ve en az bir legal hamle var (çoğunlukla >=2 farklı; fallback 3-1 açılışı da >=2).
describe('makePuzzle', () => {
  it('always yields a playable white-to-move position with dice', () => {
    for (let i = 0; i < 50; i++) {
      const s = makePuzzle()
      expect(s.turn).toBe('white')
      expect(s.dice.length).toBeGreaterThan(0)
      const moves = generateMoves(s)
      expect(hasNoMove(moves)).toBe(false)
    }
  })
})
