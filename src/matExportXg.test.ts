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

describe('buildMatXg — Extreme Gammon uyumlu .mat (gercek XG dosyasiyla birebir bicim)', () => {
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
    expect(mat).toContain('; [EventDate "2026.09.08"]')
    expect(mat).toContain('; [EventTime "21.30"]')
    expect(mat).toContain('; [Crawford "On"]')
    expect(mat).toContain('; [CubeLimit "1024"]')
    // header'dan sonra bos satir + "N point match" + bos satir + " Game 1" (bosluklu)
    expect(mat).toMatch(/; \[CubeLimit "1024"\]\n\n1 point match\n\n Game 1\n/)
    expect(mat).toMatch(/^ Omer : 0\s+GnuBot : 0$/m) // skor satiri BOSLUKLA baslar
  })

  it('hamle satirlari XG paren bicimi "  N)" (nokta DEGIL)', () => {
    const mat = buildMatXg(playRealGame(12345), { matchLength: 1, whiteName: 'A', blackName: 'B' })
    expect(mat).toMatch(/^\s*\d+\) /m) // "  1) ..." paren
    expect(mat).not.toMatch(/^\s*\d+\. /m) // "1. ..." nokta bicimi OLMAMALI
  })

  it('YASAK tokenlar yok: bar/, /off, sikistirma (n)', () => {
    for (const seed of [1, 2, 3, 12345, 777, 999]) {
      const mat = buildMatXg(playRealGame(seed), { matchLength: 1, whiteName: 'A', blackName: 'B' })
      expect(mat, `seed ${seed} bar/`).not.toMatch(/bar\//)
      expect(mat, `seed ${seed} /off`).not.toMatch(/\/off/)
      expect(mat, `seed ${seed} (n)`).not.toMatch(/\/\d+\(\d+\)/)
    }
  })

  it('bear-off 0 ve bar 25 olarak yaziliyor (donusum sadik)', () => {
    expect(xgMoves('bar/20 8/6')).toBe('25/20 8/6')
    expect(xgMoves('6/off 3/off')).toBe('6/0 3/0')
    expect(xgMoves('8/3(2) 20/15')).toBe('8/3 8/3 20/15')
    expect(xgMoves('1/off(3)')).toBe('1/0 1/0 1/0')
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

  it('sonuc: her oyunda Wins satiri, tekil "point", mac bitince "and the match"', () => {
    for (const seed of [1, 2, 3, 12345, 777, 999]) {
      const mat = buildMatXg(playRealGame(seed), { matchLength: 1, whiteName: 'A', blackName: 'B' })
      expect(mat, `seed ${seed} Wins`).toMatch(/Wins \d+ point/)
      expect(mat, `seed ${seed} points`).not.toContain('points') // TEKIL point
      // Kazanan sol -> "      Wins ..." ayri satir; kazanan sag -> "  N)  Losses ...  Wins ..."
      const leftWin = / {6}Wins \d+ point/.test(mat)
      const rightWin = /^\s*\d+\)\s+Losses \d+ point\s+Wins \d+ point/m.test(mat)
      expect(leftWin || rightWin, `seed ${seed} sonuc bicimi`).toBe(true)
    }
    expect(buildMatXg(playRealGame(12345), { matchLength: 1, whiteName: 'A', blackName: 'B' })).toContain('and the match')
  })

  it('cok oyunlu: skor onceki oyunlarin sonucundan birikir', () => {
    const mat = buildMatXg([...playRealGame(12345), ...playRealGame(2)], { matchLength: 7, whiteName: 'A', blackName: 'B' })
    const games = mat.split('\n').filter((l) => /^ Game \d+$/.test(l))
    expect(games).toEqual([' Game 1', ' Game 2'])
    const scoreLines = mat.split('\n').filter((l) => /^ A : \d+\s+B : \d+$/.test(l))
    expect(scoreLines[0]).toMatch(/^ A : 0\s+B : 0$/) // 1. oyun 0-0
    expect(scoreLines[1]).not.toMatch(/^ A : 0\s+B : 0$/) // 2. oyun skor birikti
  })
})

