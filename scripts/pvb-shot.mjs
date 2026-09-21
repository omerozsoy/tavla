import { chromium } from 'playwright'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto('https://tavlai.com/yz-ile-oyna', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
// olası giriş/popup kapat
for (const t of ['Kapat','Misafir','Devam','Anladım','Başla','Oyna','Onayla']) {
  try { const b = page.getByRole('button', { name: t }); if (await b.count()) { await b.first().click({ timeout: 1500 }); await page.waitForTimeout(800) } } catch {}
}
await page.waitForTimeout(2000)
await page.screenshot({ path: 'scripts/_pvb.png' })
// board var mi
const hasBoard = await page.locator('.board-inner, .board').count().catch(()=>0)
console.log('board el:', hasBoard, '-> scripts/_pvb.png')
await browser.close()
