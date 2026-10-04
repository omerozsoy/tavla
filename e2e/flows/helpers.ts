// Uçtan uca OYUN AKIŞI yardımcıları (API düzeyi, gerçek backend + validator [+ gnubg]).
//
// Çalıştırma: e2e ortamı ayakta olmalı (bkz playwright.flows.config.ts başlığı).
// Hiçbir üretim seam'i kullanılmaz: zar sunucuda (FairDiceService) üretilir, hamle validator'da
// doğrulanır. Test yalnız İSTEMCİ gibi davranır; sunucunun döndürdüğü her durumu istemci TS
// motoruyla BAĞIMSIZ olarak denetler (taş sayısı, oyun sonu puanı, iki oyuncunun aynı durumu).
import { expect, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { generateMoves } from '../../src/engine/moves'
import { applyMove } from '../../src/engine/game'
import { gameOutcome } from '../../src/engine/board'
import type { GameState, Move, Player } from '../../src/engine/types'

export const API = 'http://127.0.0.1:8000/api'
export type User = { id: number; token: string; nick: string }
export const users: User[] = JSON.parse(readFileSync('backend/storage/app/e2e-users.json', 'utf8'))

export type Seat = { user: User | null; token: string; color: Player; bearer?: string }
export type Room = {
  code: string
  status: string
  bot?: boolean
  mode?: string
  stake?: number
  server_version: number
  server_state: GameState | null
  server_match: {
    target?: number
    score?: { white?: number; black?: number }
    done?: boolean
    winner?: Player | null
    opened?: boolean
    crawford?: boolean
    gameNo?: number
    cube?: { value: number; owner: Player | null; pending: Player | null }
  } | null
  p1_user_id?: number | null
  p2_user_id?: number | null
}

export async function call(request: APIRequestContext, method: 'GET' | 'POST', path: string, bearer: string | undefined, data?: unknown) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (bearer) headers.Authorization = `Bearer ${bearer}`
  const url = path.startsWith('http') ? path : `${API}${path}`
  for (let attempt = 0; ; attempt++) {
    const res = method === 'GET'
      ? await request.get(url, { headers, timeout: 30_000 })
      : await request.post(url, { headers, data, timeout: 60_000 })
    // Hız sınırı (throttle) gerçek oyuncu temposu için; API testi çok hızlı -> bekle ve yeniden dene.
    if (res.status() === 429 && attempt < 20) {
      const wait = Number(res.headers()['retry-after'] ?? 5)
      await new Promise((r) => setTimeout(r, Math.min(60, Math.max(1, wait)) * 1000))
      continue
    }
    const body = await res.json().catch(() => null)
    if (body && typeof body === 'object' && 'trace' in body) delete (body as Record<string, unknown>).trace
    return { status: res.status(), body }
  }
}

export const seatToken = () => randomUUID().replace(/-/g, '').slice(0, 32)

export async function getRoom(request: APIRequestContext, code: string, seat: Seat): Promise<Room> {
  const r = await call(request, 'GET', `/rooms/${code}?token=${encodeURIComponent(seat.token)}`, seat.bearer ?? seat.user?.token)
  expect(r.status, `oda okunamadı ${code}: ${JSON.stringify(r.body)}`).toBe(200)
  return r.body.room as Room
}

/** İki hesabı aynı ayarlarla rastgele eşleşmeye sokar; beyaz=p1 (ilk bekleyen). */
export async function matchmake(request: APIRequestContext, a: User, b: User, opts: Record<string, unknown>): Promise<{ code: string; white: Seat; black: Seat }> {
  const ta = seatToken(); const tb = seatToken()
  const r1 = await call(request, 'POST', '/matchmaking', a.token, { token: ta, name: a.nick, ...opts })
  expect(r1.status, `matchmaking(a) ${JSON.stringify(r1.body)}`).toBe(200)
  const r2 = await call(request, 'POST', '/matchmaking', b.token, { token: tb, name: b.nick, ...opts })
  expect(r2.status, `matchmaking(b) ${JSON.stringify(r2.body)}`).toBe(200)
  expect(r2.body.matched, 'ikinci arayan eşleşmeli').toBe(true)
  const code = r2.body.room.code as string
  const aSeat: Seat = { user: a, token: ta, color: r1.body.slot === 'p1' ? 'white' : 'black' }
  const bSeat: Seat = { user: b, token: tb, color: r2.body.slot === 'p1' ? 'white' : 'black' }
  expect(aSeat.color).not.toBe(bSeat.color)
  return { code, white: aSeat.color === 'white' ? aSeat : bSeat, black: aSeat.color === 'black' ? aSeat : bSeat }
}

/** Arkadaş odası: a oluşturur (p1/beyaz), b kodla katılır. */
export async function friendRoom(request: APIRequestContext, a: User, b: User, opts: Record<string, unknown>): Promise<{ code: string; white: Seat; black: Seat }> {
  const ta = seatToken(); const tb = seatToken()
  const c = await call(request, 'POST', '/rooms', a.token, { token: ta, name: a.nick, ...opts })
  expect(c.status, `oda oluştur ${JSON.stringify(c.body)}`).toBe(200)
  const code = c.body.room.code as string
  const j = await call(request, 'POST', `/rooms/${code}/join`, b.token, { token: tb, name: b.nick })
  expect(j.status, `odaya katıl ${JSON.stringify(j.body)}`).toBe(200)
  return { code, white: { user: a, token: ta, color: 'white' }, black: { user: b, token: tb, color: 'black' } }
}

export function cmd(seat: Seat, version: number, extra: Record<string, unknown> = {}) {
  return { token: seat.token, expected_version: version, command_id: randomUUID(), ...extra }
}

