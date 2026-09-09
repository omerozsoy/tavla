// MAT export DETERMİNİZMİ + KÜP REGRESYONU + KANONİK ZAR.
//
// Kök neden (tavlatv-mac (5) vs (21)): aynı gerçek oyun iki kez export edilince çıktı
// değişiyordu — (a) header Date.now'dan, (b) zar ham sırada (23 vs 32), (c) küp girdileri
// oturuma göre kayboluyor -> sonuç 12 yerine 3. Bu testler exporter'ın AYNI GİRDİ -> AYNI
// ÇIKTI (byte-level) ürettiğini ve küp/puanın kaybolmadığını kilitler.
import { describe, it, expect } from 'vitest'
import { buildMatXg, xgDice } from './matExport'
import type { GameState, Player, Step } from './engine/types'
import type { MoveLogEntry } from './storage'

const zeros = () => new Array(24).fill(0)
const mk = (o: Partial<GameState>): GameState => ({
  points: o.points ?? zeros(),
  bar: o.bar ?? { white: 0, black: 0 },
  off: o.off ?? { white: 0, black: 0 },
  turn: o.turn ?? 'white',
  dice: o.dice ?? [],
  diceUsed: o.diceUsed ?? [],
})
// Beyaz kazanan terminal tahta. mult: 1 normal / 2 gammon / 3 backgammon (barda taş).
const whiteWin = (mult: 1 | 2 | 3): GameState => {
  const points = zeros()
  const off = { white: 15, black: mult === 1 ? 1 : 0 }
  const bar = { white: 0, black: mult === 3 ? 1 : 0 }
  points[12] = -(15 - off.black - bar.black)
  return mk({ points, off, bar })
}
const move = (pos: GameState, player: Player, dice: number[], playedSteps: Step[] = []): MoveLogEntry => ({
  notation: '2/off', best: '', loss: 0, player, pos, playedSteps, dice, seq: 100,
})
const cube = (chosen: 'double' | 'take' | 'drop', player: Player, seq: number): MoveLogEntry => ({
  notation: '', best: '', loss: 0, player, seq,
  cube: { win: 0.5, equity: 0, recommended: chosen, chosen, correct: true },
})

// Basit deterministik string hash (djb2) — kripto ortamına bağımlı olmadan byte-özdeşlik.
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16)
}

const OPTS = { matchLength: 3, whiteName: 'A', blackName: 'B', matchId: 'FIXED', eventDate: '2026.09.09', eventTime: '03.32' }

describe('MAT export — kanonik zar (yüksek önce)', () => {
  it('xgDice: 23->32, 12->21, 35->53; çiftler değişmez; tek/boş güvenli', () => {
    expect(xgDice([2, 3])).toBe('32')
    expect(xgDice([1, 2])).toBe('21')
    expect(xgDice([3, 5])).toBe('53')
    expect(xgDice([6, 4])).toBe('64') // zaten yüksek önce
    expect(xgDice([5, 5])).toBe('55') // çift
    expect(xgDice([6])).toBe('') // eksik
    expect(xgDice(undefined)).toBe('')
  })

  it('zar sırası kaynak sırasından BAĞIMSIZ: [2,5] ve [5,2] AYNI .mat üretir', () => {
    const a = buildMatXg([move(whiteWin(1), 'white', [2, 5])], OPTS)
    const b = buildMatXg([move(whiteWin(1), 'white', [5, 2])], OPTS)
    expect(a).toBe(b) // byte-level özdeş
    expect(a).toContain('52:') // her ikisi de yüksek-önce
    expect(a).not.toContain('25:')
  })
})

describe('MAT export — DETERMİNİZM (aynı girdi -> aynı çıktı)', () => {
  const log: MoveLogEntry[] = [
    cube('double', 'white', 0),
    cube('take', 'black', 1),
    move(mk({ points: (() => { const p = zeros(); p[5] = 2; p[12] = -2; return p })(), turn: 'white' }), 'white', [3, 2]),
    move(whiteWin(3), 'white', [2, 1]),
  ]

  it('10 kez export -> HEPSİ byte-level aynı (hash özdeş)', () => {
    const outs = Array.from({ length: 10 }, () => buildMatXg(log, OPTS))
    const hashes = new Set(outs.map(hash))
    expect(hashes.size).toBe(1)
  })

  it('3 kez export hash karşılaştırması (rapor deliverable #11)', () => {
    const h1 = hash(buildMatXg(log, OPTS))
    const h2 = hash(buildMatXg(log, OPTS))
    const h3 = hash(buildMatXg(log, OPTS))
    expect(h1).toBe(h2)
    expect(h2).toBe(h3)
  })
})

describe('MAT export — KÜP REGRESYONU (kaybolmamalı; puan küp ile çarpılır)', () => {
  // Senaryo (rapor deliverable #G): A double->2, B take, B double->4, A take, A backgammon kazanır.
  // Beklenti: 4 küp yarı-eventi + Wins 12 point (backgammon 3 × küp 4). 12-vs-3 bug'ı burada kilitlenir.
  const log: MoveLogEntry[] = [
    cube('double', 'white', 0), // A: Doubles => 2
    cube('take', 'black', 1), // B: Takes
    cube('double', 'black', 2), // B: Doubles => 4 (redouble)
    cube('take', 'white', 3), // A: Takes
    move(whiteWin(3), 'white', [2, 1]),
  ]
  const mat = buildMatXg(log, OPTS)

  it('tüm küp eventleri korunur: Doubles => 2, Takes, Doubles => 4, Takes', () => {
    expect(mat).toContain('Doubles => 2')
    expect(mat).toContain('Doubles => 4')
    expect((mat.match(/Takes/g) ?? []).length).toBe(2)
  })

  it('sonuç puanı küp ile çarpılır: backgammon(3) × küp(4) = 12', () => {
    expect(mat).toContain('Wins 12 point')
    expect(mat).not.toContain('Wins 3 point') // küp kaybolsaydı 3 çıkardı (bug)
  })

  it('küp içeren maç da deterministik (10×)', () => {
    const hashes = new Set(Array.from({ length: 10 }, () => hash(buildMatXg(log, OPTS))))
    expect(hashes.size).toBe(1)
  })
})
