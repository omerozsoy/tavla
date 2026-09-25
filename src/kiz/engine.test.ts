import { describe, expect, it } from 'vitest'
import {
  applyRoll,
  checkersConserved,
  endTurn,
  initialState,
  lanesTotal,
  other,
  playableLanes,
  playableSlots,
  playSlot,
  rollDice,
  TOTAL_CHECKERS,
  turnComplete,
  type KizPlayer,
  type KizState,
} from './engine'

describe('Kız Tavlası — başlangıç', () => {
  it('her oyuncuda 15 pul, doğru diziliş (6:3,5:3,4:3,3:2,2:2,1:2)', () => {
    const s = initialState()
    expect(s.lanes.white).toEqual([2, 2, 2, 3, 3, 3]) // 1..6
    expect(s.lanes.black).toEqual([2, 2, 2, 3, 3, 3])
    expect(lanesTotal(s.lanes.white)).toBe(15)
    expect(lanesTotal(s.lanes.black)).toBe(15)
    expect(s.off.white).toBe(0)
    expect(s.off.black).toBe(0)
    expect(checkersConserved(s)).toBe(true)
  })
})

describe('Kız Tavlası — normal zar', () => {
  it('zar d, d hanesinden BİR pul toplar; pul oluşup kaybolmaz', () => {
    let s = initialState('white')
    s = applyRoll(s, [6, 4], false)
    expect(playableLanes(s)).toEqual([4, 6])
    // 6 hanesini oyna (index 5, değer 6) -> slot 0
    s = playSlot(s, 0)
    expect(s.lanes.white[5]).toBe(2) // 6.hane 3 -> 2
    expect(s.off.white).toBe(1)
    expect(checkersConserved(s)).toBe(true)
    // 4 hanesini oyna (slot 1, değer 4)
    s = playSlot(s, 1)
    expect(s.lanes.white[3]).toBe(2) // 4.hane 3 -> 2
    expect(s.off.white).toBe(2)
    expect(turnComplete(s)).toBe(true)
    expect(checkersConserved(s)).toBe(true)
  })

  it('boş hane zarı OYNANAMAZ (overflow yok)', () => {
    let s = initialState('white')
    // 1.haneyi boşalt: elle iki pul topla
    s = applyRoll(s, [1, 1], true) // çift 1 -> tüm 1.hane
    s = playSlot(s, 0)
    expect(s.lanes.white[0]).toBe(0)
    s = endTurn(s) // siyah
    s = endTurn(s) // tekrar beyaz (siyah pas gibi; test için elle)
    // Not: endTurn iki kez -> beyaza döner (rakip turu boş geçildi)
    s = applyRoll(s, [1, 5], false)
    // 1.hane boş -> yalnız 5 oynanabilir
    expect(playableLanes(s)).toEqual([5])
    const slots = playableSlots(s)
    expect(slots.length).toBe(1)
    expect(s.dice[slots[0]]).toBe(5)
  })

  it('her iki hane de boşsa hamlesiz tur (turnComplete=true, off değişmez)', () => {
    let s = initialState('white')
    // 2 ve 3 hanelerini boşalt (her biri 2 pul -> çift ile temizle)
    s = applyRoll(s, [2, 2], true)
    s = playSlot(s, 0)
    s = endTurn(s)
    s = endTurn(s)
    s = applyRoll(s, [3, 3], true)
    s = playSlot(s, 0)
    s = endTurn(s)
    s = endTurn(s)
    // Şimdi 2 ve 3 boş. [2,3] at -> ikisi de boş -> hamle yok
    s = applyRoll(s, [2, 3], false)
    expect(playableSlots(s)).toEqual([])
    expect(playableLanes(s)).toEqual([])
    expect(turnComplete(s)).toBe(true)
    const offBefore = s.off.white
    s = playSlot(s, 0) // boş haneyi oynamayı dene -> değişmez
    expect(s.off.white).toBe(offBefore)
  })
})

