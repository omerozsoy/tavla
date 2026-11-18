// Müfredattaki ELLE GİRİLMİŞ cevaplı pozisyonları motorla doğrula: saklanan cevap
// motorun en iyi hamlesinden çok kötüyse (blunder) işaretle. onnxruntime-node (public/models).
import { describe, it, beforeAll } from 'vitest'
import * as ort from 'onnxruntime-node'
import { readFileSync } from 'node:fs'
import { parseXgid } from './xgid'
import { parseGnuId } from './gnubgId'
import { generateMoves, applyStep } from './moves'
import { cloneState, opponent, WHITE } from './board'
import { toWildPos, phaseOf, contactInputs, raceInputs, equityFrom, CONTACT_INPUTS, RACE_INPUTS } from './encoding'
import { matchGnubgMove } from './gnubgMove'
import { moveNotation } from './notation'
import type { GameState, Player, Move } from './types'

const INPUT = 'onnx::Gemm_0'
let contact: ort.InferenceSession
let race: ort.InferenceSession

const switchSides = (o: number[]): number[] => [o[3], o[4], o[5], o[0], o[1], o[2]]

async function runProbs(session: ort.InferenceSession, inputs: Float32Array, n: number): Promise<number[]> {
  const t = new ort.Tensor('float32', inputs, [1, n])
  const out = await session.run({ [INPUT]: t })
  return Array.from((out[session.outputNames[0]].data as Float32Array).slice(0, 6))
}

function terminalEquity(board: GameState, mover: Player): number {
  const opp = opponent(mover)
  if (board.off[opp] > 0) return 1
  const [hs, he] = mover === WHITE ? [0, 6] : [18, 24]
  let bg = board.bar[opp] > 0
  if (!bg) for (let i = hs; i < he; i++) { const v = board.points[i]; if ((opp === WHITE && v > 0) || (opp !== WHITE && v < 0)) { bg = true; break } }
  return bg ? 3 : 2
}

async function scoreMove(state: GameState, move: Move): Promise<number> {
  const mover = state.turn
  const result = cloneState(state)
  for (const st of move.steps) applyStep(result, st, mover)
  if (result.off[mover] === 15) return terminalEquity(result, mover)
  const pos = toWildPos(result, opponent(mover))
  const phase = phaseOf(pos)
  const inputs = phase === 'contact' ? contactInputs(pos) : raceInputs(pos)
  const probs = await runProbs(phase === 'contact' ? contact : race, inputs, phase === 'contact' ? CONTACT_INPUTS : RACE_INPUTS)
  return equityFrom(switchSides(probs))
}

interface Pos { xgid?: string; gnuPos?: string; gnuMatch?: string; answer: string; title: string }
function extract(): Pos[] {
  const txt = readFileSync('src/ui/trainingCurriculum.ts', 'utf8')
  const out: Pos[] = []
  const reX = /xgid:\s*'([^']+)'[^\n}]*?answer:\s*'([^']+)'[^\n}]*?title:\s*'((?:[^'\\]|\\.)*)'/g
  let m: RegExpExecArray | null
  while ((m = reX.exec(txt))) out.push({ xgid: m[1], answer: m[2], title: m[3].replace(/\\'/g, "'") })
  const reG = /gnuPos:\s*'([^']+)'[^\n}]*?gnuMatch:\s*'([^']*)'[^\n}]*?answer:\s*'([^']+)'[^\n}]*?title:\s*'((?:[^'\\]|\\.)*)'/g
  while ((m = reG.exec(txt))) out.push({ gnuPos: m[1], gnuMatch: m[2], answer: m[3], title: m[4].replace(/\\'/g, "'") })
  return out
}

// Opt-in dev aracı (CI'da çalışmaz; motor + model yükler). Çalıştır:
//   VALIDATE_POS=1 npx vitest run src/engine/validatePositions.node.test.ts --disable-console-intercept
describe.skipIf(!process.env.VALIDATE_POS)('curriculum answer validation', () => {
  beforeAll(async () => {
    contact = await ort.InferenceSession.create('public/models/contact.onnx')
    race = await ort.InferenceSession.create('public/models/race.onnx')
  }, 120000)

  it('flags blunder/unresolved answers', async () => {
    const positions = extract()
    const flagged: { loss: number; line: string }[] = []
    for (const p of positions) {
      const r = p.gnuPos ? parseGnuId(p.gnuPos, p.gnuMatch ?? '') : parseXgid(p.xgid!)
      if (!r || !r.dice) { flagged.push({ loss: 99, line: `PARSE-FAIL | ${p.title}` }); continue }
      const d = r.dice
      const dice = d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : [d[0], d[1]]
      const state: GameState = { ...r.state, turn: 'white', dice, diceUsed: dice.map(() => false) }
      const moves = generateMoves(state)
      if (!moves.length) continue
      const scored: { move: Move; eq: number }[] = []
      for (const mv of moves) scored.push({ move: mv, eq: await scoreMove(state, mv) })
      scored.sort((a, b) => b.eq - a.eq)
      const best = scored[0]
      const ansMove = matchGnubgMove(state, 'white', p.answer)
      if (!ansMove) { flagged.push({ loss: 98, line: `UNRESOLVED "${p.answer}" | best=${moveNotation(best.move, 'white')} | ${p.title}` }); continue }
      const ansEq = scored.find((s) => s.move.resultKey === ansMove.resultKey)?.eq ?? -99
      const loss = best.eq - ansEq
      if (loss > 0.08) flagged.push({ loss, line: `LOSS ${loss.toFixed(3)} | stored "${p.answer}" vs best "${moveNotation(best.move, 'white')}" | ${p.title}` })
    }
    flagged.sort((a, b) => b.loss - a.loss)
    const report = [`ANSWERED=${positions.length} FLAGGED=${flagged.length} (1-ply wildbg; >0.5 loss = yüksek güven, küçük kayıplar rollout/gammon bağlamında yanlış-pozitif olabilir)`, ...flagged.map((f) => f.line)].join('\n')
    console.log('\n' + report)
  }, 600000)
})
