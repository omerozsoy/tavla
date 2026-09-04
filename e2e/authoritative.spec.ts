import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Faz 2 tam-stack smoke: TÜM stack (backend e2e + Node validator + Vite + tarayıcı) uçtan uca.
// 2 istemci auth olur (Sanctum token -> /me) ve matchmaking ile EŞLEŞİR; oda AUTHORITATIVE
// atanır (allow-list 1,2). Böylece "sunucu ayakta + auth + eşleşme + otorite atama" bütün olarak
// doğrulanır. (Oyun-içi senkron: opening/hamle/tur/küp/saat/maç-sonu -> deterministik sim testi.)
const API = 'http://127.0.0.1:8000/api'
const users = JSON.parse(readFileSync('backend/storage/app/e2e-users.json', 'utf8')) as {
  id: number
  token: string
  nick: string
}[]

async function loadAuthed(context: import('@playwright/test').BrowserContext, token: string) {
  // Token'ı localStorage'a enjekte et (app + fetch'ler Bearer olarak kullanır). Sayfa yüklenir;
  // auth ispatı matchmaking fetch'inde (Sanctum token -> user_id). /me zamanlamasına bağlanmayız.
  const page = await context.newPage()
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  // Token'ı yükledikten SONRA yaz (addInitScript+token goto'yu abort ediyordu). Matchmake fetch'i
  // bunu Bearer olarak kullanır; app'in kendi auth state'ine ihtiyaç yok.
  await page.evaluate((tok) => localStorage.setItem('tavla.token', tok), token)
  return page
}

async function matchmake(page: import('@playwright/test').Page, roomToken: string, name: string) {
  return page.evaluate(
    async ([api, tok, rt, nm]) => {
      const bearer = localStorage.getItem('tavla.token')
      const res = await fetch(`${api}/matchmaking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
        body: JSON.stringify({ token: rt, name: nm, rating: 1500, stake: 100, targets: [1], time_control: 'normal' }),
      })
      return { status: res.status, body: await res.json() }
    },
    [API, page.url(), roomToken, name] as const,
  )
}

// Tam stack: backend e2e + Node validator + AYRI-port Vite (5199) + tarayıcı. Eski flaky goto
// (Vite reuse yarışı) ayrı port + retry ile giderildi. Oyun-içi senkron: authSync sim (16 test).
test('tam stack: 2 istemci auth + eşleşme + oda authoritative', async ({ browser }) => {
  const c1 = await browser.newContext()
  const c2 = await browser.newContext()
  const p1 = await loadAuthed(c1, users[0].token)
  const p2 = await loadAuthed(c2, users[1].token)

  // p1 havuza girer (rakip yok -> matched:false, mm_waiting oda).
  const r1 = await matchmake(p1, 'e2e-room-p1', users[0].nick)
  expect(r1.status).toBe(200)
  expect(r1.body.matched).toBeFalsy()

  // p2 eşleşir (p1'i bulur -> matched:true).
  const r2 = await matchmake(p2, 'e2e-room-p2', users[1].nick)
  expect(r2.status).toBe(200)
  expect(r2.body.matched, 'p2 p1 ile eşleşmeli').toBe(true)

  // Oda AUTHORITATIVE olmalı (iki oyuncu da allow-list'te: 1,2).
  expect(r2.body.room.authoritative, 'staging allow-list -> authoritative=true').toBe(true)
  expect(r2.body.room.code).toBeTruthy()

  await c1.close()
  await c2.close()
})