describe('Kız Tavlası — çift zar', () => {
  it('çift (d,d) o hanedeki TÜM pulları toplar (tek kullanım)', () => {
    let s = initialState('white')
    s = applyRoll(s, [6, 6], true)
    expect(s.isDouble).toBe(true)
    expect(s.diceUsed).toEqual([false]) // çiftte tek slot
    s = playSlot(s, 0)
    expect(s.lanes.white[5]).toBe(0) // 6.hane (3 pul) tamamen boşaldı
    expect(s.off.white).toBe(3)
    expect(turnComplete(s)).toBe(true)
    expect(checkersConserved(s)).toBe(true)
  })

  it('çift ama hane boşsa oynanamaz (hamlesiz)', () => {
    let s = initialState('white')
    s = applyRoll(s, [6, 6], true)
    s = playSlot(s, 0) // 6.hane temizlendi
    s = endTurn(s)
    s = endTurn(s)
    s = applyRoll(s, [6, 6], true) // 6.hane artık boş
    expect(playableSlots(s)).toEqual([])
    expect(turnComplete(s)).toBe(true)
  })
})

describe('Kız Tavlası — galibiyet ve mars', () => {
  // lanes'ten n pul çıkar (yüksek haneden başlayarak) -> bütünlük korunur (test yardımcı).
  function drain(lanes: [number, number, number, number, number, number], n: number) {
    const l = lanes.slice() as [number, number, number, number, number, number]
    let rem = n
    for (let i = 5; i >= 0 && rem > 0; i--) {
      const take = Math.min(l[i], rem)
      l[i] -= take
      rem -= take
    }
    return l
  }

  // Bir oyuncuyu neredeyse bitmiş konuma getir (yardımcı). Rakip oppOff kadar toplamış olsun.
  function nearWin(turn: KizPlayer, oppOff: number): KizState {
    const s = initialState(turn)
    // turn oyuncusunun 6.hanesi hariç hepsini boşalt -> off = 12, 6.hanede 3 pul kalsın
    const lanes = [0, 0, 0, 0, 0, 3] as [number, number, number, number, number, number]
    return {
      ...s,
      lanes: { ...s.lanes, [turn]: lanes, [other(turn)]: drain(s.lanes[other(turn)], oppOff) },
      off: { ...s.off, [turn]: 12, [other(turn)]: oppOff },
    }
  }

  it('tüm pulları toplayan KAZANIR', () => {
    let s = nearWin('white', 5) // rakip 5 pul toplamış -> mars değil
    s = applyRoll(s, [6, 6], true) // 6.hane (3) temizlenir -> off 15
    s = playSlot(s, 0)
    expect(s.off.white).toBe(15)
    expect(s.winner).toBe('white')
    expect(s.mars).toBe(false)
    expect(checkersConserved(s)).toBe(true)
  })

  it('rakip 0 pul topladıysa MARS', () => {
    let s = nearWin('white', 0)
    s = applyRoll(s, [6, 6], true)
    s = playSlot(s, 0)
    expect(s.winner).toBe('white')
    expect(s.mars).toBe(true)
  })

  it('oyun bittikten sonra hamle/roll değişiklik yapmaz', () => {
    let s = nearWin('white', 3)
    s = applyRoll(s, [6, 6], true)
    s = playSlot(s, 0)
    const snapshot = JSON.stringify(s)
    s = applyRoll(s, [5, 5], true)
    s = playSlot(s, 0)
    s = endTurn(s)
    expect(JSON.stringify(s)).toBe(snapshot) // winner set -> tüm mutasyonlar no-op
  })
})

describe('Kız Tavlası — bütünlük (rastgele tam oyunlar)', () => {
  it('100 rastgele oyunda pul sayısı DAİMA korunur ve oyun biter', () => {
    // Deterministik PRNG (mulberry32) — testler tekrarlanabilir olsun.
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
      while (!s.winner && guard++ < 5000) {
        const { dice, isDouble } = rollDice(rng)
        s = applyRoll(s, dice, isDouble)
        // Oynanabilecek her slot'u oyna (sıra: playableSlots baştan hesaplanır)
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
