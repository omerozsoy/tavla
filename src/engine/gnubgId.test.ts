import { describe, it, expect } from 'vitest'
import { parseGnuId } from './gnubgId'
import { initialState } from './board'

describe('parseGnuId (GNU Position ID + Match ID)', () => {
  it('standart baslangic Position ID -> initialState board', () => {
    const r = parseGnuId('4HPwATDgc/ABMA', 'cAgAAAAAAAAA')
    expect(r).not.toBeNull()
    expect(r!.state.points).toEqual(initialState().points)
    expect(r!.state.bar).toEqual({ white: 0, black: 0 })
    expect(r!.dice).toBeNull() // baslangic: zar atilmamis
  })

  it('15/15 saglamasi geçmeyen gecersiz ID -> null', () => {
    expect(parseGnuId('AAAAAAAAAAAAAA', 'cAgAAAAAAAAA')).toBeNull()
    expect(parseGnuId('bozuk!!', 'x')).toBeNull()
  })
})
