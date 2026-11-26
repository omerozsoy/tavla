// Turnuva slider PARMAK (swipe) testi — düzeltme #2 doğrulaması.
// API'yi mock'lar (backend GEREKMEZ), mobil viewport'ta Vite dev server'daki GÜNCEL kodu sürer.
// Doğrular: (1) sola swipe -> sonraki sayfa, (2) sağa swipe -> önceki, (3) swipe sırasında kart
// KAZARA AÇILMAZ (carousel DOM'da kalır), (4) düz dokunma (tap) kartı AÇAR (carousel kalkar).
// Kullanım: PORT=5178 node scripts/tourn-swipe-test.mjs
import { chromium } from 'playwright'

const PORT = process.env.PORT || 5178
const base = `http://localhost:${PORT}`
const assert = (c, msg) => { if (!c) { console.error('FAIL: ' + msg); process.exitCode = 1; throw new Error(msg) } }

// 3 açık turnuva -> mobilde per=1 => 3 sayfa => noktalar + swipe aktif.
const now = Date.now()
const mkT = (id, name, mins) => ({
  id, name, status: 'open', size: 16, count: id + 3,
  starts_at: new Date(now + mins * 60000).toISOString(),
  prizes: [{ coins: 1000 }, { coins: 500 }, { coins: 250 }], joined: false,
})
const TOURNS = [mkT(1, 'Alfa Kupası', 30), mkT(2, 'Beta Turnuvası', 90), mkT(3, 'Gama Ligi', 180)]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

// /api/tournaments -> mock; diğer tüm /api çağrıları -> abort (app .catch ile boş panel gösterir).
await ctx.route('**/api/**', (route) => {
  const u = route.request().url()
  if (/\/api\/tournaments(\?|$)/.test(u)) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tournaments: TOURNS }) })
  }
  return route.abort()
})

const page = await ctx.newPage()
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 })
// Çerez bandı varsa kapat (carousel'in üstüne binmesin).
await page.locator('.cookie-consent button, [class*="cookie"] button').first().click({ timeout: 1500 }).catch(() => {})
await page.waitForSelector('.tourn-carousel', { timeout: 30000 })
await page.waitForTimeout(500)

const read = () => page.evaluate(() => {
  const track = document.querySelector('.tourn-track')
  const dots = [...document.querySelectorAll('.tourn-dot')]
  return {
    transform: track ? track.style.transform : null,
    dotCount: dots.length,
    active: dots.findIndex((d) => d.classList.contains('active')),
    carousel: !!document.querySelector('.tourn-carousel'),
  }
})

// Mouse = pointerdown/move/up (React onPointerDown/Move/Up ile AYNI kod yolu; pointerType'a bakmıyoruz).
const swipe = async (dir) => {
  const box = await page.locator('.tourn-carousel').boundingBox()
  const y = box.y + 36 // üst bölge: alttaki KATIL butonundan uzak
  const x0 = box.x + box.width / 2
  const sign = dir === 'left' ? -1 : 1
  await page.mouse.move(x0, y)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(x0 + sign * (120 * i) / 10, y)
  await page.mouse.up()
  await page.waitForTimeout(400) // transform transition (0.3s)
}

const steps = []
const before = await read(); steps.push(['başlangıç', before])
assert(before.dotCount >= 2, `nokta sayısı ${before.dotCount} < 2 (slider tek sayfa, test geçersiz)`)
assert(before.active === 0, `başlangıç aktif nokta ${before.active} !== 0`)

await swipe('left')
const afterL = await read(); steps.push(['sola swipe', afterL])
assert(afterL.carousel, 'sola swipe sonrası carousel KAYBOLDU -> kart kazara açıldı!')
assert(afterL.active === 1, `sola swipe aktif nokta ${afterL.active} !== 1 (ileri gitmedi)`)

await swipe('right')
const afterR = await read(); steps.push(['sağa swipe', afterR])
assert(afterR.active === 0, `sağa swipe aktif nokta ${afterR.active} !== 0 (geri gelmedi)`)

// Düz dokunma (hareketsiz) -> kart açılır -> ana sayfa gider -> carousel DOM'dan kalkar.
const box = await page.locator('.tourn-carousel').boundingBox()
await page.mouse.click(box.x + box.width / 2, box.y + 36)
await page.waitForTimeout(500)
const afterTap = await read(); steps.push(['tap', afterTap])
assert(!afterTap.carousel, 'tap sonrası carousel hâlâ var -> dokunma kartı AÇMADI')

await page.screenshot({ path: 'scripts/tourn-swipe.png' }).catch(() => {})
console.log(JSON.stringify(steps, null, 2))
console.log(process.exitCode ? '\n❌ TEST BAŞARISIZ' : '\n✅ TÜM ADIMLAR GEÇTİ (swipe ileri/geri + swipe kazara açmıyor + tap açıyor)')
await browser.close()
