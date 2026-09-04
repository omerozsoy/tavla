import { describe, expect, it } from 'vitest'
import type { Player } from '../engine/types'
import { rollResponseAction, shouldApplyServerState, type SyncLocal } from './authSync'

// ---- shouldApplyServerState: mid-move koruması sıra sahipliğine bağlı olmalı ----
describe('shouldApplyServerState', () => {
  const rv = (v: number, turn: Player = 'white') => ({
    authoritative: true,
    server_state: { turn, dice: [] },
    server_version: v,
  })

  it('sürüm ilerlemediyse uygulamaz', () => {
    const local: SyncLocal = { turn: 'white', diceCount: 0, playedCount: 0, appliedServerVersion: 5 }
    expect(shouldApplyServerState(local, rv(5), 'white')).toBe(false)
    expect(shouldApplyServerState(local, rv(6), 'white')).toBe(true)
  })

  it('authoritative değilse / server_state yoksa uygulamaz', () => {
    const local: SyncLocal = { turn: 'white', diceCount: 0, playedCount: 0, appliedServerVersion: -1 }
    expect(shouldApplyServerState(local, { authoritative: false, server_version: 3 }, 'white')).toBe(false)
    expect(shouldApplyServerState(local, { authoritative: true, server_version: 3 }, 'white')).toBe(false)
  })

  it('KENDİ turumda + zar/hamle varken uygulamaz (mid-move koruması)', () => {
    const local: SyncLocal = { turn: 'white', diceCount: 2, playedCount: 0, appliedServerVersion: 0 }
    expect(shouldApplyServerState(local, rv(9), 'white')).toBe(false) // benim turum, zar elimde
  })

  it('DESYNC FIX: rakip turundayken zar görünse bile DAİMA senkronla (açılış başlayan-olmayan)', () => {
    // Açılışta başlayan-olmayan tarafın tahtasında da açılış zarı görünür (turn=rakip, diceCount>0).
    // ESKİ BUG: sıra-kontrolsüz midMove -> uygulamaz -> kalıcı desync. FIX: rakip turu -> uygula.
    const local: SyncLocal = { turn: 'black', diceCount: 2, playedCount: 0, appliedServerVersion: 0 }
    expect(shouldApplyServerState(local, rv(9, 'black'), 'white')).toBe(true)
  })
})

describe('rollResponseAction', () => {
  it('opening -> apply-opening', () => {
    expect(rollResponseAction({ opening: true, starter: 'black' })).toBe('apply-opening')
  })
  it('reused -> defer-to-poll (starter taşımaz, poll düzeltir)', () => {
    expect(rollResponseAction({ reused: true })).toBe('defer-to-poll')
  })
  it('normal -> apply-normal', () => {
    expect(rollResponseAction({ reused: false })).toBe('apply-normal')
  })
})

// ---- 2-İSTEMCİ SİMÜLASYON: açılış + hamle döngüsü, DESYNC olmamalı ----
// Sunucu modeli (backend sözleşmesini yansıtır) + iki istemci gerçek sync kararlarıyla oynar.
class SimServer {
  turn: Player = 'white'
  dice: number[] = []
  version = 0
  opened = false
  starter: Player
  constructor(starter: Player) {
    this.starter = starter
  }

  roll(color: Player): { opening?: boolean; reused?: boolean; starter?: Player; dice: number[] } | { error: 409 } {
    if (!this.opened) {
      this.opened = true
      this.turn = this.starter
      this.dice = [5, 3] // açılış çifti (farklı)
      this.version++
      return { opening: true, starter: this.starter, dice: this.dice }
    }
    if (this.dice.length > 0) return { reused: true, dice: this.dice } // zaten verilmiş
    if (this.turn !== color) return { error: 409 }
    this.dice = [4, 2]
    this.version++
    return { reused: false, dice: this.dice }
  }

  move(color: Player): { ok: boolean } {
    if (this.turn !== color || this.dice.length === 0) return { ok: false }
    this.turn = color === 'white' ? 'black' : 'white'
    this.dice = []
    this.version++
    return { ok: true }
  }

