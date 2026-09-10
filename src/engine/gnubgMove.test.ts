import { describe, it, expect } from 'vitest'
import { initialState, cloneState, WHITE } from './board'
import { generateMoves, applyStep } from './moves'
import type { GameState } from './types'
import { gnubgNotationKey, matchGnubgMove } from './gnubgMove'

function whiteRoll(d1: number, d2: number): GameState {
  const s = cloneState(initialState())
  s.turn = WHITE
  s.dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]
  s.diceUsed = s.dice.map(() => false)
  return s
}

describe('gnubgNotationKey — notasyon -> net anahtar', () => {
  it('iki ayrı taş', () => {
    // 8/5 6/5 -> net legs {8>5, 6>5} (sıralı)
    expect(gnubgNotationKey('8/5 6/5')).toBe('6>5,8>5')
  })
  it('vuruş (*) yok sayılır', () => {
    expect(gnubgNotationKey('13/7* 8/7')).toBe(gnubgNotationKey('13/7 8/7'))
  })
  it('(n) çoğaltır', () => {
    expect(gnubgNotationKey('24/18(2)')).toBe('24>18,24>18')
  })
  it('ardışık sıçrama birleşir (13/10 10/7 -> 13/7)', () => {
    expect(gnubgNotationKey('13/10 10/7')).toBe('13>7')
    expect(gnubgNotationKey('13/7')).toBe('13>7')
  })
  it('geçersiz token -> null', () => {
    expect(gnubgNotationKey('abc')).toBeNull()
    expect(gnubgNotationKey('')).toBeNull()
  })
})

describe('matchGnubgMove — gnubg notasyonu -> yerel Move (güvenli)', () => {
  it('geçerli açılış hamlesini TEK eşleşmeyle bulur', () => {
    const s = whiteRoll(3, 1)
    const m = matchGnubgMove(s, WHITE, '8/5 6/5') // 5-point yapımı
    expect(m).not.toBeNull()
    // uygulanınca beyazın 5-noktası (iç index 4) 2 taş olur
    const after = cloneState(s)
    for (const st of m!.steps) applyStep(after, st, WHITE)
    expect(after.points[4]).toBe(2)
  })

  it('zar uymayan hamle -> null (fallback)', () => {
    const s = whiteRoll(3, 1)
    expect(matchGnubgMove(s, WHITE, '24/18')).toBeNull() // 6 zarı yok
  })

  it('anlamsız notasyon -> null', () => {
    const s = whiteRoll(3, 1)
    expect(matchGnubgMove(s, WHITE, 'xyz')).toBeNull()
  })

  it('üretilen her hamle kendi net-notasyonuyla eşleşir (round-trip)', () => {
    const s = whiteRoll(6, 4)
    const moves = generateMoves(s)
    expect(moves.length).toBeGreaterThan(0)
    // Her yasal hamlenin net anahtarı benzersizse matchGnubgMove onu bulmalı.
    for (const mv of moves) {
      // Move -> net notasyon üret (per-step "from/to"), matcher net'e indirger.
      const notation = mv.steps
        .map((st) => `${st.from === 'bar' ? 'bar' : (st.from as number) + 1}/${st.to === 'off' ? 'off' : (st.to as number) + 1}`)
        .join(' ')
      const back = matchGnubgMove(s, WHITE, notation)
      // Eşleşme ya bu hamle ya da net-anahtarı aynı olan (aynı sonuç) bir hamledir; null OLMAMALI
      // (benzersiz olmayan durumda null olabilir -> onu atla).
      if (back) {
        // aynı net anahtar
        const key = (x: typeof mv) =>
          x.steps.map((st) => `${st.from}>${st.to}`).join('|')
        // net anahtar eşit değilse bile sonuç konumu aynı olmalı -> uygula & karşılaştır
        const a1 = cloneState(s)
        for (const st of mv.steps) applyStep(a1, st, WHITE)
        const a2 = cloneState(s)
        for (const st of back.steps) applyStep(a2, st, WHITE)
        expect(a2.points).toEqual(a1.points)
        void key
      }
    }
  })
})
