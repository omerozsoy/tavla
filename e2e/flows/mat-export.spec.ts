import { expect, test } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { call, friendRoom, playToEnd, seeded, users } from './helpers'

// .mat dışa aktarımı gerçek maçla tutarlı mı: maç uzunluğu, oyun sayısı, oyun başı kazanılan
// puanlar ve toplam skor sunucu maç sonucuyla aynı olmalı. (İstemci maç sonunda /rating/report
// çağırır -> match_results satırı -> GET /me/matches/{id}/mat.)
const OUT = 'test-kanitlari/flows'
mkdirSync(OUT, { recursive: true })
const P7 = users[6], P8 = users[7]

test('.mat: oyun sayısı, oyun puanları ve skor sunucu sonucuyla aynı (hedef 3)', async ({ request }) => {
  const s = await friendRoom(request, P7, P8, { target: 3, time_control: 'casual' })
  const res = await playToEnd(request, s.code, s, { rng: seeded(1301) })
  expect(res.anomalies).toEqual([])
  for (const seat of [s.white, s.black]) {
    const rep = await call(request, 'POST', '/rating/report', seat.user!.token, { won: res.matchWinner === seat.color, opponent_rating: 1500, room_code: s.code, match_length: 3, match_type: 'match' })
    expect(rep.status, JSON.stringify(rep.body)).toBeLessThan(300)
  }
  const list = await call(request, 'GET', '/me/matches', P7.token)
  const rows = (list.body?.matches ?? list.body?.data ?? list.body ?? []) as { id: number; room_code?: string; opponent_name?: string; match_length?: number }[]
  // Liste room_code döndürmüyor -> bu maçın satırı: en yeni (id en büyük), rakip P8, uzunluk 3.
  const row = rows.find((m) => m.room_code === s.code) ?? [...rows].sort((a, b) => b.id - a.id).find((m) => m.opponent_name === P8.nick && m.match_length === 3)
  expect(row, `maç listesinde oda ${s.code} yok: ${JSON.stringify(rows.slice(0, 2))}`).toBeTruthy()
  const mat = await call(request, 'GET', `/me/matches/${row!.id}/mat`, P7.token)
  expect(mat.status, JSON.stringify(mat.body)).toBe(200)
  const text = mat.body.mat as string
  writeFileSync(`${OUT}/mat-${s.code}.mat`, text)
  expect(text).toMatch(/^\s*3 point match/)
  const games = text.split(/\n\s*Game \d+\s*\n/).slice(1)
  expect(games.length, 'oyun sayısı').toBe(res.games.length)
  // Her oyunda tam bir "Wins N point" satırı; puan = sunucunun verdiği puan.
  const wins = games.map((g) => Number((g.match(/Wins (\d+) point/) ?? [])[1]))
  expect(wins, `.mat puanları ${JSON.stringify(wins)} / sunucu ${JSON.stringify(res.games.map((g) => g.points))}`).toEqual(res.games.map((g) => g.points))
  // Oyun başı skor başlıkları: bir sonraki oyunun başlangıç skoru = öncekiler toplamı.
  // Toplam = final skor (maç hedefinde kırpma yok).
  const total = wins.reduce((a, b) => a + b, 0)
  expect(total).toBe(res.finalScore.white + res.finalScore.black)
})
