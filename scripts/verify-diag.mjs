// APK kosulunu birebir taklit et: Capacitor WebView UA (INAPP=true) + CF beacon'i BLOKLA
// (yuklenmesin -> error olayi atesleensin). Sonra #appdiag overlay cikti mi + root doldu mu kontrol.
import { chromium } from 'playwright'

const CAP_UA =
  'Mozilla/5.0 (Linux; Android 16; 2602EPTC0G Build/BP2A.250605.031.A3; wv) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/156.0.8078.47 Mobile Safari/537.36'

const browser = await chromium.launch()
const ctx = await browser.newContext({ userAgent: CAP_UA, viewport: { width: 393, height: 852 } })
const p = await ctx.newPage()

// window.Capacitor enjekte et (INAPP tespiti UA + window.Capacitor'e bakiyor)
await p.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true } })

// CF beacon'i ABORT et -> gercek APK'daki "yuklenemedi" hatasini zorla
let beaconBlocked = 0
await p.route('**/*', (route) => {
  const u = route.request().url()
  if (u.includes('cloudflareinsights.com') || u.includes('beacon.min.js')) { beaconBlocked++; return route.abort() }
  return route.continue()
})

const logs = []
p.on('console', (m) => logs.push(m.text()))

await p.goto('https://tavlatv.com/', { waitUntil: 'load', timeout: 60000 })
// React mount + nobetci interval (1500ms) icin pay birak
await p.waitForTimeout(6000)

const res = await p.evaluate(() => {
  const root = document.getElementById('root')
  const diag = document.getElementById('__appdiag')
  return {
    rootChildren: root ? root.children.length : 'root YOK',
    diagVar: !!diag,
    diagText: diag ? diag.textContent.slice(0, 120) : null,
    hasLoadfail: !!document.getElementById('__loadfail'),
  }
})

console.log('beacon abort sayisi :', beaconBlocked)
console.log('#root cocuk          :', res.rootChildren)
console.log('__appdiag overlay var:', res.diagVar)
console.log('__loadfail var       :', res.hasLoadfail)
if (res.diagText) console.log('diag text            :', res.diagText)

const ok = beaconBlocked > 0 && res.rootChildren > 0 && !res.diagVar && !res.hasLoadfail
console.log('\nSONUC:', ok ? 'GECTI ✓ (beacon basarisiz ama teshis overlay YOK, app mount oldu)' : 'KALDI ✗')
await browser.close()
process.exit(ok ? 0 : 1)
