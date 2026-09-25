import { describe, expect, it } from 'vitest'
import {
  applyRoll,
  checkersConserved,
  endTurn,
  initialState,
  lanesTotal,
  other,
  phaseOf,
  playableLanes,
  playableSlots,
  playSlot,
  rollDice,
  TOTAL_CHECKERS,
  turnComplete,
  type KizPlayer,
  type KizState,
} from './engine'

describe('Kız Tavlası (iki fazlı) — başlangıç', () => {
  it('15 pul kapalı, doğru diziliş, açma fazı', () => {
    const s = initialState()
    expect(s.closed.white).toEqual([2, 2, 2, 3, 3, 3])
    expect(s.open.white).toEqual([0, 0, 0, 0, 0, 0])
    expect(s.off.white).toBe(0)
    expect(lanesTotal(s.closed.white)).toBe(15)
    expect(phaseOf(s, 'white')).toBe('acma')
    expect(phaseOf(s, 'black')).toBe('acma')
    expect(checkersConserved(s)).toBe(true)
  })
})

describe('Kız Tavlası — AÇMA fazı (indirme)', () => {
  it('zar d, d hanesinden BİR pulu kapalı->açık indirir', () => {
    let s = initialState('white')
    s = applyRoll(s, [6, 4], false)
    expect(playableLanes(s)).toEqual([4, 6])
    s = playSlot(s, 0) // 6 hanesi
    expect(s.closed.white[5]).toBe(2) // 3 -> 2 kapalı
    expect(s.open.white[5]).toBe(1) // 1 açık
    expect(s.off.white).toBe(0) // açma fazında off ARTMAZ
    expect(checkersConserved(s)).toBe(true)
    s = playSlot(s, 1) // 4 hanesi
    expect(s.closed.white[3]).toBe(2)
    expect(s.open.white[3]).toBe(1)
    expect(turnComplete(s)).toBe(true)
  })

  it('çift zar açma fazında o hanenin TÜM kapalılarını indirir', () => {
    let s = initialState('white')
    s = applyRoll(s, [6, 6], true)
    s = playSlot(s, 0)
    expect(s.closed.white[5]).toBe(0)
    expect(s.open.white[5]).toBe(3) // 3 kapalı -> 3 açık
    expect(s.off.white).toBe(0)
    expect(checkersConserved(s)).toBe(true)
  })

  it('kapalı pul yoksa o zar açma fazında oynanamaz', () => {
    let s = initialState('white')
    s = applyRoll(s, [6, 6], true)
    s = playSlot(s, 0) // 6 hanesi tamamen açıldı (kapalı[6]=0)
    s = endTurn(s)
    s = endTurn(s)
    s = applyRoll(s, [6, 3], false)
    // 6 hanesinde kapalı yok -> yalnız 3 oynanabilir
    expect(playableLanes(s)).toEqual([3])
  })
})

describe('Kız Tavlası — faz geçişi', () => {
  it('tüm pullar indirilince toplama fazına geçilir', () => {
    let s = initialState('white')
    // Beyazın tüm kapalılarını elle açık yap (faz geçişini test et)
    s = { ...s, closed: { ...s.closed, white: [0, 0, 0, 0, 0, 0] }, open: { ...s.open, white: [2, 2, 2, 3, 3, 3] } }
    expect(phaseOf(s, 'white')).toBe('toplama')
    expect(checkersConserved(s)).toBe(true)
  })

  it('son kapalı indirilince İKİNCİ zar aynı turda toplama fazında oynanır', () => {
    let s = initialState('white')
    // Beyazda yalnız 6 hanesinde 1 kapalı kalsın; 5 hanesinde 2 açık olsun
    s = {
      ...s,
      closed: { ...s.closed, white: [0, 0, 0, 0, 0, 1] },
      open: { ...s.open, white: [0, 0, 0, 0, 2, 0] },
      off: { ...s.off, white: 12 },
    }
    expect(phaseOf(s, 'white')).toBe('acma')
    s = applyRoll(s, [6, 5], false)
    // 6: açma (kapalı indir), 5: henüz açma fazında ama kapalı[5]=0 -> başta oynanamaz
    expect(playableLanes(s)).toEqual([6])
    s = playSlot(s, 0) // 6 kapalı indirildi -> kapalı=0 -> TOPLAMA fazı
    expect(phaseOf(s, 'white')).toBe('toplama')
    // Artık 5 zarı toplama fazında oynanabilir (5 hanesinde 3 açık: 2 eski + 1 yeni indirilen)
    expect(s.open.white[4]).toBe(2)
    expect(s.open.white[5]).toBe(1)
    expect(playableLanes(s)).toEqual([5]) // yalnız 5 (6 zarı kullanıldı)
    s = playSlot(s, 1) // 5 hanesinden bir açık topla
    expect(s.open.white[4]).toBe(1)
    expect(s.off.white).toBe(13)
    expect(checkersConserved(s)).toBe(true)
  })
})