// ---------------------------------------------------------------------------
// SONUC SATIRI GARANTISI: tamamlanmis her oyun MUTLAKA Wins/Losses satiri alir,
// gerekiyorsa "and the match". Kritik regresyon: analiz logu zorunlu (tek-legal)
// bitiren-hamleyi ATLAR -> logdaki son hamle terminal DEGILdir -> tahta-tekrari
// sonuc bulamaz. O bosluk otoriter `results` diziyle doldurulur (bkz. buildMatXg).
// ---------------------------------------------------------------------------
describe('buildMatXg — oyun sonu (Wins/Losses) garantisi + gercek puan + "and the match"', () => {
  const zeros = () => new Array(24).fill(0)
  const mk = (o: Partial<GameState>): GameState => ({
    points: o.points ?? zeros(),
    bar: o.bar ?? { white: 0, black: 0 },
    off: o.off ?? { white: 0, black: 0 },
    turn: o.turn ?? 'white',
    dice: o.dice ?? [],
    diceUsed: o.diceUsed ?? [],
  })
  // Beyaz kazanan terminal tahta (off.white=15). mult: 1 normal (kaybeden 1 tas topladi),
  // 2 gammon (hic toplamadi, bar/ev yok), 3 backgammon (barda tas var).
  const whiteWin = (mult: 1 | 2 | 3): GameState => {
    const points = zeros()
    const off = { white: 15, black: mult === 1 ? 1 : 0 }
    const bar = { white: 0, black: mult === 3 ? 1 : 0 }
    points[12] = -(15 - off.black - bar.black) // kalan siyah taslar 13. ucgende (siyah=negatif)
    return mk({ points, off, bar })
  }
  // Siyah kazanan terminal tahta (off.black=15, kaybeden beyaz 1 tas topladi -> mult 1).
  const blackWin = (): GameState => {
    const points = zeros()
    points[11] = 14 // beyaz (pozitif) 12. ucgende
    return mk({ points, off: { white: 1, black: 15 }, turn: 'black' })
  }
  const move = (pos: GameState, player: Player, playedSteps: Step[] = []): MoveLogEntry => ({
    notation: '2/off', best: '', loss: 0, player, pos, playedSteps, dice: [2, 1], seq: 100,
  })
  const cube = (chosen: 'double' | 'take' | 'drop', player: Player, seq: number): MoveLogEntry => ({
    notation: '', best: '', loss: 0, player, seq,
    cube: { win: 0.5, equity: 0, recommended: chosen, chosen, correct: true },
  })
  const winLine = (mat: string) =>
    / {6}Wins \d+ point/.test(mat) || /^\s*\d+\)\s+Losses \d+ point\s+Wins \d+ point/m.test(mat)

  it('normal win: kazanan sol sutunda -> "      Wins 1 point"', () => {
    const mat = buildMatXg([move(whiteWin(1), 'white')], { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(mat).toMatch(/ {6}Wins 1 point/)
    expect(mat).not.toContain('and the match') // 1 < 5 -> mac bitmedi
  })

  it('gammon: kaybeden hic toplamadi -> "Wins 2 point"', () => {
    const mat = buildMatXg([move(whiteWin(2), 'white')], { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('Wins 2 point')
    expect(mat).not.toContain('points') // tekil
  })

  it('backgammon: kaybedenin barda tasi -> "Wins 3 point"', () => {
    const mat = buildMatXg([move(whiteWin(3), 'white')], { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('Wins 3 point')
  })

  it('kup ile biten oyun: Doubles/Takes -> puan kup ile carpilir (2)', () => {
    const log = [cube('double', 'white', 0), cube('take', 'black', 1), move(whiteWin(1), 'white')]
    const mat = buildMatXg(log, { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('Doubles => 2')
    expect(mat).toContain('Takes')
    expect(mat).toMatch(/ {6}Wins 2 point/) // 1 (mult) × 2 (kup)
  })

  it('kazanan SAG sutunda (siyah): "  N)  Losses 1 point   Wins 1 point"', () => {
    const mat = buildMatXg([move(blackWin(), 'black')], { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(mat).toMatch(/^\s*\d+\)\s+Losses 1 point\s+Wins 1 point/m)
  })

  it('maci bitiren oyun: kazanan mac puanina ulasti -> "and the match"', () => {
    const mat = buildMatXg([move(whiteWin(1), 'white')], { matchLength: 1, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('Wins 1 point and the match')
  })

  it('gercek puan KIRPILMAZ: 1 puanlik macta gammon (2) -> "Wins 2 point and the match"', () => {
    // Kullanici kurali: mac puani asilsa bile o oyunda kazanilan GERCEK puan yazilir.
    const mat = buildMatXg([move(whiteWin(2), 'white')], { matchLength: 1, whiteName: 'A', blackName: 'B' })
    expect(mat).toContain('Wins 2 point and the match')
  })

  it('REGRESYON: logdaki son hamle terminal DEGILse (zorunlu bitiren-hamle atlanmis) results olmadan sonuc satiri YOK', () => {
    // Bear-off ortasi, oyun bitmemis gorunur (off.white=13<15) -> tahta-tekrari null.
    const nonTerminal = mk({ points: (() => { const p = zeros(); p[3] = 2; p[12] = -14; return p })(), off: { white: 13, black: 1 } })
    const mat = buildMatXg([move(nonTerminal, 'white')], { matchLength: 5, whiteName: 'A', blackName: 'B' })
    expect(winLine(mat)).toBe(false) // iste tavlatv-mac(12).mat bug'i: sonuc satiri yazilmiyordu
  })

  it('FIX: ayni terminal-olmayan log + otoriter results -> sonuc satiri MUTLAKA yazilir', () => {
    const nonTerminal = mk({ points: (() => { const p = zeros(); p[3] = 2; p[12] = -14; return p })(), off: { white: 13, black: 1 } })
    const log = [move(nonTerminal, 'white')]
    const mat = buildMatXg(log, {
      matchLength: 5, whiteName: 'A', blackName: 'B',
      results: [{ winner: 'white', points: 2 }],
    })
    expect(winLine(mat)).toBe(true)
    expect(mat).toMatch(/ {6}Wins 2 point/)
  })

  it('FIX: results ile maci bitiren oyunda "and the match"', () => {
    const nonTerminal = mk({ points: (() => { const p = zeros(); p[3] = 2; p[12] = -14; return p })(), off: { white: 13, black: 1 } })
    const mat = buildMatXg([move(nonTerminal, 'white')], {
      matchLength: 2, whiteName: 'A', blackName: 'B',
      results: [{ winner: 'white', points: 2 }],
    })
    expect(mat).toContain('Wins 2 point and the match') // sw=2 >= 2
  })

  it('results yalnizca oyun sayisiyla BIREBIR eslesirse fallback olur (kayik dizi kullanilmaz)', () => {
    const nonTerminal = mk({ points: (() => { const p = zeros(); p[3] = 2; p[12] = -14; return p })(), off: { white: 13, black: 1 } })
    // 1 oyun ama 2 sonuc -> eslesmiyor -> fallback YOK -> sonuc satiri yok (yanlis veri riski onlenir)
    const mat = buildMatXg([move(nonTerminal, 'white')], {
      matchLength: 5, whiteName: 'A', blackName: 'B',
      results: [{ winner: 'black', points: 9 }, { winner: 'white', points: 9 }],
    })
    expect(winLine(mat)).toBe(false)
  })
})
