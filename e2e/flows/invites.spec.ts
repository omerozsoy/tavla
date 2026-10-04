import { expect, test, type APIRequestContext } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { call, playToEnd, seatToken, seeded, users, type Seat } from './helpers'

// Davetle oyun: davet -> (davet eden odayı açar) -> davetli /ping'de görür -> kabul/ret/iptal.
const OUT = 'test-kanitlari/flows'
mkdirSync(OUT, { recursive: true })
const P7 = users[6]
const P8 = users[7]

async function invite(request: APIRequestContext, target = 1) {
  const inv = await call(request, 'POST', `/friends/${P8.id}/invite`, P7.token, { target, time_control: 'casual' })
  expect(inv.status, `davet ${JSON.stringify(inv.body)}`).toBe(200)
  const code = inv.body.code as string
  const t7 = seatToken()
  const en = await call(request, 'POST', `/rooms/${code}/enter`, P7.token, { token: t7, name: P7.nick, target })
  expect(en.status, `davet eden odaya girer ${JSON.stringify(en.body)}`).toBe(200)
  const ping = await call(request, 'POST', '/ping', P8.token, {})
  const mine = (ping.body?.invites ?? []).find((x: { code: string }) => x.code === code)
  return { code, t7, enterSlot: en.body.slot as string, seen: mine as { id: number; code: string; target: number } | undefined }
}

test('davet kabul -> oyun ×5 (hedef 1), sonuç kaydı', async ({ request }) => {
  const rows = []
  for (let i = 0; i < 5; i++) {
    const inv = await invite(request, 1)
    expect(inv.seen, 'davetli /ping ile daveti görmeli').toBeTruthy()
    const acc = await call(request, 'POST', `/invites/${inv.seen!.id}/respond`, P8.token, { accept: true })
    expect(acc.status, JSON.stringify(acc.body)).toBe(200)
    expect(acc.body.code).toBe(inv.code)
    const t8 = seatToken()
    const en = await call(request, 'POST', `/rooms/${inv.code}/enter`, P8.token, { token: t8, name: P8.nick, target: acc.body.target })
    expect(en.status, JSON.stringify(en.body)).toBe(200)
    const p7: Seat = { user: P7, token: inv.t7, color: inv.enterSlot === 'p1' ? 'white' : 'black' }
    const p8: Seat = { user: P8, token: t8, color: en.body.slot === 'p1' ? 'white' : 'black' }
    expect(p7.color).not.toBe(p8.color)
    const seats = { white: p7.color === 'white' ? p7 : p8, black: p7.color === 'black' ? p7 : p8 }
    const res = await playToEnd(request, inv.code, seats, { rng: seeded(900 + i) })
    expect(res.matchWinner).not.toBeNull()
    rows.push({ code: inv.code, ...res })
    // Kabul edilmiş davet tekrar kabul edilemez / ping'de görünmez.
    const again = await call(request, 'POST', '/ping', P8.token, {})
    expect((again.body?.invites ?? []).some((x: { code: string }) => x.code === inv.code)).toBe(false)
  }
  writeFileSync(`${OUT}/invites.json`, JSON.stringify(rows, null, 2))
  expect(rows.flatMap((r) => r.anomalies)).toEqual([])
})

test('davet reddi: oda açılmaz, davet kaybolur', async ({ request }) => {
  const inv = await invite(request)
  const dec = await call(request, 'POST', `/invites/${inv.seen!.id}/respond`, P8.token, { accept: false })
  expect(dec.status).toBe(200)
  expect(dec.body.code).toBeNull()
  const ping = await call(request, 'POST', '/ping', P8.token, {})
  expect((ping.body?.invites ?? []).some((x: { code: string }) => x.code === inv.code)).toBe(false)
  await call(request, 'POST', '/invites/cancel', P7.token, { code: inv.code })
  await call(request, 'POST', `/rooms/${inv.code}/leave`, P7.token, { token: inv.t7 })
})

test('davet iptali: davetli artık göremez; iptalden sonra kabul edilemez', async ({ request }) => {
  const inv = await invite(request)
  const can = await call(request, 'POST', '/invites/cancel', P7.token, { code: inv.code })
  expect(can.status).toBe(200)
  const ping = await call(request, 'POST', '/ping', P8.token, {})
  expect((ping.body?.invites ?? []).some((x: { code: string }) => x.code === inv.code), 'iptal edilen davet görünmemeli').toBe(false)
  const acc = await call(request, 'POST', `/invites/${inv.seen!.id}/respond`, P8.token, { accept: true })
  expect(acc.status, `iptal edilmiş davet kabulü: ${JSON.stringify(acc.body)}`).not.toBe(200)
  await call(request, 'POST', `/rooms/${inv.code}/leave`, P7.token, { token: inv.t7 })
})

test('davet eden odadan ayrılınca davet geçersiz (expired)', async ({ request }) => {
  const inv = await invite(request)
  await call(request, 'POST', `/rooms/${inv.code}/leave`, P7.token, { token: inv.t7 })
  const acc = await call(request, 'POST', `/invites/${inv.seen!.id}/respond`, P8.token, { accept: true })
  expect(acc.status, JSON.stringify(acc.body)).toBe(409)
})

test('başkasına ait daveti yanıtlayamaz; kendini davet edemez', async ({ request }) => {
  const inv = await invite(request)
  const other = await call(request, 'POST', `/invites/${inv.seen!.id}/respond`, users[2].token, { accept: true })
  expect(other.status).toBe(404)
  const self = await call(request, 'POST', `/friends/${P7.id}/invite`, P7.token, { target: 1 })
  expect(self.status).toBe(422)
  await call(request, 'POST', '/invites/cancel', P7.token, { code: inv.code })
  await call(request, 'POST', `/rooms/${inv.code}/leave`, P7.token, { token: inv.t7 })
})
