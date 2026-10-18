import { describe, expect, it } from 'vitest'
import { initialState, lossMultiplier, WHITE, BLACK } from './board'
import type { GameState } from './types'
import { resignationValue } from './resign'

// ============================================================================
// DENETİM TESTİ — SAF POZİSYON pes/timeout puanı (kullanıcı kararı 2026-10-18).
//
// Pes (resign) + timeout/AFK puanı SAF KONUMDAN türetilir: pes eden tahtada ne
//   kaybediyorsa onu kaybeder -> resignationValue = lossMultiplier (kapı YOK).
//   Kazananın bear-off'a geçip geçmemesi FARK ETMEZ. AÇILIŞTA geri taşlar zaten
//   rakip evinde olduğundan erken terk = backgammon(3) olabilir -> kasıtlı anti-terk
//   kuralı (önceki toplama-evresi kapısı 2026-10-18'de kaldırıldı).
//
// Bu testler saf-pozisyon davranışını doğrular (hepsi YEŞİL olmalı).
// ============================================================================

function st(o: Partial<GameState>): GameState {
  return {
    points: new Array(24).fill(0),
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 },
    turn: WHITE,
    dice: [],
    diceUsed: [],
    ...o,
  }
}

describe('saf pozisyon: terk/timeout puanı', () => {
  it('AÇILIŞ: geri taşlar rakip evinde -> BACKGAMMON(3), kazananın durumuna bakılmaz', () => {
    expect(resignationValue(initialState(), WHITE)).toBe(3)
    expect(resignationValue(initialState(), BLACK)).toBe(3)
  })

  it('resign = ham lossMultiplier (ikisi de 3 döner)', () => {
    expect(lossMultiplier(initialState(), WHITE)).toBe(3)
    expect(lossMultiplier(initialState(), BLACK)).toBe(3)
  })

  it('kaybeden hiç toplamadı + barda -> 3 (kazanan toplamasa bile)', () => {
    // loser=black (frontend konvansiyonu: 2.param=kaybeden). winner=white, bear-off evresinde.
    const p = new Array(24).fill(0)
    p[0] = 10 // beyaz (kazanan) hepsi evde (0..5) -> allHome
    p[3] = 5
    const s = st({ points: p, off: { white: 0, black: 0 }, bar: { white: 0, black: 1 } })
    expect(resignationValue(s, BLACK)).toBe(3)
  })

  it('GAMMON: kazanan topluyor + kaybeden hiç toplamadı, bar/ev yok -> 2', () => {
    const p = new Array(24).fill(0)
    p[0] = 15 // beyaz (kazanan) hepsi evde
    p[10] = -15 // siyah (kaybeden) orta sahada (beyaz evi 0..5 DIŞI, bar yok)
    const s = st({ points: p, off: { white: 0, black: 0 } })
    expect(resignationValue(s, BLACK)).toBe(2)
  })

  it('SINGLE: kaybeden en az 1 taş topladı -> 1 (kapıdan bağımsız)', () => {
    const p = new Array(24).fill(0)
    p[0] = 10
    const s = st({ points: p, off: { white: 0, black: 1 } })
    expect(resignationValue(s, BLACK)).toBe(1)
  })
})
