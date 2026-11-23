import { describe, expect, it } from 'vitest'
import { matchCubeDisplay } from './matchCube'

// Gammonsuz olasılık vektörü: p kazanma, 1−p kaybetme.
const gl = (p: number): number[] => [p, 0, 0, 1 - p, 0, 0]

describe('matchCubeDisplay — skor-farkında küp durumu (tab gösterimi)', () => {
  it('3 equity [-1,1] aralığında, win = p×100, highlight geçerli', () => {
    const d = matchCubeDisplay(gl(0.65), 1, 3, 3)
    for (const v of [d.noDouble, d.doublePass, d.doubleTake]) {
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(d.win).toBeCloseTo(65, 6)
    expect(['noDouble', 'doublePass', 'doubleTake']).toContain(d.highlight)
  })

  it('SKOR önemli: AYNI pozisyon farklı away ile FARKLI equity verir', () => {
    const near = matchCubeDisplay(gl(0.65), 1, 2, 2) // ikisi de 2-away (küp çok önemli)
    const far = matchCubeDisplay(gl(0.65), 1, 7, 7) // ikisi de 7-away (money'e yakın)
    expect(near.noDouble).not.toBeCloseTo(far.noDouble, 4)
  })

  it("1-away lider: güçlü pozisyonda (%75) bile DOUBLE etme — küpün değeri yok (money'den FARKLI)", () => {
    // Money modeli %75'te DOUBLE der; ama 1-away iken sadece 1 puana ihtiyacım var -> büyük küp
    // ekstra kazanç GETİRMEZ, yalnız riski artırır. Skor-farkında model doğru şekilde no-double der.
    const d = matchCubeDisplay(gl(0.75), 1, 1, 5)
    expect(d.recommended).toBe('no-double')
  })

  it('take point SKORA göre: [0,1] aralığında, uzak-simetrik ~%25, away ile değişir', () => {
    const far = matchCubeDisplay(gl(0.6), 1, 7, 7)
    expect(far.takePoint).toBeGreaterThanOrEqual(0)
    expect(far.takePoint).toBeLessThanOrEqual(1)
    expect(far.takePoint).toBeGreaterThan(0.2) // ölü-küp take point'ine yakın
    expect(far.takePoint).toBeLessThan(0.35)
    const near = matchCubeDisplay(gl(0.6), 1, 2, 2)
    expect(near.takePoint).not.toBeCloseTo(far.takePoint, 3) // skor take point'i değiştirir
  })

  it('double match point (1-away/1-away): rakip HER şansta alır -> take point ~0', () => {
    // Küp ölü; pas = maçı vermek. Rakip herhangi bir kazanma şansıyla take eder.
    const d = matchCubeDisplay(gl(0.6), 1, 1, 1)
    expect(d.takePoint).toBeCloseTo(0, 6)
  })
})
