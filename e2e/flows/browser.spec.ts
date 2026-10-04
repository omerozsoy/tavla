import { expect, test, devices, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { generateMoves } from '../../src/engine/moves'
import type { Move } from '../../src/engine/types'
import { call, cmd, getRoom, users, type Seat, type User } from './helpers'

// TARAYICI AKIŞLARI (Vite dev :5199 + e2e backend): iki gerçek tarayıcı oturumu UI'dan eşleşir.
// Oyun, hamleleri API'den gönderir; her adımda İKİ arayüzün çizdiği tahta sunucu tahtasıyla
// karşılaştırılır. Ek olarak: sayfa yenileme, aynı hesap 2. sekme, bağlantı kopması, arka plan
// (visibilitychange), mobilde UI ile zar+hamle+onay, maç sonu ekranı ve yatay taşma.
const OUT = 'test-kanitlari/flows'
mkdirSync(OUT, { recursive: true })
const P5 = users[4], P6 = users[5]

type Ctx = { user: User; ctx: BrowserContext; page: Page; errors: string[] }
async function open(browser: Browser, user: User, device?: (typeof devices)[string]): Promise<Ctx> {
  const ctx = await browser.newContext(device ? { ...device } : { viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript((tok) => localStorage.setItem('tavla.token', tok), user.token)
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/google|doubleclick|analytics|ERR_CERT|ERR_TUNNEL|ERR_NAME|fonts\.g/i.test(m.text())) errors.push(`console: ${m.text()}`) })
  return { user, ctx, page, errors }
}
async function readBoard(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const pts = Array<number>(24).fill(0)
    document.querySelectorAll<HTMLElement>('.board .point[data-point]').forEach((pt) => {
      const idx = Number(pt.dataset.point)
      const cs = pt.querySelectorAll('.checkers > .checker')
      if (!cs.length || !(idx >= 0 && idx < 24)) return
      const label = Number(pt.querySelector('.checkers .checker-count')?.textContent || 0)
      const n = label > cs.length ? label : cs.length
      pts[idx] = cs[0].classList.contains('black') ? -n : n
    })
    return pts
  })
}
async function synced(pages: Page[], points: number[], label: string) {
  for (const p of pages) await expect.poll(() => readBoard(p), { timeout: 20_000, message: `arayüz senkron değil (${label})` }).toEqual(points)
}
async function uiMatchmake(a: Ctx, b: Ctx): Promise<{ code: string; white: Seat; black: Seat }> {
  let code = ''
  for (const c of [a, b]) c.page.on('response', async (r) => { if (r.url().endsWith('/matchmaking')) { try { const j = await r.json(); if (j.room?.code) code = j.room.code } catch { /* yok */ } } })
  await Promise.all([a, b].map((c) => c.page.goto('/', { waitUntil: 'domcontentloaded' })))
  await Promise.all([a, b].map((c) => expect(c.page.locator('.app')).toBeVisible({ timeout: 30_000 })))
  for (const c of [a, b]) {
    await c.page.getByRole('button', { name: /^Maç Oyunu$/ }).first().click()
    await expect(c.page.locator('.setup-page')).toBeVisible()
    await c.page.locator('.target-chip').filter({ hasText: /^1$|Tek/ }).first().click().catch(() => {})
    const start = c.page.getByRole('button', { name: /Başla|Başlat|Oyuna Başla|Devam|Rakip Bul/ }).last()
    await expect(start).toBeVisible({ timeout: 15_000 })
    await start.click()
    if (c === a) await expect(a.page.getByRole('heading', { name: /Rakip aranıyor/ })).toBeVisible({ timeout: 20_000 })
  }
  await Promise.all([a, b].map((c) => expect(c.page.locator('.board')).toBeVisible({ timeout: 30_000 })))
  await expect.poll(() => code, { timeout: 15_000 }).not.toBe('')
  const toks = await Promise.all([a, b].map((c) => c.page.evaluate(() => localStorage.getItem('tavla.playerToken') || '')))
  const ra = await call(a.page.request, 'GET', `/rooms/${code}?token=${toks[0]}`, a.user.token)
  const aIsWhite = ra.body.room.p1_user_id === a.user.id
  const sa: Seat = { user: a.user, token: toks[0], color: aIsWhite ? 'white' : 'black' }
  const sb: Seat = { user: b.user, token: toks[1], color: aIsWhite ? 'black' : 'white' }
  return { code, white: aIsWhite ? sa : sb, black: aIsWhite ? sb : sa }
}
/** Bir ply'ı API ile oynar; sonraki durumu döndürür. */
async function apiPly(request: Page['request'], code: string, s: { white: Seat; black: Seat }) {
  for (let i = 0; i < 6; i++) {
    const r = await getRoom(request, code, s.white)
    if (r.server_match?.done) return r
    const st = r.server_state
    if (!st) { await call(request, 'POST', `/rooms/${code}/roll`, s.white.user!.token, cmd(s.white, r.server_version)); continue }
    const me = s[st.turn]
    if (!st.dice?.length) { await call(request, 'POST', `/rooms/${code}/roll`, me.user!.token, cmd(me, r.server_version)); continue }
    const moves = generateMoves(st) as Move[]
    const mv = await call(request, 'POST', `/rooms/${code}/move`, me.user!.token, cmd(me, r.server_version, { steps: moves.length ? moves[Math.floor(Math.random() * moves.length)].steps : [] }))
    if (mv.status === 200) return getRoom(request, code, s.white)
  }
  return getRoom(request, code, s.white)
}

