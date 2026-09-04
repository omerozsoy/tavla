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
import { checkerDecision, cubeDecision, summarize, type PrDecision, type PrSummary } from '../src/analysis/pr'
import { offerLoss, takeLoss } from '../src/engine/cubeEquity'

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

// Pozisyonun `player` (on-roll = x) perspektifli 6 ham olasılığı [wn,wg,wb,ln,lg,lb].
// (neuralBot.evalPosition ile aynı: toWildPos(pos, player) -> net çıktısı player perspektifi.)
async function probsAt(pos: GameState, player: Player): Promise<number[]> {
  const wp = toWildPos(pos, player)
  const phase = phaseOf(wp)
  const inputs = phase === 'contact' ? contactInputs(wp) : raceInputs(wp)
  const session = phase === 'contact' ? contactSession! : raceSession!
  const n = phase === 'contact' ? CONTACT_INPUTS : RACE_INPUTS
  const out = await session.run({ [INPUT_NAME]: new ort.Tensor('float32', inputs, [1, n]) })
  return Array.from((out[session.outputNames[0]].data as Float32Array).subarray(0, 6))
}

// Küp kararını (offer/take) XG-style PrDecision'a çevir: pozisyonu player perspektifinden NN ile
// değerlendir -> cubeEquity offerLoss/takeLoss -> equity kaybı. chosen: double|no-double|take|drop.
async function cubeRecord(
  pos: GameState,
  player: Player,
  chosen: string,
  matchLength: number,
  isMoney: boolean,
): Promise<PrDecision> {
  const probs = await probsAt(pos, player)
  const isOffer = chosen === 'double' || chosen === 'no-double'
  const res = isOffer
    ? offerLoss(probs, chosen === 'double' ? 'double' : 'no-double')
    : takeLoss(probs, chosen === 'take' ? 'take' : 'pass')
  // best=loss, actual=0 -> normalizedEquityLoss=loss; 1pt faktörü/countsForPR pr modülünde.
  return cubeDecision(res.normalizedEquityLoss, 0, res.countsForPR, matchLength, isMoney)
}

// Bir checker kararini XG-style PrDecision'a cevir: tum yasal oynamalarin en iyi/en kotu equity'si
// + oynanan equity -> checkerDecision (zorunlu/obvious eleme + 1pt faktoru pr modulunde). pos =
// hamleden onceki tahta (turn=mover, dice dolu). playedSteps = oynanan tam-tur.
async function checkerRecord(
  pos: GameState,
  dice: number[],
  playedSteps: Step[],
  matchLength: number,
  isMoney: boolean,
): Promise<PrDecision> {
  const mover = pos.turn
  const state = cloneState(pos)
  state.dice = dice.slice()
  state.diceUsed = dice.map(() => false)
  const moves: Move[] = generateMoves(state)
  if (moves.length <= 1) {
    // Zorunlu (tek/sifir hamle) -> sayilmaz; equity eval'e gerek yok.
    return checkerDecision(0, 0, 0, moves.length, matchLength, isMoney)
  }
  let best = -Infinity
  let worst = Infinity
  for (const m of moves) {
    const eq = await equityAfter(applyMove(state, m.steps, mover), mover)
    if (eq > best) best = eq
    if (eq < worst) worst = eq
  }
  const chosenEq = await equityAfter(applyMove(state, playedSteps, mover), mover)
  return checkerDecision(best, chosenEq, worst, moves.length, matchLength, isMoney)
}

export interface PrLogEntry {
  player?: Player
  pos?: GameState
  dice?: number[]
  playedSteps?: Step[]
  cube?: { chosen?: string } // küp kararı girdisi (chosen: double|no-double|take|drop)
}

export interface PrResult extends PrSummary {
  pr: number | null // overall.pr (geriye uyum + ana gosterim)
  decisions: number // overall.decisions
}

// Verilen oyuncunun (hc) log'undan SUNUCU-otoriter XG-style PR. matchLength=1 -> ×1.5 (pr modulu).
// NOT: cube PR icin log best/actual cubeful equity TASIMAZ (motor online cube equity uretmiyor)
// -> cube kararlari suan PR'a girmez (overall = checker). Cube equity eklenince cubeDecision ile
// buraya baglanir. checker tarafi TAM XG-style (zorunlu+obvious eleme, 1pt faktoru, havuzlama).
export async function analyzePr(
  hc: Player,
  log: PrLogEntry[],
  matchLength = 1,
  isMoney = false,
): Promise<PrResult> {
  await init()
  const decisions: PrDecision[] = []
  for (const e of log) {
    if (e.player !== hc || !e.pos) continue
    if (e.cube && typeof e.cube.chosen === 'string') {
      // KÜP kararı -> sunucu-otoriter cube PR (pozisyonu NN ile değerlendir + cubeEquity).
      decisions.push(await cubeRecord(e.pos, hc, e.cube.chosen, matchLength, isMoney))
    } else if (e.dice && e.playedSteps) {
      decisions.push(await checkerRecord(e.pos, e.dice, e.playedSteps, matchLength, isMoney))
    }
  }
  const s = summarize(decisions)
  return { ...s, pr: s.overall.pr, decisions: s.overall.decisions }
}
