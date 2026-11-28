import { describe, expect, it } from 'vitest'
import { levelWindow, payloadFromRange, rangeFromStops, selfStopIndex } from './levelRange'
import { rankOf } from './ranks'

describe('levelRange', () => {
  it('centers on player rating-band, 5 below + 5 above', () => {
    const w = levelWindow(1760) // I1 (1700–1799)
    const self = selfStopIndex(w, 1760)
    expect(w[self].divKey).toBe('div.i1')
    expect(self).toBe(5) // 5 alt
    expect(w.length - 1 - self).toBe(5) // 5 üst
    expect(w[0].divKey).toBe('div.novice')
    expect(w[w.length - 1].divKey).toBe('div.m2')
  })

  it('clamps window at the bottom of the list', () => {
    const w = levelWindow(0) // Rookie (ilk kademe)
    expect(w[0].divKey).toBe('div.rookie')
    expect(selfStopIndex(w, 0)).toBe(0) // solda alt yok
    expect(w.length).toBe(6) // kendi + 5 üst
  })

  it('clamps window at the top and marks open-ended apex', () => {
    const w = levelWindow(2600) // S1 (zirve)
    const top = w[w.length - 1]
    expect(top.divKey).toBe('div.sgm1')
    expect(top.max).toBeNull() // açık uçlu
  })

  it('maps handle stops to a rating range (low floor, high ceil)', () => {
    const w = levelWindow(1760)
    // I3 (alt) .. A2 (üst)
    const loIdx = w.findIndex((s) => s.divKey === 'div.i3')
    const hiIdx = w.findIndex((s) => s.divKey === 'div.a2')
    const r = rangeFromStops(w, loIdx, hiIdx)
    expect(r.min).toBe(1500) // I3 alt
    expect(r.max).toBe(1949) // A2 üst (A1 min 1950 − 1)
  })

  it('default widest window spans full ±5 band', () => {
    const w = levelWindow(1760)
    const r = rangeFromStops(w, 0, w.length - 1)
    expect(r.min).toBe(1200) // Novice alt
    expect(r.max).toBe(2099) // M2 üst
  })

  it('open-ended top yields max=null -> payload maxRating 0', () => {
    const w = levelWindow(2600)
    const hi = w.length - 1
    const r = rangeFromStops(w, hi, hi) // yalnız S1
    expect(r.max).toBeNull()
    expect(payloadFromRange(r).maxRating).toBe(0)
  })

  it('single-level selection (both handles same stop)', () => {
    const w = levelWindow(1760)
    const self = selfStopIndex(w, 1760)
    const r = rangeFromStops(w, self, self)
    expect(r.min).toBe(1700)
    expect(r.max).toBe(1799)
  })

  it('rankOf sanity for band edges', () => {
    expect(rankOf(1199).divKey).toBe('div.rookie')
    expect(rankOf(1200).divKey).toBe('div.novice')
  })
})
