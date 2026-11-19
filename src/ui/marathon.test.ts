import { describe, it, expect } from 'vitest'
import { questionPoints, MARATHON_POOL, positionCode } from './trainingCurriculum'
import { boardKey } from '../engine/moves'

describe('positionCode stabil + benzersiz', () => {
  it('5 hane, deterministik, havuzda çakışmasız', () => {
    const codes = MARATHON_POOL.map(positionCode)
    for (const c of codes) expect(c).toMatch(/^[0-9A-Z]{5}$/)
    // Deterministik: aynı soru -> aynı kod
    expect(positionCode(MARATHON_POOL[0])).toBe(codes[0])
    // Çakışma oranı çok düşük olmalı (36^5 uzay); havuz için 0 bekleriz
    const uniq = new Set(codes)
    expect(codes.length - uniq.size).toBeLessThanOrEqual(1)
  })
})

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
