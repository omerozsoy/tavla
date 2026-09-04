import { describe, expect, it } from 'vitest'
import type { Player } from '../engine/types'
import {
  isOnlineReady,
  matchEndFromServer,
  openingStateFromMatch,
  rollResponseAction,
  serverMatchToLocal,
  shouldApplyServerState,
  type SyncLocal,
} from './authSync'

const other = (p: Player): Player => (p === 'white' ? 'black' : 'white')

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
  cube = { value: 1, owner: null as Player | null, pending: null as Player | null }
  target = 1
  score = { white: 0, black: 0 }
  done = false
  winner: Player | null = null
  constructor(starter: Player, target = 1) {
    this.starter = starter
    this.target = target
  }

  // Kazanan hamle: sıra sahibi oyunu (ve target=1 maçı) bitirir. Sunucu skoru+winner yazar.
  winningMove(color: Player): { ok: boolean } {
    if (this.turn !== color || this.dice.length === 0 || this.cube.pending) return { ok: false }
    this.score[color] += this.cube.value
    this.dice = []
    if (this.score[color] >= this.target) {
      this.done = true
      this.winner = color
    } else {
      this.turn = other(color) // maç sürüyor -> sıra devret (yeni oyun açılışı ayrı)
    }
    this.version++
    return { ok: true }
  }

  roll(color: Player): { opening?: boolean; reused?: boolean; starter?: Player; dice: number[] } | { error: 409 } {
    if (this.cube.pending) return { error: 409 } // küp beklerken zar yok
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
    if (this.turn !== color || this.dice.length === 0 || this.cube.pending) return { ok: false }
    this.turn = other(color)
    this.dice = []
    this.version++
    return { ok: true }
  }

  cubeOffer(color: Player): { ok: boolean } {
    if (this.turn !== color || this.dice.length > 0 || this.cube.pending) return { ok: false }
    if (this.cube.owner !== null && this.cube.owner !== color) return { ok: false }
    this.cube.pending = color
    this.version++
    return { ok: true }
  }

  cubeRespond(color: Player, action: 'take' | 'drop'): { ok: boolean } {
    if (!this.cube.pending || color !== other(this.cube.pending)) return { ok: false }
    if (action === 'take') {
      this.cube = { value: this.cube.value * 2, owner: color, pending: null }
    } else {
      this.cube = { value: 1, owner: null, pending: null } // drop -> oyun biter, yeni oyun küpü ortada
    }
    this.version++
    return { ok: true }
  }

  view() {
    return {
      authoritative: true,
      server_state: { turn: this.turn, dice: [...this.dice] },
      server_version: this.version,
      server_match: {
        target: this.target,
        score: { ...this.score },
        cube: { ...this.cube },
        done: this.done,
        winner: this.winner,
        opened: this.opened,
      },
    }
  }
}

class SimClient {
  turn: Player = 'white'
  dice: number[] = []
  played = 0
  appliedServerVersion = -1
  // Küp + skor yerel görünümü (SUNUCUDAN serverMatchToLocal ile senkron; forge yok).
  cubeValue = 1
  cubeOwner: Player | null = null
  cubePending: Player | null = null
  score = { white: 0, black: 0 }
  target = 1
  myColor: Player
  server: SimServer
  constructor(myColor: Player, server: SimServer) {
    this.myColor = myColor
    this.server = server
  }

  // Sunucu görünümündeki maç durumunu (skor+küp) SAF reduce ile yerelе uygula.
  private syncMatch(sm: Parameters<typeof serverMatchToLocal>[0]) {
    const lm = serverMatchToLocal(sm, this.target)
    this.cubeValue = lm.cubeValue
    this.cubeOwner = lm.cubeOwner
    this.cubePending = lm.cubePending
    this.score = lm.score
    this.target = lm.target
  }

  // İstemcinin KENDİ senkron skorundan türettiği maç-sonu (App.tsx matchEndFromServer ile aynı).
  matchEnd() {
    return matchEndFromServer({ target: this.target, score: this.score })
  }

