// Canlı ana sayfada gerçek etkileşim gecikmesini (INP proxy) mobil emülasyon + 4× CPU altında ölçer.
// PerformanceObserver 'event' entry'lerinin duration'ı = input delay + işleme + sunum gecikmesi.
// Tıklanabilir öğelere tek tek tıklayıp her etkileşimin gecikmesini raporlar (en kötü = INP).
import { chromium } from 'playwright'

const URL = process.argv[2] || 'https://tavlatv.com/'
const b = await chromium.launch()
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
const p = await ctx.newPage()
const cdp = await ctx.newCDPSession(p)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

await p.addInitScript(() => {
  window.__ev = []
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (!e.interactionId) continue
      const n = e.target
      const tgt = n && n.nodeType === 1
        ? `${n.tagName.toLowerCase()}${n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}${n.textContent ? ' «' + n.textContent.trim().slice(0, 24) + '»' : ''}`
        : '(hedef yok)'
      window.__ev.push({ name: e.name, dur: Math.round(e.duration), proc: Math.round(e.processingEnd - e.processingStart), tgt: tgt.slice(0, 80) })
    }
  }).observe({ type: 'event', durationThreshold: 16, buffered: true })
})

await p.goto(URL, { waitUntil: 'load', timeout: 60000 })
await p.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 30000 }).catch(() => {})
await p.waitForTimeout(3000)

// Ana sayfada tıklanabilir öğeler: liderlik tab butonları, panel başlıkları, nav. Görünür olanlara tıkla.
const clickTargets = [
  'button:has-text("Jeton")', 'button:has-text("WxP")', 'button:has-text("PR")', 'button:has-text("Puan")',
  '.rank-tabs button', '.home-panel-head', '.bottom-nav button', '.side-menu button', 'button',
]
let clicks = 0
for (const sel of clickTargets) {
  const els = await p.locator(sel).all().catch(() => [])
  for (const el of els.slice(0, 3)) {
    try {
      if (await el.isVisible() && clicks < 18) { await el.click({ timeout: 1500, trial: false }); clicks++; await p.waitForTimeout(400) }
    } catch { /* tıklanamadı, geç */ }
  }
}
await p.waitForTimeout(1500)

const ev = await p.evaluate(() => window.__ev)
console.log(`${clicks} etkileşim denendi, ${ev.length} ölçüldü (mobil, 4× CPU)`)
if (ev.length) {
  const sorted = ev.sort((a, b) => b.dur - a.dur)
  const p75 = sorted[Math.floor(sorted.length * 0.25)]?.dur ?? 0
  console.log(`\nINP (en kötü): ${sorted[0].dur}ms   p75: ${p75}ms`)
  console.log(`\nEn yavaş 10 etkileşim (toplam | işleme | olay → HEDEF):`)
  for (const e of sorted.slice(0, 10)) console.log(`  ${String(e.dur).padStart(4)}ms | proc ${String(e.proc).padStart(4)}ms | ${e.name.padEnd(12)} → ${e.tgt}`)
}
await b.close()
