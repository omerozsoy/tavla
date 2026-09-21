// Oyun-ICI tahta yakalama: YZ oyununu baslatir, tahtayi cesitli cihaz+yonlerde yakalar.
// Kullanim: TOKEN=... node scripts/game-shots.mjs [tag]
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const tag = process.argv[2] || 'before'
const base = 'http://localhost:5188/'
const TOKEN = process.env.TOKEN || ''
const outDir = `scripts/_shots/mobile/game-${tag}`
mkdirSync(outDir, { recursive: true })

const VIEWS = [
  { name: 'se-portrait', w: 375, h: 667 },
  { name: 'se-landscape', w: 667, h: 375 },
  { name: '14pro-portrait', w: 393, h: 852 },
  { name: '14pro-landscape', w: 852, h: 393 },
  { name: 'ipad-portrait', w: 820, h: 1180 },
  { name: 'ipad-landscape', w: 1180, h: 820 },
]

const browser = await chromium.launch()
for (const v of VIEWS) {
  const ctx = await browser.newContext({
    viewport: { width: v.w, height: v.h },
    deviceScaleFactor: 1,
    isMobile: !v.name.startsWith('ipad'),
    hasTouch: true,
  })
  if (TOKEN) await ctx.addInitScript((t) => { try { localStorage.setItem('tavla.token', t) } catch {} }, TOKEN)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('PAGEERR', v.name, e.message))
  try {
    await page.goto(base, { waitUntil: 'load', timeout: 60000 })
  } catch (e) {
    console.error('goto err', v.name, e.message)
  }
  await page.waitForTimeout(3500)
  // YZ oyununa gec + Basla
  await page.evaluate(() => { history.pushState(null, '', '/yz-ile-oyna'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await page.waitForTimeout(1200)
  // "Basla" butonunu bul ve tikla
  let started = false
  try {
    const btn = page.getByRole('button', { name: /Başla|Basla|Start/i }).first()
    if (await btn.count()) { await btn.click({ timeout: 4000 }); started = true }
  } catch (e) { /* devam */ }
  await page.waitForTimeout(3500) // tahta + ilk zar
  // Tahta var mi?
  const hasBoard = await page.evaluate(() => !!document.querySelector('.board, .bg-board, [class*="board"]'))
  console.log(`${v.name.padEnd(16)} started=${started} board=${hasBoard} ${v.w}x${v.h}`)
  await page.screenshot({ path: `${outDir}/game__${v.name}.png` })
  await ctx.close()
}
await browser.close()
console.log('DONE ->', outDir)
