import { expect, test, type APIRequestContext } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { generateMoves } from '../../src/engine/moves'
import type { Move } from '../../src/engine/types'
import { call, cmd, getRoom, matchmake, users, type Seat } from './helpers'

// Hile / yetki / yarış senaryoları — gerçek backend. Ayrı hesaplar (P5,P6 oyuncu; P7 üçüncü kişi)
// kullanılır ki diğer akışlarla çakışmasın.
const [, , , , P5, P6, P7] = users
const opened: { code: string; white: Seat; black: Seat }[] = []
test.afterEach(async ({ request }) => {
  // Test başarısız olsa da odayı kapat (sonraki eşleşme "aktif maç" yüzünden engellenmesin).
  for (const s of opened.splice(0)) await finish(request, s.code, s).catch(() => {})
})

async function openRoom(request: APIRequestContext, target = 3) {
  const s = await matchmake(request, P5, P6, { stake: 0, targets: [target], time_control: 'casual' })
  // açılış
  const r0 = await getRoom(request, s.code, s.white)
  opened.push(s)
  const op = await call(request, 'POST', `/rooms/${s.code}/roll`, P5.token, cmd(s.white, r0.server_version))
  expect(op.status).toBe(200)
  return s
}
async function finish(request: APIRequestContext, code: string, s: { white: Seat; black: Seat }) {
  // Odayı kapat ki sonraki eşleşme engellenmesin.
  const r = await getRoom(request, code, s.white)
  if (!r.server_match?.done) await call(request, 'POST', `/rooms/${code}/leave`, s.white.user!.token, { token: s.white.token })
}

test('açılış zarı iki tarafa da aynen döner (reused), sürüm değişmez', async ({ request }) => {
  const s = await openRoom(request)
  const r = await getRoom(request, s.code, s.white)
  const other = await call(request, 'POST', `/rooms/${s.code}/roll`, P6.token, cmd(s.black, r.server_version))
  expect(other.status).toBe(200)
  expect(other.body.reused).toBe(true)
  expect(other.body.dice).toEqual(r.server_state!.dice)
  expect((await getRoom(request, s.code, s.white)).server_version).toBe(r.server_version)
})

test('sırası olmayan oyuncu zar atamaz / hamle yapamaz', async ({ request }) => {
  const s = await openRoom(request)
  let r = await getRoom(request, s.code, s.white)
  const starter = r.server_state!.turn === 'white' ? s.white : s.black
  const op = await call(request, 'POST', `/rooms/${s.code}/move`, starter.user!.token, cmd(starter, r.server_version, { steps: (generateMoves(r.server_state!) as Move[])[0].steps }))
  expect(op.status).toBe(200)
  // Şimdi sıra rakipte ve zarı yok: başlayan (artık sırası olmayan) zar atmayı dener.
  r = await getRoom(request, s.code, s.white)
  const turn = r.server_state!.turn
  const notMe = turn === 'white' ? s.black : s.white
  const roll = await call(request, 'POST', `/rooms/${s.code}/roll`, notMe.user!.token, cmd(notMe, r.server_version))
  // Tasarım: sırası olmayana 409 ya da 200 + not_turn (yalnız senkron yükü, zar ÜRETİLMEZ).
  if (roll.status === 200) expect(roll.body.not_turn, `rakip turunda roll: ${JSON.stringify(roll.body)}`).toBe(true)
  else expect([403, 409]).toContain(roll.status)
  let after = await getRoom(request, s.code, s.white)
  expect(after.server_version, 'sırası olmayanın roll\'u sürümü artırmamalı').toBe(r.server_version)
  expect(after.server_state!.dice).toEqual([])
  // Sıra sahibi zar atar; rakip, sıra sahibinin YASAL hamlesini göndermeye çalışır.
  const owner = turn === 'white' ? s.white : s.black
  expect((await call(request, 'POST', `/rooms/${s.code}/roll`, owner.user!.token, cmd(owner, r.server_version))).status).toBe(200)
  r = await getRoom(request, s.code, s.white)
  const moves = generateMoves(r.server_state!) as Move[]
  const mv = await call(request, 'POST', `/rooms/${s.code}/move`, notMe.user!.token, cmd(notMe, r.server_version, { steps: moves[0]?.steps ?? [] }))
  expect([403, 409, 422], `rakip turunda hamle: ${mv.status} ${JSON.stringify(mv.body).slice(0, 200)}`).toContain(mv.status)
  after = await getRoom(request, s.code, s.white)
  expect(after.server_version, 'reddedilen komut sürümü artırmamalı').toBe(r.server_version)
  expect(after.server_state).toEqual(r.server_state)
})

