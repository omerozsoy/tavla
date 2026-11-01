import { describe, it, expect } from 'vitest'
import { tournamentPlayerStatus } from './tournamentStatus'
import type { TMatch, TPlayer } from './api'

const P = (id: number, name = `p${id}`): TPlayer => ({ id, name, rating: 1500 })
const players = [P(1), P(2), P(3), P(4), P(5)]

describe('tournamentPlayerStatus', () => {
  it('kaybeden + acik maci yok -> elendi; kazanan sonraki turda -> normal', () => {
    const bracket: TMatch[][] = [
      [{ key: 'r0m0', p1: P(1), p2: P(2), winner: 1, score: { p1: 3, p2: 1 } }],
      [{ key: 'r1m0', p1: P(1), p2: null, winner: null }], // kazanan bekliyor (acik tek-taraf)
    ]
    const st = tournamentPlayerStatus(bracket, players, {})
    expect(st.get(2)?.out).toBe(true) // 1'e kaybetti, baska maci yok -> elendi
    expect(st.get(1)).toBeUndefined() // kazanan, bekliyor -> normal (rozet yok)
  })

  it('su an oynuyor -> canli skor (kendi/rakip) + oda', () => {
    const bracket: TMatch[][] = [
      [{ key: 'r0m0', p1: P(1), p2: P(2), winner: null, room: 'tavla-abc' }],
    ]
    const live = { 'TAVLA-ABC': { '1': 2, '2': 4 } }
    const st = tournamentPlayerStatus(bracket, players, live)
    expect(st.get(1)?.play).toEqual({ room: 'tavla-abc', a: 2, b: 4, oppName: 'p2' })
    expect(st.get(2)?.play).toEqual({ room: 'tavla-abc', a: 4, b: 2, oppName: 'p1' })
  })

  it('oynuyor, elendi(gecmis kayip)den onceliklidir; cift-maglubiyet iki tarafi eler', () => {
    const bracket: TMatch[][] = [
      // 3 gecmis turda kaybetti AMA su an acik maci var (swiss) -> oynuyor, elendi degil
      [{ key: 'a', p1: P(3), p2: P(4), winner: 4 }],
      [{ key: 'b', p1: P(3), p2: P(5), winner: null, room: 'r2' }],
      // cift maglubiyet: ikisi de elendi
      [{ key: 'c', p1: P(1), p2: P(2), winner: null, double_loss: true }],
    ]
    const st = tournamentPlayerStatus(bracket, players, {})
    expect(st.get(3)?.play).toBeDefined() // acik maci var -> oynuyor
    expect(st.get(3)?.out).toBeUndefined()
    expect(st.get(1)?.out).toBe(true)
    expect(st.get(2)?.out).toBe(true)
  })
})
