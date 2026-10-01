import { describe, it, expect } from 'vitest'
import { pwValid } from './api'

// Sifre politikasi (kayit + sifirlama): en az 12 karakter, >=1 kucuk + 1 buyuk harf + 1 rakam.
// Sunucudaki AuthController::passwordRules ile AYNI olmali.
describe('pwValid', () => {
  it('gecerli: 12+ karakter, kucuk+buyuk harf, rakam', () => {
    expect(pwValid('Abcdefgh1234')).toBe(true)
    expect(pwValid('Parola20261001')).toBe(true)
  })
  it('reddet: 12 karakterden kisa', () => {
    expect(pwValid('Abcdef12')).toBe(false)
  })
  it('reddet: kucuk harf yok', () => {
    expect(pwValid('ABCDEFGH1234')).toBe(false)
  })
  it('reddet: buyuk harf yok', () => {
    expect(pwValid('abcdefgh1234')).toBe(false)
  })
  it('reddet: rakam yok', () => {
    expect(pwValid('Abcdefghijkl')).toBe(false)
  })
})
