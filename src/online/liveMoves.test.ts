import { describe, expect, it } from 'vitest'
import { liveMoveDelta, replayStartIndex } from './liveMoves'
import type { Step } from '../engine/types'

const s = (from: number, to: number, die: number): Step => ({ from, to, die } as Step)

describe('liveMoveDelta', () => {
  const a = s(23, 20, 3)
  const b = s(20, 18, 2)

  it('boş -> tek adım: o adımı animate et', () => {
    expect(liveMoveDelta([], [a])).toEqual({ animate: [a], reset: false })
  })

  it('uzantı (aynı prefiks + yeni adım): yalnız yeni adımı animate et', () => {
    expect(liveMoveDelta([a], [a, b])).toEqual({ animate: [b], reset: false })
  })

  it('değişmedi: animate boş, reset yok', () => {
    expect(liveMoveDelta([a], [a])).toEqual({ animate: [], reset: false })
  })

  it('GERİ ALMA (kısaldı): reset + kalan adımları uygula', () => {
    expect(liveMoveDelta([a, b], [a])).toEqual({ animate: [a], reset: true })
  })

  it('tam geri alma (boşaldı): reset + animate boş', () => {
    expect(liveMoveDelta([a, b], [])).toEqual({ animate: [], reset: true })
  })

  it('farklı dizi (prefiks tutmadı): reset + incoming tamamı', () => {
    const c = s(23, 21, 2)
    expect(liveMoveDelta([a], [c])).toEqual({ animate: [c], reset: true })
  })
})

describe('replayStartIndex (onaylı hamle adım adım oynatma başlangıcı)', () => {
  const a = s(23, 20, 3)
  const b = s(20, 18, 2)
  const c = s(13, 11, 2)

  it('önizleme hiç göstermediyse: baştan (0)', () => {
    expect(replayStartIndex([], [a, b])).toBe(0)
  })

  it('önizleme bir kısmını gösterdiyse: oradan devam', () => {
    expect(replayStartIndex([a], [a, b])).toBe(1)
  })

  it('önizleme TAMAMINI gösterdiyse: full.length (çağıran atlar)', () => {
    expect(replayStartIndex([a, b], [a, b])).toBe(2)
  })

  it('önizleme saptıysa (yanlış adım): baştan tam oynat (0)', () => {
    expect(replayStartIndex([c], [a, b])).toBe(0)
  })

  it('önizleme full-dan uzun ama sapmalı: baştan (0)', () => {
    expect(replayStartIndex([a, c], [a, b])).toBe(0)
  })
})
