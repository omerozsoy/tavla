import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { generateMoves, hasNoMove } from './moves'

// "6 kapımda kapalı iken gele attığında giremiyor" senaryosu: bar'daki oyuncu, rakip TÜM
// giriş noktalarını (2+ taşla) kapattığı için giremez -> DANCE. Motor bunu doğru ele almalı:
// generateMoves TEK bir boş hamle döndürür (hasNoMove=true), HİÇBİR hayali step üretmez.
function state(partial: Partial<GameState>): GameState {
  return {
    points: Array(24).fill(0),
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 },
    turn: 'white',
    dice: [3, 4],
    diceUsed: [false, false],
    ...partial,
  }
}

describe('dance (closeout) — hayali hamle olmamalı', () => {
  it('beyaz bar\'da, siyah tüm giriş noktalarını (18-23) kapatmış -> DANCE, no move', () => {
    const points = Array(24).fill(0)
    // Siyah beyazın giriş bölgesini (index 18-23) tamamen kapatır (her noktada 2+ siyah).
    for (let i = 18; i <= 23; i++) points[i] = -2
    const s = state({ turn: 'white', bar: { white: 1, black: 0 }, dice: [3, 4], points })

    const moves = generateMoves(s)
    expect(hasNoMove(moves)).toBe(true) // tek boş hamle
    expect(moves.length).toBe(1)
    expect(moves[0].steps.length).toBe(0) // HİÇBİR hayali step
  })

  it('siyah bar\'da, beyaz tüm giriş noktalarını (0-5) kapatmış -> DANCE, no move', () => {
    const points = Array(24).fill(0)
    for (let i = 0; i <= 5; i++) points[i] = 2 // beyaz siyahın giriş bölgesini kapatır
    const s = state({ turn: 'black', bar: { white: 0, black: 1 }, dice: [2, 5], points })

    const moves = generateMoves(s)
    expect(hasNoMove(moves)).toBe(true)
    expect(moves[0].steps.length).toBe(0)
  })

  it('KISMİ: bir zar girebiliyor -> yalnız o giriş hamlesi (hayali diğer step yok)', () => {
    const points = Array(24).fill(0)
    // 5 noktayı kapat (18-22), 23\'ü (die=1 girişi) AÇIK bırak.
    for (let i = 18; i <= 22; i++) points[i] = -2
    const s = state({ turn: 'white', bar: { white: 1, black: 0 }, dice: [1, 4], points })

    const moves = generateMoves(s)
    expect(hasNoMove(moves)).toBe(false)
    // Her tam hamle bar\'dan girişle BAŞLAMALI (giremeden başka taş oynatılamaz).
    for (const m of moves) {
      expect(m.steps.length).toBeGreaterThan(0)
      expect(m.steps[0].from).toBe('bar')
    }
  })
})
