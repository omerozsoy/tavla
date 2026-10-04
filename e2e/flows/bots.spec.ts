import { expect, test } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { generateMoves } from '../../src/engine/moves'
import { applyMove } from '../../src/engine/game'
import { gameOutcome } from '../../src/engine/board'
import type { Move } from '../../src/engine/types'
import { call, cmd, getRoom, seatToken, seeded, users, type Seat } from './helpers'

// YZ (sunucu-otoriter bot) — seviye 1..10 her biri tam oyun + seviye 11/12 premium kapısı.
// Gerçek gnubg servisi gerekir (GNUBG_URL). İnsan=beyaz (API), bot=siyah (sunucu sürer).
const OUT = 'test-kanitlari/flows'
mkdirSync(OUT, { recursive: true })
const P3 = users[2]

type BotRow = { level: number; code: string; winner: string | null; score: unknown; humanPlies: number; botTurns: number; botMsMax: number; botMsAvg: number; statuses: Record<string, number>; anomalies: string[] }

async function playBot(request: Parameters<typeof getRoom>[0], level: number, target: number, seed: number): Promise<BotRow> {
  const token = seatToken()
  const c = await call(request, 'POST', '/bot/rooms', P3.token, { token, name: P3.nick, level, target, time_control: 'casual' })
  expect(c.status, `bot oda ${JSON.stringify(c.body)}`).toBe(200)
  const code = c.body.room.code as string
  const me: Seat = { user: P3, token, color: 'white' }
  const rng = seeded(seed)
  const row: BotRow = { level, code, winner: null, score: null, humanPlies: 0, botTurns: 0, botMsMax: 0, botMsAvg: 0, statuses: {}, anomalies: [] }
  let botMsSum = 0
  for (let guard = 0; guard < 3000; guard++) {
    const r = await getRoom(request, code, me)
    const m = r.server_match!
    if (m.done || r.status === 'finished') { row.winner = m.winner ?? null; row.score = m.score; break }
    const st = r.server_state!
    let tot = { w: st.bar.white + st.off.white, b: st.bar.black + st.off.black }
    for (const v of st.points) { if (v > 0) tot.w += v; else tot.b -= v }
    if (tot.w !== 15 || tot.b !== 15) row.anomalies.push(`v${r.server_version}: taş ${tot.w}/${tot.b}`)
    if (m.cube?.pending === 'black') {
      const res = await call(request, 'POST', `/rooms/${code}/cube/respond`, P3.token, cmd(me, r.server_version, { action: rng() < 0.7 ? 'take' : 'drop' }))
      expect(res.status, `küp yanıtı ${JSON.stringify(res.body)}`).toBe(200)
      continue
    }
    if (st.turn === 'black') {
      // Senkron sürüş durakladıysa (gnubg) kurtarma ucu.
      const t0 = Date.now()
      const n = await call(request, 'POST', `/rooms/${code}/bot`, P3.token, { token })
      const ms = Date.now() - t0
      const s = n.body?.bot_status ?? `http${n.status}`
      row.statuses[s] = (row.statuses[s] ?? 0) + 1
      if (s === 'unavailable') { await new Promise((res) => setTimeout(res, 500)); if ((row.statuses.unavailable ?? 0) > 20) throw new Error(`bot kullanılamıyor: ${n.body?.bot_reason}`) }
      row.botMsMax = Math.max(row.botMsMax, ms)
      continue
    }
    if (!st.dice?.length) {
      const t0 = Date.now()
      const rr = await call(request, 'POST', `/rooms/${code}/roll`, P3.token, cmd(me, r.server_version))
      expect([200, 409], `roll ${JSON.stringify(rr.body)}`).toContain(rr.status)
      if (rr.body?.bot?.length) { row.botTurns += rr.body.bot.length; botMsSum += Date.now() - t0; row.botMsMax = Math.max(row.botMsMax, Date.now() - t0) }
      if (rr.body?.bot_status) row.statuses[rr.body.bot_status] = (row.statuses[rr.body.bot_status] ?? 0) + 1
      continue
    }
    const moves = generateMoves(st) as Move[]
    const move = moves.length ? moves[Math.floor(rng() * moves.length)] : ({ steps: [] } as unknown as Move)
    let expectPts: number | null = null
    if (move.steps.length) { const o = gameOutcome(applyMove(st, move)); if (o) expectPts = o.multiplier * (m.cube?.value ?? 1) }
    const preW = m.score?.white ?? 0
    const t0 = Date.now()
    const mv = await call(request, 'POST', `/rooms/${code}/move`, P3.token, cmd(me, r.server_version, { steps: move.steps }))
    if (mv.status === 409) continue
    expect(mv.status, `move ${JSON.stringify(mv.body).slice(0, 300)}`).toBe(200)
    row.humanPlies++
    if (mv.body?.bot?.length) { row.botTurns += mv.body.bot.length; botMsSum += Date.now() - t0; row.botMsMax = Math.max(row.botMsMax, Date.now() - t0) }
    if (mv.body?.bot_status) row.statuses[mv.body.bot_status] = (row.statuses[mv.body.bot_status] ?? 0) + 1
    if (expectPts !== null) {
      const after = await getRoom(request, code, me)
      const got = (after.server_match?.score?.white ?? 0) - preW
      if (got !== expectPts) row.anomalies.push(`kazanma puanı ${got}, beklenen ${expectPts}`)
    }
  }
  row.botMsAvg = row.botTurns ? Math.round(botMsSum / row.botTurns) : 0
  if (row.winner === null) throw new Error(`bot maçı bitmedi ${code}`)
  return row
}

test('YZ seviye 1–10: her seviyede tam oyun (Tek Oyun)', async ({ request }) => {
  const rows: BotRow[] = []
  for (let level = 1; level <= 10; level++) {
    rows.push(await playBot(request, level, 1, 500 + level))
    console.log(`seviye ${level}: kazanan ${rows.at(-1)!.winner}, bot tur ${rows.at(-1)!.botTurns}, maks ${rows.at(-1)!.botMsMax}ms, durum ${JSON.stringify(rows.at(-1)!.statuses)}`)
  }
  writeFileSync(`${OUT}/bots.json`, JSON.stringify(rows, null, 2))
  expect(rows.flatMap((r) => r.anomalies.map((a) => `L${r.level} ${r.code}: ${a}`))).toEqual([])
})

test('YZ maç (hedef 3) seviye 5 ve 9', async ({ request }) => {
  const rows: BotRow[] = []
  for (const level of [5, 9]) rows.push(await playBot(request, level, 3, 700 + level))
  writeFileSync(`${OUT}/bots-match.json`, JSON.stringify(rows, null, 2))
  for (const r of rows) expect(Math.max((r.score as { white: number }).white ?? 0, (r.score as { black: number }).black ?? 0)).toBeGreaterThanOrEqual(3)
  expect(rows.flatMap((r) => r.anomalies)).toEqual([])
})

test('YZ seviye 11/12 Premium kapısı; geçersiz seviye reddi', async ({ request }) => {
  for (const level of [11, 12]) {
    const r = await call(request, 'POST', '/bot/rooms', P3.token, { token: seatToken(), name: P3.nick, level, target: 1 })
    expect(r.status, JSON.stringify(r.body)).toBe(403)
    expect(r.body.code).toBe('premium_required')
  }
  for (const level of [0, 13]) {
    const r = await call(request, 'POST', '/bot/rooms', P3.token, { token: seatToken(), name: P3.nick, level, target: 1 })
    expect(r.status).toBe(422)
  }
})
