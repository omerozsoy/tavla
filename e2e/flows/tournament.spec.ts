import { expect, test, type APIRequestContext } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { call, playToEnd, seatToken, seeded, users, type Seat, type User } from './helpers'

// Turnuva: yönetici (W, yalnız e2e DB'de admin) 8 kişilik eleme turnuvası açar; 8 test hesabı
// katılır; her maç match-room -> iki oyuncu /enter -> tam oyun (API) -> report. Sahte rapor ve
// tekrar rapor denenir; turnuva bitene dek turlar ilerler.
const OUT = 'test-kanitlari/flows'
mkdirSync(OUT, { recursive: true })
const admin = users[0]
type BMatch = { key: string; p1?: { id: number } | null; p2?: { id: number } | null; winner?: number | null; room?: string | null; third_place?: boolean }

async function show(request: APIRequestContext, id: number) {
  const r = await call(request, 'GET', `/tournaments/${id}`, admin.token)
  expect(r.status).toBe(200)
  return r.body.tournament ?? r.body
}

test('8 kişilik eleme turnuvası: tüm maçlar oynanır, sonuçlar ve tur geçişleri doğru', async ({ request }) => {
  const c = await call(request, 'POST', '/tournaments', admin.token, { name: `E2E ${Date.now() % 100000}`, size: 8, premium_only: false, match_length: 1, prize_coins: 0 })
  expect(c.status, JSON.stringify(c.body)).toBeLessThan(300)
  const id = (c.body.tournament ?? c.body).id as number
  for (const u of users.slice(0, 8)) {
    const j = await call(request, 'POST', `/tournaments/${id}/join`, u.token, {})
    expect(j.status, `${u.nick} katılım ${JSON.stringify(j.body)}`).toBeLessThan(300)
  }
  // Çift katılım tekrar sayılmamalı.
  await call(request, 'POST', `/tournaments/${id}/join`, users[1].token, {})
  const st = await call(request, 'POST', `/tournaments/${id}/start`, admin.token, {})
  expect(st.status, JSON.stringify(st.body)).toBeLessThan(300)
  // Yönetici olmayan başlatamaz / silemez.
  expect((await call(request, 'POST', `/tournaments/${id}/start`, users[2].token, {})).status).toBe(403)

  const byId = new Map<number, User>(users.map((u) => [u.id, u]))
  const played: Record<string, unknown>[] = []
  const anomalies: string[] = []
  for (let loop = 0; loop < 30; loop++) {
    const t = await show(request, id)
    if (t.status === 'finished') { played.push({ champion: t.winner ?? t.champion ?? null }); break }
    const pending = (t.bracket as BMatch[][]).flat().filter((m) => m.p1?.id && m.p2?.id && !m.winner)
    if (!pending.length) { await new Promise((r) => setTimeout(r, 1000)); continue }
    for (const m of pending) {
      const u1 = byId.get(m.p1!.id)!, u2 = byId.get(m.p2!.id)!
      const mr = await call(request, 'POST', `/tournaments/${id}/match-room`, u1.token, { match: m.key })
      if (mr.status === 422 && /üçüncülük/.test(mr.body?.message ?? '')) { await new Promise((r) => setTimeout(r, 2000)); continue }
      expect(mr.status, `match-room ${m.key} ${JSON.stringify(mr.body)}`).toBe(200)
      const code = mr.body.code as string
      const mr2 = await call(request, 'POST', `/tournaments/${id}/match-room`, u2.token, { match: m.key })
      expect(mr2.body.code, 'iki oyuncu aynı odaya yönlenmeli').toBe(code)
      // Maçta olmayan oyuncu odayı isteyemez.
      const outsider = users.find((u) => u.id !== u1.id && u.id !== u2.id)!
      expect((await call(request, 'POST', `/tournaments/${id}/match-room`, outsider.token, { match: m.key })).status).toBe(403)
      const t1 = seatToken(), t2 = seatToken()
      const e1 = await call(request, 'POST', `/rooms/${code}/enter`, u1.token, { token: t1, name: u1.nick, target: mr.body.target })
      const e2 = await call(request, 'POST', `/rooms/${code}/enter`, u2.token, { token: t2, name: u2.nick, target: mr.body.target })
      expect(e1.status, JSON.stringify(e1.body)).toBe(200)
      expect(e2.status, JSON.stringify(e2.body)).toBe(200)
      const s1: Seat = { user: u1, token: t1, color: e1.body.slot === 'p1' ? 'white' : 'black' }
      const s2: Seat = { user: u2, token: t2, color: e2.body.slot === 'p1' ? 'white' : 'black' }
      expect(s1.color).not.toBe(s2.color)
      const seats = { white: s1.color === 'white' ? s1 : s2, black: s1.color === 'black' ? s1 : s2 }
      const res = await playToEnd(request, code, seats, { rng: seeded(code.charCodeAt(0) * 31 + code.charCodeAt(1)) })
      anomalies.push(...res.anomalies.map((a) => `${m.key}/${code}: ${a}`))
      const winnerUser = seats[res.matchWinner!].user!
      const loserUser = winnerUser.id === u1.id ? u2 : u1
      // Kaybeden kendini kazanan bildiremez.
      const fake = await call(request, 'POST', `/tournaments/${id}/report`, loserUser.token, { match: m.key, winner_id: loserUser.id })
      expect(fake.status, `sahte rapor ${JSON.stringify(fake.body)}`).toBeGreaterThanOrEqual(400)
      const rep = await call(request, 'POST', `/tournaments/${id}/report`, winnerUser.token, { match: m.key, winner_id: winnerUser.id })
      expect(rep.status, `rapor ${JSON.stringify(rep.body)}`).toBeLessThan(300)
      const rep2 = await call(request, 'POST', `/tournaments/${id}/report`, loserUser.token, { match: m.key, winner_id: winnerUser.id })
      expect(rep2.status, 'tekrar rapor 5xx olmamalı').toBeLessThan(500)
      const after = (await show(request, id)).bracket as BMatch[][]
      const mm = after.flat().find((x) => x.key === m.key)!
      if (mm.winner !== winnerUser.id) anomalies.push(`${m.key}: bracket kazananı ${mm.winner}, beklenen ${winnerUser.id}`)
      played.push({ match: m.key, code, winner: winnerUser.nick, games: res.games.length, score: res.finalScore })
    }
  }
  const t = await show(request, id)
  writeFileSync(`${OUT}/tournament.json`, JSON.stringify({ id, status: t.status, played, anomalies, bracket: t.bracket }, null, 2))
  expect(t.status, 'turnuva bitmeli').toBe('finished')
  expect(played.filter((p) => 'match' in p).length).toBeGreaterThanOrEqual(7)
  expect(anomalies).toEqual([])
})
