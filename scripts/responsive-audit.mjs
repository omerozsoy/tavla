// Responsive / mobil-tablet-desktop UI denetim aracı.
// Tüm public route'ları çeşitli viewport'larda gezer; yatay taşma (horizontal overflow),
// taşan DOM elemanlarını, küçük dokunma hedeflerini ve console hatalarını tespit eder.
// Kullanım:  node scripts/responsive-audit.mjs [--full] [--shot] [--base http://localhost:5199]
//   --full : genişletilmiş viewport listesi (varsayılan: çekirdek set)
//   --shot : 390/768/1440 genişliklerinde ekran görüntüsü al (.shots/audit/)
// Çıktı: konsol özeti + .shots/audit/audit-report.json
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', '.shots', 'audit')
mkdirSync(OUT, { recursive: true })

const args = process.argv.slice(2)
const FULL = args.includes('--full')
const SHOT = args.includes('--shot')
const baseIdx = args.indexOf('--base')
const BASE = baseIdx >= 0 ? args[baseIdx + 1] : 'http://localhost:5199'
const tokIdx = args.indexOf('--token')
const TOKEN = tokIdx >= 0 ? args[tokIdx + 1] : null

// Public, auth gerektirmeyen (ya da gate'te home'a düşen) route'lar. Slug = pages.ts.
const ROUTES = [
  { slug: '', name: 'lobby' },
  { slug: 'lider-tablosu', name: 'leaderboard' },
  { slug: 'online-turnuvalar', name: 'tournaments' },
  { slug: 'sans-carki', name: 'lucky-wheel' },
  { slug: 'zar-slotu', name: 'dice-slot' },
  { slug: 'bahane-makinesi', name: 'excuses' },
  { slug: 'turnuva-takvimi', name: 'calendar' },
  { slug: 'kulupler', name: 'clubs' },
  { slug: 'haberler', name: 'news' },
  { slug: 'tavla-magazin', name: 'magazine' },
  { slug: 'urunler', name: 'products' },
  { slug: 'pozisyon-analizi', name: 'position-analyzer' },
  { slug: 'mat-analiz', name: 'mat-analyzer' },
  { slug: 'hata-gunlugu', name: 'blunders' },
  { slug: 'mac-analizleri', name: 'match-history' },
  { slug: 'uyelik', name: 'membership' },
  { slug: 'magaza', name: 'shop' },
  { slug: 'sepet', name: 'cart' },
  { slug: 'bilgi/hakkinda', name: 'info-about' },
  { slug: 'bilgi/hizmetler', name: 'info-services' },
  { slug: 'bilgi/rutbeler', name: 'info-ranks' },
  { slug: 'bilgi/puanlama', name: 'info-scoring' },
  { slug: 'bilgi/basarilarim', name: 'info-badges' },
  { slug: 'bilgi/adil-zar', name: 'info-fair' },
  { slug: 'tek-oyun', name: 'solo-setup' },
  { slug: 'yeni-oyun', name: 'match-setup' },
  { slug: 'yz-ile-oyna', name: 'ai-setup' },
  { slug: 'arkadasinla-oyna', name: 'friend-setup' },
]

const CORE_VP = [
  { w: 320, h: 568, label: '320-iphone-se' },
  { w: 360, h: 800, label: '360-android' },
  { w: 390, h: 844, label: '390-iphone' },
  { w: 430, h: 932, label: '430-iphone-max' },
  { w: 768, h: 1024, label: '768-ipad' },
  { w: 820, h: 1180, label: '820-ipad-air' },
  { w: 1024, h: 1366, label: '1024-ipad-pro' },
  { w: 844, h: 390, label: '844-landscape' },
  { w: 1024, h: 768, label: '1024-landscape' },
  { w: 1366, h: 768, label: '1366-desktop' },
  { w: 1440, h: 900, label: '1440-desktop' },
  { w: 1920, h: 1080, label: '1920-desktop' },
]
const FULL_VP = [
  ...CORE_VP,
  { w: 375, h: 667, label: '375-iphone-8' },
  { w: 393, h: 852, label: '393-pixel' },
  { w: 412, h: 915, label: '412-android-l' },
  { w: 667, h: 375, label: '667-landscape' },
  { w: 915, h: 412, label: '915-landscape' },
  { w: 1280, h: 720, label: '1280-desktop' },
]
const VIEWPORTS = FULL ? FULL_VP : CORE_VP