function checkerTotals(s: GameState) {
  let w = s.bar.white + s.off.white, b = s.bar.black + s.off.black
  for (const v of s.points) { if (v > 0) w += v; else b -= v }
  return { w, b }
}

export type GameLog = { score: string; points: number; expectedPoints: number; winner: Player; plies: number }
export type PlayResult = { games: GameLog[]; matchWinner: Player | null; finalScore: { white: number; black: number }; plies: number; anomalies: string[] }

/**
 * Bir odayı MAÇ SONUNA dek API ile oynar. Hamle: yasal hamlelerden rastgele biri (tohumlu RNG).
 * Her ply'da: iki oyuncunun durumu/sürümü aynı, 15+15 taş korunur. Oyun bitişinde sunucunun
 * verdiği puan = istemci motorunun sonucu (tek/mars/katmerli) × küp.
 */
export async function playToEnd(request: APIRequestContext, code: string, seats: { white: Seat; black: Seat }, opt: { rng?: () => number; maxPlies?: number; resignAtPly?: number } = {}): Promise<PlayResult> {
  const rng = opt.rng ?? Math.random
  const anomalies: string[] = []
  const games: GameLog[] = []
  let plies = 0
  let gamePlies = 0
  for (let guard = 0; guard < (opt.maxPlies ?? 4000); guard++) {
    const r = await getRoom(request, code, seats.white)
    const m = r.server_match
    if (m?.done || r.status === 'finished') {
      return { games, matchWinner: (m?.winner ?? null) as Player | null, finalScore: { white: m?.score?.white ?? 0, black: m?.score?.black ?? 0 }, plies, anomalies }
    }
    const st = r.server_state
    if (!st) {
      // Oda henüz açılmadı: açılış zarını ilk /roll atar (sunucu iki zarla başlayanı belirler).
      const rr = await call(request, 'POST', `/rooms/${code}/roll`, seats.white.user?.token, cmd(seats.white, r.server_version))
      if (rr.status !== 200 && rr.status !== 409) throw new Error(`açılış roll ${rr.status} ${JSON.stringify(rr.body)}`)
      continue
    }
    const t = checkerTotals(st)
    if (t.w !== 15 || t.b !== 15) anomalies.push(`ply ${plies}: taş sayısı beyaz=${t.w} siyah=${t.b}`)
    const color = st.turn
    const me = seats[color]
    if (!st.dice?.length) {
      const rr = await call(request, 'POST', `/rooms/${code}/roll`, me.user?.token, cmd(me, r.server_version))
      if (rr.status !== 200) {
        if (rr.status === 409) continue
        throw new Error(`roll ${color} ${rr.status} ${JSON.stringify(rr.body)}`)
      }
      continue
    }
    const moves = generateMoves(st) as Move[]
    const move = moves.length ? moves[Math.floor(rng() * moves.length)] : { steps: [] } as unknown as Move
    // Oyun bitiriyor mu? Sonucu istemci motoruyla ÖNCEDEN hesapla.
    let expectWin: { winner: Player; mult: number } | null = null
    if (move.steps.length) {
      const after = applyMove(st, move)
      const out = gameOutcome(after)
      if (out) expectWin = { winner: out.winner, mult: out.multiplier }
    }
    const pre = { w: m?.score?.white ?? 0, b: m?.score?.black ?? 0, cube: m?.cube?.value ?? 1 }
    const mv = await call(request, 'POST', `/rooms/${code}/move`, me.user?.token, cmd(me, r.server_version, { steps: move.steps }))
    if (mv.status === 409) continue
    expect(mv.status, `move ${color} ply ${plies} ${JSON.stringify(move.steps)} -> ${JSON.stringify(mv.body)}`).toBe(200)
    plies++; gamePlies++
    // İki oyuncu aynı sürüm + durumu görmeli.
    const a = await getRoom(request, code, seats.white)
    const b = await getRoom(request, code, seats.black)
    if (a.server_version !== b.server_version || JSON.stringify(a.server_state) !== JSON.stringify(b.server_state)) {
      anomalies.push(`ply ${plies}: iki oyuncunun durumu farklı (v${a.server_version}/v${b.server_version})`)
    }
    if (expectWin) {
      const sw = (a.server_match?.score?.white ?? 0) - pre.w
      const sb = (a.server_match?.score?.black ?? 0) - pre.b
      const got = expectWin.winner === 'white' ? sw : sb
      const other = expectWin.winner === 'white' ? sb : sw
      const expected = expectWin.mult * pre.cube
      games.push({ score: `${a.server_match?.score?.white ?? 0}-${a.server_match?.score?.black ?? 0}`, points: got, expectedPoints: expected, winner: expectWin.winner, plies: gamePlies })
      gamePlies = 0
      // Maç hedefinde puan kırpılabilir (ör. 5 hedefte 4-0 iken mars = 2 değil kalan puan değil; TavlaTV
      // skoru hedefe KIRPMAZ ise birebir eşit olmalı). Kaybedenin skoru değişmemeli.
      if (other !== 0) anomalies.push(`oyun ${games.length}: kaybedenin skoru değişti (${other})`)
      if (got !== expected) anomalies.push(`oyun ${games.length}: puan ${got}, beklenen ${expected} (çarpan ${expectWin.mult} × küp ${pre.cube})`)
    }
  }
  throw new Error(`maç ${opt.maxPlies ?? 4000} ply içinde bitmedi (${code})`)
}

/** Basit tohumlu RNG (mulberry32) — tekrar üretilebilir hamle seçimi. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
