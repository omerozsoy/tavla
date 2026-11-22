import { chromium } from 'playwright'
const b = await chromium.launch()
// iPhone-ish portrait
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })
await p.goto('https://tavlatv.com/', { waitUntil: 'networkidle' }).catch(() => {})
await p.waitForTimeout(4000)
const info = await p.evaluate(() => {
  const inp = document.querySelector('.online-search')
  const panel = document.querySelector('.online-panel')
  if (!inp) return { err: 'no search input', hasPanel: !!panel }
  const r = inp.getBoundingClientRect()
  const cs = getComputedStyle(inp)
  const pr = panel.getBoundingClientRect()
  return {
    box: Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height),
    panelW: Math.round(pr.width),
    overflowsRight: Math.round(r.right) > Math.round(pr.right) + 1,
    fontSize: cs.fontSize,
    placeholder: inp.getAttribute('placeholder'),
  }
})
console.log(JSON.stringify(info))
const panel = p.locator('.online-panel').first()
if (await panel.count()) await panel.screenshot({ path: 'online-mobile.png' })
await p.screenshot({ path: 'online-mobile-full.png' })
await b.close()