test('masaüstü: eşleşme, senkron, yenileme, aynı hesap 2. sekme, bağlantı kopması, arka plan, maç sonu', async ({ browser }) => {
  test.setTimeout(25 * 60_000)
  const a = await open(browser, P5), b = await open(browser, P6)
  const s = await uiMatchmake(a, b)
  const req = a.page.request
  const log: string[] = []
  let r = await apiPly(req, s.code, s)
  const checks: Record<string, string> = {}
  for (let ply = 0; ply < 400 && !r.server_match?.done; ply++) {
    if (r.server_state && r.server_match?.opened !== false) await synced([a.page, b.page], r.server_state.points, `ply ${ply}`)
    if (ply === 3) { // sayfa yenileme
      await a.page.reload({ waitUntil: 'domcontentloaded' })
      await expect(a.page.locator('.board')).toBeVisible({ timeout: 30_000 })
      await synced([a.page], r.server_state!.points, 'yenileme sonrası')
      checks.reload = 'OK: yenileme sonrası oyun aynı tahtayla devam etti'
    }
    if (ply === 6) { // aynı hesap ikinci sekme
      const tab2 = await b.ctx.newPage()
      await tab2.goto('/', { waitUntil: 'domcontentloaded' })
      await expect(tab2.locator('.board')).toBeVisible({ timeout: 30_000 }).catch(() => {})
      const vis = await tab2.locator('.board').isVisible()
      r = await apiPly(req, s.code, s)
      if (vis && r.server_state) { await synced([tab2, b.page], r.server_state.points, 'ikinci sekme'); checks.secondTab = 'OK: ikinci sekme oyunu açtı; iki sekme senkron' }
      else checks.secondTab = 'BİLGİ: ikinci sekme ana sayfada açıldı (oyuna otomatik dönmedi)'
      await tab2.screenshot({ path: `${OUT}/browser-second-tab.png` })
      await tab2.close()
    }
    if (ply === 9) { // bağlantı kopması
      await b.ctx.setOffline(true)
      r = await apiPly(req, s.code, s)
      await a.page.waitForTimeout(5000)
      await b.ctx.setOffline(false)
      if (r.server_state && !r.server_match?.done) await synced([b.page], r.server_state.points, 'bağlantı geri gelince')
      checks.offline = 'OK: 5 sn çevrimdışı sonrası tahta sunucuya yetişti'
    }
    if (ply === 12) { // arka plan / ön plan (mobil uygulama arka plana alma benzetimi)
      await a.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
      r = await apiPly(req, s.code, s); r = await apiPly(req, s.code, s)
      await a.page.waitForTimeout(3000)
      await a.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
      if (r.server_state && !r.server_match?.done) await synced([a.page], r.server_state.points, 'ön plana dönüş')
      checks.background = 'OK: gizli->görünür sonrası senkron (tarayıcı emülasyonu, gerçek cihaz değil)'
    }
    r = await apiPly(req, s.code, s)
    log.push(`${ply}:v${r.server_version}`)
  }
  expect(r.server_match?.done, 'maç bitmeli').toBe(true)
  for (const c of [a, b]) await expect(c.page.locator('.mr-overlay, .mr-card').first()).toBeVisible({ timeout: 30_000 })
  checks.result = 'OK: iki tarafta maç sonu ekranı'
  await a.page.screenshot({ path: `${OUT}/browser-desktop-result-a.png` })
  await b.page.screenshot({ path: `${OUT}/browser-desktop-result-b.png` })
  writeFileSync(`${OUT}/browser-desktop.json`, JSON.stringify({ code: s.code, checks, errors: { a: a.errors, b: b.errors } }, null, 2))
  console.log(JSON.stringify(checks, null, 1))
  expect([...a.errors, ...b.errors].filter((e) => !/409|429|Failed to load resource/.test(e))).toEqual([])
  await a.ctx.close(); await b.ctx.close()
})

