import { describe, it, expect } from 'vitest'
import { initialState, cloneState } from '../engine/board'
import { maximalTerminals, boardKey, applyStep } from '../engine/moves'
import { reconstructOppMove, oppMoveBase } from './oppMove'
import { replayStartIndex } from './liveMoves'
import type { GameState, Player, Step } from '../engine/types'

// §5.2 ONAYLI RAKİP HAMLESİ REPLAY — DOĞRULUK/YAKINSAMA kanıtı (gerçek motor).
//
// Belirti 4: rakip hamlesi onaylanınca tahta SON konuma sıçrıyordu. §5.2 bunu otoriter delta'dan
// (reconstructOppMove) adım adım oynatır. Bu test, App.tsx'in çizdiği kare dizisini —
// applyPlayed(base, steps.slice(0,k)) = cloneState + fold applyStep — birebir taklit edip İKİ ŞEYİ
// kanıtlar (tarayıcı gerekmez, deterministik):
//   1) SON kare TAM OLARAK otoriter tahtaya eşit (tamamlanma ölçütü: "animasyon bitince ekran
//      yetkili durumla eşleşmeli"), ve
//   2) ara kareler hem başlangıçtan hem bitişten FARKLI + her adım bir öncekinden farklı (gerçekten
//      ADIM ADIM geçiyor, "bir anda tamamlanmış" SNAP DEĞİL).

const turnOf = (base: GameState, player: Player, dice: number[]): GameState => ({
  ...cloneState(base),
  turn: player,
  dice,
  diceUsed: dice.map(() => false),
})

// App.tsx applyPlayed'in birebir eşi (clone + sıralı applyStep).
const frameAt = (base: GameState, steps: Step[], k: number): GameState => {
  const s = cloneState(base)
  for (let i = 0; i < k; i++) applyStep(s, steps[i], base.turn)
  return s
}

describe('oppReplay — otoriter hamleyi adım adım oynatma yakınsar + snap değil', () => {
  // Çift zar (3-3-3-3): çok adımlı bir hamle garanti eder -> adım-adım'ın anlamı test edilir.
  const prev = turnOf(initialState(), 'black', [3, 3, 3, 3])
  const terms = maximalTerminals(prev)
  const term = terms.find((t) => t.steps.length >= 2) ?? terms[0]
  // "Otoriter" hamle sonrası tahta (sunucudan gelmiş gibi): sıra RAKİBE (white) döner, zar sıfırlanır.
  const next: GameState = { ...cloneState(term.state), turn: 'white', dice: [], diceUsed: [] }

  it('ön koşul: çok adımlı maksimal hamle bulundu', () => {
    expect(term.steps.length).toBeGreaterThanOrEqual(2)
  })

  const steps = reconstructOppMove(prev, next)
  it('reconstruct otoriter tahtadan adımları geri üretir', () => {
    expect(steps).not.toBeNull()
    expect((steps as Step[]).length).toBeGreaterThanOrEqual(2)
  })

  it('SON kare otoriter tahtaya TAM eşit (yakınsama) + ilk kare başlangıç', () => {
    const s = steps as Step[]
    expect(boardKey(frameAt(prev, s, 0))).toBe(boardKey(prev))
    expect(boardKey(frameAt(prev, s, s.length))).toBe(boardKey(next))
  })

  it('ara kareler başlangıç ve bitişten FARKLI (snap değil, adım adım)', () => {
    const s = steps as Step[]
    for (let k = 1; k < s.length; k++) {
      const key = boardKey(frameAt(prev, s, k))
      expect(key, `kare ${k} başlangıçtan farklı olmalı`).not.toBe(boardKey(prev))
      expect(key, `kare ${k} bitişten farklı olmalı`).not.toBe(boardKey(next))
    }
  })

  it('her kare bir öncekinden farklı (tek tek ilerleyen reveal)', () => {
    const s = steps as Step[]
    for (let k = 1; k <= s.length; k++) {
      expect(boardKey(frameAt(prev, s, k))).not.toBe(boardKey(frameAt(prev, s, k - 1)))
    }
  })

  it('canlı önizleme ile süreklilik: hiç gösterilmediyse baştan, tamamı gösterildiyse atla', () => {
    const s = steps as Step[]
    expect(replayStartIndex([], s)).toBe(0) // önizleme yok -> tam replay
    expect(replayStartIndex(s, s)).toBe(s.length) // önizleme tamamını gösterdi -> replay atlanır
  })
})

