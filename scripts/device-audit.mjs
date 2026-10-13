// Cihaz-matrisli OYUN EKRANI + lobi tasarim denetimi (Playwright, gercek cihaz viewport'lari).
// responsive-audit.mjs public sayfalari tarar; bu arac ASIL hata yuvasi olan OYUN EKRANINI
// (board + HUD: menu, mac ID, saat, butonlar) tum cihazlarda — hem dikey hem YATAY — denetler.
//
// Nasil calisir: token ile giris yapar, TEK bir YZ (bot) maci baslatir; oyuncu hamle yapmadigi
// icin board kendi sirasinda askida kalir (saat isler ama oyun bitmez) -> her cihaz viewport'una
// setViewportSize ile gecip ekran goruntusu + yatay-tasma/cakisma taramasi alir. Tek maç kaydi.
//
// Kullanim:
//   node scripts/device-audit.mjs --base https://www.tavlatv.com --token "<id>|<plain>"
//   node scripts/device-audit.mjs --base http://localhost:5199 --token "..." --level 12
// Cikti: .shots/device-audit/<cihaz>_<yon>_<ekran>.png + device-audit-report.json
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', '.shots', 'device-audit')
mkdirSync(OUT, { recursive: true })

const args = process.argv.slice(2)
const argVal = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d }
const BASE = argVal('--base', 'https://www.tavlatv.com')
const TOKEN = argVal('--token')
const LEVEL = argVal('--level') // opsiyonel: bot seviyesi (varsayilan UI'daki secili)

// Gercek cihazlarin CSS viewport boyutlari (dikey). Yatay = w/h ters. Medya sorgularini
// (asil tasarim kirilimlari) birebir tetikler; DPR/UA layout tasmasi icin gerekli degil.
const DEVICES = [
  { name: 'iPhone-SE', w: 375, h: 667 },
  { name: 'iPhone-XR-11', w: 414, h: 896 },
  { name: 'iPhone-14-15-16', w: 390, h: 844 },
  { name: 'iPhone-17-Pro', w: 393, h: 852 },
  { name: 'iPhone-14-15-Plus', w: 428, h: 926 },
  { name: 'iPhone-16-17-Pro-Max', w: 440, h: 956 },
  { name: 'Galaxy-S10', w: 360, h: 760 },
  { name: 'Galaxy-Note9', w: 414, h: 846 },
  { name: 'Galaxy-S25', w: 384, h: 854 },
  { name: 'Galaxy-S25-Ultra', w: 412, h: 915 },
  { name: 'iPad-Mini-6', w: 744, h: 1133 },
  { name: 'iPad-10-11', w: 820, h: 1180 },
  { name: 'iPad-Pro-11-M4', w: 834, h: 1194 },
  { name: 'Galaxy-Tab-S9', w: 800, h: 1280 },
]

// Sayfa icinde: yatay tasma suclulari + cakisan/ustuste binen sabit HUD ogeleri + kucuk dokunma.
function scan() {
  const winW = window.innerWidth
  const winH = window.innerHeight
  const docW = document.documentElement.scrollWidth
  const overflow = docW - winW
  const offenders = []
  if (overflow > 1) {
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (!(r.right > winW + 1 || r.left < -1)) continue
      let childOver = false
      for (const c of el.children) {
        const cr = c.getBoundingClientRect()
        if (cr.right > winW + 1 || cr.left < -1) { childOver = true; break }
      }
      if (childOver) continue
      const cls = typeof el.className === 'string' ? el.className : ''
      offenders.push({ tag: el.tagName.toLowerCase(), cls: cls.slice(0, 80), right: Math.round(r.right), w: Math.round(r.width) })
    }
  }
  // HUD cakismasi: sabit/absolute oyun kontrolleri ust ustte mi? (menu, mac ID, saat, tam ekran, rotate ipucu)
  const hudSel = ['.game-ham', '.match-id-hud', '.fs-toggle', '.rotate-tip', '.clock-stack', '.viewers-float']
  const boxes = hudSel.map((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { s, x: r.left, y: r.top, r: r.right, b: r.bottom } : null }).filter(Boolean)
  const overlaps = []
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]
    const ix = Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x))
    const iy = Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y))
    if (ix > 2 && iy > 2) overlaps.push(`${a.s} ∩ ${b.s} (${Math.round(ix)}×${Math.round(iy)}px)`)
  }
  // Ekran disina tasan sabit HUD (viewport disi -> gorunmez/kirik)
  const offscreen = boxes.filter((b) => b.r > winW + 1 || b.x < -1 || b.b > winH + 1 || b.y < -1).map((b) => b.s)
  // Kucuk dokunma hedefleri
  let smallTaps = 0
  for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue
    const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden') continue
    if (r.height < 32 || r.width < 24) smallTaps++
  }
  // KIRPILAN/EKRAN-DISI ogeler: belge tasmasi OLMASA bile (overflow:hidden ebeveyn kirpar) yatayda
  // viewport disina tasan GORUNUR, anlamli (metin/resim/svg) yaprak ogeler. Logo/wordmark/nav
  // kirpilmasini yakalar (ornegin landscape telefonda ust-bar logosu). Gurultu icin filtre: metin
  // veya img/svg iceren, >12px, tam gizli olmayan ogeler.
  const clipped = []
  for (const el of document.querySelectorAll('header *, nav *, .account-bar *, .side-menu *, .hero *, .promo *, main > * , [class*="logo" i], [class*="brand" i], [class*="wordmark" i]')) {
    const r = el.getBoundingClientRect()
    if (r.width < 12 || r.height < 6) continue
    if (!(r.left < -2 || r.right > winW + 2)) continue
    const st = getComputedStyle(el)
    if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) continue
    const hasInk = (el.textContent || '').trim().length > 0 || el.querySelector('img,svg,use') || /img|svg/.test(el.tagName.toLowerCase())
    if (!hasInk) continue
    // yaprak-benzeri: cocuklari da ayni yonde tasmiyorsa bu eleman kaynak
    let childClip = false
    for (const c of el.children) { const cr = c.getBoundingClientRect(); if (cr.left < -2 || cr.right > winW + 2) { childClip = true; break } }
    if (childClip) continue
    const cls = typeof el.className === 'string' ? el.className : ''
    clipped.push({ tag: el.tagName.toLowerCase(), cls: cls.slice(0, 50), left: Math.round(r.left), right: Math.round(r.right) })
    if (clipped.length >= 8) break
  }
  return { winW, winH, overflow, offenders: offenders.slice(0, 10), overlaps, offscreen, smallTaps, clipped }
}

