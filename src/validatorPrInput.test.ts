import { expect, it } from 'vitest'
import { saneDice, sanePos, saneSteps } from '../validator/prInput'

// A-31: /analyze-pr istemci kaydındaki bozuk zar/tahta değerleri motoru kilitlememeli.
it('accepts only two dice 1..6', () => {
  expect(saneDice([3, 5])).toBe(true)
  expect(saneDice([6, 6])).toBe(true)
  expect(saneDice(Array(12).fill(1))).toBe(false)
  expect(saneDice([0, 7])).toBe(false)
  expect(saneDice([1.5, 2])).toBe(false)
  expect(saneDice('12')).toBe(false)
})

it('requires a 24-point board and at most 4 steps', () => {
  expect(sanePos({ points: Array(24).fill(0) })).toBe(true)
  expect(sanePos({ points: Array(25).fill(0) })).toBe(false)
  expect(sanePos({ points: [...Array(23).fill(0), 99] })).toBe(false)
  expect(saneSteps([{}, {}])).toBe(true)
  expect(saneSteps(Array(40).fill({}))).toBe(false)
})
