// E2E: İKİ HESAP ARASI 10 TAM OYUN — gerçek sunucu pipeline'ı (tarayısız sürücü).
// UI'ın çağırdığı AYNI endpoint'leri kullanır: /matchmaking → /roll → /move (validator parity +
// version-gate + clock + skor + bear-off + maç-geçişi). DB'ye hamle YAZMAZ, olay ATLAMAZ -> gerçek akış.
//
// NEDEN tarayısız: tek-threadli dev-server'da (php artisan serve, Windows'ta FPM/worker yok) 2 canlı
// tarayıcının sürekli poll'u worker'ı 15-50× satüre eder -> POST ~10sn -> oyun SAATİ (casual 15sn delay)
// aşılır -> oyunlar bear-off'tan ÖNCE forfeit olur. Tarayıcı render'ı AYRI doğrulanır (full-ui harness).
// NOT (hız): e2e.sqlite WAL modunda daha hızlı koşar (`PRAGMA journal_mode=WAL`); doğruluk için şart değil.
//
// KÖK-NEDEN ÖĞRENİMLERİ (harness, uygulama değil): (1) command_id geçerli UUID olmalı -> randomUUID().
// (2) presence: bekleyen oyuncu heartbeat GÖNDERMELİ yoksa _seen 45sn'de eskir -> haksız ABANDON.
// (3) DANCE'te boş-steps /move ile PAS at (tarayıcı oto-pas'ı yok) yoksa aktif oyuncu AFK_TIMEOUT.
import { test, expect, type APIRequestContext } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomUUID, randomBytes } from 'node:crypto'
import { generateMoves, hasNoMove } from '../../src/engine/moves'
import type { GameState, Move, Player } from '../../src/engine/types'

type User = { id: number; token: string; nick: string }
const API = 'http://127.0.0.1:8000/api'
const GAMES_TARGET = Number(process.env.GAMES || 10)
const OUT = 'test-artifacts/api-games'
const users = JSON.parse(readFileSync('backend/storage/app/e2e-users.json', 'utf8')) as User[]
type Match = { score?: { white?: number; black?: number }; done?: boolean; gameNo?: number; winner?: string }
type Room = { code: string; status?: string; server_version: number; server_state: GameState | null; server_match: Match | null; end_reason?: string | null }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ptoken = () => 'p_' + randomBytes(32).toString('base64url')
const log = (line: string) => { try { writeFileSync(`${OUT}/games.log`, line + '\n', { flag: 'a' }) } catch { /* */ } }

async function post(request: APIRequestContext, path: string, bearer: string, data: unknown) {
  const r = await request.post(API + path, { headers: { Authorization: `Bearer ${bearer}` }, data, timeout: 20_000 })
  return { status: r.status(), body: (await r.json().catch(() => null)) as Record<string, unknown> | null }
}
async function getRoom(request: APIRequestContext, code: string, rt: string): Promise<Room> {
  const r = await request.get(`${API}/rooms/${code}?token=${encodeURIComponent(rt)}`, { headers: { Authorization: `Bearer ${users[0].token}` }, timeout: 20_000 })
  const b = await r.json().catch(() => null)
  return (b?.room ?? {}) as Room
}
// PRESENCE HEARTBEAT: tarayıcı showRoom() poll'unu taklit — her iki oyuncunun _seen'ini tazeler.
// API ile oynarken bekleyen oyuncu poll ETMEZ -> _seen 45sn'de eskir -> haksız ABANDON (sahte 5-0).
// since=huge -> sunucu 204 döner (payload yok, hızlı) ama tickClock _seen'i DAMGALAR (show():~1619).
async function heartbeat(request: APIRequestContext, code: string, u: User, rt: string) {
  await request.get(`${API}/rooms/${code}?token=${encodeURIComponent(rt)}&since=999999999`, { headers: { Authorization: `Bearer ${u.token}`, 'X-Room-Token': rt }, timeout: 20_000 }).catch(() => { /* */ })
}
// POST /roll + /move yanıt gövdesi -> Room (ayrı getRoom gerekmez; tur başına poll'u eler).
function roomFromResp(code: string, b: Record<string, unknown> | null): Room | null {
  if (!b || (b as { version?: number }).version === undefined) return null
  const x = b as { state?: GameState; version: number; match?: Match; match_done?: boolean }
  return { code, status: x.match_done ? 'done' : 'playing', server_version: x.version, server_state: x.state ?? null, server_match: x.match ?? null }
}
async function apiRoll(request: APIRequestContext, code: string, u: User, rt: string, ver: number) {
  return post(request, `/rooms/${code}/roll`, u.token, { token: rt, expected_version: ver, command_id: randomUUID() })
}
async function apiMove(request: APIRequestContext, code: string, u: User, rt: string, steps: Move['steps'], ver: number) {
  return post(request, `/rooms/${code}/move`, u.token, { token: rt, steps, expected_version: ver, command_id: randomUUID() })
}

