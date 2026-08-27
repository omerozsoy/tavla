// Layout ekran goruntusu araci. Uygulamayi '/' ile yukleyip tam baslatir, sonra
// popstate ile hedef slug'a gecer (applyFromPath tetiklenir; mount-race yok).
// Kullanim: node scripts/shoot.mjs <slug> <out.png> <w> <h>
import { chromium } from 'playwright'

const slug = process.argv[2] || 'oyun-onizleme'
const out = process.argv[3] || 'shot.png'
const w = Number(process.argv[4] || 812)
const h = Number(process.argv[5] || 375)
const base = 'http://localhost:5173/'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.error('PAGEERR', e.message))
try {
  await page.goto(base, { waitUntil: 'load', timeout: 60000 })
} catch (e) {
  console.error('goto err', e.message)
}
await page.waitForTimeout(3500) // uygulama init (auth vb.)
await page.evaluate((s) => {
  history.pushState(null, '', '/' + s)
  window.dispatchEvent(new PopStateEvent('popstate'))
}, slug)
await page.waitForTimeout(2000)
await page.screenshot({ path: out })
await browser.close()
console.log('saved', out, `${w}x${h}`, slug)
