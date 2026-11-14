import { describe, it, expect } from 'vitest'
import { CURRICULUM, questionId } from './trainingCurriculum'
import { generateMoves, hasNoMove } from '../engine/moves'

// Regresyon: hicbir mufredat sorusu "hamle yok" (dansli/kapanmis) olmamali — oyle pozisyonlar
// "en iyi hamleyi bul" dersinde bozuk gorunur (bkz. isPlayableQuestion filtresi). Kup sorulari haric.
describe('curriculum has no dead (no-move) questions', () => {
  it('every non-cube question has a legal move', () => {
    const broken: string[] = []
    for (const tier of CURRICULUM) {
      for (const lesson of tier.lessons) {
        for (const q of lesson.questions) {
          if (q.cube) continue
          if (q.state.dice.length === 0 || hasNoMove(generateMoves(q.state))) {
            broken.push(`${lesson.id}: ${q.title ?? q.id ?? questionId(q)}`)
          }
        }
      }
    }
    expect(broken, broken.join('\n')).toHaveLength(0)
  })
})
