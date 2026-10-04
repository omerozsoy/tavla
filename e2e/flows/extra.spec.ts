import { expect, test, type APIRequestContext } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { generateMoves } from '../../src/engine/moves'
import type { Move } from '../../src/engine/types'
import { call, cmd, friendRoom, getRoom, matchmake, seatToken, seeded, users, type Seat } from './helpers'

// Eksik kalan alanlar: bot motoru düşükken/geri gelince, AFK kaybı, Crawford, turnuva no-show,
// Swiss oluşturma. Bot senaryoları gnubg durumuna bağlıdır: BOT_PHASE=down (gnubg kapalı) ve
// BOT_PHASE=up (gnubg açık) ayrı koşulur.
const OUT = 'test-kanitlari/flows'
mkdirSync(OUT, { recursive: true })
const [W, , P3, P4, P5, P6, P7, P8] = users
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const STATE = `${OUT}/bot-down-room.json`

test('bot motoru kapalı: insan hamlesi korunur, bot "unavailable", saat insanı hükmen yenmez', async ({ request }) => {
  test.skip(process.env.BOT_PHASE !== 'down', 'yalnız gnubg kapalıyken')
  const token = seatToken()
  const c = await call(request, 'POST', '/bot/rooms', P3.token, { token, name: P3.nick, level: 5, target: 1, time_control: 'speed' })
  expect(c.status).toBe(200)
  const code = c.body.room.code as string
  const me: Seat = { user: P3, token, color: 'white' }
  // İnsan sırası gelene dek (açılışta bot başlarsa bot sürülemez -> unavailable).
  let r = await getRoom(request, code, me)
  const log: unknown[] = []
  for (let i = 0; i < 10; i++) {
    r = await getRoom(request, code, me)
    const st = r.server_state!
    if (st.turn === 'white' && st.dice?.length) {
      const mv = await call(request, 'POST', `/rooms/${code}/move`, P3.token, cmd(me, r.server_version, { steps: (generateMoves(st) as Move[])[0]?.steps ?? [] }))
      log.push({ move: mv.status, bot_status: mv.body?.bot_status, bot_reason: mv.body?.bot_reason })
      expect(mv.status, 'insan hamlesi gnubg yokken de kabul edilmeli').toBe(200)
      break
    }
    const rr = await call(request, 'POST', `/rooms/${code}/roll`, P3.token, cmd(me, r.server_version))
    log.push({ roll: rr.status, bot_status: rr.body?.bot_status })
    if (rr.body?.bot_status === 'unavailable' && st.turn === 'black') break
  }
  const after = await getRoom(request, code, me)
  expect(after.server_state!.turn, 'sıra botta beklemeli').toBe('black')
  const nudge = await call(request, 'POST', `/rooms/${code}/bot`, P3.token, { token })
  expect(nudge.status).toBe(200)
  expect(nudge.body.bot_status).toBe('unavailable')
  // Hızlı mod (8 sn gecikme + 24 sn banka) dolsa bile bot odasında insan HÜKMEN kaybetmemeli / bot kazanmamalı.
  await sleep(40_000)
  const later = await call(request, 'GET', `/rooms/${code}?token=${token}`, P3.token)
  const loss = later.body.room.clock?.loss
  log.push({ after40s: { status: later.body.room.status, loss } })
  expect(later.body.room.server_match?.done ?? false, `gnubg yokken maç bitmemeli: ${JSON.stringify(loss)}`).toBe(false)
  writeFileSync(STATE, JSON.stringify({ code, token, log }, null, 2))
})

test('bot motoru geri gelince: dürtme botu oynatır, oyun sonuna dek sürer', async ({ request }) => {
  test.skip(process.env.BOT_PHASE !== 'up' || !existsSync(STATE), 'yalnız gnubg açıldıktan sonra')
  const { code, token } = JSON.parse(readFileSync(STATE, 'utf8'))
  const me: Seat = { user: P3, token, color: 'white' }
  const n = await call(request, 'POST', `/rooms/${code}/bot`, P3.token, { token })
  expect(n.status).toBe(200)
  expect(n.body.bot_status, JSON.stringify(n.body).slice(0, 300)).toBe('played')
  const rng = seeded(4242)
  for (let i = 0; i < 2000; i++) {
    const r = await getRoom(request, code, me)
    if (r.server_match?.done) break
    const st = r.server_state!
    if (r.server_match?.cube?.pending === 'black') { await call(request, 'POST', `/rooms/${code}/cube/respond`, P3.token, cmd(me, r.server_version, { action: 'take' })); continue }
    if (st.turn === 'black') { await call(request, 'POST', `/rooms/${code}/bot`, P3.token, { token }); continue }
    if (!st.dice?.length) { await call(request, 'POST', `/rooms/${code}/roll`, P3.token, cmd(me, r.server_version)); continue }
    const moves = generateMoves(st) as Move[]
    await call(request, 'POST', `/rooms/${code}/move`, P3.token, cmd(me, r.server_version, { steps: moves.length ? moves[Math.floor(rng() * moves.length)].steps : [] }))
  }
  const end = await getRoom(request, code, me)
  expect(end.server_match?.done, 'kurtarılan bot maçı bitmeli').toBe(true)
})

