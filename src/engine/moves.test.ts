import { describe, expect, it } from 'vitest'
import type { GameState } from './types'
import { initialState, WHITE, BLACK } from './board'
import { applyStep, generateMoves, hasNoMove, singleDieSteps } from './moves'

// Bos tahta iskeleti olustur (test kurulumu icin)
function emptyState(turn: GameState['turn'] = WHITE): GameState {
  return {
    points: new Array(24).fill(0),
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 },
    turn,
    dice: [],
    diceUsed: [],
  }
}

describe('baslangic dizilimi', () => {
  it('her oyuncunun 15 tasi olmali', () => {
    const s = initialState()
    const white = s.points.filter((v) => v > 0).reduce((a, b) => a + b, 0)
    const black = -s.points.filter((v) => v < 0).reduce((a, b) => a + b, 0)
    expect(white).toBe(15)
    expect(black).toBe(15)
  })
})

describe('singleDieSteps - temel hareket', () => {
  it('beyaz 24. ucgenden zar 2 ile 22. ucgene gider', () => {
    const s = emptyState(WHITE)
    s.points[23] = 2 // 24. ucgen (index 23)
    const steps = singleDieSteps(s, WHITE, 2)
    expect(steps).toContainEqual({ from: 23, to: 21, die: 2 })
  })

  it('bloke ucgene girilemez', () => {
    const s = emptyState(WHITE)
    s.points[23] = 1
    s.points[21] = -2 // siyahin 2 tasi -> bloke
    const steps = singleDieSteps(s, WHITE, 2)
    expect(steps.find((st) => st.to === 21)).toBeUndefined()
  })
})

describe('bar kurallari', () => {
  it('bar varken once giris zorunlu', () => {
    const s = emptyState(WHITE)
    s.bar.white = 1
    s.points[10] = 3
    const steps = singleDieSteps(s, WHITE, 3)
    // Sadece bar girisi olmali, tahta ici hareket olmamali
    expect(steps.every((st) => st.from === 'bar')).toBe(true)
    // beyaz zar 3 ile 24-3 = index 21'e girer
    expect(steps).toContainEqual({ from: 'bar', to: 21, die: 3 })
  })

  it('giris ucgeni blokeyse giris yok', () => {
    const s = emptyState(WHITE)
    s.bar.white = 1
    s.points[21] = -2
    const steps = singleDieSteps(s, WHITE, 3)
    expect(steps.length).toBe(0)
  })
})

describe('bear off kurallari', () => {
  it('tam zar ile bear off', () => {
    const s = emptyState(WHITE)
    s.points[2] = 1 // 3. ucgen -> pip 3
    const steps = singleDieSteps(s, WHITE, 3)
    expect(steps).toContainEqual({ from: 2, to: 'off', die: 3 })
  })

  it('fazla zar ile bear off sadece en uzak tas icin', () => {
    const s = emptyState(WHITE)
    s.points[2] = 1 // 3. ucgen (pip 3) - en uzak
    s.points[0] = 1 // 1. ucgen (pip 1)
    // zar 5: sadece en uzaktaki (index 2) bear off olabilir
    const steps = singleDieSteps(s, WHITE, 5)
    expect(steps).toContainEqual({ from: 2, to: 'off', die: 5 })
    // index 0'dan zar 5 ile bear off OLMAMALI (daha uzakta tas var)
    expect(steps.find((st) => st.from === 0 && st.to === 'off')).toBeUndefined()
  })

  it('ev disinda tas varken bear off yok', () => {
    const s = emptyState(WHITE)
    s.points[2] = 1
    s.points[10] = 1 // ev disinda
    const steps = singleDieSteps(s, WHITE, 3)
    expect(steps.find((st) => st.to === 'off')).toBeUndefined()
  })
})

