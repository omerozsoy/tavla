// wildbg sinir agini tarayicida onnxruntime-web ile calistiran motor + analiz.
// Hamle secimi wildbg ile ayni: her hamlenin sonucunu rakip perspektifinden
// degerlendirir; mover perspektifine cevirip en yuksek equity'yi secer.
import type { InferenceSession, Tensor } from 'onnxruntime-web'
import type { GameState, Move, Player } from './types'
import type { Engine } from './engine'
import { cloneState, opponent, WHITE } from './board'
import { applyStep, generateMoves } from './moves'
import {
  CONTACT_INPUTS,
  RACE_INPUTS,
  contactInputs,
  equityFrom,
  phaseOf,
  raceInputs,
  toWildPos,
  type Phase,
} from './encoding'

const INPUT_NAME = 'onnx::Gemm_0'

// wasm dosyalarini Vite asset olarak (?url) import et -> served URL'ler.
// (src/ort'a kopyalandi; paketin exports kisitlamasini asmak icin.)
// Boylece CDN'e gerek yok (offline calisir) ve /public import sorunu olmaz.
import wasmUrl from '../ort/ort-wasm-simd-threaded.wasm?url'
import wasmMjsUrl from '../ort/ort-wasm-simd-threaded.mjs?url'
import jsepWasmUrl from '../ort/ort-wasm-simd-threaded.jsep.wasm?url'
import jsepMjsUrl from '../ort/ort-wasm-simd-threaded.jsep.mjs?url'

// onnxruntime-web'i tek sefer, tek-thread (SharedArrayBuffer gerekmez) yukle.
type Ort = typeof import('onnxruntime-web')
let ortPromise: Promise<Ort> | null = null
function getOrt(): Promise<Ort> {
  if (!ortPromise) {
    ortPromise = import('onnxruntime-web').then((ort) => {
      ort.env.wasm.numThreads = 1
      ort.env.wasm.proxy = false
      const wasmPaths: Record<string, string> = {
        'ort-wasm-simd-threaded.wasm': wasmUrl,
        'ort-wasm-simd-threaded.mjs': wasmMjsUrl,
        'ort-wasm-simd-threaded.jsep.wasm': jsepWasmUrl,
        'ort-wasm-simd-threaded.jsep.mjs': jsepMjsUrl,
      }
      // ort tipi obje-eslesmeyi kabul etmiyor ama runtime bunu destekliyor
      ort.env.wasm.wasmPaths = wasmPaths as unknown as typeof ort.env.wasm.wasmPaths
      return ort
    })
  }
  return ortPromise
}

// Rakibin 6 olasiligini mover perspektifine cevir
function switchSides(opp: ArrayLike<number>): number[] {
  return [opp[3], opp[4], opp[5], opp[0], opp[1], opp[2]]
}

// Oyun biten (mover 15 tas topladi) pozisyonun mover-perspektifli sonucu
function terminalResult(board: GameState, mover: Player): { equity: number; probs: number[] } {
  const opp = opponent(mover)
  if (board.off[opp] > 0) return { equity: 1, probs: [1, 0, 0, 0, 0, 0] } // normal
  // Rakip hic toplamadi -> gammon veya backgammon
  const [hs, he] = mover === WHITE ? [0, 6] : [18, 24]
  let backgammon = board.bar[opp] > 0
  if (!backgammon) {
    for (let i = hs; i < he; i++) {
      const v = board.points[i]
      if ((opp === WHITE && v > 0) || (opp !== WHITE && v < 0)) {
        backgammon = true
        break
      }
    }
  }
  return backgammon
    ? { equity: 3, probs: [0, 0, 1, 0, 0, 0] }
    : { equity: 2, probs: [0, 1, 0, 0, 0, 0] }
}

interface Candidate {
  move: Move
  phase?: Phase
  inputs?: Float32Array
  equity: number // mover perspektifi (yuksek = iyi)
  probs: number[] // mover perspektifi [wn,wg,wb,ln,lg,lb]
}

// Analiz sonucu: bir hamle ve mover-perspektifli degerlendirmesi
export interface RankedMove {
  move: Move
  equity: number
  probs: number[]
}

