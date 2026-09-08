import { describe, it, expect } from 'vitest'
import { initialState, cloneState, opponent, gameOutcome } from './engine/board'
import { maximalTerminals, applyStep, boardKey } from './engine/moves'
import { moveNotation } from './engine/notation'
import type { GameState, Player, Step } from './engine/types'
import type { MoveLogEntry } from './storage'
import { buildMatXg, xgMoves } from './matExport'

// Sabit-seed PRNG -> tekrar-oynanabilir mac (bkz. matExport.test.ts).
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Motorla gercek (legal) tek oyunluk mac uret; kayitlar MoveLogEntry.
function playRealGame(seed: number): MoveLogEntry[] {
  const rng = mulberry32(seed)
  const roll = (): number[] => {
    const a = 1 + Math.floor(rng() * 6)
    const b = 1 + Math.floor(rng() * 6)
    return a === b ? [a, a, a, a] : [a, b]
  }
  const entries: MoveLogEntry[] = []
  let s: GameState = initialState()
  let mover: Player = 'white'
  let seq = 0
  for (let guard = 0; guard < 2000; guard++) {
    const dice = roll()
    s = { ...cloneState(s), turn: mover, dice, diceUsed: dice.map(() => false) }
    const before = cloneState(s)
    const terminals = maximalTerminals(s)
    let played: Step[] = []
    let after = cloneState(s)
    if (terminals.length > 0) {
      const pick = terminals[Math.floor(rng() * terminals.length)]
      played = pick.steps
      after = cloneState(pick.state)
    }
    entries.push({
      notation: moveNotation({ steps: played, resultKey: '' }, mover),
      best: '', loss: 0, pos: before, steps: played, playedSteps: played,
      player: mover, dice: dice.slice(0, 2), seq: seq++,
    })
    if (gameOutcome(after)) break
    after.turn = opponent(mover)
    after.dice = []
    after.diceUsed = []
    s = after
    mover = opponent(mover)
  }
  return entries
}

// XG notasyonunu geri ayristir (XG importerinin yaptigi is): 25 -> bar, 0 -> off.
// Tekrarlar zaten AYRI yazilidir (parantez yok). Beyaz mutlak numara (index=num-1),
// siyah ayna (index=24-num). Vurus (*) yok sayilir.
function parseXg(notation: string, player: Player): Step[] {
  if (!notation) return []
  const steps: Step[] = []
  for (const tok of notation.trim().split(/\s+/)) {
    const m = tok.replace(/\*/g, '').match(/^(25|\d+)\/(\d+)$/)
    if (!m) throw new Error(`gecersiz XG token: "${tok}" (notation="${notation}")`)
    const [, fromS, toS] = m
    const from: number | 'bar' =
      fromS === '25' ? 'bar' : player === 'white' ? parseInt(fromS, 10) - 1 : 24 - parseInt(fromS, 10)
    const to: number | 'off' =
      toS === '0' ? 'off' : player === 'white' ? parseInt(toS, 10) - 1 : 24 - parseInt(toS, 10)
    steps.push({ from, to, die: 0 })
  }
  return steps
}