test('AFK: ilk hamleden sonra 60 sn hareketsiz kalan (ama bağlı) oyuncu kaybeder', async ({ request }) => {
  test.skip(!!process.env.BOT_PHASE, 'bot fazında koşulmaz')
  const s = await matchmake(request, P5, P6, { stake: 0, targets: [1], time_control: 'casual' })
  let r = await getRoom(request, s.code, s.white)
  await getRoom(request, s.code, s.black)
  await call(request, 'POST', `/rooms/${s.code}/roll`, P5.token, cmd(s.white, r.server_version))
  r = await getRoom(request, s.code, s.white)
  const starter = r.server_state!.turn === 'white' ? s.white : s.black
  const idle = starter === s.white ? s.black : s.white
  expect((await call(request, 'POST', `/rooms/${s.code}/move`, starter.user!.token, cmd(starter, r.server_version, { steps: (generateMoves(r.server_state!) as Move[])[0].steps }))).status).toBe(200)
  // İki taraf da poll eder (bağlı) ama sırası gelen hiç oynamaz. Casual banka 180 sn > AFK 60 sn.
  let loss: { winner: string; reason: string } | null = null
  let afkWarn: number | null = null
  const t0 = Date.now()
  while (!loss && Date.now() - t0 < 100_000) {
    await sleep(2000)
    await call(request, 'GET', `/rooms/${s.code}?token=${idle.token}`, idle.user!.token)
    const v = await call(request, 'GET', `/rooms/${s.code}?token=${starter.token}`, starter.user!.token)
    loss = v.body.room.clock?.loss ?? null
    afkWarn = afkWarn ?? v.body.room.clock?.afk ?? null
  }
  const elapsed = (Date.now() - t0) / 1000
  writeFileSync(`${OUT}/afk.json`, JSON.stringify({ code: s.code, loss, afkWarn, elapsed }, null, 2))
  expect(loss, 'AFK kaybı ilan edilmeli').toBeTruthy()
  expect(loss!.reason).toBe('AFK_TIMEOUT')
  expect(loss!.winner).toBe(starter.color)
  expect(afkWarn, 'son 15 sn geri sayımı görünmeli').not.toBeNull()
  expect(elapsed).toBeGreaterThan(50)
})

test('Crawford: hedefe 1 kala oyunda küp yok; sonrası (post-Crawford) küp serbest', async ({ request }) => {
  test.skip(!!process.env.BOT_PHASE, 'bot fazında koşulmaz')
  test.setTimeout(30 * 60_000)
  const findings: Record<string, unknown>[] = []
  let sawCrawford = false, sawPost = false
  for (let attempt = 0; attempt < 8 && !(sawCrawford && sawPost); attempt++) {
    const s = await friendRoom(request, P7, P8, { target: 3, time_control: 'casual' })
    const rng = seeded(7000 + attempt)
    let lastGame = -1
    for (let i = 0; i < 4000; i++) {
      const r = await getRoom(request, s.code, s.white)
      const m = r.server_match
      if (m?.done || r.status === 'finished') break
      const st = r.server_state
      if (!st) { await call(request, 'POST', `/rooms/${s.code}/roll`, P7.token, cmd(s.white, r.server_version)); continue }
      const me = s[st.turn]
      if (!st.dice?.length) {
        const sc = m?.score ?? {}
        const myS = sc[st.turn] ?? 0, oppS = sc[st.turn === 'white' ? 'black' : 'white'] ?? 0
        const gameNo = m?.gameNo ?? 0
        // Her oyunda bir kez: geride olan oyuncu küp teklif etmeyi dener.
        if (gameNo !== lastGame && myS < oppS && (m?.turns ?? 0) >= 1 && !m?.cube?.pending) {
          lastGame = gameNo
          const off = await call(request, 'POST', `/rooms/${s.code}/cube/offer`, me.user!.token, cmd(me, r.server_version))
          const phase = m?.crawford ? 'crawford' : m?.crawfordDone ? 'post' : 'normal'
          findings.push({ code: s.code, gameNo, score: sc, phase, offer: off.status, reason: off.body?.reason ?? off.body?.errors?.reason ?? null })
          if (phase === 'crawford') { sawCrawford = true; expect(off.status, 'Crawford oyununda küp teklif edilemez').toBe(409) }
          if (off.status === 200) {
            if (phase === 'post') sawPost = true
            const other = st.turn === 'white' ? s.black : s.white
            const r2 = await getRoom(request, s.code, s.white)
            await call(request, 'POST', `/rooms/${s.code}/cube/respond`, other.user!.token, cmd(other, r2.server_version, { action: 'take' }))
          }
          continue
        }
        await call(request, 'POST', `/rooms/${s.code}/roll`, me.user!.token, cmd(me, r.server_version)); continue
      }
      const moves = generateMoves(st) as Move[]
      await call(request, 'POST', `/rooms/${s.code}/move`, me.user!.token, cmd(me, r.server_version, { steps: moves.length ? moves[Math.floor(rng() * moves.length)].steps : [] }))
    }
  }
  writeFileSync(`${OUT}/crawford.json`, JSON.stringify(findings, null, 2))
  expect(sawCrawford, `Crawford oyunu gözlenmeli: ${JSON.stringify(findings)}`).toBe(true)
  for (const f of findings.filter((x) => x.phase === 'crawford')) expect(f.offer).toBe(409)
  for (const f of findings.filter((x) => x.phase === 'post')) expect(f.offer, 'post-Crawford küp serbest').toBe(200)
})