const report = []
const browser = await chromium.launch()
console.log(`Base: ${BASE} | cihaz: ${DEVICES.length} | token: ${TOKEN ? 'var' : 'YOK'}`)

// --- TEK oyun baslat (ilk cihazda), sonra her cihazda viewport degistirip screenshot ---
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
if (TOKEN) await ctx.addInitScript((t) => { try { localStorage.setItem('tavla.token', t) } catch {} }, TOKEN)
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)) })
page.on('pageerror', (e) => consoleErrors.push('PAGEERR:' + String(e).slice(0, 160)))

async function shoot(label, device) {
  await page.waitForTimeout(500)
  const s = await page.evaluate(scan)
  const file = `${device.name}_${s.winW}x${s.winH}_${label}.png`
  await page.screenshot({ path: join(OUT, file), fullPage: false })
  const flags = []
  if (s.overflow > 1) flags.push(`OVERFLOW +${s.overflow}px`)
  if (s.overlaps.length) flags.push(`OVERLAP: ${s.overlaps.join('; ')}`)
  if (s.offscreen.length) flags.push(`OFFSCREEN-HUD: ${s.offscreen.join(',')}`)
  if (s.clipped?.length) flags.push(`CLIP: ${s.clipped.map((c) => `${c.tag}.${c.cls.split(' ')[0]}`).join(', ')}`)
  if (s.smallTaps) flags.push(`smallTaps×${s.smallTaps}`)
  report.push({ device: device.name, screen: label, ...s, file })
  if (flags.length) console.log(`  ⚠ ${device.name} ${label} ${s.winW}x${s.winH}: ${flags.join(' | ')}`)
  else console.log(`  ✓ ${device.name} ${label} ${s.winW}x${s.winH}`)
}

// Lobi (tum cihazlarda, dikey)
console.log('\n== LOBI ==')
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForTimeout(2000)
for (const d of DEVICES) {
  await page.setViewportSize({ width: d.w, height: d.h }); await shoot('lobby-portrait', d)
  await page.setViewportSize({ width: d.h, height: d.w }); await shoot('lobby-landscape', d)
}

// Oyun ekrani: TEK YZ maci baslat
console.log('\n== OYUN EKRANI ==')
let gameOk = false
try {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(`${BASE}/yz-ile-oyna`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForSelector('.setup-page', { timeout: 20000 })
  if (LEVEL) { // seviye chip'i (varsa)
    const chip = page.locator(`.level-chip`).filter({ hasText: new RegExp(`\\b${LEVEL}\\b`) }).first()
    if (await chip.isVisible().catch(() => false)) await chip.click().catch(() => {})
  }
  // Baslat = setup-actions'taki son buton (ilki Iptal)
  await page.locator('.setup-actions button').last().click()
  await page.waitForSelector('.board', { timeout: 30000 })
  await page.waitForTimeout(2500) // acilis zari + HUD yerlesimi
  gameOk = true
} catch (e) {
  console.log(`  ✗ oyun baslatilamadi: ${String(e).slice(0, 160)}`)
}
if (gameOk) {
  for (const d of DEVICES) {
    await page.setViewportSize({ width: d.w, height: d.h }); await shoot('game-portrait', d)
    await page.setViewportSize({ width: d.h, height: d.w }); await shoot('game-landscape', d)
  }
}

await ctx.close()
await browser.close()
writeFileSync(join(OUT, 'device-audit-report.json'), JSON.stringify({ base: BASE, consoleErrors: consoleErrors.slice(0, 20), report }, null, 2))

// ---- Ozet ----
const over = report.filter((r) => r.overflow > 1)
const ovl = report.filter((r) => r.overlaps.length)
const off = report.filter((r) => r.offscreen.length)
const clp = report.filter((r) => r.clipped?.length)
console.log('\n===== OZET =====')
console.log(`Ekran goruntusu: ${report.length} | Yatay tasma: ${over.length} | HUD cakisma: ${ovl.length} | HUD ekran-disi: ${off.length} | KIRPILAN oge: ${clp.length}`)
console.log(`Console hatasi (benzersiz ilk 20): ${consoleErrors.length}`)
for (const r of ovl) console.log(`  CAKISMA ${r.device} ${r.screen}: ${r.overlaps.join('; ')}`)
for (const r of off) console.log(`  EKRAN-DISI ${r.device} ${r.screen}: ${r.offscreen.join(',')}`)
for (const r of clp) console.log(`  KIRPIK ${r.device} ${r.screen}: ${r.clipped.map((c) => `${c.tag}.${c.cls.split(' ')[0]}(l${c.left}/r${c.right})`).join(', ')}`)
console.log(`\nGoruntuler + rapor: ${OUT}`)