  // Sıramsa + zar atmadan önce küp teklif et.
  cubeOfferIfCan() {
    if (this.turn !== this.myColor || this.dice.length > 0 || this.cubePending) return
    this.server.cubeOffer(this.myColor)
  }

  // Bana teklif geldiyse yanıtla.
  cubeRespondIfPending(action: 'take' | 'drop') {
    if (this.cubePending && this.cubePending === other(this.myColor)) {
      this.server.cubeRespond(this.myColor, action)
    }
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

  // Kazanan hamle + commit (App.tsx commitTurn authoritative gibi: serverMove yanıtını uygula ->
  // KENDİ zarını temizler + skoru/turnu senkronlar; yani mid-move biter).
  winningMoveIfMyTurn() {
    if (this.turn !== this.myColor || this.dice.length === 0) return
    const res = this.server.winningMove(this.myColor)
    if (res.ok) {
      const v = this.server.view()
      this.appliedServerVersion = v.server_version
      this.turn = v.server_state.turn
      this.dice = [...v.server_state.dice]
      this.played = 0
      this.syncMatch(v.server_match)
    }
  }

  // Poll: gerçek karar fonksiyonuyla senkronla (tahta + skor/küp).
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
      this.syncMatch(rv.server_match)
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
          expect(white.turn).toBe(black.turn)
          // SAAT dışlaması: TAM BİR istemci "benim turum" der (diğeri "rakip turu"). Aksi halde
          // iki tarafta da saat sayar / "hamle yap" uyarısı çıkar (yaşanan bug). XOR olmalı.
          const whiteThinksMine = white.turn === white.myColor
          const blackThinksMine = black.turn === black.myColor
          expect(whiteThinksMine).not.toBe(blackThinksMine)

          // OYNANABİLİRLİK: sırası olan istemci authoritative'de TAHTAYA ETKİLEŞEBİLMELİ (onlineReady).
          // p2(black) authoritative'de oppStarted asla set olmaz; gate onu kilitlerse HAMLE YAPAMAZ
          // (yaşanan "zar atıldı oynayamadım" bug'ı). İki istemci de authoritative -> daima hazır.
          for (const [c, slot] of [[white, 'p1'], [black, 'p2']] as const) {
            expect(
              isOnlineReady({ online: true, status: 'playing', slot, oppStarted: false, authoritative: true }),
              `${slot} authoritative'de hazır olmalı (oppStarted olmadan)`,
            ).toBe(true)
            void c
          }
        }

        // En az birkaç tur ilerledi (oyun kilitlenmedi).
        expect(server.version).toBeGreaterThan(3)
      })
    }
  }

  it('küp senkronu: teklif -> rakip görür -> take -> iki istemci de ×2 (offer/pending/take)', () => {
    const server = new SimServer('white')
    const white = new SimClient('white', server)
    const black = new SimClient('black', server)
    // Açılış + senkron (white başlar, zarını oynar, sıra black'e).
    white.triggerOpening()
    black.triggerOpening()
    white.poll()
    black.poll()
    white.moveIfMyTurn() // white açılışı oynar -> sıra black
    white.poll()
    black.poll()
    expect(server.turn).toBe('black')

    // Black sırasında, ZAR ATMADAN küp teklif eder.
    black.cubeOfferIfCan()
    white.poll()
    black.poll()
    // Teklif eden (black) ve rakip (white) İKİSİ de bekleyen teklifi görür (senkron).
    expect(server.cube.pending).toBe('black')
    expect(black.cubePending).toBe('black')
    expect(white.cubePending).toBe('black')

    // Rakip (white) TAKE eder -> ×2, küp white'a geçer, pending temizlenir; iki istemci de senkron.
    white.cubeRespondIfPending('take')
    white.poll()
    black.poll()
    expect(server.cube.value).toBe(2)
    expect(white.cubeValue).toBe(2)
    expect(black.cubeValue).toBe(2)
    expect(white.cubeOwner).toBe('white')
    expect(black.cubeOwner).toBe('white')
    expect(white.cubePending).toBeNull()
    expect(black.cubePending).toBeNull()
  })

  it('maç-sonu senkronu: kazanan hamle -> iki istemci de AYNI kazananı/matchOver görür', () => {
    const server = new SimServer('white', 1) // tek oyunluk maç
    const white = new SimClient('white', server)
    const black = new SimClient('black', server)
    white.triggerOpening()
    black.triggerOpening()
    white.poll()
    black.poll()
    expect(server.turn).toBe('white') // starter=white, zarı elinde

    // white kazanan hamleyi yapar (commitTurn -> serverMove yanıtını uygular: kendi zarını temizler).
    white.winningMoveIfMyTurn()
    white.poll()
    black.poll()

    // İki istemci de KENDİ senkron skorundan aynı maç-sonunu türetir (loser 'kazandım' göremez).
    expect(white.matchEnd()).toEqual({ matchOver: true, winner: 'white' })
    expect(black.matchEnd()).toEqual({ matchOver: true, winner: 'white' })
    // İstemci türetimi SUNUCU winner'ıyla TUTARLI (skor-türetme == server_match.winner).
    expect(server.winner).toBe('white')
    expect(matchEndFromServer(server.view().server_match).winner).toBe(server.winner)
  })
})