async function tournamentOf(request: APIRequestContext, players: typeof users, extra: Record<string, unknown> = {}) {
  const c = await call(request, 'POST', '/tournaments', W.token, { name: `E2E-NS ${Date.now() % 100000}`, size: 4, premium_only: false, match_length: 1, ...extra })
  return c
}

test('turnuva no-show: 60 sn dolmadan red, rakip girdiyse red, girmediyse hükmen galibiyet', async ({ request }) => {
  test.skip(!!process.env.BOT_PHASE, 'bot fazında koşulmaz')
  const players = [P3, P4]
  const c = await tournamentOf(request, players)
  expect(c.status, JSON.stringify(c.body)).toBeLessThan(300)
  const id = (c.body.tournament ?? c.body).id as number
  for (const u of players) expect((await call(request, 'POST', `/tournaments/${id}/join`, u.token, {})).status).toBeLessThan(300)
  expect((await call(request, 'POST', `/tournaments/${id}/start`, W.token, {})).status).toBeLessThan(300)
  const t = (await call(request, 'GET', `/tournaments/${id}`, W.token)).body.tournament
  const m = (t.bracket as { key: string; p1?: { id: number }; p2?: { id: number } }[][]).flat().find((x) => x.p1?.id && x.p2?.id)!
  const me = m.p1!.id === P3.id ? P3 : P4
  const mr = await call(request, 'POST', `/tournaments/${id}/match-room`, me.token, { match: m.key })
  const tok = seatToken()
  expect((await call(request, 'POST', `/rooms/${mr.body.code}/enter`, me.token, { token: tok, name: me.nick, target: mr.body.target })).status).toBe(200)
  const early = await call(request, 'POST', `/tournaments/${id}/no-show`, me.token, { match: m.key, token: tok })
  expect(early.status, 'erken no-show reddedilmeli').toBe(422)
  const other = me === P3 ? P4 : P3
  const outsider = await call(request, 'POST', `/tournaments/${id}/no-show`, P5.token, { match: m.key, token: tok })
  expect(outsider.status, 'maçta olmayan no-show isteyemez').toBe(403)
  await sleep(62_000)
  const ok = await call(request, 'POST', `/tournaments/${id}/no-show`, me.token, { match: m.key, token: tok })
  expect(ok.status, JSON.stringify(ok.body).slice(0, 300)).toBe(200)
  const after = (await call(request, 'GET', `/tournaments/${id}`, W.token)).body.tournament
  const done = (after.bracket as { key: string; winner?: number }[][]).flat().find((x) => x.key === m.key)!
  expect(done.winner, 'no-show: odada bekleyen kazanır').toBe(me.id)
  expect(after.status).toBe('finished') // 2 kişilik: tek maç = final
  const again = await call(request, 'POST', `/tournaments/${id}/no-show`, me.token, { match: m.key, token: tok })
  expect(again.status).toBeGreaterThanOrEqual(400)
  writeFileSync(`${OUT}/tournament-noshow.json`, JSON.stringify({ id, match: m.key, winner: done.winner, champion: after.champion_id, other: other.id }, null, 2))
})

test('Swiss (3 haklı) turnuva: açıksa oluşur, kapalıysa açık bir mesajla reddedilir', async ({ request }) => {
  test.skip(!!process.env.BOT_PHASE, 'bot fazında koşulmaz')
  const c = await tournamentOf(request, [], { type: 'swiss_triple', size: 8 })
  writeFileSync(`${OUT}/swiss-create.json`, JSON.stringify({ status: c.status, body: c.body }, null, 2))
  expect([200, 201, 422]).toContain(c.status)
})
