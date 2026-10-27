import { describe, expect, it } from 'vitest'
import { initialState } from './board'
import { makePointTargets } from './game'
import { applyStep } from './moves'

// Boş haneye dokununca eldeki iki zarla KAPI yapma (makePointTargets) — açılış klasikleri.
// İndeks: beyaz idx23→0 azalır; d zarı idx i → i-d. 5-point=idx4, 4-point=idx3, bar(7)=idx6.
describe('makePointTargets — açılış kapıları', () => {
  function opening(dice: number[]) {
    const s = initialState()
    s.dice = dice
    s.diceUsed = dice.map(() => false)
    return s
  }

  function assertMakes(dice: number[], target: number) {
    const map = makePointTargets(opening(dice), [])
    const seq = map.get(target)
    expect(seq, `dice ${dice} -> idx ${target} kapı olmalı`).toBeTruthy()
    expect(seq!).toHaveLength(2)
    // İki adım da hedefe inmeli ve iki FARKLI zarı kullanmalı.
    expect(seq!.every((st) => st.to === target)).toBe(true)
    expect(new Set(seq!.map((st) => st.die))).toEqual(new Set(dice))
    // Uygulayınca hedefte 2 beyaz taş (kapı) oluşmalı.
    const b = initialState()
    for (const st of seq!) applyStep(b, st, b.turn)
    expect(b.points[target]).toBe(2)
  }

  it('3-1 → 5-point (idx 4): 8/5 6/5', () => assertMakes([3, 1], 4))
  it('4-2 → 4-point (idx 3): 8/4 6/4', () => assertMakes([4, 2], 3))
  it('6-1 → bar-point (idx 6): 13/7 8/7', () => assertMakes([6, 1], 6))

  it('kapı yapılamayan rulo boş döner (6-5 açılışta kapı yok)', () => {
    // 6-5: lover's leap (24/13) — açılışta tek haneye iki taş inmez.
    expect(makePointTargets(opening([6, 5]), []).size).toBe(0)
  })

  it('zaten kendi hanen (dolu 6-point) kapı hedefi DEĞİL', () => {
    // idx5 (6-point) zaten 5 beyaz taş → "kapı yapma" değil, listede olmamalı.
    const map = makePointTargets(opening([1, 2]), [])
    expect(map.has(5)).toBe(false)
  })
})