export class NeuralBot implements Engine {
  name = 'Sinir Agi (wildbg)'
  private ort: Ort | null = null
  private contact: InferenceSession | null = null
  private race: InferenceSession | null = null

  async ready(): Promise<void> {
    await this.init()
  }

  private async init(): Promise<Ort> {
    const ort = await getOrt()
    this.ort = ort
    const opts = { executionProviders: ['wasm' as const] }
    const base = import.meta.env.BASE_URL // '/' veya alt-klasor ('/tavla/')
    if (!this.contact)
      this.contact = await ort.InferenceSession.create(`${base}models/contact.onnx`, opts)
    if (!this.race) this.race = await ort.InferenceSession.create(`${base}models/race.onnx`, opts)
    return ort
  }

  async chooseMove(state: GameState): Promise<Move> {
    const moves = generateMoves(state)
    if (moves.length <= 1) return moves[0] ?? { steps: [], resultKey: '' }
    const cands = await this.scoreMoves(state, moves)
    let best = cands[0]
    for (const c of cands) if (c.equity > best.equity) best = c
    return best.move
  }

  // Tum legal hamleleri equity'ye gore sirala (en iyi ilk). Mover perspektifi.
  async analyzeMoves(state: GameState): Promise<RankedMove[]> {
    const moves = generateMoves(state)
    if (moves.length === 0) return []
    const cands = await this.scoreMoves(state, moves)
    const ranked = cands.map((c) => ({ move: c.move, equity: c.equity, probs: c.probs }))
    ranked.sort((a, b) => b.equity - a.equity)
    return ranked
  }

  // Mevcut pozisyonun mover-perspektifli olasiliklari (hamleden once)
  async evalPosition(state: GameState, onRoll: Player): Promise<number[]> {
    await this.init()
    const pos = toWildPos(state, onRoll)
    const phase = phaseOf(pos)
    const inputs = phase === 'contact' ? contactInputs(pos) : raceInputs(pos)
    const session = phase === 'contact' ? this.contact! : this.race!
    const n = phase === 'contact' ? CONTACT_INPUTS : RACE_INPUTS
    const tensor = new this.ort!.Tensor('float32', inputs, [1, n]) as Tensor
    const out = await session.run({ [INPUT_NAME]: tensor })
    return Array.from((out[session.outputNames[0]].data as Float32Array).slice(0, 6))
  }

  private async scoreMoves(state: GameState, moves: Move[]): Promise<Candidate[]> {
    await this.init()
    const mover = state.turn
    const opp = opponent(mover)

    const candidates: Candidate[] = moves.map((move) => {
      const result = cloneState(state)
      for (const st of move.steps) applyStep(result, st, mover)
      if (result.off[mover] === 15) {
        const t = terminalResult(result, mover)
        return { move, equity: t.equity, probs: t.probs }
      }
      const pos = toWildPos(result, opp)
      const phase = phaseOf(pos)
      const inputs = phase === 'contact' ? contactInputs(pos) : raceInputs(pos)
      return { move, phase, inputs, equity: 0, probs: [] }
    })

    const contactCands = candidates.filter((c) => c.phase === 'contact')
    const raceCands = candidates.filter((c) => c.phase === 'race')
    await Promise.all([
      this.evalGroup(this.contact!, contactCands, CONTACT_INPUTS),
      this.evalGroup(this.race!, raceCands, RACE_INPUTS),
    ])
    return candidates
  }

  // Adaylari degerlendir; mover-perspektifli equity/probs doldur.
  // Modeller sabit batch=1 girisi bekliyor -> her adayi ayri [1,N] calistir.
  private async evalGroup(session: InferenceSession, cands: Candidate[], numInputs: number) {
    if (cands.length === 0) return
    const outName = session.outputNames[0]
    for (const c of cands) {
      const tensor = new this.ort!.Tensor('float32', c.inputs!, [1, numInputs]) as Tensor
      const out = await session.run({ [INPUT_NAME]: tensor })
      const opp = out[outName].data as Float32Array
      const moverProbs = switchSides(opp.subarray(0, 6))
      c.probs = moverProbs
      c.equity = equityFrom(moverProbs)
    }
  }
}
