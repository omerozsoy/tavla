// Oyun ekrani genislik olcumu: tablet-yatay tasmanin GERCEK sayilarini cikarir.
// node scripts/measure-board.mjs --base https://www.tavlatv.com --token "<id>|<plain>"
import { chromium } from 'playwright'
const args = process.argv.slice(2)
const argVal = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const BASE = argVal('--base', 'https://www.tavlatv.com')
const TOKEN = argVal('--token')
const VPS = [[1133, 744], [1194, 834], [1280, 800], [1366, 768], [1440, 900], [1920, 1080]]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1194, height: 834 } })
if (TOKEN) await ctx.addInitScript((t) => { try { localStorage.setItem('tavla.token', t) } catch {} }, TOKEN)
const page = await ctx.newPage()
await page.goto(`${BASE}/yz-ile-oyna`, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForSelector('.setup-page', { timeout: 20000 })
await page.locator('.setup-actions button').last().click()
await page.waitForSelector('.board', { timeout: 30000 })
await page.waitForTimeout(2000)

const measure = () => {
  const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) } }
  const ga = document.querySelector('.game-area')
  const kids = ga ? [...ga.children].map((c) => ({ cls: (typeof c.className === 'string' ? c.className : '').split(' ')[0], w: Math.round(c.getBoundingClientRect().width), l: Math.round(c.getBoundingClientRect().left), r: Math.round(c.getBoundingClientRect().right) })).filter((k) => k.w > 0) : []
  const cs = getComputedStyle(document.documentElement)
  return {
    winW: window.innerWidth, winH: window.innerHeight,
    boardH: cs.getPropertyValue('--board-h').trim(),
    gaScroll: ga ? Math.round(ga.scrollWidth) : null,
    gaRect: q('.game-area'),
    board: q('.board'),
    ham: q('.game-ham'),
    contentSpan: kids.length ? { l: Math.min(...kids.map((k) => k.l)), r: Math.max(...kids.map((k) => k.r)) } : null,
    kids,
  }
}

for (const [w, h] of VPS) {
  await page.setViewportSize({ width: w, height: h })
  await page.waitForTimeout(400)
  const m = await page.evaluate(measure)
  const span = m.contentSpan ? m.contentSpan.r - m.contentSpan.l : null
  const clip = m.contentSpan ? (m.contentSpan.l < -1 || m.contentSpan.r > m.winW + 1) : null
  console.log(`\n${w}x${h}  board-h=${m.boardH}  content=${span}px (l=${m.contentSpan?.l} r=${m.contentSpan?.r})  ${clip ? 'CLIP ✗' : 'fits ✓'}`)
  console.log(`  board.w=${m.board?.w}  ham=[${m.ham?.l}..${m.ham?.r}]`)
  console.log('  kids: ' + m.kids.map((k) => `${k.cls}(${k.w})`).join(' '))
}
await browser.close()