describe('serverMatchToLocal + openingStateFromMatch', () => {
  it('küp değeri/sahip/pending sunucudan yansır', () => {
    const lm = serverMatchToLocal({ target: 5, score: { white: 2, black: 1 }, cube: { value: 4, owner: 'black', pending: 'white' } }, 1)
    expect(lm.target).toBe(5)
    expect(lm.score).toEqual({ white: 2, black: 1 })
    expect(lm.cubeValue).toBe(4)
    expect(lm.cubeOwner).toBe('black')
    expect(lm.cubePending).toBe('white')
  })
  it('eksik alanlar güvenli varsayılan (küp 1/ortada, skor 0)', () => {
    const lm = serverMatchToLocal({}, 7)
    expect(lm.target).toBe(7)
    expect(lm.cubeValue).toBe(1)
    expect(lm.cubeOwner).toBeNull()
    expect(lm.score).toEqual({ white: 0, black: 0 })
  })
  it('açılış durumu: yeni oyun(opened false)->roll, oyun içi->null, maç bitti->keep', () => {
    expect(openingStateFromMatch({ opened: false, done: false })).toBe('roll')
    expect(openingStateFromMatch({ opened: true, done: false })).toBeNull()
    expect(openingStateFromMatch({ done: true })).toBe('keep')
  })
})

// ---- isOnlineReady: tahta etkileşimi gate'i (p2 authoritative kilitlenme bug'ı) ----
describe('isOnlineReady', () => {
  it('offline -> daima hazır', () => {
    expect(isOnlineReady({ online: false, oppStarted: false })).toBe(true)
  })
  it('online ama status playing değil -> hazır değil', () => {
    expect(isOnlineReady({ online: true, status: 'waiting', slot: 'p1', oppStarted: false })).toBe(false)
  })
  it('p1 (başlatan) playing -> hazır (rakip beklemeye gerek yok)', () => {
    expect(isOnlineReady({ online: true, status: 'playing', slot: 'p1', oppStarted: false })).toBe(true)
  })
  it('LEGACY p2: rakip snapshot gelene (oppStarted) kadar hazır DEĞİL', () => {
    expect(isOnlineReady({ online: true, status: 'playing', slot: 'p2', oppStarted: false })).toBe(false)
    expect(isOnlineReady({ online: true, status: 'playing', slot: 'p2', oppStarted: true })).toBe(true)
  })
  it('BUG FIX: AUTHORITATIVE p2 -> oppStarted olmadan da hazır (yoksa siyah HİÇ oynayamaz)', () => {
    expect(
      isOnlineReady({ online: true, status: 'playing', slot: 'p2', oppStarted: false, authoritative: true }),
    ).toBe(true)
  })
})
