import { describe, it, expect } from 'vitest'
import { initialState } from './board'
import { newTurn } from './game'
import { generateMoves } from './moves'
import { validateTurn } from './validateTurn'
import type { Step } from './types'

// Sunucu-otoriter tur doğrulama (Faz 2): yasal hamle kabul, hile red.
describe('validateTurn', () => {
  it('yasal tam turu kabul eder, uygular ve sırayı devreder', () => {
    const s = newTurn(initialState(), [3, 1])
    const legal = generateMoves(s)
    expect(legal.length).toBeGreaterThan(0)
    const move = legal[0]
    const res = validateTurn(s, move.steps)
    expect(res.valid).toBe(true)
    expect(res.state).toBeTruthy()
    expect(res.state!.turn).toBe('black') // white oynadı -> sıra black
    expect(res.state!.dice).toEqual([]) // zar temizlendi
  })

  it('yasa dışı step (mevcut olmayan zar) reddedilir', () => {
    const s = newTurn(initialState(), [3, 1])
    const bad: Step[] = [{ from: 23, to: 18, die: 5 }] // 5 zarı yok
    const res = validateTurn(s, bad)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('illegal-step')
  })

  it('eksik tur (oynanabilir zar bırakmak) reddedilir', () => {
    const s = newTurn(initialState(), [3, 1])
    // 2 stepli yasal bir hamle bul, yalnız ilk stepi gönder -> tur tamamlanmamış
    const twoStep = generateMoves(s).find((m) => m.steps.length === 2)
    expect(twoStep).toBeTruthy()
    const res = validateTurn(s, [twoStep!.steps[0]])
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('turn-incomplete')
  })

  it('hamle varken boş tur (pas) reddedilir', () => {
    const s = newTurn(initialState(), [3, 1])
    const res = validateTurn(s, [])
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('moves-available')
  })

  it('gerçekten hamle yoksa (dance) boş tur kabul edilir', () => {
    // Beyaz tamamen bar'da, siyah tüm giriş noktalarını (18..23) kapatmış -> giriş yok.
    const s = newTurn(initialState(), [1, 2])
    s.points = new Array(24).fill(0)
    s.bar.white = 2
    // Siyah 19..24 (index 18..23) her birine 2 taş -> beyaz bar'dan giremez (zar 1..6 hepsi kapalı)
    for (let i = 18; i <= 23; i++) s.points[i] = -2
    s.dice = [1, 2]
    s.diceUsed = [false, false]
    const res = validateTurn(s, [])
    expect(res.valid).toBe(true)
    expect(res.state!.turn).toBe('black')
  })
})
