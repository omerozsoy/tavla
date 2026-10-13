// Ust bar (account-bar) logo kirpilmasi olcumu. Popup'lari kapatir, birkac genislikte rect verir.
// node scripts/measure-topbar.mjs --base https://www.tavlatv.com --token "<id>|<plain>"
import { chromium } from 'playwright'
const args = process.argv.slice(2)
const argVal = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const BASE = argVal('--base', 'https://www.tavlatv.com')
const TOKEN = argVal('--token')
const WIDTHS = [[360, 760], [375, 667], [384, 854], [430, 932], [1024, 600], [1133, 744], [1280, 800]]

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
  const host = document.querySelector('.acct-desktop') || ab
  const flat = []
  const dump = (el) => { for (const c of el.children) { const r = c.getBoundingClientRect(); if (r.width < 4) continue; const cl = (typeof c.className === 'string' ? c.className : '').split(' ').filter(Boolean)[0] || c.tagName.toLowerCase(); if (['account-id', 'acct-desktop'].includes(cl)) { dump(c); continue } flat.push({ t: cl.slice(0, 20), w: Math.round(r.width) }) } }
  if (host) dump(host)
  const kids = flat
  return {
    winW: window.innerWidth,
    bar: q('.account-bar'),
    barScroll: ab ? Math.round(ab.scrollWidth) : null,
    over: ab ? Math.round(ab.scrollWidth) - window.innerWidth : null,
    barPadL: abStyle ? abStyle.paddingLeft : null,
    kids,
  }
}

for (const [w, h] of WIDTHS) {
  await page.setViewportSize({ width: w, height: h })
  await page.waitForTimeout(350)
  const m = await page.evaluate(measure)
  console.log(`\n${w}x${h}  padL=${m.barPadL} scroll=${m.barScroll} OVER=${m.over}px ${m.over > 1 ? '✗' : '✓'}`)
  console.log('  kids: ' + m.kids.map((k) => `${k.t}(${k.w})`).join(' '))
}
await browser.close()
