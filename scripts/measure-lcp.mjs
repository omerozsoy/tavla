// Canlı siteyi mobil emülasyon + Slow-4G + 4× CPU throttling altında ölç (LCP/FCP/load + JS bayt).
// Lighthouse yerine (PSI API 429 verince) hızlı saha-dışı lab ölçümü. Tek seferlik tanı aracı.
import { chromium } from 'playwright'

const URL = process.argv[2] || 'https://tavlatv.com/'
const b = await chromium.launch()
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
const p = await ctx.newPage()
const cdp = await ctx.newCDPSession(p)
await cdp.send('Network.enable')
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 })
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

let jsBytes = 0, jsCount = 0, totalBytes = 0
p.on('response', async (r) => {
  try {
    const h = r.headers()
    const len = Number(h['content-length'] || 0)
    const url = r.url()
    totalBytes += len
    if (url.endsWith('.js') || url.includes('.js?')) { jsBytes += len; jsCount++ }
  } catch { /* yok */ }
})

const t0 = Date.now()
await p.goto(URL, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 30000 }).catch(() => {})
await p.waitForTimeout(3500) // LCP/mount otursun

const m = await p.evaluate(() => new Promise((res) => {
  let lcp = 0
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true }) } catch { /* yok */ }
  setTimeout(() => {
    const paint = performance.getEntriesByType('paint')
    const fcp = paint.find((x) => x.name === 'first-contentful-paint')?.startTime || 0
    const nav = performance.getEntriesByType('navigation')[0] || {}
    res({ lcp: Math.round(lcp), fcp: Math.round(fcp), dcl: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0) })
  }, 600)
}))

console.log(`URL: ${URL}  (mobil emüle, Slow-4G, 4× CPU)`)
console.log(`  FCP            : ${m.fcp} ms`)
console.log(`  LCP            : ${m.lcp} ms`)
console.log(`  DOMContentLoad : ${m.dcl} ms`)
console.log(`  load           : ${m.load} ms`)
console.log(`  JS indirilen   : ${(jsBytes / 1024).toFixed(0)} KB (${jsCount} istek)`)
console.log(`  toplam transfer: ${(totalBytes / 1024).toFixed(0)} KB`)
await b.close()
