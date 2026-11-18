import { describe, it, expect } from 'vitest'
import { questionPoints, MARATHON_POOL } from './trainingCurriculum'
import { boardKey } from '../engine/moves'

describe('Soru Maratonu havuz + puan', () => {
  it('questionPoints sadece {10,20,25,50,100} döner ve beşi de havuzda görünür', () => {
    const vals = new Set(MARATHON_POOL.map((q) => questionPoints(q)))
    for (const v of vals) expect([10, 20, 25, 50, 100]).toContain(v)
    // dağıtım 5 tier'a yayıldığından beş puan değeri de temsil edilmeli
    expect(vals.has(10)).toBe(true)
    expect(vals.has(20)).toBe(true)
    expect(vals.has(25)).toBe(true)
    expect(vals.has(50)).toBe(true)
    expect(vals.has(100)).toBe(true)
  })

  it('MARATHON_POOL dolu ve board+zar çifti YOK', () => {
    expect(MARATHON_POOL.length).toBeGreaterThan(500)
    const seen = new Set<string>()
    let dup = 0
    for (const q of MARATHON_POOL) {
      const k = boardKey(q.state) + '|' + [...q.state.dice].sort().join('-')
      if (seen.has(k)) dup++
      seen.add(k)
    }
    expect(dup).toBe(0)
  })
})
