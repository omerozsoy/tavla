import type { GameState, Move } from './types'
import { cloneState } from './board'
import { applyStep, generateMoves } from './moves'
import { evaluatePosition } from './evaluate'

// Botlarin uygulayacagi ortak arayuz.
// Ileride bunu gnubg/wildbg WASM motoruyla degistirecegiz; UI degismeyecek.
export interface Engine {
  name: string
  // Zari atilmis bir state icin oynanacak tam hamleyi sec.
  // Legal hamle yoksa bos step'li Move doner.
  // Senkron (heuristik) veya asenkron (sinir agi) olabilir.
  chooseMove(state: GameState): Move | Promise<Move>
}

// Bir hamleyi uygulayip sonuc tahtasini dondur (degerlendirme icin)
function resultOf(state: GameState, move: Move): GameState {
  const s = cloneState(state)
  for (const step of move.steps) applyStep(s, step, state.turn)
  return s
}

// 0-ply heuristik bot: tum legal hamleleri uretir, her birinin sonucunu
// evaluatePosition ile puanlar, en iyisini secer.
export class HeuristicBot implements Engine {
  name = 'Heuristik Bot (0-ply)'

  chooseMove(state: GameState): Move {
    const moves = generateMoves(state)
    if (moves.length === 0) {
      return { steps: [], resultKey: '' }
    }
    let best = moves[0]
    let bestScore = -Infinity
    for (const move of moves) {
      const result = resultOf(state, move)
      const score = evaluatePosition(result, state.turn)
      if (score > bestScore) {
        bestScore = score
        best = move
      }
    }
    return best
  }
}