test('çalıntı oda tokenı / başka hesap / misafir komut çalıştıramaz', async ({ request }) => {
  const s = await openRoom(request)
  const r = await getRoom(request, s.code, s.white)
  const me = r.server_state!.turn === 'white' ? s.white : s.black
  const steps = (generateMoves(r.server_state!) as Move[])[0]?.steps ?? []
  for (const [label, bearer] of [['başka hesap (P7)', P7.token], ['misafir', undefined]] as const) {
    const mv = await call(request, 'POST', `/rooms/${s.code}/move`, bearer, cmd(me, r.server_version, { steps }))
    expect(mv.status, `${label}: ${JSON.stringify(mv.body)}`).toBe(403)
  }
  // Üçüncü kişi oda tokenı olmadan odayı okuyunca oyuncu tokenları/zar tohumu SIZMAMALI.
  const peek = await call(request, 'GET', `/rooms/${s.code}`, P7.token)
  const txt = JSON.stringify(peek.body)
  expect(txt).not.toContain(s.white.token)
  expect(txt).not.toContain(s.black.token)
  expect(peek.body?.room?.dice_seed ?? null, 'maç sürerken zar tohumu gizli olmalı').toBeNull()
})

test('geçersiz hamle reddedilir, tahta değişmez', async ({ request }) => {
  const s = await openRoom(request)
  const r = await getRoom(request, s.code, s.white)
  const me = r.server_state!.turn === 'white' ? s.white : s.black
  const bad = [{ from: 0, to: 23, die: r.server_state!.dice[0] }]
  const mv = await call(request, 'POST', `/rooms/${s.code}/move`, me.user!.token, cmd(me, r.server_version, { steps: bad }))
  expect(mv.status, JSON.stringify(mv.body)).toBe(422)
  const after = await getRoom(request, s.code, s.white)
  expect(after.server_state).toEqual(r.server_state)
})

test('aynı komutun tekrarı (aynı command_id) bir kez uygulanır; farklı içerikle tekrar 409', async ({ request }) => {
  const s = await openRoom(request)
  const r = await getRoom(request, s.code, s.white)
  const me = r.server_state!.turn === 'white' ? s.white : s.black
  const moves = generateMoves(r.server_state!) as Move[]
  const id = randomUUID()
  const body = { token: me.token, expected_version: r.server_version, command_id: id, steps: moves[0].steps }
  const a = await call(request, 'POST', `/rooms/${s.code}/move`, me.user!.token, body)
  const b = await call(request, 'POST', `/rooms/${s.code}/move`, me.user!.token, body)
  expect(a.status).toBe(200)
  expect(b.status, `tekrar: ${JSON.stringify(b.body)}`).toBe(200)
  const after = await getRoom(request, s.code, s.white)
  expect(after.server_version, 'tekrar sürümü bir kez daha artırmamalı').toBe(a.body.version)
  if (moves.length > 1) {
    const c = await call(request, 'POST', `/rooms/${s.code}/move`, me.user!.token, { ...body, steps: moves[1].steps })
    expect(c.status, `aynı id farklı içerik: ${JSON.stringify(c.body)}`).toBe(409)
  }
})

