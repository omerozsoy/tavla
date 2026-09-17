import { describe, it, expect } from 'vitest'
import { computeMatchSummary } from './matchSummary'
import type { LogEntry } from '../ui/MatchReport'
import type { GameState } from '../engine/types'

// Minimal geçerli pozisyon (aggregation pos varlığına bakar; içerik önemsiz).
const POS: GameState = {
  points: new Array(24).fill(0),
  bar: { white: 0, black: 0 },
  off: { white: 0, black: 0 },
  turn: 'white',
  dice: [],
  diceUsed: [],
}

// Checker hamlesi kısayolu
const checker = (player: 'white' | 'black', loss: number, notation = '8/5 6/5'): LogEntry => ({
  notation,
  best: '24/20',
  loss,
  pos: POS,
  player,
  dice: [3, 1],
})

// Küp kararı kısayolu
const cube = (
  player: 'white' | 'black',
  chosen: string,
  recommended: string,
  loss: number,
): LogEntry => ({
  notation: '',
  best: '',
  loss: 0,
  player,
  cube: { win: 50, equity: 0, recommended, chosen, correct: chosen === recommended, loss },
})

describe('computeMatchSummary', () => {
  it('cube olmayan maç: checker PR = (Σloss/karar)×500, cube alanları 0/null', () => {
    const log = [checker('white', 0.0), checker('white', 0.1), checker('black', 0.02)]
    const s = computeMatchSummary(log, ['Ali', 'Veli'])
    // white: 2 karar, Σloss=0.1 -> PR=(0.1/2)*500=25
    expect(s.white.checkerPlay).toBeCloseTo(25, 6)
    expect(s.white.performanceRating).toBeCloseTo(25, 6)
    expect(s.white.decisions).toBe(2)
    expect(s.white.checkerBlunders).toBe(1) // 0.1 >= 0.08
    expect(s.white.checkerErrors).toBe(1) // 0.1 >= 0.02
    // cube yok -> cube PR null, take/double sayıları 0
    expect(s.white.cubePlay).toBeNull()
    expect(s.white.cubeDecisions).toBe(0)
    expect(s.white.takeDecisions).toBe(0)
    // black: 1 karar 0.02 -> PR=10
    expect(s.black.checkerPlay).toBeCloseTo(10, 6)
    expect(s.black.name).toBe('Veli')
  })

  it('karar yoksa PR null (asla 0)', () => {
    const s = computeMatchSummary([], ['A', 'B'])
    expect(s.white.performanceRating).toBeNull()
    expect(s.white.checkerPlay).toBeNull()
    expect(s.white.cubePlay).toBeNull()
    expect(s.white.decisions).toBe(0)
  })

  it('wrong double (double yapmamalıyken yaptı) equity kaybını wrongDoubles a yazar', () => {
    const log = [cube('white', 'double', 'no-double', 0.06)]
    const s = computeMatchSummary(log, null)
    expect(s.white.cubeDecisions).toBe(1)
    expect(s.white.wrongDoublesCost).toBeCloseTo(0.06, 6)
    expect(s.white.missedDoublesCost).toBe(0)
    expect(s.white.doubleEquityCost).toBeCloseTo(0.06, 6)
    expect(s.white.doubles).toBe(1) // 0.06 >= 0.02
    expect(s.white.doubleBlunders).toBe(0) // 0.06 < 0.08
    // cube PR = (0.06/1)*500 = 30
    expect(s.white.cubePlay).toBeCloseTo(30, 6)
  })

  it('missed double (double yapmalıyken yapmadı) equity kaybını missedDoubles a yazar', () => {
    const log = [cube('black', 'no-double', 'double', 0.09)]
    const s = computeMatchSummary(log, null)
    expect(s.black.missedDoublesCost).toBeCloseTo(0.09, 6)
    expect(s.black.wrongDoublesCost).toBe(0)
    expect(s.black.doubleBlunders).toBe(1) // 0.09 >= 0.08
  })

  it('wrong take (pass olmalıyken take) ve wrong pass (take olmalıyken pass)', () => {
    const log = [
      cube('white', 'take', 'drop', 0.05), // wrong take
      cube('black', 'drop', 'take', 0.12), // wrong pass (blunder)
    ]
    const s = computeMatchSummary(log, null)
    expect(s.white.wrongTakesCost).toBeCloseTo(0.05, 6)
    expect(s.white.takeDecisions).toBe(1)
    expect(s.white.takes).toBe(1)
    expect(s.black.wrongPassesCost).toBeCloseTo(0.12, 6)
    expect(s.black.takeBlunders).toBe(1)
  })

  it('istemci küp girdisi (kayıp ÜST DÜZEY e.loss, cube.loss YOK) doğru okunur — 0 göstermez', () => {
    // App.recordCubePR bu şekilde loglar: loss top-level, cube objesinde loss yok.
    const log: LogEntry[] = [
      { notation: '', best: '', loss: 0.05, player: 'black', cube: { win: 50, equity: 0, recommended: 'drop', chosen: 'take', correct: false } },
      { notation: '', best: '', loss: 0.11, player: 'black', cube: { win: 50, equity: 0, recommended: 'take', chosen: 'drop', correct: false } },
    ]
    const s = computeMatchSummary(log, null)
    // İkisi de yanıt kararı (take/drop); maliyet üst düzey loss'tan gelmeli (0 DEĞİL)
    expect(s.black.takeDecisions).toBe(2)
    expect(s.black.takeEquityCost).toBeCloseTo(0.16, 6)
    expect(s.black.wrongTakesCost).toBeCloseTo(0.05, 6) // take + hata
    expect(s.black.wrongPassesCost).toBeCloseTo(0.11, 6) // drop + hata
    expect(s.black.takes).toBe(2)
    expect(s.black.takeBlunders).toBe(1) // 0.11 >= 0.08
    expect(s.black.cubePlay).toBeCloseTo((0.16 / 2) * 500, 6)
  })

  it('checker + cube havuzlanır (overall PR ORTALAMA değil, Σloss/Σkarar)', () => {
    const log = [
      checker('white', 0.1), // checker: 1 karar, 0.1
      cube('white', 'double', 'no-double', 0.3), // cube: 1 karar, 0.3
    ]
    const s = computeMatchSummary(log, null)
    expect(s.white.checkerPlay).toBeCloseTo(50, 6) // 0.1/1*500
    expect(s.white.cubePlay).toBeCloseTo(150, 6) // 0.3/1*500
    // overall = (0.1+0.3)/(1+1)*500 = 100 (checker/cube PR ortalaması 100 ile aynı burada;
    // ama farklı karar sayısında farklı olurdu -> havuzlama doğrulanır)
    expect(s.white.performanceRating).toBeCloseTo(100, 6)
    expect(s.white.decisions).toBe(2)
    expect(s.white.totalErrors).toBe(2)
  })

  it('farklı karar sayısında overall = havuzlama (basit ortalama DEĞİL)', () => {
    const log = [
      checker('white', 0.0),
      checker('white', 0.0),
      checker('white', 0.0), // 3 checker karar, 0 loss -> checker PR 0
      cube('white', 'double', 'no-double', 0.2), // 1 cube karar, 0.2 -> cube PR 100
    ]
    const s = computeMatchSummary(log, null)
    expect(s.white.checkerPlay).toBeCloseTo(0, 6)
    expect(s.white.cubePlay).toBeCloseTo(100, 6)
    // basit ortalama olsaydı (0+100)/2=50; havuzlama = (0+0.2)/(3+1)*500 = 25
    expect(s.white.performanceRating).toBeCloseTo(25, 6)
  })

  it('"(no move)" zorunlu hamle checker kararı SAYILMAZ ama zar (roll) sayılır', () => {
    const log: LogEntry[] = [
      { ...checker('white', 0), notation: '(no move)' },
      checker('white', 0.04),
    ]
    const s = computeMatchSummary(log, null)
    expect(s.white.unforcedMoves).toBe(1) // sadece gerçek hamle
    expect(s.white.rolls).toBe(2) // ikisi de zar attı
  })

  it('luck verilmezse null (—), verilirse mwc/cost/jokers taşınır; rating/Elo daima null', () => {
    const noLuck = computeMatchSummary([checker('white', 0)], null)
    expect(noLuck.white.luck).toBeNull()
    expect(noLuck.white.luckCost).toBeNull()
    expect(noLuck.white.jokers).toBeNull()
    const withLuck = computeMatchSummary([checker('white', 0)], null, {
      white: { mwc: 1.25, cost: -0.42, jokers: 14 },
      black: { mwc: -1.25, cost: 0.42, jokers: 17 },
    })
    expect(withLuck.white.luck).toBeCloseTo(1.25, 6)
    expect(withLuck.white.luckCost).toBeCloseTo(-0.42, 6)
    expect(withLuck.white.jokers).toBe(14)
    expect(withLuck.black.jokers).toBe(17)
    // luck-based rating/Elo güvenilir üretilmiyor -> daima null
    expect(withLuck.white.luckBasedRating).toBeNull()
    expect(withLuck.white.luckBasedElo).toBeNull()
  })

  it('eksik/bozuk veri crash etmez; NaN/Infinity üretmez', () => {
    // pos'suz checker, cube.loss'suz cube, null log
    const weird: LogEntry[] = [
      { notation: 'x', best: '', loss: 0.05, player: 'white' }, // pos yok -> checker sayılmaz
      { notation: '', best: '', loss: 0, player: 'white', cube: { win: 0, equity: 0, recommended: 'take', chosen: 'take', correct: true } }, // cube.loss yok
    ]
    const s = computeMatchSummary(weird, null)
    expect(s.white.unforcedMoves).toBe(0)
    expect(s.white.takeDecisions).toBe(1)
    expect(Number.isFinite(s.white.takeEquityCost)).toBe(true)
    // null log
    const empty = computeMatchSummary(null, null)
    expect(empty.white.decisions).toBe(0)
  })
})
