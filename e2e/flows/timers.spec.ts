import { expect, test, type APIRequestContext } from '@playwright/test'
import { generateMoves } from '../../src/engine/moves'
import type { Move } from '../../src/engine/types'
import { call, cmd, getRoom, matchmake, users, type Seat } from './helpers'

// Sunucu saati: hızlı mod (24 sn/puan banka + 8 sn gecikme), AFK (60 sn), terk (45 sn görünmezlik).
// Gerçek zamanlı bekler (toplam ~3-4 dk). P3/P4 hesapları.
const P3 = users[2], P4 = users[3]
type Clock = { white: number; black: number; delay: number; active: string | null; running: boolean; loss?: { winner: string; reason: string } | null }

async function clockOf(request: APIRequestContext, code: string, seat: Seat): Promise<{ clock: Clock; room: Awaited<ReturnType<typeof getRoom>> }> {
  const r = await call(request, 'GET', `/rooms/${code}?token=${encodeURIComponent(seat.token)}`, seat.user!.token)
  expect(r.status).toBe(200)
  return { clock: r.body.clock as Clock, room: r.body.room }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function openAndFirstMove(request: APIRequestContext, mode: string) {
  const s = await matchmake(request, P3, P4, { stake: 0, targets: [1], time_control: mode })
  let r = await getRoom(request, s.code, s.white)
  await getRoom(request, s.code, s.black) // iki taraf da "görüldü"
  expect((await call(request, 'POST', `/rooms/${s.code}/roll`, P3.token, cmd(s.white, r.server_version))).status).toBe(200)
  r = await getRoom(request, s.code, s.white)
  const starter = r.server_state!.turn === 'white' ? s.white : s.black
  const mv = await call(request, 'POST', `/rooms/${s.code}/move`, starter.user!.token, cmd(starter, r.server_version, { steps: (generateMoves(r.server_state!) as Move[])[0].steps }))
  expect(mv.status).toBe(200)
  const waiter = starter === s.white ? s.black : s.white
  return { s, starter, waiter }
}

test('hızlı mod: gecikme içinde oynayanın bankası azalmaz; sıra sahibi olmayanın saati akmaz', async ({ request }) => {
  const { s, starter, waiter } = await openAndFirstMove(request, 'speed')
  const a = await clockOf(request, s.code, s.white)
  expect(a.clock.running).toBe(true)
  expect(a.clock.active).toBe(waiter.color)
  // Başlayan gecikme (8 sn) içinde oynadı -> bankası tam (24).
  expect(a.clock[starter.color as 'white' | 'black']).toBeGreaterThanOrEqual(23.5)
  await sleep(4000)
  const b = await clockOf(request, s.code, s.black)
  expect(b.clock[starter.color as 'white' | 'black'], 'sırası olmayanın bankası sabit').toBe(a.clock[starter.color as 'white' | 'black'])
  expect(b.clock.delay, 'aktifin gecikmesi azalır').toBeLessThan(a.clock.delay)
  await call(request, 'POST', `/rooms/${s.code}/leave`, P3.token, { token: s.white.token })
})

test('hızlı mod: banka + gecikme dolunca hükmen kayıp (TIMEOUT), sonra saat durur ve komut reddedilir', async ({ request }) => {
  const { s, waiter } = await openAndFirstMove(request, 'speed')
  // İki taraf da poll etmeye devam eder (terk sayılmasın); bekleyen ZAR ATMAZ.
  let loss: Clock['loss'] = null
  const t0 = Date.now()
  while (!loss && Date.now() - t0 < 60_000) {
    await sleep(1500)
    await clockOf(request, s.code, s.white)
    loss = (await clockOf(request, s.code, s.black)).clock.loss ?? null
  }
  const elapsed = (Date.now() - t0) / 1000
  expect(loss, 'süre dolunca kayıp ilan edilmeli').toBeTruthy()
  expect(loss!.reason).toBe('TIMEOUT')
  expect(loss!.winner, 'süresi biten kaybeder').not.toBe(waiter.color)
  expect(elapsed, `~32 sn (8 gecikme + 24 banka), gerçekleşen ${elapsed}`).toBeGreaterThan(25)
  expect(elapsed).toBeLessThan(45)
  const r = await getRoom(request, s.code, s.white)
  expect(r.server_match?.done).toBe(true)
  expect(r.server_match?.winner).toBe(loss!.winner)
  const roll = await call(request, 'POST', `/rooms/${s.code}/roll`, waiter.user!.token, cmd(waiter, r.server_version))
  expect(roll.status).toBe(409)
  const c1 = await clockOf(request, s.code, s.white)
  await sleep(2500)
  const c2 = await clockOf(request, s.code, s.white)
  expect(c2.clock.white).toBe(c1.clock.white)
  expect(c2.clock.black).toBe(c1.clock.black)
})

test('terk: bir oyuncu 45 sn görünmezse rakip kazanır (ABANDON)', async ({ request }) => {
  const { s, waiter, starter } = await openAndFirstMove(request, 'casual')
  // Yalnız başlayan poll eder; bekleyen tamamen kaybolur.
  let loss: Clock['loss'] = null
  const t0 = Date.now()
  while (!loss && Date.now() - t0 < 90_000) {
    await sleep(2000)
    loss = (await clockOf(request, s.code, starter)).clock.loss ?? null
  }
  expect(loss, 'terk eden kaybetmeli').toBeTruthy()
  expect(loss!.reason).toMatch(/ABANDON|AFK/)
  expect(loss!.winner).toBe(starter.color)
  expect(waiter.color).not.toBe(starter.color)
})
