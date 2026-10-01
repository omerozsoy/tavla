import { describe, it, expect } from 'vitest'
import { pwValid } from './api'

// Sifre politikasi (kayit + sifirlama): en az 8 karakter, >=1 buyuk harf, >=1 rakam.
// Sunucudaki AuthController::passwordRules ile AYNI olmali.
describe('pwValid', () => {
  it('gecerli: 8+ karakter, buyuk harf, rakam', () => {
    expect(pwValid('Abcdef12')).toBe(true)
    expect(pwValid('Parola2026')).toBe(true)
  })
  it('reddet: 8 karakterden kisa', () => {
    expect(pwValid('Abc123')).toBe(false)
  })
  it('reddet: buyuk harf yok', () => {
    expect(pwValid('abcdef12')).toBe(false)
  })
  it('reddet: rakam yok', () => {
    expect(pwValid('Abcdefgh')).toBe(false)
  })
})