test('API tek-sürücü: iki hesap gerçek sunucu akışıyla 10 tam oyun (bear-off)', async ({ request }) => {
  test.setTimeout(60 * 60_000)
  mkdirSync(OUT, { recursive: true })
  const anomalies: string[] = []; const timeouts: string[] = []; const gameRows: Record<string, unknown>[] = []
  let totalGames = 0, matchNo = 0, totalPlies = 0
  const t0 = Date.now()

  // İki hesabı matchmaking ile eşle. İlk seeken p1(=white), eşleşen p2(=black).
  async function matchmake(): Promise<{ code: string; whiteU: User; whiteT: string; blackU: User; blackT: string } | null> {
    const tokA = ptoken(), tokB = ptoken()
    const mk = (u: User, tok: string) => ({ token: tok, name: u.nick, rating: null, avatar: null, stake: 0, stakes: null, user_id: u.id, min_rating: 0, bet_pct: 0, targets: [5], time_control: 'casual', classic: false })
    await post(request, '/matchmaking/cancel', users[0].token, { token: tokA }).catch(() => {})
    await post(request, '/matchmaking/cancel', users[1].token, { token: tokB }).catch(() => {})
    const r0 = await post(request, '/matchmaking', users[0].token, mk(users[0], tokA))
    const r1 = await post(request, '/matchmaking', users[1].token, mk(users[1], tokB))
    const room0 = r0.body?.room as { code?: string } | undefined
    const room1 = r1.body?.room as { code?: string } | undefined
    const code = room1?.code || room0?.code || ''
    if (!code) { log(`matchmake FAIL r0=${r0.status} r1=${r1.status}`); return null }
    // slot: ilk seeker p1. p1=white (empirik doğrulandı). user0 p2'ye düşerse (nadir) ters çevir.
    const s0 = r0.body?.slot as string | undefined
    const aIsWhite = s0 !== 'p2'
    return aIsWhite
      ? { code, whiteU: users[0], whiteT: tokA, blackU: users[1], blackT: tokB }
      : { code, whiteU: users[1], whiteT: tokB, blackU: users[0], blackT: tokA }
  }

  try {
    while (totalGames < GAMES_TARGET && matchNo < 12) {
      matchNo++
      const mm = await matchmake()
      if (!mm) { await sleep(1000); continue }
      const { code, whiteU, whiteT, blackU, blackT } = mm
      const readT = whiteT // GET için herhangi geçerli oda token'ı
      log(`--- MAÇ ${matchNo} ${code} white=${whiteU.nick} black=${blackU.nick} ---`)
      const seen = new Set<string>(); let done = false; let gStart = Date.now(); let stuck = 0
      let cur = await getRoom(request, code, readT)
      for (let guard = 0; guard < 20000 && !done && totalGames < GAMES_TARGET; guard++) {
        // İKİ oyuncu da "canlı" kalsın (bekleyen oyuncu presence timeout'uyla ABANDON olmasın).
        await heartbeat(request, code, whiteU, whiteT)
        await heartbeat(request, code, blackU, blackT)
        done = !!cur.server_match?.done
        const score = `${cur.server_match?.score?.white ?? 0}-${cur.server_match?.score?.black ?? 0}`
        if (!seen.has(score) && score !== '0-0') {
          seen.add(score); totalGames++
          gameRows.push({ match: matchNo, game: totalGames, score, gameNo: cur.server_match?.gameNo, ms: Date.now() - gStart }); gStart = Date.now()
          log(`OYUN ${totalGames} bitti skor=${score} gameNo=${cur.server_match?.gameNo} (${Math.round((Date.now() - gStart) / 1000)}s)`)
        }
        if (done || totalGames >= GAMES_TARGET) break
        const st = cur.server_state
        if (!st) { // AÇILIŞ: iki taraf da v=0'da roll -> sunucu başlayanı belirler
          await apiRoll(request, code, whiteU, whiteT, cur.server_version).catch(() => {})
          await apiRoll(request, code, blackU, blackT, cur.server_version).catch(() => {})
          await sleep(120); cur = await getRoom(request, code, readT); continue
        }
        const tot = (() => { let w = st.bar.white + st.off.white, b = st.bar.black + st.off.black; for (const v of st.points) { if (v > 0) w += v; else b -= v } return { w, b } })()
        if (tot.w !== 15 || tot.b !== 15) anomalies.push(`v${cur.server_version}: taş ${tot.w}/${tot.b}`)
        const turn = st.turn as Player
        const au = turn === 'white' ? whiteU : blackU
        const at = turn === 'white' ? whiteT : blackT
        const vBefore = cur.server_version

        if (!st.dice?.length) {
          const resp = await apiRoll(request, code, au, at, vBefore)
          const nx = roomFromResp(code, resp.body)
          cur = nx ?? await getRoom(request, code, readT)
          if (cur.server_version === vBefore && !nx) { stuck++; if (stuck > 6) { anomalies.push(`v${vBefore}: roll ilerlemedi ${resp.status}`); break } }
          continue
        }
        const moves = generateMoves(st) as Move[]
        if (hasNoMove(moves)) {
          // DANCE (hamle yok): API'de tarayıcı oto-pas YOK -> boş-steps /move ile PAS at (istemci de
          // commitTurn([]) yapar). Yoksa aktif oyuncu hamle yapmadan bekler -> AFK_TIMEOUT forfeit.
          const resp = await apiMove(request, code, au, at, [], vBefore)
          const nx = roomFromResp(code, resp.body)
          cur = nx ?? await getRoom(request, code, readT)
          if (cur.server_version === vBefore && !nx) { stuck++; if (stuck > 6) { anomalies.push(`v${vBefore}: pas ilerlemedi ${resp.status}`); break } } else { totalPlies++; stuck = 0 }
          continue
        }
        const mv = moves[0]
        const resp = await apiMove(request, code, au, at, mv.steps, vBefore)
        const nx = roomFromResp(code, resp.body)
        if (nx) cur = nx
        const advanced = cur.server_version !== vBefore || !!cur.server_match?.done
        if (advanced) { totalPlies++; stuck = 0 } else { stuck++; cur = await getRoom(request, code, readT); if (cur.server_version === vBefore) anomalies.push(`v${vBefore}: /move ilerlemedi ${resp.status} ${JSON.stringify(mv.steps)}`) }
        if (stuck > 6) { anomalies.push(`v${vBefore}: tur ilerlemedi (stuck ${resp.status})`); break }
      }
      const fin = await getRoom(request, code, readT)
      const er = fin.end_reason ?? '-'
      log(`MAÇ ${matchNo} bitiş end_reason=${er} skor=${fin.server_match?.score?.white ?? 0}-${fin.server_match?.score?.black ?? 0}`)
      if (er === 'TIMEOUT' || er === 'AFK_TIMEOUT' || er === 'ABANDON') timeouts.push(`maç${matchNo}:${code}:${er}`)
    }
  } finally {
    writeFileSync(`${OUT}/summary.json`, JSON.stringify({ totalGames, matchNo, totalPlies, elapsedMs: Date.now() - t0, timeouts, anomalies, games: gameRows }, null, 2))
    log(`BİTTİ oyun=${totalGames} maç=${matchNo} ply=${totalPlies} timeout=${timeouts.length} anomali=${anomalies.length}`)
  }
  expect(anomalies, `anomali: ${anomalies.slice(0, 4).join(' | ')}`).toHaveLength(0)
  expect(timeouts, `forfeit/timeout ile biten maç (bear-off bekleniyordu): ${timeouts.join(' | ')}`).toHaveLength(0)
  expect(totalGames, `>=${GAMES_TARGET} tam oyun`).toBeGreaterThanOrEqual(GAMES_TARGET)
})
