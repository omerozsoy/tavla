import { describe, it, expect } from 'vitest'
import { initialState, cloneState, opponent, gameOutcome } from './engine/board'
import { maximalTerminals } from './engine/moves'
import { moveNotation } from './engine/notation'
import type { GameState, Player, Step } from './engine/types'
import type { MoveLogEntry } from './storage'
import { mergeOppLog } from './online/oppMove'
import { buildMat } from './matExport'
import { validateMat } from './matValidate'

// UCTAN UCA: otoriter OLMAYAN online oda (peer senkron) -> .mat.
//
// Gercek zincirin tamami simule edilir:
//  - her istemci YALNIZ kendi renginin girdilerini yazar (App.recordMatchTurn / commitTurn)
//  - snapshot'ta rakibe `matchLog.slice(-80)` gider (App: updateRoom)
//  - alici tarafta applyOnlineState birlestirir: kendi girdilerim + mergeOppLog(rakibinkiler)
//  - seq = turnsPlayed ve HER OYUNDA sifirlanir (App.nextGame -> resetGameUi)
//  - log mac boyunca birikir (yalniz yeni MAC'ta temizlenir)
// Sonra iki istemcinin de logundan .mat uretilir ve XG/gnubg gibi bastan oynanarak dogrulanir.

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

const SYNC_WINDOW = 80 // App.tsx: moves: matchLog.slice(-80)

/** Iki istemcinin logu. Yazan taraf kendi rengini yazar; sonra snapshot karsi tarafa akar. */
class Clients {
  logs: Record<Player, MoveLogEntry[]> = { white: [], black: [] }

  /** Girdiyi SAHIBININ istemcisine yaz (kendi rengi). */
  record(owner: Player, e: MoveLogEntry) {
    this.logs[owner].push(e)
  }

  /** `from` istemcisinin snapshot'i `to` istemcisine uygulanir (App.applyOnlineState). */
  sync(from: Player, to: Player) {
    // App: moves = matchLog.filter(kendi rengim).slice(-80)
    const snapshot = this.logs[from].filter((e) => e.player === from).slice(-SYNC_WINDOW)
    const incoming = snapshot.filter((e) => e.player === from)
    const mine = this.logs[to].filter((e) => e.player === to)
    const theirs = this.logs[to].filter((e) => e.player === from)
    this.logs[to] = [...mine, ...mergeOppLog(theirs, incoming)]
  }

  syncBoth() {
    this.sync('white', 'black')
    this.sync('black', 'white')
  }
}

/** Hedefe kadar oyun oynayip iki istemcinin loglarini uretir (kup kararlari dahil). */
function playOnlineMatch(seed: number, target: number): Clients {
  const rng = mulberry32(seed)
  const roll = (): number[] => {
    const a = 1 + Math.floor(rng() * 6)
    const b = 1 + Math.floor(rng() * 6)
    return a === b ? [a, a, a, a] : [a, b]
  }
  const cl = new Clients()
  let sw = 0
  let sb = 0

  for (let gi = 0; gi < 12 && sw < target && sb < target; gi++) {
    let seq = 0 // HER OYUNDA sifirlanir
    let s: GameState = initialState()
    let mover: Player = rng() < 0.5 ? 'white' : 'black'
    let cubeVal = 1
    let cubeDone = false

    for (let guard = 0; guard < 400; guard++) {
      const dice = roll()
      s = { ...cloneState(s), turn: mover, dice, diceUsed: dice.map(() => false) }
      const before = cloneState(s)

      // Kup: teklif eden KENDI istemcisine 'double', yanitlayan KENDI istemcisine cevabini yazar.
      if (!cubeDone && guard === 4) {
        cubeDone = true
        const responder = opponent(mover)
        const resp: 'take' | 'drop' = rng() < 0.7 ? 'take' : 'drop'
        const mk = (player: Player, chosen: string): MoveLogEntry => ({
          notation: '', best: '', loss: 0, player, pos: before, seq,
          cube: { win: 0, equity: 0, recommended: chosen, chosen, correct: true },
        })
        cl.record(mover, mk(mover, 'double'))
        cl.syncBoth()
        cl.record(responder, mk(responder, resp))
        cl.syncBoth()
        if (resp === 'drop') {
          if (mover === 'white') sw += cubeVal
          else sb += cubeVal
          break
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
      cl.record(mover, {
        notation: moveNotation({ steps: played, resultKey: '' }, mover),
        best: '', loss: 0, pos: before, steps: played, playedSteps: played,
        player: mover, dice: dice.slice(0, 2), seq: seq++,
      })
      cl.syncBoth()

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
  return cl
}

describe('online (peer senkron) cok oyunlu mac -> .mat', () => {
  it('iki istemci de TAM ve gecerli .mat uretir', () => {
    const TARGET = 11
    const cl = playOnlineMatch(31, TARGET)

    for (const me of ['white', 'black'] as Player[]) {
      const log = cl.logs[me]
      const mat = buildMat(log, { matchLength: TARGET, whiteName: 'W', blackName: 'B' })

      // 1) Cok oyunlu ve hicbir oyun BOS degil (eski hata: N-1 bos "Game N" + tek dev bozuk oyun)
      const lines = mat.split('\n')
      const headers = lines.filter((l) => /^ Game \d+$/.test(l))
      expect(headers.length, `${me}: mac cok oyunlu olmali`).toBeGreaterThan(2)
      lines.forEach((l, i) => {
        if (/^ Game \d+$/.test(l)) expect(lines[i + 2], `${me}: ${l} bos`).toMatch(/^\s*\d+\)/)
      })

      // 2) HER oyunda IKI sutun da dolu (eski hata: 80'lik pencere disinda kalan erken
      //    oyunlarda rakibin sutunu bombostu)
      let game = 0
      const cells: Record<number, { w: number; b: number }> = {}
      for (const l of lines) {
        if (/^ Game \d+$/.test(l)) {
          game += 1
          cells[game] = { w: 0, b: 0 }
          continue
        }
        if (!/^\s*\d+\)\s/.test(l)) continue
        if (l.slice(5, 5 + 34).trim()) cells[game].w += 1
        if (l.slice(5 + 34).trim()) cells[game].b += 1
      }
      for (const g of Object.keys(cells)) {
        expect(cells[+g].w, `${me}: Game ${g} beyaz sutunu bos`).toBeGreaterThan(0)
        expect(cells[+g].b, `${me}: Game ${g} siyah sutunu bos`).toBeGreaterThan(0)
      }

      // 3) XG/gnubg gibi bastan oyna: tek bir gecersizlik bile olmamali
      expect(validateMat(mat), `${me}: .mat gecersiz`).toEqual([])
    }
  })

  it('iki istemcinin urettigi .mat BIREBIR ayni (tek dogru kayit)', () => {
    const cl = playOnlineMatch(31, 11)
    // Iki istemcinin logu da TAM olmali (kendi rengi zaten tam; rakibin rengi mergeOppLog ile)
    for (const me of ['white', 'black'] as Player[]) {
      expect(cl.logs[me].filter((e) => e.player === 'white').length).toBeGreaterThan(SYNC_WINDOW)
      expect(cl.logs[me].filter((e) => e.player === 'black').length).toBeGreaterThan(SYNC_WINDOW)
    }
    const asW = buildMat(cl.logs.white, { matchLength: 11, whiteName: 'W', blackName: 'B' })
    const asB = buildMat(cl.logs.black, { matchLength: 11, whiteName: 'W', blackName: 'B' })
    expect(asW).toBe(asB)
  })
})
