// Canlı ana sayfada CLS kaynaklarını (kayan DOM node'ları + katkıları) mobil emülasyonda yakalar.
// layout-shift PerformanceObserver entry'lerinin sources[] alanı tam DOM atfını verir.
import { chromium } from 'playwright'

const URL = process.argv[2] || 'https://tavlatv.com/'
const b = await chromium.launch()
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
const p = await ctx.newPage()
const cdp = await ctx.newCDPSession(p)
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 })
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

await p.addInitScript(() => {
  window.__cls = 0
  window.__shifts = []
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (e.hadRecentInput) continue
      window.__cls += e.value
      for (const s of e.sources || []) {
        const n = s.node
        if (!n) continue
        const desc = n.nodeType === 1
          ? `${n.tagName.toLowerCase()}${n.id ? '#' + n.id : ''}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).join('.') : ''}`
          : String(n.nodeName)
        window.__shifts.push({ v: +e.value.toFixed(4), node: desc.slice(0, 120) })
      }
    }
  }).observe({ type: 'layout-shift', buffered: true })
})

await p.goto(URL, { waitUntil: 'load', timeout: 60000 })
await p.waitForTimeout(6000) // yüklenme + geç kaymaları yakala

const r = await p.evaluate(() => ({ cls: window.__cls, shifts: window.__shifts }))
console.log(`CLS toplam (mobil emüle): ${r.cls.toFixed(3)}`)
// node'a göre topla
const byNode = {}
for (const s of r.shifts) byNode[s.node] = (byNode[s.node] || 0) + s.v
const sorted = Object.entries(byNode).sort((a, b) => b[1] - a[1])
console.log(`\nKAYAN ELEMANLAR (katkıya göre):`)
for (const [node, v] of sorted.slice(0, 15)) console.log(`  ${v.toFixed(4)}  ${node}`)
await b.close()
