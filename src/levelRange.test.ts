import { describe, expect, it } from 'vitest'
import { levelWindow, payloadFromRange, rangeFromStops, selfStopIndex } from './levelRange'
import { RANKS, rankOf } from './ranks'

describe('levelRange (dinamik ±500 pencere)', () => {
  it('tüm duraklar [rating−500, rating+500] ile kesişir + kendi kademesi pencerede', () => {
    const r = 1760
    const w = levelWindow(r)
    for (const s of w) {
      expect(s.min).toBeLessThanOrEqual(r + 500) // üst sınır aşılmaz
      expect(s.max == null || s.max >= r - 500).toBe(true) // alt sınır aşılmaz
    }
    expect(w[selfStopIndex(w, r)].divKey).toBe(rankOf(r).divKey)
  })

  it('±500 sınırının hemen dışındaki kademeler pencereye GİRMEZ (seçilemez)', () => {
    const r = 1760
    const w = levelWindow(r)
    const firstIdx = w[0].index
    const lastIdx = w[w.length - 1].index
    if (firstIdx > 0) expect(RANKS[firstIdx].min - 1).toBeLessThan(r - 500) // alttaki band tümüyle r−500 altında
    if (lastIdx < RANKS.length - 1) expect(RANKS[lastIdx + 1].min).toBeGreaterThan(r + 500) // üstteki min r+500 üstünde
  })

  it('1760 için pencere Novice..G1 (bilinen eşiklerle)', () => {
    const w = levelWindow(1760)
    expect(w[0].divKey).toBe('div.novice')
    expect(w[w.length - 1].divKey).toBe('div.g1')
    const full = rangeFromStops(w, 0, w.length - 1)
    expect(full.min).toBe(1200) // Novice alt
    expect(full.max).toBe(2299) // G1 üst (G0 min 2300 − 1)
  })

  it('alt uçta kelepçelenir (düşük rating)', () => {
    const w = levelWindow(0)
    expect(w[0].divKey).toBe('div.rookie')
    expect(selfStopIndex(w, 0)).toBe(0)
  })

  it('üst uçta açık-uçlu apex işaretlenir', () => {
    const w = levelWindow(2600)
    const top = w[w.length - 1]
    expect(top.divKey).toBe('div.sgm1')
    expect(top.max).toBeNull() // açık uçlu
  })

  it('tek kademe seçimi (iki tutamaç aynı durak)', () => {
    const w = levelWindow(1760)
    const self = selfStopIndex(w, 1760)
    const r = rangeFromStops(w, self, self)
    expect(r.min).toBe(1700) // I1 alt
    expect(r.max).toBe(1799) // I1 üst (A3 min 1800 − 1)
  })

  it('açık-uçlu zirve -> payload maxRating 0', () => {
    const w = levelWindow(2600)
    const hi = w.length - 1
    const r = rangeFromStops(w, hi, hi) // yalnız S1
    expect(r.max).toBeNull()
    expect(payloadFromRange(r).maxRating).toBe(0)
  })

  it('rankOf band kenarları', () => {
    expect(rankOf(1199).divKey).toBe('div.rookie')
    expect(rankOf(1200).divKey).toBe('div.novice')
  })
})
