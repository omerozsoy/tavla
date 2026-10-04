import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { call, users } from './helpers'

// KULLANICI ŞİKÂYETİ: YZ ile oynarken botun MAÇI BİTİREN son hamlesi görünmüyor, doğrudan sonuç
// (özet) ekranı açılıyordu. Kurulum: tahta, botun (siyah) sıradaki zarıyla son taşını toplayıp maçı
// kazanacağı konuma getirilir; insan (beyaz) arayüzden hamlesini yapar. Beklenen: botun son hamlesi
// tahtada oynanır (son taş toplanır) ve sonuç ekranı ancak ondan SONRA (≥1 sn) açılır.
const P7 = users[6]
const P8 = users[7]

async function readBoard(page: import('@playwright/test').Page): Promise<number[]> {
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

function rig(code: string) {
  // e2e DB'de oda durumunu ayarla: beyaz 15 taş 11. haneye (ev dışında, toplayamaz), siyah tek taş
  // 24. haneye (her zarla toplar -> bot maçı kazanır). Sıra beyazda, zar atılmamış.
  const php = `
    $r = App\\Models\\Room::where('code', '${code}')->firstOrFail();
    $pts = array_fill(0, 24, 0); $pts[10] = 15; $pts[23] = -1;
    $r->server_state = ['points' => $pts, 'bar' => ['white' => 0, 'black' => 0], 'off' => ['white' => 0, 'black' => 14],
      'turn' => 'white', 'dice' => [], 'diceUsed' => []];
    $m = $r->server_match; $m['opened'] = true; $m['done'] = false; $m['winner'] = null;
    $r->server_match = $m;
    $r->server_version = (int) $r->server_version + 5;
    $r->save();
    echo 'ok';`
  const out = execFileSync('php', ['artisan', 'tinker', '--execute', php], { cwd: 'backend', env: { ...process.env, APP_ENV: 'e2e' } }).toString()
  expect(out).toContain('ok')
}

test('YZ: maçı bitiren bot hamlesi sonuç ekranından ÖNCE tahtada oynanır', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript((tok) => localStorage.setItem('tavla.token', tok), P7.token)
  const page = await ctx.newPage()
  let code = ''
  page.on('response', async (r) => {
    if (/\/bot\/rooms$/.test(r.url())) { try { const j = await r.json(); if (j.room?.code) code = j.room.code } catch { /* yok */ } }
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.app')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: /YZ ile Oyna|Yapay Zeka ile Oyna/ }).first().click()
  await expect(page.locator('.setup-page')).toBeVisible()
  await page.locator('.target-chip').filter({ hasText: /^1$|Tek/ }).first().click().catch(() => {})
  await page.getByRole('button', { name: /^Başla$/ }).last().click()
  await expect(page.locator('.board')).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => code, { timeout: 15_000 }).not.toBe('')
  const tok = await page.evaluate(() => localStorage.getItem('tavla.playerToken') || '')

  // Açılış bitsin (sunucu maçı açsın), sonra tahtayı kur.
  await expect.poll(async () => (await call(page.request, 'GET', `/rooms/${code}?token=${tok}`, P7.token)).body?.room?.server_match?.opened, { timeout: 30_000 }).toBe(true)
  await expect.poll(async () => (await call(page.request, 'GET', `/rooms/${code}?token=${tok}`, P7.token)).body?.room?.server_state?.turn, { timeout: 60_000 }).toBe('white')
  rig(code)
  // İstemci kendi turunda (zarı varken) sunucu durumunu ezmez (mid-move kalkanı) -> yenile: bot odası
  // koddan yeniden bağlanır ve kurulan tahta baştan uygulanır.
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('.board')).toBeVisible({ timeout: 30_000 })

  // İnsan: zar at (düğme ya da otomatik) + bir taş oyna + onayla.
  const blackOnLast = () => page.evaluate(() => {
    const pt = document.querySelector<HTMLElement>('.board .point[data-point="23"]')
    return pt ? pt.querySelectorAll('.checkers > .checker.black').length : -1
  })
  await expect.poll(blackOnLast, { timeout: 20_000, message: 'kurulan tahta arayüze gelmeli' }).toBe(1)
  await expect.poll(async () => {
    const roll = page.getByRole('button', { name: /Zar At/ })
    if (await roll.isVisible().catch(() => false)) await roll.click().catch(() => {})
    return page.locator('.checker.draggable').count()
  }, { timeout: 25_000 }).toBeGreaterThan(0)
  for (let k = 0; k < 4; k++) {
    if (await page.getByRole('button', { name: /Onayla/ }).isVisible().catch(() => false)) break
    const drag = page.locator('.checker.draggable').first()
    if (!(await drag.count())) break
    await drag.click()
    await page.waitForTimeout(700)
  }
  const confirm = page.getByRole('button', { name: /Onayla/ })
  if (await confirm.isVisible().catch(() => false)) await confirm.click()

  // Örnekle: siyahın son taşı tahtadan kalktığı an ile sonuç ekranının açıldığı an.
  const overlay = page.locator('.mr-overlay, .mr-card').first()
  let lastGoneAt = 0
  let overlayAt = 0
  let overlayWhileCheckerOnBoard = false
  const t0 = Date.now()
  while (Date.now() - t0 < 30_000) {
    const onLast = await blackOnLast()
    const ov = await overlay.isVisible().catch(() => false)
    if (onLast === 0 && !lastGoneAt) lastGoneAt = Date.now()
    if (ov && !overlayAt) { overlayAt = Date.now(); overlayWhileCheckerOnBoard = onLast > 0; break }
    await page.waitForTimeout(50)
  }
  console.log(`zaman çizelgesi: son taş kalktı +${lastGoneAt - t0} ms, sonuç ekranı +${overlayAt - t0} ms`)
  expect(overlayAt, 'sonuç ekranı açılmalı').toBeGreaterThan(0)
  expect(overlayWhileCheckerOnBoard, 'sonuç ekranı botun son hamlesinden önce açılmamalı').toBe(false)
  expect(lastGoneAt, 'botun son taşı toplanırken tahtada görülmeli').toBeGreaterThan(0)
  expect(overlayAt - lastGoneAt, 'son hamleden sonra sonuç ekranından önce bekleme olmalı (ms)').toBeGreaterThanOrEqual(1000)
  await page.screenshot({ path: 'test-kanitlari/flows/bot-final-move.png' })
  await ctx.close()
})