test('eşzamanlı iki farklı hamle: yalnız biri kabul edilir (yarış)', async ({ request }) => {
  const s = await openRoom(request)
  const r = await getRoom(request, s.code, s.white)
  const me = r.server_state!.turn === 'white' ? s.white : s.black
  const moves = generateMoves(r.server_state!) as Move[]
  test.skip(moves.length < 2, 'tek yasal hamle — yarış kurulamadı')
  const send = (m: Move) => call(request, 'POST', `/rooms/${s.code}/move`, me.user!.token, cmd(me, r.server_version, { steps: m.steps }))
  const res = await Promise.all([send(moves[0]), send(moves[1]), send(moves[0]), send(moves[1])])
  const ok = res.filter((x) => x.status === 200)
  expect(ok.length, `kabul edilen: ${JSON.stringify(res.map((x) => x.status))}`).toBe(1)
  const after = await getRoom(request, s.code, s.white)
  expect(after.server_version).toBe(r.server_version + 1)
})

test('eski (stale) expected_version reddedilir', async ({ request }) => {
  const s = await openRoom(request)
  const r = await getRoom(request, s.code, s.white)
  const me = r.server_state!.turn === 'white' ? s.white : s.black
  const steps = (generateMoves(r.server_state!) as Move[])[0].steps
  const mv = await call(request, 'POST', `/rooms/${s.code}/move`, me.user!.token, cmd(me, Math.max(0, r.server_version - 1), { steps }))
  expect(mv.status).toBe(409)
})

test('bitmemiş maç için sahte puan raporu reddedilir; maç sonrası komutlar reddedilir', async ({ request }) => {
  const s = await openRoom(request, 1)
  const fake = await call(request, 'POST', '/rating/report', P5.token, { won: true, opponent_rating: 4000, room_code: s.code })
  expect(fake.status, JSON.stringify(fake.body)).toBe(409)
  // Teslim ol -> maç biter; sonra roll/move/resign reddedilmeli.
  const r = await getRoom(request, s.code, s.white)
  const rs = await call(request, 'POST', `/rooms/${s.code}/resign`, P5.token, cmd(s.white, r.server_version))
  expect(rs.status, JSON.stringify(rs.body)).toBe(200)
  const done = await getRoom(request, s.code, s.white)
  expect(done.server_match?.done).toBe(true)
  expect(done.server_match?.winner).toBe('black')
  for (const ep of ['roll', 'resign']) {
    const x = await call(request, 'POST', `/rooms/${s.code}/${ep}`, P6.token, cmd(s.black, done.server_version))
    expect(x.status, `${ep} maç sonrası`).toBe(409)
  }
  // Maç bitti: dice_seed artık açıklanabilir (adillik doğrulaması).
  // Puan raporu: kazanan bir kez sayılır, ikinci rapor aynı sonucu tekrar SAYMAMALI.
  const me1 = (await call(request, 'GET', '/me', P6.token)).body
  const rep1 = await call(request, 'POST', '/rating/report', P6.token, { won: true, opponent_rating: 1500, room_code: s.code })
  const rep2 = await call(request, 'POST', '/rating/report', P6.token, { won: true, opponent_rating: 1500, room_code: s.code })
  const me2 = (await call(request, 'GET', '/me', P6.token)).body
  const rating = (b: { user?: { rating?: number }; rating?: number }) => b?.user?.rating ?? b?.rating
  expect(rep1.status, JSON.stringify(rep1.body)).toBeLessThan(500)
  expect(rep2.status).toBeLessThan(500)
  const r1 = await call(request, 'POST', '/rating/report', P6.token, { won: true, opponent_rating: 1500, room_code: s.code })
  const me3 = (await call(request, 'GET', '/me', P6.token)).body
  expect(rating(me3), 'tekrarlanan rapor puanı tekrar artırmamalı').toBe(rating(me2))
  expect(r1.status).toBeLessThan(500)
  console.log('rating', rating(me1), '->', rating(me2))
})

