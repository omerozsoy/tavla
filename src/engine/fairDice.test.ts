import { describe, it, expect } from 'vitest'
import {
  sha256Hex,
  FairDice,
  verifyRoll,
  rollFromSeed,
  serverRoll,
  serverSingle,
  verifyServerRolls,
  futureServerRolls,
  nextRollIndex,
} from './fairDice'

// Ground-truth: backend App\Services\FairDiceService (php -r) ile üretildi.
// JS portu PHP ile BYTE-AYNI olmalı; bu vektörler değişirse port bozulmuştur.
describe('fairDice sunucu HMAC portu (PHP FairDiceService ile birebir)', () => {
  const SEED = 'a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00'
  const CS = 'clientX'
  it('commit = SHA256(serverSeed)', () => {
    expect(sha256Hex(SEED)).toBe('83418260fe3c7bf5063efde5c04315bab07ae31ea393e5adf84dbc7a52181eef')
  })
  it('serverRoll PHP vektörleriyle eşleşir', () => {
    expect(serverRoll(SEED, CS, 0)).toEqual([5, 5])
    expect(serverRoll(SEED, CS, 1)).toEqual([3, 2])
    expect(serverRoll(SEED, CS, 2)).toEqual([3, 2])
    expect(serverRoll(SEED, CS, 3)).toEqual([1, 6])
    expect(serverRoll(SEED, CS, 7)).toEqual([2, 1])
    expect(serverRoll(SEED, '', 0)).toEqual([4, 6])
  })
  it('serverSingle PHP vektörleriyle eşleşir', () => {
    expect(serverSingle(SEED, CS, 4)).toBe(5)
    expect(serverSingle(SEED, CS, 5)).toBe(4)
    expect(serverSingle(SEED, CS, 6)).toBe(5)
  })
  it('verifyServerRolls: doğru kayıt ok, bozuk kayıt ✗', () => {
    const entries = [
      { opening: 1, white: 5, black: 4, starter: 'white' as const }, // base=4: single4=5,single5=4 -> white başlar
      { index: 0, slot: 'p1', dice: [5, 5, 5, 5] }, // roll0=5,5 -> çift => 4 zar
      { index: 1, slot: 'p2', dice: [3, 2] },
      { index: 3, slot: 'p1', dice: [6, 6] }, // yanlış (gerçek 1,6)
    ]
    const res = verifyServerRolls(SEED, CS, entries)
    expect(res.map((r) => r.ok)).toEqual([true, true, true, false])
    expect(res[1].computed).toEqual([5, 5, 5, 5])
  })
  it('nextRollIndex + futureServerRolls: oyun sonrası devam deterministik', () => {
    const entries = [
      { opening: 1, white: 5, black: 4, starter: 'white' as const },
      { index: 0, slot: 'p1', dice: [5, 5, 5, 5] },
      { index: 1, slot: 'p2', dice: [3, 2] },
    ]
    expect(nextRollIndex(entries)).toBe(2) // en büyük index 1 -> sonraki 2
    const fut = futureServerRolls(SEED, CS, 2, 3)
    expect(fut.map((f) => f.index)).toEqual([2, 3, 4])
    expect(fut[0].dice).toEqual([3, 2]) // serverRoll index 2 = 3,2 (PHP vektörü)
    expect(fut.length).toBe(3)
  })
})

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
