// Uctan uca dogrulama: kodlama + ONNX contact modeli + olasilik yorumu.
// wildbg nets-branch (guclu) modeliyle mantikli ciktilar uretmeli.
// Node ortaminda onnxruntime-node ile calisir.
import { describe, expect, it, beforeAll } from 'vitest'
import * as ort from 'onnxruntime-node'
import type { WildPos } from './encoding'
import { contactInputs } from './encoding'

function wp(list: [number, number][], xOff: number, oOff: number): WildPos {
  const pips = new Array(26).fill(0)
  for (const [i, v] of list) pips[i] = v
  return { pips, xOff, oOff }
}

let session: ort.InferenceSession

async function evalContact(pos: WildPos): Promise<number[]> {
  const input = contactInputs(pos)
  const tensor = new ort.Tensor('float32', input, [1, 202])
  const out = await session.run({ 'onnx::Gemm_0': tensor })
  return Array.from(out[session.outputNames[0]].data as Float32Array)
}

const win = (p: number[]) => p[0] + p[1] + p[2]
const lose = (p: number[]) => p[3] + p[4] + p[5]

describe('contact ONNX modeli - uctan uca (guclu ag)', () => {
  beforeAll(async () => {
    session = await ort.InferenceSession.create('public/models/contact.onnx')
  })

  it('kesin kazanma: x 1:1; o 24:1 -> yuksek kazanma', async () => {
    const p = await evalContact(wp([[1, 1], [24, -1]], 14, 14))
    expect(win(p)).toBeGreaterThan(0.6)
    expect(p[0]).toBeGreaterThan(p[3]) // win_normal > lose_normal
  })

  it('gammon kazanma: x 1:1; o 18:15 -> gammon baskin', async () => {
    const p = await evalContact(wp([[1, 1], [18, -15]], 14, 0))
    expect(win(p)).toBeGreaterThan(0.9)
    expect(p[1]).toBeGreaterThan(p[0]) // win_gammon > win_normal
  })

  it('backgammon kazanma: x 1:1; o 6:15 -> gammon+bg yuksek', async () => {
    const p = await evalContact(wp([[1, 1], [6, -15]], 14, 0))
    expect(p[1] + p[2]).toBeGreaterThan(0.5)
    expect(p[2]).toBeGreaterThan(0) // biraz backgammon sansi
  })

  it('kesin kaybetme: x 1:6; o 24:1 -> yuksek kaybetme', async () => {
    const p = await evalContact(wp([[1, 6], [24, -1]], 9, 14))
    expect(p[3]).toBeGreaterThan(0.8)
  })

  it('gammon kaybetme: x 7:15; o 24:1 -> gammon kaybi baskin', async () => {
    const p = await evalContact(wp([[7, 15], [24, -1]], 0, 14))
    expect(lose(p)).toBeGreaterThan(0.9)
    expect(p[4]).toBeGreaterThan(p[3]) // lose_gammon > lose_normal
  })

  it('olasiliklar toplami ~1.0', async () => {
    const p = await evalContact(wp([[1, 1], [24, -1]], 14, 14))
    expect(Math.abs(p.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(0.01)
  })
})