test('küp: teklif -> kabul (küp 2) ve teklif -> ret (teklif eden küp değerini alır)', async ({ request }) => {
  const s = await openRoom(request, 5)
  // Açılış hamlesini oyna ki sonraki oyuncu zar atmadan önce küp teklif edebilsin.
  let r = await getRoom(request, s.code, s.white)
  let me = r.server_state!.turn === 'white' ? s.white : s.black
  let mv = await call(request, 'POST', `/rooms/${s.code}/move`, me.user!.token, cmd(me, r.server_version, { steps: (generateMoves(r.server_state!) as Move[])[0].steps }))
  expect(mv.status).toBe(200)
  r = await getRoom(request, s.code, s.white)
  const offerer = r.server_state!.turn === 'white' ? s.white : s.black
  const taker = offerer === s.white ? s.black : s.white
  const off = await call(request, 'POST', `/rooms/${s.code}/cube/offer`, offerer.user!.token, cmd(offerer, r.server_version))
  expect(off.status, JSON.stringify(off.body)).toBe(200)
  // Teklif bekliyorken teklif eden zar atamaz.
  r = await getRoom(request, s.code, s.white)
  const rollBlocked = await call(request, 'POST', `/rooms/${s.code}/roll`, offerer.user!.token, cmd(offerer, r.server_version))
  expect(rollBlocked.status).toBe(409)
  const take = await call(request, 'POST', `/rooms/${s.code}/cube/respond`, taker.user!.token, cmd(taker, r.server_version, { action: 'take' }))
  expect(take.status, JSON.stringify(take.body)).toBe(200)
  r = await getRoom(request, s.code, s.white)
  expect(r.server_match?.cube?.value).toBe(2)
  expect(r.server_match?.cube?.owner).toBe(taker.color)
  // Küp sahibi olmayan (offerer) tekrar teklif edemez.
  me = offerer
  // Offerer'ın turunu oyna (zar + hamle), sonra taker yeniden teklif eder (4) ve offerer REDDEDER.
  const rr = await call(request, 'POST', `/rooms/${s.code}/roll`, me.user!.token, cmd(me, r.server_version))
  expect(rr.status).toBe(200)
  r = await getRoom(request, s.code, s.white)
  if (r.server_state!.turn === me.color && r.server_state!.dice.length) {
    const reoffer = await call(request, 'POST', `/rooms/${s.code}/cube/offer`, me.user!.token, cmd(me, r.server_version))
    expect(reoffer.status, 'küp sahibi olmayan teklif edememeli').toBe(409)
    mv = await call(request, 'POST', `/rooms/${s.code}/move`, me.user!.token, cmd(me, r.server_version, { steps: (generateMoves(r.server_state!) as Move[])[0]?.steps ?? [] }))
    expect(mv.status).toBe(200)
  }
  r = await getRoom(request, s.code, s.white)
  if (r.server_state!.turn === taker.color && !r.server_state!.dice.length) {
    const pre = r.server_match?.score ?? {}
    const off2 = await call(request, 'POST', `/rooms/${s.code}/cube/offer`, taker.user!.token, cmd(taker, r.server_version))
    expect(off2.status, JSON.stringify(off2.body)).toBe(200)
    r = await getRoom(request, s.code, s.white)
    const drop = await call(request, 'POST', `/rooms/${s.code}/cube/respond`, offerer.user!.token, cmd(offerer, r.server_version, { action: 'drop' }))
    expect(drop.status).toBe(200)
    r = await getRoom(request, s.code, s.white)
    const gained = (r.server_match?.score?.[taker.color] ?? 0) - (pre[taker.color] ?? 0)
    expect(gained, 'ret: teklif eden mevcut küp değeri (2) kadar puan alır').toBe(2)
    expect(r.server_match?.cube?.value, 'yeni oyunda küp 1').toBe(1)
  }
})
