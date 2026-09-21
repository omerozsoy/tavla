// MANUEL motor testi: gercek wildbg sinir agiyla (her iki taraf) tam 7-puanlik
// bir mac oynatir. Motorun ucdan uca calistigini dogrular: hamle uretimi,
// sinir agi hamle secimi, oyun-sonu puani (tek/mars/cifte-mars), mac skoru,
// Crawford ve mac kazanani. Sadece elle calistirmak icin (RUN_MATCH7=1).
//
//   RUN_MATCH7=1 npx vitest run src/engine/match7.manual.node.test.ts
import { describe, it, beforeAll, expect } from 'vitest'
import * as ort from 'onnxruntime-node'
import type { GameState, Move, Player } from './types'
import { initialState, opponent, winner, cloneState, WHITE } from './board'
import { applyStep, generateMoves } from './moves'
import { newTurn, applyMove } from './game'
import { newMatch, scoreGame, matchWinner, setupNextGame, type MatchState } from './match'
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

// NeuralBot.chooseMove ile ayni secim mantigi: her hamlenin sonucunu rakip
// perspektifinden degerlendirir, en dusuk rakip-equity'yi (= en iyi mover) secer.
async function chooseMove(state: GameState): Promise<Move> {
  const moves = generateMoves(state)
  if (moves.length <= 1) return moves[0] ?? { steps: [], resultKey: '' }
  const mover = state.turn
  const opp = opponent(mover)
  let best = moves[0]
  let bestEq = Infinity
  for (const move of moves) {
    const result = cloneState(state)
    for (const st of move.steps) applyStep(result, st, mover)
    if (result.off[mover] === 15) return move // oyunu bitiren hamle: kesin en iyi
    const pos = toWildPos(result, opp)
    const phase = phaseOf(pos)
    const probs =
      phase === 'contact'
        ? await evalOne(contactInputs(pos), contact, CONTACT_INPUTS)
        : await evalOne(raceInputs(pos), race, RACE_INPUTS)
    const eq = equityFrom(probs)
    if (eq < bestEq) {
      bestEq = eq
      best = move
    }
  }
  return best
}

function roll(): number[] {
  const a = 1 + Math.floor(Math.random() * 6)
  const b = 1 + Math.floor(Math.random() * 6)
  return a === b ? [a, a, a, a] : [a, b]
}

// tek(1) / mars(2) / cifte-mars(3)
function gamePoints(s: GameState, w: Player): number {
  const loser = opponent(w)
  if (s.off[loser] > 0) return 1
  let bg = s.bar[loser] > 0
  const [hs, he] = w === WHITE ? [0, 6] : [18, 24]
  for (let i = hs; i < he; i++) {
    const v = s.points[i]
    if ((loser === WHITE && v > 0) || (loser !== WHITE && v < 0)) bg = true
  }
  return bg ? 3 : 2
}

const RUN = process.env.RUN_MATCH7 === '1'

describe.runIf(RUN)('gercek sinir agi ile tam 7-puanlik mac', () => {
  beforeAll(async () => {
    contact = await ort.InferenceSession.create('public/models/contact.onnx')
    race = await ort.InferenceSession.create('public/models/race.onnx')
  }, 60_000)

  it(
    'mac 7 puana ulasana kadar sorunsuz oynanir',
    async () => {
      const TARGET = 7
      let match: MatchState = newMatch(TARGET)
      let starter: Player = Math.random() < 0.5 ? WHITE : 'black'
      let gameNo = 0
      let totalTurns = 0
      const t0 = Date.now()

      const label = (p: Player) => (p === WHITE ? 'Beyaz' : 'Siyah')

      while (!matchWinner(match)) {
        gameNo++
        let state = initialState()
        state.turn = starter
        let turns = 0
        const cw = match.isCrawford ? '  [Crawford]' : ''
        // eslint-disable-next-line no-console
        console.log(`\nOyun ${gameNo} — baslayan: ${label(starter)}${cw}`)

        while (!winner(state)) {
          const dice = roll()
          const ts = newTurn(state, dice)
          const moves = generateMoves(ts)
          if (moves.length === 0) {
            // gele: oynanabilir hamle yok -> sira gecer
            state = applyMove(ts, { steps: [], resultKey: '' })
            turns++
            continue
          }
          const mv = await chooseMove(ts)
          // secilen hamlenin legal-hamle listesinde oldugunu dogrula (motor tutarliligi)
          expect(moves.some((m) => m.resultKey === mv.resultKey)).toBe(true)
          state = applyMove(ts, mv)
          turns++
          expect(state.off.white + state.off.black).toBeLessThanOrEqual(30)
        }

        const w = winner(state)!
        totalTurns += turns
        const pts = gamePoints(state, w) * match.cube.value
        const kind = pts === 1 ? 'tek' : pts === 2 ? 'MARS' : 'CIFTE MARS'
        match = scoreGame(match, w, pts)
        // eslint-disable-next-line no-console
        console.log(
          `  ${label(w)} kazandi (+${pts} ${kind}, ${turns} tur) — skor ${match.score.white}-${match.score.black}`,
        )
        expect(pts).toBeGreaterThanOrEqual(1)
        expect(pts).toBeLessThanOrEqual(3)

        starter = opponent(starter)
        match = setupNextGame(match)
      }

      const mw = matchWinner(match)!
      const secs = ((Date.now() - t0) / 1000).toFixed(1)
      // eslint-disable-next-line no-console
      console.log(
        `\n=== MAC BITTI === Kazanan: ${label(mw)} | Skor: ${match.score.white}-${match.score.black} | ${gameNo} oyun, ${totalTurns} tur, ${secs} sn\n`,
      )

      expect(match.score[mw]).toBeGreaterThanOrEqual(TARGET)
    },
    600_000,
  )
})
