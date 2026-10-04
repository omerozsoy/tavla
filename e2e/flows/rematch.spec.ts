import { expect, test } from '@playwright/test'
import { call, cmd, friendRoom, getRoom, playToEnd, seeded, users } from './helpers'

// Rövanş: maç biter -> iki taraf kabul -> yeni oda (aynı koltuklar); eski odanın komutları yeni
// oyunu etkilemez; tek taraflı kabulde oda açılmaz; bitmemiş maçta rövanş istenemez.
const P7 = users[6], P8 = users[7]

test('rövanş: kabul/ret, yeni oda tam oyun, eski oda komutları reddedilir', async ({ request }) => {
  const s = await friendRoom(request, P7, P8, { target: 1, time_control: 'casual' })
  // Bitmemiş maçta rövanş yok.
  const early = await call(request, 'POST', `/rooms/${s.code}/rematch`, P7.token, { token: s.white.token, accept: true })
  expect(early.status).toBe(409)
  const r1 = await playToEnd(request, s.code, s, { rng: seeded(1201) })
  expect(r1.anomalies).toEqual([])
  // Tek taraf kabul: oda açılmaz.
  const a = await call(request, 'POST', `/rooms/${s.code}/rematch`, P7.token, { token: s.white.token, accept: true })
  expect(a.status, JSON.stringify(a.body)).toBe(200)
  expect(a.body.code ?? a.body.rematch?.code ?? null).toBeNull()
  // Diğer taraf da kabul -> yeni kod.
  const b = await call(request, 'POST', `/rooms/${s.code}/rematch`, P8.token, { token: s.black.token, accept: true })
  expect(b.status, JSON.stringify(b.body)).toBe(200)
  const newCode = (b.body.code ?? b.body.rematch?.code) as string
  expect(newCode).toBeTruthy()
  expect(newCode).not.toBe(s.code)
  // Tekrar kabul aynı kodu döndürmeli (çift oda açılmaz).
  const again = await call(request, 'POST', `/rooms/${s.code}/rematch`, P7.token, { token: s.white.token, accept: true })
  expect(again.body.code ?? again.body.rematch?.code).toBe(newCode)
  // Eski odaya komut: reddedilir, yeni oda etkilenmez.
  const old = await getRoom(request, s.code, s.white)
  const stale = await call(request, 'POST', `/rooms/${s.code}/roll`, P7.token, cmd(s.white, old.server_version))
  expect(stale.status).toBe(409)
  const fresh = await getRoom(request, newCode, s.white)
  expect(fresh.server_version).toBe(0)
  expect(fresh.server_match?.score).toEqual({ white: 0, black: 0 })
  const r2 = await playToEnd(request, newCode, s, { rng: seeded(1202) })
  expect(r2.matchWinner).not.toBeNull()
  expect(r2.anomalies).toEqual([])
  // Rövanş reddi: üçüncü oda açılmaz.
  await call(request, 'POST', `/rooms/${newCode}/rematch`, P7.token, { token: s.white.token, accept: true })
  const no = await call(request, 'POST', `/rooms/${newCode}/rematch`, P8.token, { token: s.black.token, accept: false })
  expect(no.status).toBe(200)
  expect(no.body.code ?? no.body.rematch?.code ?? null).toBeNull()
})
