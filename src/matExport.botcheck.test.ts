/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { initialState, cloneState, opponent, gameOutcome } from './engine/board'
import { maximalTerminals } from './engine/moves'
import { moveNotation } from './engine/notation'
import type { GameState, Player, Step } from './engine/types'
import type { MoveLogEntry } from './storage'
import { buildMat } from './matExport'
import { validateMat } from './matValidate'

// GERÇEK bot maçı üret (motor, iki taraf da legal hamle oynar) — TAM log (online değil, tek
// istemci gibi eksiksiz). buildMat ile .mat kur, dosyaya yaz, İKİ oyuncunun da hamlesi var mı
// doğrula. Amaç: "biri 0" bug'ı buildMat'ta mı yoksa yalnız online kısmi-log'da mı?
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

// ÇOK OYUNLU maç (gerçek App davranışı): oyunlar hedef puana kadar sürer, her oyunun başında
// seq SIFIRLANIR (App.nextGame -> resetGameUi -> setTurnsPlayed(0)) ama matchLog BİRİKİR. Ayrıca
// her oyunun 5. turunda küp teklifi + yanıt (take/drop) enjekte edilir.
function playRealMatch(seed: number, target: number): MoveLogEntry[] {
  const rng = mulberry32(seed)
  const roll = (): number[] => {
    const a = 1 + Math.floor(rng() * 6)
    const b = 1 + Math.floor(rng() * 6)
    return a === b ? [a, a, a, a] : [a, b]
  }
  const entries: MoveLogEntry[] = []
  let sw = 0
  let sb = 0
  for (let gi = 0; gi < 12 && sw < target && sb < target; gi++) {
    let seq = 0 // HER OYUNDA sıfırlanır (turnsPlayed)
    let s: GameState = initialState()
    let mover: Player = rng() < 0.5 ? 'white' : 'black'
    let cubeVal = 1
    let cubeDone = false
    for (let guard = 0; guard < 400; guard++) {
      const dice = roll()
      s = { ...cloneState(s), turn: mover, dice, diceUsed: dice.map(() => false) }
      const before = cloneState(s)
      if (!cubeDone && guard === 4) {
        cubeDone = true
        const resp: 'take' | 'drop' = rng() < 0.7 ? 'take' : 'drop'
        const mk = (player: Player, chosen: string): MoveLogEntry => ({
          notation: '', best: '', loss: 0, player, pos: before, seq,
          cube: { win: 0, equity: 0, recommended: chosen, chosen, correct: true },
        })
        entries.push(mk(mover, 'double'))
        entries.push(mk(opponent(mover), resp))
        if (resp === 'drop') {
          if (mover === 'white') sw += cubeVal
          else sb += cubeVal
          break // pas -> oyun biter
        }
        cubeVal *= 2
      }
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
      const oc = gameOutcome(after)
      if (oc) {
        const pts = cubeVal * oc.multiplier
        if (oc.winner === 'white') sw += pts
        else sb += pts
        break
      }
      after.turn = opponent(mover)
      after.dice = []
      after.diceUsed = []
      s = after
      mover = opponent(mover)
    }
  }
  return entries
}

describe('bot maçı .mat kontrolü', () => {
  it('TAM log -> .mat: iki oyuncunun da hamleleri var (biri 0 bug repro değil)', () => {
    const log = playRealGame(2026)
    const mat = buildMat(log, { matchLength: 1, whiteName: 'Omer', blackName: 'GnuBot' })
    // Fixture: sunucuda gerçek gnubg'ye beslemek için (tavla:gnubg-matchluck-file). Deterministik.
    mkdirSync('backend/tests/Fixtures', { recursive: true })
    writeFileSync('backend/tests/Fixtures/bot-match.mat', mat)
    // Log JSON'u: PHP MatBuilder'ın TS buildMat ile BİREBİR aynı .mat'i ürettiğini doğrulamak için
    // (MatBuilderTest bu log'u okuyup üretir + bot-match.mat ile karşılaştırır -> port parite).
    writeFileSync('backend/tests/Fixtures/bot-match-log.json', JSON.stringify(log))

    const whiteMoves = log.filter((e) => e.player === 'white' && !e.cube).length
    const blackMoves = log.filter((e) => e.player === 'black' && !e.cube).length
    // .mat satırlarında sol (beyaz) ve sağ (siyah) sütun DOLU mu? "NN) <beyaz>   <siyah>"
    const rows = mat.split('\n').filter((l) => /^\s*\d+\)/.test(l))
    const rowsWithBlack = rows.filter((l) => l.replace(/^\s*\d+\)\s*/, '').trim().length > 0
      && /\d\d?:/.test(l.slice(38))).length

    // eslint-disable-next-line no-console
    console.log(`\n=== bot .mat (white ${whiteMoves} / black ${blackMoves} hamle) ===\n${mat}`)

    expect(whiteMoves).toBeGreaterThan(0)
    expect(blackMoves).toBeGreaterThan(0) // KRİTİK: siyahın da hamleleri olmalı (yoksa gnubg 0 verir)
    expect(rows.length).toBeGreaterThan(3)
    expect(rowsWithBlack).toBeGreaterThan(0) // sağ sütun (siyah) .mat'te gerçekten var mı
  })

  // ÇOK OYUNLU maç fixture'ı: gerçek App davranışı gibi seq (= turnsPlayed) HER OYUNDA sıfırlanır
  // ve küp kararları var. Eskiden bu iki şart .mat'i çöpe çeviriyordu (N-1 boş "Game" başlığı +
  // tek dev bozuk oyun). PHP MatBuilder parite testi de bu fixture'ı kullanır.
  it('çok oyunlu + küp + seq reset -> oyunlar doğru bölünür, .mat geçerli', () => {
    const log = playRealMatch(31, 11)
    const mat = buildMat(log, { matchLength: 11, whiteName: 'Omer', blackName: 'GnuBot' })
    mkdirSync('backend/tests/Fixtures', { recursive: true })
    writeFileSync('backend/tests/Fixtures/multi-game-match.mat', mat)
    writeFileSync('backend/tests/Fixtures/multi-game-match-log.json', JSON.stringify(log))

    const headers = mat.split('\n').filter((l) => /^ Game \d+$/.test(l))
    expect(headers.length).toBeGreaterThan(2) // gerçekten çok oyunlu
    // Hiçbir oyun BOŞ olmamalı ("Game N" + skor satırı ardından hamle satırı gelmeli)
    const lines = mat.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!/^ Game \d+$/.test(lines[i])) continue
      expect(lines[i + 2]).toMatch(/^\s*\d+\)/)
    }
    expect(mat).toContain('Doubles => 2')
    expect(validateMat(mat)).toEqual([]) // XG/gnubg gibi baştan oyna: tek bir geçersizlik olmamalı
  })
})