describe('Kız Tavlası — TOPLAMA fazı', () => {
  function allOpen(turn: KizPlayer, off: number): KizState {
    const s = initialState(turn)
    return {
      ...s,
      closed: { white: [0, 0, 0, 0, 0, 0], black: [0, 0, 0, 0, 0, 0] },
      open: { ...s.open, [turn]: [2, 2, 2, 3, 3, 3], [other(turn)]: [2, 2, 2, 3, 3, 3] },
      off: { ...s.off, [turn]: off },
    }
  }

  it('toplama fazında zar d, d hanesinden açık pulu off yapar', () => {
    let s = allOpen('white', 0)
    expect(phaseOf(s, 'white')).toBe('toplama')
    s = applyRoll(s, [6, 4], false)
    s = playSlot(s, 0)
    expect(s.open.white[5]).toBe(2) // 3 -> 2 açık
    expect(s.off.white).toBe(1)
    expect(checkersConserved(s)).toBe(true)
  })

  it('çift toplama fazında o hanenin tüm açıklarını toplar', () => {
    let s = allOpen('white', 0)
    s = applyRoll(s, [6, 6], true)
    s = playSlot(s, 0)
    expect(s.open.white[5]).toBe(0)
    expect(s.off.white).toBe(3)
  })

  it('açık pul yoksa o zar toplama fazında oynanamaz; ikisi de yoksa hamlesiz', () => {
    let s = allOpen('white', 0)
    // 5 ve 6 hanelerini boşalt (çiftlerle)
    s = applyRoll(s, [6, 6], true); s = playSlot(s, 0); s = endTurn(s); s = endTurn(s)
    s = applyRoll(s, [5, 5], true); s = playSlot(s, 0); s = endTurn(s); s = endTurn(s)
    s = applyRoll(s, [5, 6], false)
    expect(playableSlots(s)).toEqual([])
    expect(turnComplete(s)).toBe(true)
  })
})

describe('Kız Tavlası — galibiyet ve mars', () => {
  function nearWin(turn: KizPlayer, oppOff: number): KizState {
    const s = initialState(turn)
    const oppOpen: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, Math.max(0, 15 - oppOff)]
    return {
      ...s,
      closed: { white: [0, 0, 0, 0, 0, 0], black: [0, 0, 0, 0, 0, 0] },
      open: { ...s.open, [turn]: [0, 0, 0, 0, 0, 3], [other(turn)]: oppOpen },
      off: { ...s.off, [turn]: 12, [other(turn)]: oppOff },
    }
  }

  it('tüm pulları toplayan kazanır (mars değil)', () => {
    let s = nearWin('white', 5)
    s = applyRoll(s, [6, 6], true)
    s = playSlot(s, 0)
    expect(s.off.white).toBe(15)
    expect(s.winner).toBe('white')
    expect(s.mars).toBe(false)
    expect(checkersConserved(s)).toBe(true)
  })

  it('rakip 0 topladıysa MARS', () => {
    let s = nearWin('white', 0)
    s = applyRoll(s, [6, 6], true)
    s = playSlot(s, 0)
    expect(s.winner).toBe('white')
    expect(s.mars).toBe(true)
  })

  it('oyun bitince mutasyon yok', () => {
    let s = nearWin('white', 3)
    s = applyRoll(s, [6, 6], true)
    s = playSlot(s, 0)
    const snap = JSON.stringify(s)
    s = applyRoll(s, [5, 5], true)
    s = playSlot(s, 0)
    s = endTurn(s)
    expect(JSON.stringify(s)).toBe(snap)
  })
})

describe('Kız Tavlası — bütünlük (100 rastgele tam oyun)', () => {
  it('pul DAİMA korunur, iki faz işler ve oyun biter', () => {
    function makeRng(seed: number) {
      let a = seed >>> 0
      return () => {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }
    for (let game = 0; game < 100; game++) {
      const rng = makeRng(game + 1)
      let s = initialState(game % 2 === 0 ? 'white' : 'black')
      let guard = 0
      while (!s.winner && guard++ < 20000) {
        const { dice, isDouble } = rollDice(rng)
        s = applyRoll(s, dice, isDouble)
        let slots = playableSlots(s)
        while (slots.length > 0 && !s.winner) {
          s = playSlot(s, slots[0])
          slots = playableSlots(s)
        }
        expect(checkersConserved(s)).toBe(true)
        if (!s.winner) s = endTurn(s)
      }
      expect(s.winner).not.toBeNull()
      expect(s.off[s.winner as KizPlayer]).toBe(TOTAL_CHECKERS)
      expect(checkersConserved(s)).toBe(true)
    }
  })
})