test('mobil (Pixel 7): UI ile zar at, taş oyna, onayla; tahta taşmıyor; maç sonu', async ({ browser }) => {
  test.setTimeout(25 * 60_000)
  const a = await open(browser, P5, devices['Pixel 7']), b = await open(browser, P6, devices['Pixel 7'])
  const s = await uiMatchmake(a, b)
  const req = a.page.request
  const byColor = { [s.white.user!.id === P5.id ? 'white' : 'black']: a, [s.white.user!.id === P5.id ? 'black' : 'white']: b } as Record<string, Ctx>
  const ui: string[] = []
  // Açılış + ilk birkaç tur UI'dan: Zar At -> taşa dokun (etkin zarla oynar) -> Onayla.
  for (let turn = 0; turn < 4; turn++) {
    let r = await getRoom(req, s.code, s.white)
    if (!r.server_state) { await call(req, 'POST', `/rooms/${s.code}/roll`, s.white.user!.token, cmd(s.white, r.server_version)); r = await getRoom(req, s.code, s.white) }
    const c = byColor[r.server_state!.turn]
    const before = r.server_version
    if (!r.server_state!.dice.length) {
      // İstemci zarı ya "Zar At" düğmesiyle ya da (otomatik zar) kendiliğinden atar: hangisi
      // önce olursa. Düğme görünürse dokun; zar sunucuda belirince devam.
      const roll = c.page.getByRole('button', { name: /Zar At/ }).last()
      await expect.poll(async () => {
        const now = await getRoom(req, s.code, s.white)
        if (now.server_state?.dice?.length) return true
        if (await roll.isVisible().catch(() => false)) {
          const box = await roll.boundingBox()
          ui.push(`zar düğmesi ${Math.round(box!.width)}x${Math.round(box!.height)}`)
          await roll.tap().catch(() => {})
        }
        return false
      }, { timeout: 25_000, message: 'sırası gelen istemci zar atmalı (düğme ya da otomatik)' }).toBe(true)
      if (!ui.some((x) => x.startsWith('zar düğmesi'))) ui.push('otomatik zar (düğmesiz)')
      r = await getRoom(req, s.code, s.white)
      await expect.poll(() => c.page.locator('.board-dice .die, .board-dice [class*="die"]').count(), { timeout: 15_000, message: 'zar arayüzde görünmeli' }).toBeGreaterThan(0)
    }
    const moves = generateMoves(r.server_state!) as Move[]
    if (!moves.length || !moves[0].steps.length) continue
    await expect.poll(() => c.page.locator('.checker.draggable').count(), { timeout: 15_000 }).toBeGreaterThan(0)
    const v0 = r.server_version
    for (let k = 0; k < 4; k++) {
      const confirm = c.page.getByRole('button', { name: /Onayla/ })
      if (await confirm.isVisible().catch(() => false)) break
      const drag = c.page.locator('.checker.draggable').first()
      if (!(await drag.count())) break
      await drag.tap()
      await c.page.waitForTimeout(900)
    }
    const confirm = c.page.getByRole('button', { name: /Onayla/ })
    if (await confirm.isVisible().catch(() => false)) {
      const cb = await confirm.boundingBox()
      ui.push(`onay düğmesi ${Math.round(cb!.width)}x${Math.round(cb!.height)}`)
      expect(Math.round(cb!.height), 'Onayla dokunma hedefi ≥44px').toBeGreaterThanOrEqual(44)
      await confirm.tap()
    }
    await expect.poll(async () => (await getRoom(req, s.code, s.white)).server_version, { timeout: 20_000, message: 'UI hamlesi sunucuya ulaşmalı' }).toBeGreaterThan(v0)
    const after = await getRoom(req, s.code, s.white)
    if (after.server_state) await synced([a.page, b.page], after.server_state.points, `mobil UI tur ${turn}`)
  }
  const overflow = await a.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'mobilde yatay taşma').toBeLessThanOrEqual(1)
  await a.page.screenshot({ path: `${OUT}/browser-mobile-game.png` })
  let r = await getRoom(req, s.code, s.white)
  for (let i = 0; i < 2000 && !r.server_match?.done; i++) r = await apiPly(req, s.code, s)
  for (const c of [a, b]) await expect(c.page.locator('.mr-overlay, .mr-card').first()).toBeVisible({ timeout: 30_000 })
  const mr = a.page.locator('.mr-card').first()
  const mb = await mr.boundingBox()
  await a.page.screenshot({ path: `${OUT}/browser-mobile-result.png` })
  writeFileSync(`${OUT}/browser-mobile.json`, JSON.stringify({ code: s.code, ui, resultCard: mb, overflow, errors: { a: a.errors, b: b.errors } }, null, 2))
  expect(mb!.width, 'sonuç kartı ekrana sığmalı').toBeLessThanOrEqual(412)
  expect([...a.errors, ...b.errors].filter((e) => !/409|429|Failed to load resource/.test(e))).toEqual([])
  await a.ctx.close(); await b.ctx.close()
})
