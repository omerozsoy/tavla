/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { initialState, cloneState, opponent, gameOutcome } from './engine/board'
import { maximalTerminals } from './engine/moves'
import { moveNotation } from './engine/notation'
import type { GameState, Player, Step } from './engine/types'
import type { MoveLogEntry } from './storage'
import { buildMat } from './matExport'

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
})
