// GERÇEK maç üzerinde Median Error doğrulaması.
// Gerçek sinir ağı (contact/race onnx) ile bir oyun oynanır:
//   - beyaz = kusurlu oyuncu (rastgele legal hamle) → gerçek equity kayıpları oluşur
//   - siyah = en iyi (min opp-equity)
// Her beyaz kararı için motor TÜM adayları değerlendirir; error = chosenEq - bestEq.
// Sonra calculateMedianError ile medyan + (kıyas için) average hesaplanıp yazdırılır.
//
// Bu, recordPR'ın (App.tsx) yaptığı analizle AYNI kaynağı kullanır: bestEquity =
// en iyi aday, playedEquity = oynanan aday; loss = max(0, best-played).
import { describe, it, expect, beforeAll } from 'vitest'
import * as ort from 'onnxruntime-node'
import type { GameState, Player, Move } from './../engine/types'
import { initialState, opponent, cloneState, WHITE } from './../engine/board'
import { applyStep, generateMoves } from './../engine/moves'
import {
  CONTACT_INPUTS,
  RACE_INPUTS,
  contactInputs,
  equityFrom,
  phaseOf,
  raceInputs,
  toWildPos,
} from './../engine/encoding'
import { calculateMedianError, type ErrorDecision } from './medianError'

let contact: ort.InferenceSession
let race: ort.InferenceSession

async function evalOne(inputs: Float32Array, session: ort.InferenceSession, n: number): Promise<Float32Array> {
  const t = new ort.Tensor('float32', inputs, [1, n])
  const out = await session.run({ 'onnx::Gemm_0': t })
  return out[session.outputNames[0]].data as Float32Array
}

// Bir hamlenin MOVER için opp-perspektif equity'si (düşük = iyi). Tüm taşları
// toplayan hamle kesin en iyi → -3 (equity aralığı ~[-3,3] dışında güvenli alt).
async function moveEquity(state: GameState, move: Move, mover: Player): Promise<number> {
  const result = cloneState(state)
  for (const st of move.steps) applyStep(result, st, mover)
  if (result.off[mover] === 15) return -3
  const pos = toWildPos(result, opponent(mover))
  const probs =
    phaseOf(pos) === 'contact'
      ? await evalOne(contactInputs(pos), contact, CONTACT_INPUTS)
      : await evalOne(raceInputs(pos), race, RACE_INPUTS)
  return equityFrom(probs)
}

// Tekrar-üretilebilir PRNG (matExport.test.ts ile aynı) — seed sabit → aynı maç.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('Median Error — gerçek maç (sinir ağı)', () => {
  beforeAll(async () => {
    contact = await ort.InferenceSession.create('public/models/contact.onnx')
    race = await ort.InferenceSession.create('public/models/race.onnx')
  }, 60_000)

  it('bir maçı oynayıp beyazın Median vs Average Error değerlerini üretir', async () => {
    const rng = mulberry32(20260831)
    const roll = (): number[] => {
      const a = 1 + Math.floor(rng() * 6)
      const b = 1 + Math.floor(rng() * 6)
      return a === b ? [a, a, a, a] : [a, b]
    }

    const decisions: ErrorDecision[] = [] // beyazın kararları (medianError girdisi)
    const usedErrors: number[] = [] // average kıyası için ham hatalar
    let whiteTotalDecisions = 0 // beyazın tüm checker karar fırsatları (forced dahil)

    let s: GameState = initialState()
    let mover: Player = WHITE
    for (let guard = 0; guard < 4000; guard++) {
      const dice = roll()
      s = { ...cloneState(s), turn: mover, dice, diceUsed: dice.map(() => false) }
      const moves = generateMoves(s)

      if (moves.length === 0) {
        // Dance: legal hamle yok → karar değil (forced de değil). Sırayı devret.
        mover = opponent(mover)
        continue
      }

      // Her iki taraf için de aday equity'lerini hesapla (mover perspektifi: min iyi).
      const eqs: number[] = []
      for (const m of moves) eqs.push(await moveEquity(s, m, mover))
      let bestIdx = 0
      for (let i = 1; i < eqs.length; i++) if (eqs[i] < eqs[bestIdx]) bestIdx = i
      const bestEq = eqs[bestIdx]

      let chosenIdx: number
      if (mover === WHITE) {
        whiteTotalDecisions++
        if (moves.length === 1) {
          decisions.push({ forced: true }) // zorunlu hamle → medyana girmez
          chosenIdx = 0
        } else {
          chosenIdx = Math.floor(rng() * moves.length) // kusurlu oyuncu: rastgele legal
          const error = Math.max(0, eqs[chosenIdx] - bestEq)
          decisions.push({ error })
          usedErrors.push(error)
        }
      } else {
        chosenIdx = bestIdx // siyah: en iyi
      }

      const chosen = moves[chosenIdx]
      const after = cloneState(s)
      for (const st of chosen.steps) applyStep(after, st, mover)
      if (after.off[mover] === 15) break // oyun bitti
      mover = opponent(mover)
      s = after
    }

    const result = calculateMedianError(decisions)
    const average =
      usedErrors.length > 0 ? usedErrors.reduce((a, b) => a + b, 0) / usedErrors.length : null

    // --- İstenen 5 çıktı ---
    /* eslint-disable no-console */
    console.log('\n===== Median Error — Gerçek Maç (beyaz, kusurlu oyuncu) =====')
    console.log('1) Toplam karar sayısı        :', whiteTotalDecisions)
    console.log('2) Kullanılan karar sayısı    :', result.analyzedDecisions)
    console.log('3) Hariç tutulan forced move  :', result.excludedForcedMoves)
    console.log('4) Median Error               :', result.medianError)
    console.log('5) Average Error              :', average)
    console.log('   (median 3 ondalık gösterim :', result.medianError?.toFixed(3), ')')
    console.log('============================================================\n')
    /* eslint-enable no-console */

    // Sağlamlık
    expect(whiteTotalDecisions).toBe(result.analyzedDecisions + result.excludedForcedMoves)
    expect(result.analyzedDecisions).toBeGreaterThan(0)
    expect(result.medianError).not.toBeNull()
    expect(result.medianError!).toBeGreaterThanOrEqual(0)
    expect(average).not.toBeNull()
    // Rastgele oyunda birkaç büyük blunder beklenir → medyan genelde average'ın altında.
    // (Kesin garanti değil ama bu tohum için doğrulanır; metriğin amacını gösterir.)
    expect(result.medianError!).toBeLessThanOrEqual(average!)
  }, 120_000)
})
