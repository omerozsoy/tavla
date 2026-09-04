// Sunucu-otoriter PR (Performance Rating) analizi — Node + onnxruntime-node.
//
// AMAC: PR'i istemcinin gonderdigi `loss` degerlerine GUVENEREK degil, her insan kararini
// SUNUCUDA sinir agiyla YENIDEN degerlendirerek hesaplamak. Boylece istemci sahte dusuk-hata
// (iyi PR) uyduramaz. Kazanan/kaybeden zaten sunucu-otoriter; bu PR'i da otoriter yapar.
//
// PARITE: featurization (encoding.ts) + hamle uretimi (moves.ts) + skor mantigi CLIENT
// (neuralBot.ts) ile AYNI kod. Ayni model dosyalari (contact/race.onnx) + ayni girdi -> ayni
// equity. Yani sunucu PR'i, dogru oynayan istemcinin PR'iyle SAYISAL eslesir (gölge modda
// dogrulanir). Fark yalnizca calisma-zamani (ort-node vs ort-web) — ONNX deterministik.
import * as ort from 'onnxruntime-node'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { GameState, Move, Player, Step } from '../src/engine/types'
import { cloneState, opponent, WHITE } from '../src/engine/board'
import { applyStep, generateMoves } from '../src/engine/moves'
import {
  CONTACT_INPUTS,
  RACE_INPUTS,
  contactInputs,
  equityFrom,
  phaseOf,
  raceInputs,
  toWildPos,
} from '../src/engine/encoding'

const INPUT_NAME = 'onnx::Gemm_0'

let contactSession: ort.InferenceSession | null = null
let raceSession: ort.InferenceSession | null = null

// Model dizini: MODELS_DIR env (deploy) veya bundle yanindaki `models/` (build-validator kopyalar).
function modelsDir(): string {
  if (process.env.MODELS_DIR) return process.env.MODELS_DIR
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, 'models')
}

async function init(): Promise<void> {
  if (contactSession && raceSession) return
  const dir = modelsDir()
  contactSession = await ort.InferenceSession.create(join(dir, 'contact.onnx'))
  raceSession = await ort.InferenceSession.create(join(dir, 'race.onnx'))
}

// Rakip 6 olasiligini mover perspektifine cevir (neuralBot.switchSides ile birebir).
function switchSides(opp: ArrayLike<number>): number[] {
  return [opp[3], opp[4], opp[5], opp[0], opp[1], opp[2]]
}

// Oyunu bitiren (mover 15 topladi) pozisyonun mover-perspektifli equity'si (1/2/3).
function terminalEquity(board: GameState, mover: Player): number {
  const opp = opponent(mover)
  if (board.off[opp] > 0) return 1 // normal
  const [hs, he] = mover === WHITE ? [0, 6] : [18, 24]
  let bg = board.bar[opp] > 0
  if (!bg) {
    for (let i = hs; i < he; i++) {
      const v = board.points[i]
      if ((opp === WHITE && v > 0) || (opp !== WHITE && v < 0)) {
        bg = true
        break
      }
    }
  }
  return bg ? 3 : 2 // backgammon : gammon
}

// Hamleden SONRAKI tahtanin mover-perspektifli equity'si. Sirada rakip (opp) var -> opp
// perspektifinden degerlendir, sonucu mover'a cevir (neuralBot.scoreMoves ile ayni).
async function equityAfter(after: GameState, mover: Player): Promise<number> {
  if (after.off[mover] === 15) return terminalEquity(after, mover)
  const opp = opponent(mover)
  const pos = toWildPos(after, opp)
  const phase = phaseOf(pos)
  const inputs = phase === 'contact' ? contactInputs(pos) : raceInputs(pos)
  const session = phase === 'contact' ? contactSession! : raceSession!
  const n = phase === 'contact' ? CONTACT_INPUTS : RACE_INPUTS
  const tensor = new ort.Tensor('float32', inputs, [1, n])
  const out = await session.run({ [INPUT_NAME]: tensor })
  const oppProbs = out[session.outputNames[0]].data as Float32Array
  return equityFrom(switchSides(oppProbs.subarray(0, 6)))
}

function applyMove(state: GameState, steps: Step[], mover: Player): GameState {
  const s = cloneState(state)
  for (const st of steps) applyStep(s, st, mover)
  return s
}

// Bir insan kararinin equity kaybi: en iyi legal hamle equity'si - oynanan hamle equity'si.
// Secim yoksa (0/1 hamle) karar degil -> null (PR'a katilmaz). pos = hamleden onceki tahta
// (turn=mover, dice dolu). playedSteps = oyuncunun oynadigi tam-tur.
async function decisionLoss(pos: GameState, dice: number[], playedSteps: Step[]): Promise<number | null> {
  const mover = pos.turn
  const state = cloneState(pos)
  state.dice = dice.slice()
  state.diceUsed = dice.map(() => false)
  const moves: Move[] = generateMoves(state)
  if (moves.length <= 1) return null // tek/ hic secenek -> karar degil (forced/pas)

  let best = -Infinity
  for (const m of moves) {
    const eq = await equityAfter(applyMove(state, m.steps, mover), mover)
    if (eq > best) best = eq
  }
  const chosenEq = await equityAfter(applyMove(state, playedSteps, mover), mover)
  return Math.max(0, best - chosenEq)
}

export interface PrLogEntry {
  player?: Player
  pos?: GameState
  dice?: number[]
  playedSteps?: Step[]
}

// Verilen oyuncunun (hc) log'undan SUNUCU-otoriter PR. decisions=0 ise null.
export async function analyzePr(
  hc: Player,
  log: PrLogEntry[],
): Promise<{ pr: number | null; decisions: number }> {
  await init()
  let sum = 0
  let n = 0
  for (const e of log) {
    if (e.player !== hc || !e.pos || !e.dice || !e.playedSteps) continue
    const loss = await decisionLoss(e.pos, e.dice, e.playedSteps)
    if (loss == null) continue
    sum += loss
    n++
  }
  if (n === 0) return { pr: null, decisions: 0 }
  return { pr: Math.round((sum / n) * 500 * 100) / 100, decisions: n }
}
