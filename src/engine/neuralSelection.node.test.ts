// Guclu botun hamle-secim algoritmasini GERCEK sinir agiyla dogrular.
// NeuralBot ile ayni mantik (rakip perspektifi + min equity), ama Node'da
// onnxruntime-node ile. wildbg gucunde bir bot 3-1 acilisinda 5-kapisini yapar.
import { describe, expect, it, beforeAll } from 'vitest'
import * as ort from 'onnxruntime-node'
import type { GameState } from './types'
import { initialState, opponent, WHITE } from './board'
import { applyStep, generateMoves } from './moves'
import { cloneState } from './board'
import {
  CONTACT_INPUTS,
  RACE_INPUTS,
  contactInputs,
  equityFrom,
  phaseOf,
  raceInputs,
  toWildPos,
} from './encoding'

let contact: ort.InferenceSession
let race: ort.InferenceSession

async function evalOne(inputs: Float32Array, session: ort.InferenceSession, n: number) {
  const t = new ort.Tensor('float32', inputs, [1, n])
  const out = await session.run({ 'onnx::Gemm_0': t })
  return out[session.outputNames[0]].data as Float32Array
}

// NeuralBot.chooseMove ile ayni secim mantigi
async function chooseMove(state: GameState) {
  const moves = generateMoves(state)
  const mover = state.turn
  const opp = opponent(mover)
  let best = moves[0]
  let bestEq = Infinity
  for (const move of moves) {
    const result = cloneState(state)
    for (const st of move.steps) applyStep(result, st, mover)
    if (result.off[mover] === 15) return move
    const pos = toWildPos(result, opp)
    const phase = phaseOf(pos)
    const probs =
      phase === 'contact'
        ? await evalOne(contactInputs(pos), contact, CONTACT_INPUTS)
        : await evalOne(raceInputs(pos), race, RACE_INPUTS)
    const eq = equityFrom(probs) // rakip perspektifi
    if (eq < bestEq) {
      bestEq = eq
      best = move
    }
  }
  return best
}

describe('sinir agi hamle secimi (gercek net)', () => {
  beforeAll(async () => {
    contact = await ort.InferenceSession.create('public/models/contact.onnx')
    race = await ort.InferenceSession.create('public/models/race.onnx')
  })

  it('3-1 acilisinda 5-kapisini yapar (uzman hamlesi)', async () => {
    const s = initialState()
    s.dice = [3, 1]
    s.turn = WHITE
    const move = await chooseMove(s)
    const result = cloneState(s)
    for (const st of move.steps) applyStep(result, st, WHITE)
    // 5. ucgende (index 4) beyazin 2 tasi olmali
    expect(result.points[4]).toBe(2)
  })
})
