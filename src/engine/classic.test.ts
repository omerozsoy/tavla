import { describe, it, expect } from 'vitest'
import type { GameState } from './types'
import { lossMultiplier, gameOutcome } from './board'
import { newMatch, cubeAvailability, canDouble, shouldAutoRoll } from './match'
import { resignationValue } from './resign'

// KLASIK TAVLA kural çekirdeği testleri. Fark: (1) küp YOK, (2) mars sabit 2 (backgammon-3 yok).
// Hareket/zorunlu-zar/bar/toplama kuralları PAYLAŞILAN motorda (moves.ts/validateTurn.ts) zaten
// test edilir ve Klasik'te AYNIDIR — bu dosya yalnız Klasik'e ÖZGÜ iki farkı doğrular.

// Kaybeden = siyah, kazanan = beyaz. Beyazın evi points[0..5].
function st(partial: Partial<GameState> = {}): GameState {
  return {
    points: new Array(24).fill(0),
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 },
    turn: 'white',
    dice: [],
    diceUsed: [],
    ...partial,
  }
}

describe('Klasik Tavla — puanlama (mars=2, backgammon-3 yok)', () => {
  it('normal galibiyet: kaybeden en az 1 taş topladı -> 1 (klasik ve normal aynı)', () => {
    const s = st({ off: { white: 15, black: 4 } })
    expect(lossMultiplier(s, 'black', true)).toBe(1)
    expect(lossMultiplier(s, 'black', false)).toBe(1)
  })

  it('mars: kaybeden hiç toplamadı -> 2 (klasik ve normal aynı)', () => {
    const s = st({ off: { white: 15, black: 0 } })
    expect(lossMultiplier(s, 'black', true)).toBe(2)
    expect(lossMultiplier(s, 'black', false)).toBe(2)
  })

  it('KLASIK FARKI: kaybedenin barda taşı -> klasik 2, normal 3', () => {
    const s = st({ off: { white: 15, black: 0 }, bar: { white: 0, black: 1 } })
    expect(lossMultiplier(s, 'black', true)).toBe(2) // backgammon-3 YOK
    expect(lossMultiplier(s, 'black', false)).toBe(3)
  })

  it('KLASIK FARKI: kaybedenin kazananın evinde taşı -> klasik 2, normal 3', () => {
    const p = new Array(24).fill(0)
    p[2] = -1 // siyah taş, beyazın evi (0..5)
    const s = st({ points: p, off: { white: 15, black: 0 } })
    expect(lossMultiplier(s, 'black', true)).toBe(2) // backgammon-3 YOK
    expect(lossMultiplier(s, 'black', false)).toBe(3)
  })

  it('gameOutcome klasik çarpanı kullanır (backgammon pozisyonunda 2)', () => {
    const s = st({ off: { white: 15, black: 0 }, bar: { white: 0, black: 2 } })
    expect(gameOutcome(s, true)).toEqual({ winner: 'white', multiplier: 2 })
    expect(gameOutcome(s, false)).toEqual({ winner: 'white', multiplier: 3 })
  })

  it('pes (resign) değeri de klasikte 2 ile sınırlı', () => {
    const s = st({ bar: { white: 0, black: 1 }, off: { white: 0, black: 0 } })
    expect(resignationValue(s, 'black', true)).toBe(2)
    expect(resignationValue(s, 'black', false)).toBe(3)
  })
})

describe('Klasik Tavla — küp yok', () => {
  it('cubeAvailability klasikte her zaman reddeder (CLASSIC_NO_CUBE)', () => {
    const m = newMatch(5, true)
    expect(cubeAvailability(m, 'white', false)).toEqual({ allowed: false, reason: 'CLASSIC_NO_CUBE' })
    expect(canDouble(m, 'white', false)).toBe(false)
  })

  it('normal maçta küp teklif edilebilir (regresyon)', () => {
    const m = newMatch(5, false)
    // skor 0-0, kup ortada, 1. turdan sonra -> teklif edilebilir
    expect(cubeAvailability(m, 'white', false).allowed).toBe(true)
  })

  it('klasikte zar otomatik atılır (beklenecek küp seçeneği yok)', () => {
    const m = newMatch(5, true)
    expect(shouldAutoRoll(m, 'white', 1)).toBe(true)
  })
})
