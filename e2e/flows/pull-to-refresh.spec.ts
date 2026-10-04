import { expect, test, devices, type BrowserContext, type Page } from '@playwright/test'

// KULLANICI ŞİKÂYETİ: telefonda gizlilik politikasında yazı seçince "sayfa güncellenmiş gibi" seçim
// gidiyordu. Sebep: kendi "aşağı çek-yenile" (PullToRefresh) bileşenimiz, seçim tutamacını aşağı
// sürüklemeyi yenileme hareketi sanıp sayfayı yeniliyordu. Vite dev (:5199) + e2e backend gerekir.
const URL = 'http://localhost:5199/gizlilik-politikasi'

async function openLegal(browser: import('@playwright/test').Browser) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] })
  const page = await ctx.newPage()
  const counter = { loads: 0 }
  page.on('load', () => counter.loads++)
  await page.goto(URL, { waitUntil: 'load' })
  const p = page.locator('.info-rich p').nth(1)
  await p.waitFor({ timeout: 30000 })
  await page.waitForTimeout(1500)
  const box = (await p.boundingBox())!
  return { ctx, page, counter, x: box.x + 20, y: box.y + 8 }
}

async function swipeDown(ctx: BrowserContext, page: Page, x: number, y: number, between?: () => Promise<void>) {
  const cdp = await ctx.newCDPSession(page)
  const touch = (type: string, yy: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: yy }] })
  await touch('touchStart', y)
  if (between) await between()
  for (let d = 10; d <= 220; d += 15) { await touch('touchMove', y + d); await page.waitForTimeout(16) }
  await touch('touchEnd', y + 220)
}

test('mobil: yazı seçip tutamacı aşağı sürüklemek sayfayı yenilemez, seçim korunur', async ({ browser }) => {
  const { ctx, page, counter, x, y } = await openLegal(browser)
  await swipeDown(ctx, page, x, y, async () => {
    // Uzun basma -> tarayıcı metni seçer (burada seçimi programla kuruyoruz).
    await page.evaluate(() => {
      const el = document.querySelectorAll('.info-rich p')[1]
      const r = document.createRange()
      r.selectNodeContents(el)
      const s = window.getSelection()!
      s.removeAllRanges()
      s.addRange(r)
    })
    await page.waitForTimeout(600)
  })
  await page.waitForTimeout(2500)
  expect(counter.loads, 'sayfa yenilenmemeli').toBe(1)
  expect(await page.evaluate(() => (window.getSelection()?.toString() || '').length), 'seçim korunmalı').toBeGreaterThan(0)
  await ctx.close()
})

test('mobil: seçim yokken en üstte aşağı çekmek hâlâ sayfayı yeniler', async ({ browser }) => {
  const { ctx, page, counter, x, y } = await openLegal(browser)
  await swipeDown(ctx, page, x, y)
  await expect.poll(() => counter.loads, { timeout: 10_000, message: 'aşağı çek-yenile çalışmalı' }).toBe(2)
  await ctx.close()
})