test('YZ: tarayıcıdan tam bot oyunu — her bot turundan sonra tahta sunucuyla aynı, sonda sonuç ekranı', async ({ browser }) => {
  test.setTimeout(10 * 60_000)
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript((tok) => localStorage.setItem('tavla.token', tok), P8.token)
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  let code = ''
  page.on('response', async (r) => {
    if (/\/bot\/rooms$/.test(r.url())) { try { const j = await r.json(); if (j.room?.code) code = j.room.code } catch { /* yok */ } }
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /YZ ile Oyna|Yapay Zeka ile Oyna/ }).first().click()
  await page.locator('.target-chip').filter({ hasText: /^1$|Tek/ }).first().click().catch(() => {})
  await page.getByRole('button', { name: /^Başla$/ }).last().click()
  await expect(page.locator('.board')).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => code, { timeout: 15_000 }).not.toBe('')
  const tok = await page.evaluate(() => localStorage.getItem('tavla.playerToken') || '')
  const srv = async () => (await call(page.request, 'GET', `/rooms/${code}?token=${tok}`, P8.token)).body?.room
  const overlay = page.locator('.mr-overlay, .mr-card').first()
  let checks = 0
  for (let guard = 0; guard < 400; guard++) {
    if (await overlay.isVisible().catch(() => false)) break
    const r = await srv()
    if (guard % 10 === 0) console.log(`#${guard} turn=${r?.server_state?.turn} dice=${JSON.stringify(r?.server_state?.dice)} v=${r?.server_version} done=${r?.server_match?.done} pending=${r?.server_match?.cube?.pending} checks=${checks}`)
    if (r?.server_match?.done) { await expect(overlay).toBeVisible({ timeout: 20_000 }); break }
    // Bot küp çektiyse kabul et.
    const take = page.getByRole('button', { name: /^Kabul|Al$/ })
    if (await take.isVisible().catch(() => false)) { await take.click(); continue }
    if (r?.server_state?.turn === 'white' && !(r.server_state.dice?.length)) {
      // Bot turu bitti, sıra bende ve zar atılmadı: ekrandaki tahta sunucuyla aynı olmalı.
      await expect.poll(() => readBoard(page), { timeout: 15_000, message: 'bot turundan sonra tahta senkron değil' }).toEqual(r.server_state.points)
      checks++
    }
    const roll = page.getByRole('button', { name: /Zar At/ })
    if (await roll.isVisible().catch(() => false)) { await roll.click().catch(() => {}); await page.waitForTimeout(400); continue }
    const confirm = page.getByRole('button', { name: /Onayla/ })
    if (await confirm.isVisible().catch(() => false)) { await confirm.click(); await page.waitForTimeout(600); continue }
    const drag = page.locator('.checker.draggable').first()
    if (await drag.count()) { await drag.click().catch(() => {}); await page.waitForTimeout(500); continue }
    await page.waitForTimeout(400)
  }
  await expect(overlay).toBeVisible({ timeout: 30_000 })
  console.log(`bot oyunu bitti, ${checks} tur sonrası senkron kontrolü`)
  expect(checks, 'en az birkaç bot turu kontrol edilmeli').toBeGreaterThan(3)
  expect(errors, errors.join('\n')).toEqual([])
  await ctx.close()
})
