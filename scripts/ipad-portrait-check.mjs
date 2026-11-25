// iPad Pro 13" portrait (1024x1366) mobil-duzen dogrulama. WebKit (Safari motoru) ile
// canli siteyi acar, yatay tasma + mobil-duzen sinyallerini olcer, screenshot alir.
// Kullanim: node scripts/ipad-portrait-check.mjs [url]
import { webkit } from 'playwright'

const url = process.argv[2] || 'https://tavlatv.com/'
const W = parseInt(process.argv[3] || '1024', 10)
const H = parseInt(process.argv[4] || '1366', 10)
const browser = await webkit.launch()
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  isMobile: true,
  userAgent:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
const page = await ctx.newPage()
await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForTimeout(1200)

const m = await page.evaluate(() => {
  const de = document.documentElement
  const bar = document.querySelector('.account-bar')
  const hamb = document.querySelector('.hamburger, .side-menu-toggle, [aria-label*="menü" i], [aria-label*="menu" i]')
  const sideMenu = document.querySelector('.side-menu')
  const acctDesktop = document.querySelector('.acct-desktop')
  const vis = (el) => {
    if (!el) return null
    const s = getComputedStyle(el)
    return { display: s.display, visible: s.display !== 'none' && s.visibility !== 'hidden' }
  }
  return {
    pageHorizontalOverflow: de.scrollWidth - de.clientWidth, // >0 ise yatay scroll
    clientWidth: de.clientWidth,
    bar: bar ? { scrollOverflow: bar.scrollWidth - bar.clientWidth } : null,
    hamburgerVisible: hamb ? vis(hamb).visible : false,
    sideMenu: vis(sideMenu),
    acctDesktop: vis(acctDesktop), // mobilde GIZLI olmali
  }
})
console.log(JSON.stringify(m, null, 2))
await page.screenshot({ path: 'scripts/ipad-portrait.png', fullPage: false })
console.log('screenshot -> scripts/ipad-portrait.png')
await browser.close()
