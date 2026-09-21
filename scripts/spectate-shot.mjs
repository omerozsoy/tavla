import { chromium } from 'playwright'
const code = process.argv[2] || 'J545B'
const url = `https://tavlai.com/izle/${code}`
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(7000) // board poll + render
await page.screenshot({ path: `scripts/_spectate-${code}.png` })
console.log('shot ->', `scripts/_spectate-${code}.png`)
await browser.close()
