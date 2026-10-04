import { expect, test } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { call, friendRoom, matchmake, playToEnd, seeded, users, type PlayResult } from './helpers'

// Her online oyun türünde ≥5 tam oyun/maç döngüsü (API). Sonuçlar test-results/flows/*.json.
const OUT = 'test-results/flows'
mkdirSync(OUT, { recursive: true })
const [W, B] = users

function summarize(name: string, rows: (PlayResult & { code: string })[]) {
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(rows, null, 2))
  const anomalies = rows.flatMap((r) => r.anomalies.map((a) => `${r.code}: ${a}`))
  console.log(`[${name}] ${rows.length} maç, ${rows.reduce((n, r) => n + r.games.length, 0)} oyun, anomali: ${anomalies.length}`)
  return anomalies
}

test('rastgele eşleşme — Tek Oyun (hedef 1, bahissiz) ×5', async ({ request }) => {
  const rows = []
  for (let i = 0; i < 5; i++) {
    const s = await matchmake(request, W, B, { stake: 0, targets: [1], time_control: 'casual' })
    const res = await playToEnd(request, s.code, s, { rng: seeded(100 + i) })
    expect(res.matchWinner).not.toBeNull()
    expect(res.games.length).toBe(1)
    rows.push({ code: s.code, ...res })
  }
  expect(summarize('matchmaking-single', rows)).toEqual([])
})

test('rastgele eşleşme — Maç oyunu (hedef 3) ×5', async ({ request }) => {
  const rows = []
  for (let i = 0; i < 5; i++) {
    const s = await matchmake(request, W, B, { stake: 0, targets: [3], time_control: 'casual' })
    const res = await playToEnd(request, s.code, s, { rng: seeded(200 + i) })
    expect(res.matchWinner).not.toBeNull()
    expect(Math.max(res.finalScore.white, res.finalScore.black)).toBeGreaterThanOrEqual(3)
    rows.push({ code: s.code, ...res })
  }
  expect(summarize('matchmaking-match3', rows)).toEqual([])
})

test('arkadaş odası (kodla katılım, hedef 1 ve 5) ×5', async ({ request }) => {
  const rows = []
  for (let i = 0; i < 5; i++) {
    const target = i < 3 ? 1 : 5
    const s = await friendRoom(request, W, B, { target, time_control: 'casual' })
    const res = await playToEnd(request, s.code, s, { rng: seeded(300 + i) })
    expect(res.matchWinner).not.toBeNull()
    rows.push({ code: s.code, ...res })
  }
  expect(summarize('friend-room', rows)).toEqual([])
})

test('bahisli Tek Oyun (stake 100) ×5 — coin bir kez el değiştirir', async ({ request }) => {
  const rows = []
  const coins = async (u: typeof W) => (await call(request, 'GET', '/me', u.token)).body?.user?.coins ?? (await call(request, 'GET', '/me', u.token)).body?.coins
  for (let i = 0; i < 5; i++) {
    const before = { w: await coins(W), b: await coins(B) }
    const s = await matchmake(request, W, B, { stake: 100, stakes: [100], targets: [1], time_control: 'casual' })
    const res = await playToEnd(request, s.code, s, { rng: seeded(400 + i) })
    // İstemci maç sonunda settle çağırır; iki taraf + TEKRAR çağrı (idempotent olmalı).
    for (const seat of [s.white, s.black, s.white, s.black]) {
      const won = res.matchWinner === seat.color
      const st = await call(request, 'POST', `/rooms/${s.code}/settle`, seat.user!.token, { token: seat.token, won })
      expect(st.status, `settle ${JSON.stringify(st.body)}`).toBeLessThan(500)
    }
    const after = { w: await coins(W), b: await coins(B) }
    const dw = after.w - before.w, db = after.b - before.b
    const pts = res.games[0]?.points ?? 1
    rows.push({ code: s.code, ...res, coins: { before, after, dw, db, pts } } as never)
    // Kazanan, kaybedenin ödediğini alır (komisyon olabilir): toplam ≤ 0, kaybeden ≤ -stake×puan... en az bir el değişti.
    const loserDelta = res.matchWinner === 'white' ? db : dw
    const winnerDelta = res.matchWinner === 'white' ? dw : db
    expect(loserDelta, `kaybeden coin farkı (${JSON.stringify({ before, after })})`).toBeLessThan(0)
    expect(winnerDelta, 'kazanan coin farkı').toBeGreaterThan(0)
    expect(winnerDelta + loserDelta, 'coin yoktan var olmamalı').toBeLessThanOrEqual(0)
  }
  expect(summarize('stake-single', rows)).toEqual([])
})