describe('maksimum zar kullanimi', () => {
  it('iki zar da oynanabiliyorsa iki step zorunlu', () => {
    const s = emptyState(WHITE)
    s.points[23] = 2
    s.dice = [6, 5]
    const moves = generateMoves(s)
    // Tum hamleler 2 step kullanmali
    expect(moves.every((m) => m.steps.length === 2)).toBe(true)
  })

  it('sadece tek zar oynanabildiginde buyuk zar zorunlu', () => {
    // Tek beyaz tas index 7'de. zar [6,1].
    //   6 ile 7->1 (bos, gecerli), sonra 1 ile 1->0 -> index 0 BLOKE (siyah 2 tas) -> durur (1 step)
    //   1 ile 7->6 (bos, gecerli), sonra 6 ile 6->0 -> index 0 BLOKE -> durur (1 step)
    // Yani iki zardan yalnizca BIRI oynanabilir; kural geregi buyuk (6) zorunlu.
    const s = emptyState(WHITE)
    s.points[7] = 1
    s.points[0] = -2 // index 0 bloke: her iki tek-zar yolu da ikinci adimda durur
    s.dice = [6, 1]
    const moves = generateMoves(s)
    expect(moves.length).toBe(1)
    expect(moves[0].steps.length).toBe(1)
    expect(moves[0].steps[0].die).toBe(6) // kucuk (1) degil, buyuk (6) oynanmali
    expect(moves[0].steps[0]).toEqual({ from: 7, to: 1, die: 6 })
  })

  it('buyuk zar oynanamiyorsa kucuk zara dusulur', () => {
    // Tek beyaz tas index 4'te. zar [6,3].
    //   6 ile 4->-2 (tahta disi, ev degil -> bear off yok) -> oynanamaz
    //   3 ile 4->1 (bos, gecerli), sonra 6 index 1'den oynanamaz (evde ama pip 2<6 ve daha uzak tas yok -> bear off... )
    // Bear off karismasin diye ev disi ek tas koyalim:
    const s = emptyState(WHITE)
    s.points[4] = 1
    s.points[15] = 1 // ev disinda tas -> bear off engellenir, boylece 6 hicbir yere oynanamaz*
    // *not: index 15'ten 6 ile 15->9 mumkun. Bunu bloke edelim ki yalniz kucuk zar senaryosu kalsin.
    s.points[9] = -2 // 15-6=9 bloke
    s.points[12] = -2 // 15-3=12 bloke -> index 15 tasi hic oynanamaz
    // Simdi yalniz index 4 tasi: 6 ile disari (bear off yok cunku ev disi tas var) -> gecersiz; 3 ile 4->1 gecerli.
    s.dice = [6, 3]
    const moves = generateMoves(s)
    expect(moves.length).toBe(1)
    expect(moves[0].steps.length).toBe(1)
    expect(moves[0].steps[0].die).toBe(3) // buyuk (6) oynanamaz -> kucuk (3) oynanir
    expect(moves[0].steps[0]).toEqual({ from: 4, to: 1, die: 3 })
  })
})

// BUYUK-ZAR KURALI — GERCEK SENARYOLAR (oyuncu raporu: "1 zar başka hamlesi varken oto oynandı").
// Kural (backgammon): iki FARKLI zardan yalnız BİRİ oynanabiliyorsa BÜYÜĞÜ oynamak ZORUNLU.
// generateMoves bunu maximalTerminals içinde uygular -> tek sonuç kalırsa oto-oyna DOĞRU tetiklenir.
describe('buyuk-zar kurali — gercek senaryolar', () => {
  it('bear-off bitisi: son tas pip 1, [6,2] -> BUYUK zar (6) ile toplanir (RRJV7 endgame tipi)', () => {
    // Oyun sonu: 14 tas toplanmis, son tas 1. hanede (index 0). [6,2] gelir.
    // Her iki zar da tek başına bear-off yapar; ikisi birlikte oynanamaz (tek tas). Kural: 6 zorunlu.
    // Kullanicinin "2 ile de oynardim" dedigi hamle YASAK -> motor 6'yi oto-oynar (sonuç aynı: tas dışarı).
    const s = emptyState(WHITE)
    s.points[0] = 1
    s.off.white = 14
    s.dice = [6, 2]
    const moves = generateMoves(s)
    expect(moves.length).toBe(1)
    expect(moves[0].steps.length).toBe(1)
    expect(moves[0].steps[0]).toEqual({ from: 0, to: 'off', die: 6 })
  })

  it('bloke kosucu: [5,3], her iki tek-zar yolu 2. adimda bloke -> 5 zorunlu, 3-yalniz REDDEDILIR', () => {
    // Beyaz tek tas index 9. index 1 rakip blok (>=2). 5->4 sonra 3->1 bloke; 3->6 sonra 5->1 bloke.
    // Yani tek zar oynanir; kural 5 (buyuk) der. Kritik: 3'ü tek başına oynama SEÇENEK OLMAMALI.
    const s = emptyState(WHITE)
    s.points[9] = 1
    s.points[1] = -2
    s.dice = [5, 3]
    const moves = generateMoves(s)
    expect(moves.length).toBe(1)
    expect(moves[0].steps.length).toBe(1)
    expect(moves[0].steps[0]).toEqual({ from: 9, to: 4, die: 5 })
    // 3'ü tek başına oynayan (9->6) HERHANGI bir tam-hamle OLMAMALI (kural onu eler).
    expect(moves.some((m) => m.steps.some((st) => st.die === 3))).toBe(false)
  })

  it('SIYAH bloke kosucu: [5,3] -> 5 (buyuk) zorunlu, yon +die', () => {
    // Siyah tek tas index 14 (soldan saga). index 22 beyaz blok (>=2 pozitif).
    // 5: 14->19 sonra 3: 19->22 bloke; 3: 14->17 sonra 5: 17->22 bloke -> tek zar; buyuk (5) zorunlu.
    const s = emptyState(BLACK)
    s.points[14] = -1
    s.points[22] = 2
    s.dice = [5, 3]
    const moves = generateMoves(s)
    expect(moves.length).toBe(1)
    expect(moves[0].steps.length).toBe(1)
    expect(moves[0].steps[0]).toEqual({ from: 14, to: 19, die: 5 })
  })

  it('NEGATIF kontrol: iki farkli zar da oynanabiliyorsa kural DEVREYE GIRMEZ (secim korunur)', () => {
    // Iki ayri tas: index 12 ve index 8. [6,3]. Her tas her zari oynayabilir, farkli sonuclar cikar
    // -> moves.length > 1 -> oto-oyna TETIKLENMEZ (oyuncunun secimi elinden alinmaz). Kullanicinin
    // korktugu durum: gercek secim varken oto-oyna. Bu test onun OLMADIGINI kanitlar.
    const s = emptyState(WHITE)
    s.points[12] = 1
    s.points[8] = 1
    s.dice = [6, 3]
    const moves = generateMoves(s)
    expect(moves.length).toBeGreaterThan(1)
    expect(moves.every((m) => m.steps.length === 2)).toBe(true) // iki zar da kullanilir (maks kural)
  })
})

