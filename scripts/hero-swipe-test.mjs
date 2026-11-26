// Ana sayfa HERO slider (BannerSlider) PARMAK testi — #1 doğrulaması.
// /api/tournament-ads'i mock'lar (3 banner -> noktalar + swipe aktif), deployed JS'i sürer.
// Doğrular: sağa swipe (prev, oto-rotasyonun ASLA yapmadığı yön -> kesin), sola swipe,
// ok dokunma, nokta dokunma; swipe sırasında banner KAZARA AÇILMAZ (banner-slider kalır).
// Kullanım: BASE=https://www.tavlatv.com node scripts/hero-swipe-test.mjs
import { chromium } from 'playwright'

const PORT = process.env.PORT || 5178
const base = process.env.BASE || `http://localhost:${PORT}`
const assert = (c, msg) => { if (!c) { console.error('FAIL: ' + msg); process.exitCode = 1; throw new Error(msg) } }

const mkAd = (id, title) => ({ id, image: 'banner-' + id + '.jpg', title, tournament_id: id, panel_color: '#111111', kicker: 'TEST', subtitle: 'alt', cta: 'Katıl' })
const ADS = [mkAd(1, 'Birinci Banner'), mkAd(2, 'İkinci Banner'), mkAd(3, 'Üçüncü Banner')]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await ctx.route('**/api/**', (route) => {
  const u = route.request().url()
  if (/\/api\/tournament-ads(\?|$)/.test(u)) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ads: ADS }) })
  }
  return route.abort()
})
const page = await ctx.newPage()
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.cookie-consent button, [class*="cookie"] button').first().click({ timeout: 1500 }).catch(() => {})
await page.waitForSelector('.banner-slider .bs-dots button', { timeout: 30000 })
await page.waitForTimeout(400)

const read = () => page.evaluate(() => {
  const dots = [...document.querySelectorAll('.banner-slider .bs-dots button')]
  return {
    dotCount: dots.length,
    active: dots.findIndex((d) => d.classList.contains('active')),
    slider: !!document.querySelector('.banner-slider'),
  }
})
const swipe = async (dir) => {
  const box = await page.locator('.banner-slider .bs-viewer').boundingBox()
  const y = box.y + box.height / 2
  const x0 = box.x + box.width / 2
  const sign = dir === 'left' ? -1 : 1
  await page.mouse.move(x0, y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + sign * (120 * i) / 10, y)
  await page.mouse.up()
  await page.waitForTimeout(750) // DURATION 560ms + tampon (oto-rotasyon 6s -> araya girmez)
}

const steps = []
const before = await read(); steps.push(['başlangıç', before])
assert(before.dotCount >= 3, `nokta ${before.dotCount} < 3`)
assert(before.active === 0, `başlangıç aktif ${before.active} !== 0`)

// Sağa swipe = önceki (oto-rotasyon ASLA geri gitmez) -> 0'dan son banner'a (2) sarar. KESİN kanıt.
await swipe('right')
let s = await read(); steps.push(['sağa swipe (prev)', s])
assert(s.slider, 'sağa swipe sonrası banner-slider yok -> kazara açıldı!')
assert(s.active === before.dotCount - 1, `sağa swipe aktif ${s.active} !== ${before.dotCount - 1}`)

await swipe('left') // 2 -> 0
s = await read(); steps.push(['sola swipe (next)', s])
assert(s.active === 0, `sola swipe aktif ${s.active} !== 0`)

// Ok dokunma: sonraki -> 1 (dispatchEvent: uzun banner + sticky header aktiflik takılmasını atla)
await page.locator('.bs-arrow-next').dispatchEvent('click')
await page.waitForTimeout(750)
s = await read(); steps.push(['ok-sonraki', s])
assert(s.active === 1, `ok-sonraki aktif ${s.active} !== 1`)

// Nokta dokunma: 3. nokta -> 2
await page.locator('.banner-slider .bs-dots button').nth(2).dispatchEvent('click')
await page.waitForTimeout(750)
s = await read(); steps.push(['nokta-3', s])
assert(s.active === 2, `nokta-3 aktif ${s.active} !== 2`)

await page.screenshot({ path: 'scripts/hero-swipe.png' }).catch(() => {})
console.log(JSON.stringify(steps, null, 2))
console.log(process.exitCode ? '\n❌ HERO TEST BAŞARISIZ' : '\n✅ HERO SLIDER: swipe(sağ/sol) + ok + nokta + kazara-açılmıyor — HEPSİ GEÇTİ')
await browser.close()