  view() {
    return { authoritative: true, server_state: { turn: this.turn, dice: [...this.dice] }, server_version: this.version }
  }
}

class SimClient {
  turn: Player = 'white'
  dice: number[] = []
  played = 0
  appliedServerVersion = -1
  myColor: Player
  server: SimServer
  constructor(myColor: Player, server: SimServer) {
    this.myColor = myColor
    this.server = server
  }

  // Açılışı tetikle (App.tsx opening useEffect authoritative dalı gibi).
  triggerOpening() {
    const r = this.server.roll(this.myColor)
    if ('error' in r) return // 409 -> sessiz, poll getirir
    const action = rollResponseAction(r)
    if (action === 'apply-opening') {
      this.turn = r.starter!
      this.dice = [...r.dice]
      this.played = 0
    }
    // defer-to-poll / apply-normal(opening değil) -> poll'a bırak
  }

  // Sıramsa zar at (App.tsx doRoll authoritative gibi).
  rollIfMyTurn() {
    if (this.turn !== this.myColor || this.dice.length > 0) return
    const r = this.server.roll(this.myColor)
    if ('error' in r) return
    if (rollResponseAction(r) === 'apply-normal') this.dice = [...r.dice]
  }

  // Sıramsa hamle yap + commit (App.tsx commitTurn authoritative gibi: serverMove yanıtını uygula).
  moveIfMyTurn() {
    if (this.turn !== this.myColor || this.dice.length === 0) return
    const res = this.server.move(this.myColor)
    if (res.ok) {
      const v = this.server.view()
      this.appliedServerVersion = v.server_version
      this.turn = v.server_state.turn
      this.dice = [...v.server_state.dice]
      this.played = 0
    }
  }

  // Poll: gerçek karar fonksiyonuyla senkronla.
  poll() {
    const rv = this.server.view()
    if (
      shouldApplyServerState(
        { turn: this.turn, diceCount: this.dice.length, playedCount: this.played, appliedServerVersion: this.appliedServerVersion },
        rv,
        this.myColor,
      )
    ) {
      this.appliedServerVersion = rv.server_version
      this.turn = rv.server_state.turn
      this.dice = [...rv.server_state.dice]
      this.played = 0
    }
  }
}

describe('2-istemci authoritative simülasyonu', () => {
  // Her iki başlayan senaryosu (white/black) + hangi istemcinin açılışı önce tetiklediği önemli.
  for (const starter of ['white', 'black'] as Player[]) {
    for (const firstToTrigger of ['white', 'black'] as Player[]) {
      it(`starter=${starter}, ilk açılış tetikleyen=${firstToTrigger} -> DESYNC yok, tur akar`, () => {
        const server = new SimServer(starter)
        const white = new SimClient('white', server)
        const black = new SimClient('black', server)
        const clients = firstToTrigger === 'white' ? [white, black] : [black, white]

        // Açılış: ikisi de tetikler (biri opening yapar, diğeri 409/reused).
        clients[0].triggerOpening()
        clients[1].triggerOpening()
        // Poll turu: her iki istemci sunucuya senkronlanır.
        white.poll()
        black.poll()

        // Birkaç tur oyna: sırası gelen zar atar, oynar; sonra ikisi de poll'lar.
        for (let i = 0; i < 6; i++) {
          white.rollIfMyTurn()
          black.rollIfMyTurn()
          white.moveIfMyTurn()
          black.moveIfMyTurn()
          white.poll()
          black.poll()

          // DESYNC OLMAMALI: iki istemci de sunucunun sırasında hemfikir.
          expect(white.turn).toBe(server.turn)
          expect(black.turn).toBe(server.turn)
          // İkisi de aynı sırayı görüyor (biri "benim turum" derken diğeri "rakip turu").
          expect(white.turn).toBe(black.turn)
        }

        // En az birkaç tur ilerledi (oyun kilitlenmedi).
        expect(server.version).toBeGreaterThan(3)
      })
    }
  }
})