describe('buildMatXg — Extreme Gammon uyumlu .mat', () => {
  it('header blogu + N point match dogru', () => {
    const log = playRealGame(12345)
    const mat = buildMatXg(log, {
      matchLength: 1, whiteName: 'Omer', blackName: 'GnuBot',
      matchId: 'ABC', eventDate: '2026.09.08', eventTime: '21.30',
    })
    expect(mat).toContain('; [Site "TavlaTV"]')
    expect(mat).toContain('; [Match ID "ABC"]')
    expect(mat).toContain('; [Player 1 "Omer"]')
    expect(mat).toContain('; [Player 2 "GnuBot"]')
    expect(mat).toContain('; [Player 1 Elo "0"]')
    expect(mat).toContain('; [EventDate "2026.09.08"]')
    expect(mat).toContain('; [EventTime "21.30"]')
    expect(mat).toContain('; [Variation "Backgammon"]')
    expect(mat).toContain('; [Unrated "Off"]')
    expect(mat).toContain('; [Crawford "On"]')
    expect(mat).toContain('; [CubeLimit "1024"]')
    // header'dan sonra bos satir + "N point match"
    expect(mat).toMatch(/; \[CubeLimit "1024"\]\n\n1 point match\n/)
    expect(mat).toContain('Game 1')
    expect(mat).toMatch(/Omer : 0\s+GnuBot : 0/)
  })

  it('YASAK tokenlar yok: bar/, /off, sikistirma (n)', () => {
    // Bir cok seed'i tara: bear-off (off->0) ve bar giris (bar->25) mutlaka gecsin.
    for (const seed of [1, 2, 3, 12345, 777, 999]) {
      const mat = buildMatXg(playRealGame(seed), { matchLength: 1, whiteName: 'A', blackName: 'B' })
      expect(mat, `seed ${seed} bar/`).not.toMatch(/bar\//)
      expect(mat, `seed ${seed} /off`).not.toMatch(/\/off/)
      expect(mat, `seed ${seed} (n)`).not.toMatch(/\/\d+\(\d+\)/) // 8/3(2) gibi sikistirma
    }
  })

  it('bear-off 0 ve bar 25 olarak yaziliyor (donusum sadik)', () => {
    // Donusum birim testi
    expect(xgMoves('bar/20 8/6')).toBe('25/20 8/6')
    expect(xgMoves('6/off 3/off')).toBe('6/0 3/0')
    expect(xgMoves('8/3(2) 20/15')).toBe('8/3 8/3 20/15')
    expect(xgMoves('1/off(3)')).toBe('1/0 1/0 1/0')
    expect(xgMoves('44')).toBe('44') // zar-benzeri artik yok ama bozmasin
    expect(xgMoves('bar/24(2)')).toBe('25/24 25/24')
  })

  it('cift zar dort hamle de acik yazilir', () => {
    const init = initialState()
    const log: MoveLogEntry[] = [
      { notation: '8/4(2) 6/2(2)', best: '', loss: 0, player: 'white', pos: init, dice: [4, 4], playedSteps: [], seq: 0 },
    ]
    const mat = buildMatXg(log, { matchLength: 1, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('44: 8/4 8/4 6/2 6/2')
    expect(mat).not.toContain('(2)')
  })

  it('notasyon sadik: XG notasyonu geri ayristirilinca playedSteps ile ayni tahta', () => {
    const log = playRealGame(12345)
    for (const e of log) {
      if (!e.player || !e.pos || !e.notation || e.notation === 'pas' || e.notation === 'pass') continue
      const viaXg = cloneState(e.pos)
      for (const st of parseXg(xgMoves(e.notation), e.player)) applyStep(viaXg, st, e.player)
      const viaSteps = cloneState(e.pos)
      for (const st of e.playedSteps ?? []) applyStep(viaSteps, st, e.player)
      expect(boardKey(viaXg)).toBe(boardKey(viaSteps))
    }
  })

  it('sonuc satiri iki-sutun numarali + mac bitince "and the match"', () => {
    const mat = buildMatXg(playRealGame(12345), { matchLength: 1, whiteName: 'Omer', blackName: 'GnuBot' })
    // Tek oyunda 1 puanlik mac biter -> "Wins 1 point and the match" ve karsi "Losses 1 point"
    expect(mat).toContain('Wins 1 point and the match')
    expect(mat).toContain('Losses 1 point')
    // Sonuc satiri NUMARALI (or. "55. Losses 1 point   Wins 1 point and the match")
    expect(mat).toMatch(/^\d+\.\s+(Losses|Wins) 1 point/m)
    // her "point" TEKIL (cogul "points" olmamali)
    expect(mat).not.toContain('points')
  })

  it('cok oyunlu: skor onceki oyunlarin sonucundan birikir', () => {
    // Iki tam oyun: seed'ler farkli, arka arkaya (acilis dizilimiyle bolunur).
    const g1 = playRealGame(12345)
    const g2 = playRealGame(2)
    const mat = buildMatXg([...g1, ...g2], { matchLength: 7, whiteName: 'A', blackName: 'B' })
    const games = mat.split('\n').filter((l) => /^Game \d+$/.test(l))
    expect(games).toEqual(['Game 1', 'Game 2'])
    // Game 1 skoru 0-0; Game 2 skoru Game 1 sonucuyla tutarli (biri >0).
    const scoreLines = mat.split('\n').filter((l) => /^A : \d+\s+B : \d+$/.test(l))
    expect(scoreLines[0]).toMatch(/^A : 0\s+B : 0$/)
    expect(scoreLines[1]).not.toMatch(/^A : 0\s+B : 0$/) // 2. oyun 0-0 OLMAMALI (skor birikti)
  })
})
