import { describe, it, expect } from 'vitest'
import { initialState, cloneState, opponent, gameOutcome } from './engine/board'
import { maximalTerminals } from './engine/moves'
import { applyStep, boardKey } from './engine/moves'
import { moveNotation } from './engine/notation'
import type { GameState, Player, Step } from './engine/types'
import type { MoveLogEntry } from './storage'
import { buildMat } from './matExport'

// Basit tekrar-uretilebilir PRNG (mulberry32) — seed sabit -> her calismada ayni mac.
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

// Motorla GERCEK (legal) tek oyunluk mac uret: her tur zar at, legal tam hamlelerden
// birini sec, uygula; biri tum taslarini toplayana kadar. Kayitlar MoveLogEntry seklinde.
function playRealGame(seed: number): MoveLogEntry[] {
  const rng = mulberry32(seed)
  const roll = (): number[] => {
    const a = 1 + Math.floor(rng() * 6)
    const b = 1 + Math.floor(rng() * 6)
    return a === b ? [a, a, a, a] : [a, b]
  }
  const entries: MoveLogEntry[] = []
  let s: GameState = initialState() // turn = white
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
      best: '',
      loss: 0,
      pos: before,
      steps: played,
      playedSteps: played,
      player: mover,
      dice: dice.slice(0, 2), // gosterim: iki zar (cift ise [d,d])
      seq: seq++,
    })
    if (gameOutcome(after)) break
    // sirayi devret
    after.turn = opponent(mover)
    after.dice = []
    after.diceUsed = []
    s = after
    mover = opponent(mover)
  }
  return entries
}

// .mat notasyonunu geri ayristir (GNU BG importerinin yaptigi is) -> step'ler.
// Beyaz mutlak numara (index = num-1); siyah ayna (index = 24-num). bar/off dogrudan.
function parseNotation(notation: string, player: Player): Step[] {
  if (!notation || notation === 'pass' || notation === 'pas') return []
  const steps: Step[] = []
  for (const tok of notation.trim().split(/\s+/)) {
    const m = tok.match(/^(bar|\d+)\/(off|\d+)(?:\((\d+)\))?$/)
    if (!m) throw new Error(`gecersiz token: "${tok}" (notation="${notation}")`)
    const [, fromS, toS, cntS] = m
    const cnt = cntS ? parseInt(cntS, 10) : 1
    const from: number | 'bar' =
      fromS === 'bar' ? 'bar' : player === 'white' ? parseInt(fromS, 10) - 1 : 24 - parseInt(fromS, 10)
    const to: number | 'off' =
      toS === 'off' ? 'off' : player === 'white' ? parseInt(toS, 10) - 1 : 24 - parseInt(toS, 10)
    for (let i = 0; i < cnt; i++) steps.push({ from, to, die: 0 })
  }
  return steps
}

describe('buildMat — gercek maci .mat olarak uret + dogrula', () => {
  it('bir oyunu uretip .mat yazar; notasyon sadik ve tekrar-oynanabilir', () => {
    const log = playRealGame(12345)
    expect(log.length).toBeGreaterThan(10)

    const mat = buildMat(log, { matchLength: 1, whiteName: 'Omer', blackName: 'GnuBot' })

    // --- Yapisal kontroller ---
    expect(mat.startsWith('1 point match')).toBe(true) // ilk satir, onunde yorum yok
    expect(mat).not.toContain(' pas') // dance turlari sadece zar, "pas" token'i yok
    expect(mat).toContain(' Game 1')
    expect(mat).toMatch(/Omer : 0\s+GnuBot : 0/)
    expect(mat).toMatch(/Wins \d+ point/)

    // --- Notasyon sadakati: her hamlenin .mat notasyonunu geri ayristir, motorla
    //     oyna, playedSteps ile AYNI tahtaya varmali (gnubg importunun yapacagi is). ---
    for (const e of log) {
      if (!e.player || !e.pos) continue
      const viaNotation = cloneState(e.pos)
      for (const st of parseNotation(e.notation, e.player)) applyStep(viaNotation, st, e.player)
      const viaSteps = cloneState(e.pos)
      for (const st of e.playedSteps ?? []) applyStep(viaSteps, st, e.player)
      expect(boardKey(viaNotation)).toBe(boardKey(viaSteps))
    }

    // --- Baslangictan tum maci playedSteps ile yeniden oyna -> gecerli bir sonuc. ---
    const replay = initialState()
    let mover: Player = log[0].player!
    for (const e of log) {
      replay.turn = e.player!
      for (const st of e.playedSteps ?? []) applyStep(replay, st, e.player!)
      mover = e.player!
    }
    const oc = gameOutcome(replay)
    expect(oc).not.toBeNull()
    expect(oc!.winner).toBe(mover) // son hamleyi oynayan kazanir (tas topladi)
  })
})
