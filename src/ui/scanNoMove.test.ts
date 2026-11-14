import { describe, it, expect } from 'vitest'
import { CURRICULUM, questionId } from './trainingCurriculum'
import { generateMoves, hasNoMove } from '../engine/moves'

// Regresyon: hicbir mufredat sorusu BOZUK olmamali (kup sorulari haric):
//  (A) hamlesiz/dansli -> "en iyi hamleyi bul" dersinde "hamle yok, gec" gosterir (bkz. isPlayableQuestion).
//  (B) otoriter cevabi ULASILAMAZ -> grader userKey===answer.resultKey hic eslesemez -> ders cozulemez.
describe('curriculum has no broken questions', () => {
  it('every non-cube question is playable and (if authored) solvable', () => {
    const broken: string[] = []
    for (const tier of CURRICULUM) {
      for (const lesson of tier.lessons) {
        for (const [i, q] of lesson.questions.entries()) {
          if (q.cube) continue
          const moves = generateMoves(q.state)
          const where = `${lesson.id} #${i + 1} ${q.title ?? q.id ?? questionId(q)}`
          if (q.state.dice.length === 0 || hasNoMove(moves)) {
            broken.push(`NO-MOVE ${where}`)
            continue
          }
          if (q.answer && !moves.some((m) => m.resultKey === q.answer!.resultKey)) {
            broken.push(`UNREACHABLE-ANSWER ${where}`)
          }
        }
      }
    }
    expect(broken, broken.join('\n')).toHaveLength(0)
  })
})
