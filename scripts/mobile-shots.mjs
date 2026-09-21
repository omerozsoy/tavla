// Mobil responsive denetim harness'i. Bir dizi sayfayi 3 cihaz viewport'unda
// (iPhone SE, iPhone 14 Pro, iPad) tam-sayfa yakalar. Kullanim:
//   node scripts/mobile-shots.mjs [tag]
// Ciktilar: scripts/_shots/mobile/<tag>/<slug>__<device>.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const tag = process.argv[2] || 'before'
const base = process.argv[3] || 'http://localhost:5188/'
const outDir = `scripts/_shots/mobile/${tag}`
mkdirSync(outDir, { recursive: true })

const DEVICES = [
  { name: 'iphoneSE', w: 375, h: 667 },
  { name: 'iphone14pro', w: 393, h: 852 },
  { name: 'ipad', w: 820, h: 1180 },
]

// Misafir gorunumlu sayfalar (auth gerektirmez). Profil/sepet auth ister -> ayri ele alinacak.
const SLUGS = process.argv[4]
  ? process.argv[4].split(',')
  : [
      '', // lobi / ana sayfa
      'uyelik',
      'online-turnuvalar',
      'lider-tablosu',
      'turnuva-takvimi',
      'kulupler',
      'haberler',
      'tavla-magazin',
      'pozisyon-analizi',
      'bilgi',
      'tek-oyun',
      'yeni-oyun',
      'yz-ile-oyna',
      'arkadasinla-oyna',
    ]

const TOKEN = process.env.TOKEN || ''
const browser = await chromium.launch()
for (const dev of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: dev.w, height: dev.h },
    deviceScaleFactor: 2,
    isMobile: dev.name !== 'ipad',
    hasTouch: true,
  })
  if (TOKEN) {
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('tavla.token', t)
      } catch {}
    }, TOKEN)
  }
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('PAGEERR', dev.name, e.message))
  try {
    await page.goto(base, { waitUntil: 'load', timeout: 60000 })
  } catch (e) {
    console.error('goto err', dev.name, e.message)
  }
  await page.waitForTimeout(3500)
  for (const slug of SLUGS) {
    try {
      await page.evaluate((s) => {
        history.pushState(null, '', '/' + s)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }, slug)
      await page.waitForTimeout(1200)
      // Ic-scroll konteynerini (.app.lobby) ac ki fullPage TUM icerigi yakalasin.
      // Tasma olcumu bundan ONCE yapilir (gercek layout genisligi).
      const overflow = await page.evaluate(() => {
        const de = document.documentElement
        return { scrollW: de.scrollWidth, clientW: de.clientWidth }
      })
      await page.addStyleTag({
        content:
          '.app.lobby,.app{height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important}' +
          'html,body{height:auto!important;overflow:visible!important}',
      })
      await page.waitForTimeout(250)
      const label = slug || 'home'
      const of = overflow.scrollW > overflow.clientW + 1 ? ` OVERFLOW(+${overflow.scrollW - overflow.clientW}px)` : ''
      console.log(`${dev.name.padEnd(12)} ${label.padEnd(22)} ${overflow.scrollW}x / ${overflow.clientW}c${of}`)
      await page.screenshot({ path: `${outDir}/${label}__${dev.name}.png`, fullPage: true })
      // Enjekte capture-CSS'i kaldir (sonraki slug'in tasma olcumu bozulmasin).
      await page.evaluate(() => document.querySelectorAll('style').forEach((s) => { if (s.textContent && s.textContent.includes('height:auto!important')) s.remove() }))
    } catch (e) {
      console.error('slug err', dev.name, slug, e.message)
    }
  }
  await ctx.close()
}
await browser.close()
console.log('DONE ->', outDir)