// Sayfada yatay taşmaya sebep olan elemanları bulur + küçük dokunma hedeflerini sayar.
function scanPage() {
  const docW = document.documentElement.scrollWidth
  const winW = window.innerWidth
  const overflow = docW - winW
  const offenders = []
  if (overflow > 1) {
    const all = document.querySelectorAll('body *')
    for (const el of all) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      // Sağ kenarı viewport'u aşan VEYA sola taşan elemanlar
      const overRight = r.right > winW + 1
      const overLeft = r.left < -1
      if (!overRight && !overLeft) continue
      // Yalnızca "yaprak" suçluları: çocukları da taşmıyorsa bu eleman kaynaktır
      let childOverflows = false
      for (const c of el.children) {
        const cr = c.getBoundingClientRect()
        if (cr.right > winW + 1 || cr.left < -1) { childOverflows = true; break }
      }
      if (childOverflows) continue
      const cls = typeof el.className === 'string' ? el.className : ''
      offenders.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || '',
        cls: cls.slice(0, 120),
        right: Math.round(r.right),
        left: Math.round(r.left),
        w: Math.round(r.width),
      })
    }
  }
  // Küçük dokunma hedefleri (yalnızca dar/mobil viewport'ta anlamlı) — buton/link/input
  const tapables = document.querySelectorAll('button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], .tab, [role="tab"]')
  const smallTaps = []
  for (const el of tapables) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    // Görünür mü?
    const st = getComputedStyle(el)
    if (st.visibility === 'hidden' || st.display === 'none' || st.pointerEvents === 'none') continue
    if (r.height < 32 || r.width < 24) {
      const cls = typeof el.className === 'string' ? el.className : ''
      smallTaps.push({ tag: el.tagName.toLowerCase(), cls: cls.slice(0, 60), w: Math.round(r.width), h: Math.round(r.height) })
    }
  }
  // İçerik imzası: sayfanın gerçekten açılıp açılmadığını (lobi'ye düşme) tespit için
  const h = document.querySelector('h1, h2, .page-title, .overlay-title, [data-slot="dialog-title"]')
  const heading = (h?.textContent || '').trim().slice(0, 60)
  const bodyTextLen = (document.body.innerText || '').length
  const dialogOpen = !!document.querySelector('[role="dialog"], .modal, .overlay')
  return { docW, winW, overflow, offenders: offenders.slice(0, 12), smallTapCount: smallTaps.length, smallTaps: smallTaps.slice(0, 8), heading, bodyTextLen, dialogOpen }
}

const report = []
const browser = await chromium.launch()
console.log(`Base: ${BASE} | viewports: ${VIEWPORTS.length} | routes: ${ROUTES.length} | shot: ${SHOT}`)

for (const route of ROUTES) {
  const url = `${BASE}/${route.slug}`
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 1,
      isMobile: vp.w < 820,
      hasTouch: vp.w < 1024,
    })
    if (TOKEN) {
      await ctx.addInitScript((t) => { try { localStorage.setItem('tavla.token', t) } catch {} }, TOKEN)
    }
    const page = await ctx.newPage()
    const consoleErrors = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + String(e).slice(0, 200)))
    let scan = null
    let navErr = null
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(1500) // overlay animasyon + ilk render + lazy chunk
      scan = await page.evaluate(scanPage)
      if (SHOT && (vp.w === 390 || vp.w === 768 || vp.w === 1440)) {
        await page.screenshot({ path: join(OUT, `${route.name}_${vp.w}.png`), fullPage: false })
      }
    } catch (e) {
      navErr = String(e).slice(0, 150)
    }
    const rec = {
      route: route.name, slug: route.slug, vp: vp.label, w: vp.w, h: vp.h,
      overflow: scan?.overflow ?? null,
      offenders: scan?.offenders ?? [],
      smallTapCount: scan?.smallTapCount ?? 0,
      smallTaps: scan?.smallTaps ?? [],
      heading: scan?.heading ?? '',
      bodyTextLen: scan?.bodyTextLen ?? 0,
      consoleErrors: consoleErrors.slice(0, 5),
      navErr,
    }
    report.push(rec)
    await ctx.close()
    // Kısa özet satırı (yalnızca sorunlu olanları göster)
    const flags = []
    if (rec.overflow && rec.overflow > 1) flags.push(`OVERFLOW +${rec.overflow}px`)
    if (rec.consoleErrors.length) flags.push(`ERR×${rec.consoleErrors.length}`)
    if (rec.navErr) flags.push('NAV-FAIL')
    if (flags.length) console.log(`  ⚠ ${route.name} @${vp.label}: ${flags.join(', ')}`)
  }
}

await browser.close()
writeFileSync(join(OUT, 'audit-report.json'), JSON.stringify(report, null, 2))

// ---- Özet ----
const overflows = report.filter((r) => r.overflow && r.overflow > 1)
const withErrors = report.filter((r) => r.consoleErrors.length)
const navFails = report.filter((r) => r.navErr)
console.log('\n===== ÖZET =====')
console.log(`Toplam test: ${report.length}`)
console.log(`Yatay taşma olan kombinasyon: ${overflows.length}`)
console.log(`Console hatası olan: ${withErrors.length}`)
console.log(`Navigasyon hatası: ${navFails.length}`)

// Route bazında en kötü taşma
const byRoute = {}
for (const r of overflows) {
  if (!byRoute[r.route] || r.overflow > byRoute[r.route].overflow) byRoute[r.route] = r
}
console.log('\n--- Route bazında maksimum taşma ---')
for (const [name, r] of Object.entries(byRoute).sort((a, b) => b[1].overflow - a[1].overflow)) {
  const off = r.offenders[0]
  console.log(`  ${name} @${r.vp}: +${r.overflow}px  <-  ${off ? `${off.tag}.${off.cls}` : '?'}`)
}

// En sık suçlu selektörler
const offCount = {}
for (const r of overflows) {
  for (const o of r.offenders) {
    const key = `${o.tag}.${o.cls.split(' ').filter(Boolean).slice(0, 2).join('.')}`
    offCount[key] = (offCount[key] || 0) + 1
  }
}
console.log('\n--- En sık taşan selektörler ---')
for (const [k, c] of Object.entries(offCount).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${c}×  ${k}`)
}
console.log(`\nRapor: ${join(OUT, 'audit-report.json')}`)
