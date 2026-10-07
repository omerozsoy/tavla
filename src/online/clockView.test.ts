import { describe, expect, it } from 'vitest'
import { interpClock, type ClockAnchor } from './clockView'

const anchor = (o: Partial<ClockAnchor>): ClockAnchor => ({
  delay: 10,
  hold: 0,
  white: 300,
  black: 300,
  active: 'white',
  at: 0,
  ...o,
})

describe('interpClock', () => {
  it('demir anında: delay tam, bankalar tam', () => {
    expect(interpClock(anchor({}), 0)).toEqual({ delay: 10, white: 300, black: 300 })
  })

  it('delay içinde: yalnız delay azalır, banka sabit', () => {
    // 4 sn geçti, delay 10 -> 6; banka değişmez
    expect(interpClock(anchor({}), 4000)).toEqual({ delay: 6, white: 300, black: 300 })
  })

  it('delay bitince AKTİF tarafın bankası erir (diğeri sabit)', () => {
    // 13 sn geçti: delay 0, over 3 -> beyaz 300-3=297 (ceil), siyah 300
    expect(interpClock(anchor({}), 13000)).toEqual({ delay: 0, white: 297, black: 300 })
  })

  it('hold boyunca delay SABİT kalır (titreme yok)', () => {
    // hold 5 sn; 3 sn geçti -> eff 0 -> delay hâlâ 10
    expect(interpClock(anchor({ hold: 5 }), 3000)).toEqual({ delay: 10, white: 300, black: 300 })
    // hold 5, 7 sn geçti -> eff 2 -> delay 8
    expect(interpClock(anchor({ hold: 5 }), 7000)).toEqual({ delay: 8, white: 300, black: 300 })
  })

  it('aktif siyahken yalnız siyah erir', () => {
    expect(interpClock(anchor({ active: 'black' }), 13000)).toEqual({ delay: 0, white: 300, black: 297 })
  })

  it('aktif yokken (null) iki banka da sabit, delay yine akar', () => {
    expect(interpClock(anchor({ active: null }), 13000)).toEqual({ delay: 0, white: 300, black: 300 })
  })

  it('negatife düşmez (banka tükendi)', () => {
    const v = interpClock(anchor({ white: 2 }), 100000)
    expect(v.white).toBe(0)
    expect(v.delay).toBe(0)
  })

  // TRUST BOUNDARY: ağdan gelen bozuk alan ekrana NaN/nonsense düşmemeli ("anlamsız saniyeler").
  it('NaN/undefined alanlar 0 olur, NaN GÖSTERİLMEZ', () => {
    const bad = anchor({ delay: NaN, white: undefined as unknown as number, black: NaN })
    const v = interpClock(bad, 5000)
    expect(Number.isNaN(v.delay)).toBe(false)
    expect(Number.isNaN(v.white)).toBe(false)
    expect(Number.isNaN(v.black)).toBe(false)
    expect(v).toEqual({ delay: 0, white: 0, black: 0 })
  })

  it('bozuk at (NaN) demiri sıfır elapsed sayar, patlamaz', () => {
    const v = interpClock(anchor({ at: NaN }), 5000)
    expect(Number.isNaN(v.delay)).toBe(false)
  })
})
