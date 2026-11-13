import { describe, it, expect } from 'vitest'
import { LESSONS, lessonPlan } from './trainingCurriculum'
import { boardKey } from '../engine/moves'
import type { GameState } from '../engine/types'

const key = (s: GameState) => boardKey(s) + '|' + [...s.dice].sort().join('-')

describe('TUM seviyelerde tekrar eden soru kontrolu (runtime: lessonPlan)', () => {
  for (const l of LESSONS) {
    it(`${l.id}: direct/base/pool dup-suz ve base∩pool bos`, () => {
      const plan = lessonPlan(l.id)
      if (plan.direct) {
        const k = plan.direct.map((q) => key(q.state))
        expect(new Set(k).size, `direct dup: ${l.id}`).toBe(k.length)
        return
      }
      const baseK = plan.base.map((q) => key(q.state))
      expect(new Set(baseK).size, `base dup: ${l.id}`).toBe(baseK.length)
      const poolK = plan.pool.map(key)
      expect(new Set(poolK).size, `pool dup: ${l.id}`).toBe(poolK.length)
      const baseSet = new Set(baseK)
      const overlap = poolK.filter((x) => baseSet.has(x))
      expect(overlap.length, `base∩pool: ${l.id}`).toBe(0)
    })
  }
})
