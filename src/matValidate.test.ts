import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { initialState, cloneState, opponent, gameOutcome } from './engine/board'
import { maximalTerminals } from './engine/moves'
import { moveNotation } from './engine/notation'
import type { GameState, Player, Step } from './engine/types'
import type { MoveLogEntry } from './storage'
import { buildMat } from './matExport'
import { validateMat } from './matValidate'

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

// Motorla GERCEK (legal) bir oyun oyna -> MoveLogEntry listesi. Kup istege bagli.
function playRealGame(seed: number, cubeAtSeq?: number): MoveLogEntry[] {
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
    if (cubeAtSeq !== undefined && seq === cubeAtSeq) {
      const c = (player: Player, chosen: 'double' | 'take'): MoveLogEntry => ({
        notation: '', best: '', loss: 0, player, pos: before, seq,
        cube: { win: 0, equity: 0, recommended: chosen, chosen, correct: true },
      })
      entries.push(c(mover, 'double'), c(opponent(mover), 'take'))
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
    if (gameOutcome(after)) break
    after.turn = opponent(mover)
    after.dice = []
    after.diceUsed = []
    s = after
    mover = opponent(mover)
  }
  return entries
}

// XG'nin yaptigi kontrolun aynisi: uretilen .mat bastan oynanir, her hamle o turun
// zarlariyla legal + maksimal olmali ve sutun almasigi bozulmamali.
describe('validateMat — uretilen .mat XG gozuyle gecerli mi', () => {
  it('gercek oyunlarin .mat ciktisinda sorun yok (kupsuz)', () => {
    for (const seed of [12345, 777, 4242, 999, 31337]) {
      const mat = buildMat(playRealGame(seed), { matchLength: 1, whiteName: 'W', blackName: 'B' })
      expect(validateMat(mat), `seed=${seed}`).toEqual([])
    }
  })

  it('gercek oyunun .mat ciktisinda sorun yok (double+take enjekte)', () => {
    const mat = buildMat(playRealGame(777, 6), { matchLength: 5, whiteName: 'W', blackName: 'B' })
    expect(validateMat(mat)).toEqual([])
  })

  it('bozuk .mat yakalanir: cevapsiz Doubles + sutun kaymasi', () => {
    const bad = [
      '1 point match',
      '',
      ' Game 1',
      ' W : 0                                 B : 0',
      '  1) 31: 8/5 6/5                       42: 24/20 13/11',
      '  2) Doubles => 2',
      '  3) 63: 24/18 18/15',
      '',
    ].join('\n')
    const p = validateMat(bad)
    expect(p.length).toBeGreaterThan(0)
    expect(p.some((x) => /cevaplanmadan/.test(x.detail))).toBe(true)
  })

  // Elde .mat dosyasi varsa dogrudan onu denetle: MAT_FILE=... npx vitest run src/matValidate.test.ts
  it('MAT_FILE verilmisse o dosyayi denetle', () => {
    const f = process.env.MAT_FILE
    if (!f) return
    const problems = validateMat(fs.readFileSync(f, 'utf8'))
    if (problems.length) {
      console.error(problems.map((p) => `oyun ${p.game} satir ${p.line}: "${p.cell}" -> ${p.detail}`).join('\n'))
    }
    expect(problems).toEqual([])
  })
})
