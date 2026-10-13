// Ust bar (account-bar) logo kirpilmasi olcumu. Popup'lari kapatir, birkac genislikte rect verir.
// node scripts/measure-topbar.mjs --base https://www.tavlatv.com --token "<id>|<plain>"
import { chromium } from 'playwright'
const args = process.argv.slice(2)
const argVal = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const BASE = argVal('--base', 'https://www.tavlatv.com')
const TOKEN = argVal('--token')
const WIDTHS = [[844, 390], [901, 440], [956, 440], [1024, 500], [1133, 744], [1280, 800]]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 956, height: 440 } })
if (TOKEN) await ctx.addInitScript((t) => { try { localStorage.setItem('tavla.token', t) } catch {} }, TOKEN)
const page = await ctx.newPage()
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForTimeout(2500)
// Popup'lari kapat: cerez + reklam modal
for (const txt of ['Tümünü Kabul', 'Kabul Et', 'Yalnızca Zorunlu']) {
  const b = page.getByRole('button', { name: new RegExp(txt, 'i') }).first()
  if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(300) }
}
for (const sel of ['.modal-x', '[aria-label="Kapat"]', '.tourn-ad-close', '.overlay-close', 'button:has-text("×")']) {
  const b = page.locator(sel).first()
  if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(300) }
}

const measure = () => {
  const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) } }
  const ab = document.querySelector('.account-bar')
  const abStyle = ab ? getComputedStyle(ab) : null
  return {
    winW: window.innerWidth,
    bar: q('.account-bar'),
    barScroll: ab ? Math.round(ab.scrollWidth) : null,
    barPadL: abStyle ? abStyle.paddingLeft : null,
    barOverflowX: abStyle ? abStyle.overflowX : null,
    brand: q('.ab-brand'),
    wordmark: q('.ab-wordmark'),
    hamburger: q('.hamburger'),
  }
}

for (const [w, h] of WIDTHS) {
  await page.setViewportSize({ width: w, height: h })
  await page.waitForTimeout(350)
  const m = await page.evaluate(measure)
  const clip = m.wordmark && (m.wordmark.l < -1)
  console.log(`\n${w}x${h}  bar=[${m.bar?.l}..${m.bar?.r}] padL=${m.barPadL} ovX=${m.barOverflowX} scroll=${m.barScroll}`)
  console.log(`  brand=[${m.brand?.l}..${m.brand?.r}]  wordmark=[${m.wordmark?.l}..${m.wordmark?.r}]  ham=${m.hamburger ? `[${m.hamburger.l}..${m.hamburger.r}]` : 'yok'}  ${clip ? 'LOGO CLIP ✗' : 'ok ✓'}`)
}
await browser.close()