// RAKIP ZAR/HAMLE GECIKMESI — KÖK NEDEN YENİDEN ÜRETİMİ + FIX (RAKIP_ZAR_HAMLE_GECIKMESI_RAPORU).
//
// Belirti: "rakibin zarı çok geç görünüyor; zar görünene kadar rakip hamlelerini yapmış oluyor".
// Kök: push yalnız "poll et" sinyali; poll EN TAZE sürümü çeker, aradaki sürümü oynatmaz. Rakip bir
// poll turundan kısa sürede (hızlı oyuncu/bot/çift zar) hem atıp hem oynarsa, istemci rakibin
// "zar atıldı-ama-oynanmadı" ara durumunu HİÇ uygulamaz -> ekrandaki tur-başı (`prev`) ZARSIZDIR.
// Eski kod `reconstructOppMove(prev,...)`i `prev.dice` dolu değilse HİÇ çağırmazdı -> hamle adım
// adım oynanmaz, tahta SNAP eder, rakibin zarı son tahtayla aynı anda (geç) görünür.
describe('rakip ara-durum kaçtığında (snap kökü) oppMoveBase zarı lastMove ile tamamlar', () => {
  const start = turnOf(initialState(), 'black', [3, 3, 3, 3]) // rakibin GERÇEK tur-başı (zarlı)
  const term = maximalTerminals(start).find((t) => t.steps.length >= 2) ?? maximalTerminals(start)[0]
  const next: GameState = { ...cloneState(term.state), turn: 'white', dice: [], diceUsed: [] }
  const lastMove = { color: 'black' as Player, dice: [3, 3, 3, 3] } // sunucunun kaydettiği TAM zar
  const baseline = reconstructOppMove(start, next) as Step[] // ara-durum yakalanınca (sağlıklı yol)

  it('ÖN KOŞUL: sağlıklı yolda (prev zarlı) reconstruct zaten çalışıyor', () => {
    expect(baseline).not.toBeNull()
    expect(baseline.length).toBeGreaterThanOrEqual(2)
  })

  it('BUG YENİDEN ÜRETİMİ: ara-durum kaçınca prev ZARSIZ -> eski yol reconstruct null (SNAP)', () => {
    const prevNoDice: GameState = { ...initialState(), turn: 'black', dice: [], diceUsed: [] }
    expect(reconstructOppMove(prevNoDice, next)).toBeNull() // <- snap'in kanıtı
  })

  it('FIX: oppMoveBase zarsız prev + lastMove ile tabanı kurar -> reconstruct ADIMLARI üretir', () => {
    // (a) ara-durum kaçtı, sıra zaten rakibe geçmiş görünüyor ama zar yok
    const prevNoDice: GameState = { ...initialState(), turn: 'black', dice: [], diceUsed: [] }
    const baseA = oppMoveBase(prevNoDice, next, lastMove, 'white')
    expect(baseA).not.toBeNull()
    expect((baseA as GameState).dice).toEqual([3, 3, 3, 3]) // çift zar TAM korunur (4 eleman)
    const stepsA = reconstructOppMove(baseA as GameState, next) as Step[]
    expect(stepsA).not.toBeNull()
    expect(boardKey(frameAt(baseA as GameState, stepsA, stepsA.length))).toBe(boardKey(next))

    // (b) ara-durum kaçtı, ekranda HÂLÂ benim tarafım (turn=white) görünüyor
    const prevMine: GameState = { ...initialState(), turn: 'white', dice: [], diceUsed: [] }
    const baseB = oppMoveBase(prevMine, next, lastMove, 'white')
    expect(baseB).not.toBeNull()
    const stepsB = reconstructOppMove(baseB as GameState, next) as Step[]
    expect(boardKey(frameAt(baseB as GameState, stepsB, stepsB.length))).toBe(boardKey(next))
  })

  it('REGRESYON YOK: ara-durum yakalanınca (prev zarlı) oppMoveBase prev.dice kullanır', () => {
    const base = oppMoveBase(start, next, lastMove, 'white')
    expect(base).not.toBeNull()
    const s = reconstructOppMove(base as GameState, next) as Step[]
    expect(boardKey(frameAt(base as GameState, s, s.length))).toBe(boardKey(next))
  })

  it('GÜVENLİK kapıları: kendi hamlem / prev yok / hamle tamamlanmamış -> null', () => {
    const prevMine: GameState = { ...initialState(), turn: 'white', dice: [], diceUsed: [] }
    expect(oppMoveBase(prevMine, next, { color: 'white', dice: [3, 3] }, 'white')).toBeNull() // lastMove BENİM
    expect(oppMoveBase(null, next, lastMove, 'white')).toBeNull() // prev yok
    const stillOpp: GameState = { ...initialState(), turn: 'black', dice: [3, 3, 3, 3], diceUsed: [false, false, false, false] }
    expect(oppMoveBase(prevMine, stillOpp, lastMove, 'white', false)).toBeNull() // next hâlâ rakipte -> oynamadı
  })
})