describe('cift zar (double) - dort hamle', () => {
  it('4-4 tek tasla dort adet 4 hamlesi uretir', () => {
    // Cift zar motora [d,d,d,d] olarak gelir.
    const s = emptyState(WHITE)
    s.points[20] = 1 // yol acik: 20->16->12->8->4
    s.dice = [4, 4, 4, 4]
    const moves = generateMoves(s)
    expect(moves.length).toBeGreaterThan(0)
    // Maksimum kullanim: dort step zorunlu
    expect(moves.every((m) => m.steps.length === 4)).toBe(true)
    // Tek tas oldugundan sonuc index 4'te olmali
    const seq = moves[0].steps
    expect(seq[seq.length - 1].to).toBe(4)
    expect(seq.every((st) => st.die === 4)).toBe(true)
  })

  it('cift zarda blok sadece oynanabilen kadarini zorlar', () => {
    // Tek tas index 20; 20->16->12 sonra 12->8 BLOKE -> en fazla 2 step.
    const s = emptyState(WHITE)
    s.points[20] = 1
    s.points[8] = -2 // 12-4=8 bloke
    s.dice = [4, 4, 4, 4]
    const moves = generateMoves(s)
    expect(moves.every((m) => m.steps.length === 2)).toBe(true)
    expect(moves[0].steps[moves[0].steps.length - 1].to).toBe(12)
  })
})

describe('vurma (hit)', () => {
  it('tek rakip tas (blot) vurulur ve bara gonderilir', () => {
    const s = emptyState(WHITE)
    s.points[7] = 1
    s.points[5] = -1 // siyah blot (index 5)
    const steps = singleDieSteps(s, WHITE, 2)
    const hit = steps.find((st) => st.to === 5)
    expect(hit).toBeDefined()
    applyStep(s, hit!, WHITE)
    expect(s.bar.black).toBe(1) // vurulan siyah tas bara
    expect(s.points[5]).toBe(1) // beyaz tas noktaya yerlesti
    expect(s.points[7]).toBe(0) // kaynak bosaldi
  })

  it('rakibin 2+ tasi olan nokta bloke, vurulamaz', () => {
    const s = emptyState(WHITE)
    s.points[7] = 1
    s.points[5] = -2 // siyah 2 tas -> bloke
    const steps = singleDieSteps(s, WHITE, 2)
    expect(steps.find((st) => st.to === 5)).toBeUndefined()
  })
})

describe('hamle yoksa pas', () => {
  it('hicbir zar oynanamiyorsa bos hamle doner', () => {
    const s = emptyState(WHITE)
    s.bar.white = 1
    s.points[18] = -2 // index 18 (zar 6 girisi) bloke
    s.points[19] = -2 // zar 5
    s.points[20] = -2 // zar 4
    s.points[21] = -2 // zar 3
    s.dice = [6, 3]
    const moves = generateMoves(s)
    expect(hasNoMove(moves)).toBe(true)
  })
})

describe('siyah yon kontrolu', () => {
  it('siyah 1. ucgenden zar 2 ile 3. ucgene gider', () => {
    const s = emptyState(BLACK)
    s.points[0] = -2 // 1. ucgen
    const steps = singleDieSteps(s, BLACK, 2)
    expect(steps).toContainEqual({ from: 0, to: 2, die: 2 })
  })
})
