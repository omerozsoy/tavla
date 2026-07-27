import { describe, it, expect } from 'vitest'
import { sha256Hex, FairDice, verifyRoll, rollFromSeed } from './fairDice'

describe('fairDice', () => {
  it('sha256 bilinen vektorler', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('commitment = sha256(serverSeed)', () => {
    const fd = new FairDice()
    expect(fd.commitment).toBe(sha256Hex(fd.serverSeed))
  })

  it('atislar deterministik ve dogrulanabilir', () => {
    const fd = new FairDice('server-abc', 'client-xyz')
    const r0 = fd.next()
    const r1 = fd.next()
    expect(fd.nonce).toBe(2)
    // Ayni tohumlarla yeniden hesaplanabilir
    expect(verifyRoll('server-abc', 'client-xyz', 0)).toEqual(r0)
    expect(verifyRoll('server-abc', 'client-xyz', 1)).toEqual(r1)
  })

  it('zarlar 1..6, cift ise 4 eleman', () => {
    for (let n = 0; n < 500; n++) {
      const d = rollFromSeed('s', 'c', n)
      expect(d.length === 2 || d.length === 4).toBe(true)
      for (const v of d) expect(v >= 1 && v <= 6).toBe(true)
      if (d.length === 4) expect(d[0]).toBe(d[3])
    }
  })

  it('dagilim yaklasik esit (yanlilik yok)', () => {
    const counts = new Array(7).fill(0)
    let total = 0
    for (let n = 0; n < 6000; n++) {
      for (const v of rollFromSeed('seed', 'cli', n).slice(0, 2)) {
        counts[v]++
        total++
      }
    }
    for (let f = 1; f <= 6; f++) {
      const p = counts[f] / total
      expect(Math.abs(p - 1 / 6)).toBeLessThan(0.03)
    }
  })
})
