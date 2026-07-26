import { describe, expect, it } from 'vitest'
import { rollDice, secureDie } from './game'

describe('CSPRNG zar', () => {
  it('secureDie hep 1-6 arasi', () => {
    for (let i = 0; i < 5000; i++) {
      const d = secureDie()
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(6)
    }
  })

  it('tum yuzler cikar (kaba dagilim)', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) seen.add(secureDie())
    expect(seen.size).toBe(6)
  })

  it('rollDice: cift ise 4 eleman, degilse 2', () => {
    for (let i = 0; i < 200; i++) {
      const dice = rollDice()
      if (dice[0] === dice[1] && dice.length === 4) {
        expect(dice.every((d) => d === dice[0])).toBe(true)
      } else {
        expect(dice.length).toBe(2)
        expect(dice[0]).not.toBe(dice[1])
      }
    }
  })

  it('dagilim makul uniform (chi-kare gevsek esik)', () => {
    const counts = [0, 0, 0, 0, 0, 0]
    const n = 12000
    for (let i = 0; i < n; i++) counts[secureDie() - 1]++
    const expected = n / 6
    // her yuz beklenenin +-%25'i icinde olmali (cok gevsek, flaky degil)
    for (const c of counts) {
      expect(c).toBeGreaterThan(expected * 0.75)
      expect(c).toBeLessThan(expected * 1.25)
    }
  })
})
