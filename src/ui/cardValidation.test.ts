import { describe, it, expect } from 'vitest'
import { luhnValid, detectBrand, formatCardNumber, expiryValid, cvvLength, cardFormValid } from './cardValidation'

describe('cardValidation', () => {
  it('luhn kabul/ret', () => {
    expect(luhnValid('4242424242424242')).toBe(true) // geçerli Visa test kartı
    expect(luhnValid('4242424242424241')).toBe(false) // son hane bozuk
    expect(luhnValid('123')).toBe(false) // çok kısa
  })
  it('marka tespiti', () => {
    expect(detectBrand('4242424242424242')).toBe('visa')
    expect(detectBrand('5500005555555559')).toBe('mastercard')
    expect(detectBrand('340000000000009')).toBe('amex')
    expect(detectBrand('9792000000000003')).toBe('troy')
  })
  it('gruplama', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242')
    expect(formatCardNumber('340000000000009')).toBe('3400 000000 00009') // amex 4-6-5
  })
  it('skt geçerliliği', () => {
    const now = { y: 2026, m: 11 }
    expect(expiryValid('12', '26', now)).toBe(true)
    expect(expiryValid('10', '26', now)).toBe(false) // geçmiş ay
    expect(expiryValid('01', '25', now)).toBe(false) // geçmiş yıl
    expect(expiryValid('13', '27', now)).toBe(false) // geçersiz ay
  })
  it('cvv uzunluğu markaya bağlı', () => {
    expect(cvvLength('amex')).toBe(4)
    expect(cvvLength('visa')).toBe(3)
  })
  it('tam form kapısı', () => {
    const now = { y: 2026, m: 11 }
    expect(cardFormValid({ number: '4242 4242 4242 4242', name: 'Omer Ozsoy', mm: '12', yy: '28', cvv: '123' }, now)).toBe(true)
    expect(cardFormValid({ number: '4242 4242 4242 4242', name: 'Omer Ozsoy', mm: '12', yy: '28', cvv: '12' }, now)).toBe(false) // cvv kısa
    expect(cardFormValid({ number: '4242 4242 4242 4241', name: 'Omer Ozsoy', mm: '12', yy: '28', cvv: '123' }, now)).toBe(false) // luhn
  })
})
