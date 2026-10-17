import { describe, expect, it } from 'vitest'
import { initialState, lossMultiplier, WHITE, BLACK } from './board'
import type { GameState } from './types'
import { resignationValue } from './resign'

// ============================================================================
// DENETİM TESTİ (Galaxy karşılaştırması 2026-10-17) — TOPLAMA-EVRESİ KAPISI.
//
// Bulgu & düzeltme: terk (resign) + timeout/AFK puanı SAF KONUMDAN türetiliyordu
//   (backend RoomController.php:2699, :4235 -> Backgammon::resignationValue;
//    frontend src/engine/resign.ts -> lossMultiplier). lossMultiplier end-of-game
//   sezgisidir (off=0 + kazananın evinde kaybeden taşı -> 3). AÇILIŞTA beyazın geri
//   taşları siyah evinde (index 23) olduğundan kapısız hesap her erken terki/timeout'u
//   BACKGAMMON(3) sayardı -> standart kural (bkgm/USBGF/WBGF: mars/backgammon yalnız
//   oyun gerçekten bitince) İHLALİ.
//
// DÜZELTME (2026-10-17): toplama-evresi kapısı geri getirildi. mars/backgammon YALNIZ
//   kazanan gerçekten bear-off evresindeyken (off>0 VEYA tüm pullar evde) sayılır; aksi
//   halde tekli(1). Para maçı gammon-kaçışı: kazanan gerçekten topluyorsa 2/3 korunur.
//
// Bu testler düzeltmeyi doğrular (hepsi YEŞİL olmalı).
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

describe('toplama-evresi kapısı: terk/timeout puanı', () => {
  it('AÇILIŞ: kazanan toplamıyor -> SINGLE(1), backgammon DEĞİL (hata düzeltildi)', () => {
    expect(resignationValue(initialState(), WHITE)).toBe(1)
    expect(resignationValue(initialState(), BLACK)).toBe(1)
  })

  it('ham lossMultiplier hâlâ 3 döner (kapı YALNIZ resign/timeout yolunda; doğal bitiş etkilenmez)', () => {
    // lossMultiplier GATELENMEZ: doğal oyun-sonu puanı için 3 doğru kalır.
    expect(lossMultiplier(initialState(), WHITE)).toBe(3)
    expect(lossMultiplier(initialState(), BLACK)).toBe(3)
  })

  it('MEŞRU backgammon: kazanan topluyor + kaybeden hiç toplamadı + barda -> 3', () => {
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
