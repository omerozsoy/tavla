// KANIT: 59C8M maçının PR'ını WILDBG (orijinal motor) ile yeniden hesapla, XG + gnubg ile kıyasla.
// Review log'undan her checker kararının before-pozisyonu + aday hamleleri alınır; her aday wildbg
// ile değerlendirilir; loss = oynanan − en iyi (opp-perspektif equity, düşük=iyi). PR = Σloss/Σdec ×500.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import * as ort from 'onnxruntime-node'
import type { GameState, Player, Step } from '../engine/types'
import { cloneState, opponent } from '../engine/board'
import { applyStep } from '../engine/moves'
import { CONTACT_INPUTS, RACE_INPUTS, contactInputs, equityFrom, phaseOf, raceInputs, toWildPos } from '../engine/encoding'

const OBVIOUS = 0.001 // AnalysisOrchestrator/pr.ts ile aynı eşik

let contact: ort.InferenceSession
let race: ort.InferenceSession

async function evalOne(inputs: Float32Array, session: ort.InferenceSession, n: number): Promise<Float32Array> {
  const t = new ort.Tensor('float32', inputs, [1, n])
  const out = await session.run({ 'onnx::Gemm_0': t })
  return out[session.outputNames[0]].data as Float32Array
}

// Bir hamle dizisini state'e uygulayıp mover için opp-perspektif equity'si (düşük=iyi).
async function stepsEquity(base: GameState, steps: Step[], mover: Player): Promise<number> {
  const s = cloneState(base)
  for (const st of steps) applyStep(s, st, mover)
  if (s.off[mover] === 15) return -3 // tüm taşlar toplandı = kesin en iyi
  const pos = toWildPos(s, opponent(mover))
  const probs = phaseOf(pos) === 'contact'
    ? await evalOne(contactInputs(pos), contact, CONTACT_INPUTS)
    : await evalOne(raceInputs(pos), race, RACE_INPUTS)
  return equityFrom(probs)
}

interface Dec { player: Player; pos: { points: number[]; bar: Record<Player, number>; off: Record<Player, number>; turn: Player }; dice: number[]; playedSteps: Step[]; cands: { steps: Step[] }[] }

// Yerel KANIT/debug testi: 59c8m.json fixture'i repoda YOK (yerel dump). Yoksa atla (CI yesil).
describe.skipIf(!existsSync('59c8m.json'))('KANIT: 59C8M wildbg PR vs XG/gnubg', () => {
  beforeAll(async () => {
    contact = await ort.InferenceSession.create('public/models/contact.onnx')
    race = await ort.InferenceSession.create('public/models/race.onnx')
  }, 60_000)

  it('wildbg PR hesapla ve kıyasla', async () => {
    const decs: Dec[] = JSON.parse(readFileSync('59c8m.json', 'utf8'))
    const sum: Record<Player, number> = { white: 0, black: 0 }
    const cnt: Record<Player, number> = { white: 0, black: 0 }

    for (const d of decs) {
      const mover = d.player
      const state: GameState = { points: d.pos.points, bar: d.pos.bar, off: d.pos.off, turn: d.pos.turn, dice: d.dice, diceUsed: d.dice.map(() => false) }
      const eqs: number[] = []
      for (const c of d.cands) eqs.push(await stepsEquity(state, c.steps, mover))
      const best = Math.min(...eqs)
      const worst = Math.max(...eqs)
      if (worst - best < OBVIOUS) continue // obvious -> sayılmaz
      const played = await stepsEquity(state, d.playedSteps, mover)
      sum[mover] += Math.max(0, played - best)
      cnt[mover] += 1
    }

    const prW = cnt.white > 0 ? (sum.white / cnt.white) * 500 : null
    const prB = cnt.black > 0 ? (sum.black / cnt.black) * 500 : null

    /* eslint-disable no-console */
    console.log('\n========== 59C8M — WILDBG PR (checker) ==========')
    console.log('ÖmerDOĞAN (white): wildbg', prW?.toFixed(2), `(${cnt.white} karar)`, ' | XG 2.02 | gnubg 3.56')
    console.log('ahselbah  (black): wildbg', prB?.toFixed(2), `(${cnt.black} karar)`, ' | XG 13.34 | gnubg 9.30')
    console.log('==================================================\n')
    /* eslint-enable no-console */

    expect(prW).not.toBeNull()
    expect(prB).not.toBeNull()
  }, 180_000)
})
