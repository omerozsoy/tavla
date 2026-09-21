import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:8123'
const out = []
const log = (m) => { out.push(m); console.log(m) }

const browser = await chromium.launch()
try {
  // ---- DESKTOP ----
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const gaRequests = []
  page.on('request', (r) => {
    const u = r.url()
    if (/googletagmanager|google-analytics|connect\.facebook/.test(u)) gaRequests.push(u)
  })
  await page.goto(BASE, { waitUntil: 'networkidle' })

  const banner = page.locator('.cc-banner')
  await banner.waitFor({ timeout: 8000 })
  log('OK banner görünüyor: ' + (await page.locator('.cc-title').first().innerText()))
  await page.screenshot({ path: '/tmp/consent-desktop.png' })

  // Reddet (Yalnızca Zorunlular)
  await page.getByRole('button', { name: 'Yalnızca Zorunlular' }).first().click()
  await banner.waitFor({ state: 'hidden', timeout: 5000 })
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('tavla.cookieConsent')))
  log('OK kayıt: ' + JSON.stringify(rec))
  if (rec.necessary !== true || rec.analytics !== false || rec.marketing !== false) throw new Error('consent kaydı yanlış')
  if (typeof rec.consentVersion !== 'number' || !rec.updatedAt) throw new Error('version/updatedAt eksik')

  // Reload -> banner tekrar çıkmamalı
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  if (await page.locator('.cc-banner').count()) throw new Error('reload sonrası banner tekrar çıktı')
  log('OK reload sonrası banner çıkmıyor')

  // Analytics/marketing script YÜKLENMEMELİ (reddedildi + ID yok)
  if (gaRequests.length) throw new Error('reddedilmesine rağmen tracking isteği: ' + gaRequests.join(','))
  log('OK reddedilince analytics/marketing script yüklenmedi')

  // Footer "Çerez Tercihleri" -> tercih modalı
  await page.evaluate(() => window.dispatchEvent(new Event('tavla:cookie-prefs')))
  await page.locator('.cc-cats').waitFor({ timeout: 5000 })
  const cats = await page.locator('.cc-cat-name').allInnerTexts()
  log('OK tercih modalı kategoriler: ' + cats.join(' | '))
  if (cats.length !== 4) throw new Error('4 kategori beklenirdi')

  // Analitik aç + kaydet -> kayıt güncellenmeli
  await page.locator('.cc-cat', { hasText: 'Analitik' }).locator('.cc-slider').click()
  await page.getByRole('button', { name: 'Seçimlerimi Kaydet' }).click()
  await page.waitForTimeout(800)
  const rec2 = await page.evaluate(() => JSON.parse(localStorage.getItem('tavla.cookieConsent')))
  log('OK güncellenen kayıt: ' + JSON.stringify(rec2))
  if (rec2.analytics !== true) throw new Error('analitik kaydedilmedi')

  // Hukuki sayfa: /cerez-politikasi -> tablo görünmeli
  await page.goto(BASE + '/cerez-politikasi', { waitUntil: 'networkidle' })
  await page.locator('.info-title', { hasText: 'Çerez Politikası' }).waitFor({ timeout: 6000 })
  await page.locator('.cc-cookie-table').waitFor({ timeout: 6000 })
  const rows = await page.locator('.cc-cookie-table tbody tr').count()
  log('OK Çerez Politikası açıldı, tablo satır: ' + rows)
  if (rows < 1) throw new Error('çerez tablosu boş')
  await page.screenshot({ path: '/tmp/consent-legal.png' })

  // /kvkk deep-link
  await page.goto(BASE + '/kvkk', { waitUntil: 'networkidle' })
  await page.locator('.info-title', { hasText: 'Aydınlatma' }).waitFor({ timeout: 6000 })
  log('OK /kvkk deep-link açıldı, başlık: ' + (await page.locator('.info-title').first().innerText()))

  // ---- MOBILE ---- (temiz context -> banner tekrar)
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
  const mp = await m.newPage()
  await mp.goto(BASE, { waitUntil: 'networkidle' })
  await mp.locator('.cc-banner').waitFor({ timeout: 8000 })
  await mp.screenshot({ path: '/tmp/consent-mobile.png' })
  const bw = await mp.locator('.cc-banner-inner').boundingBox()
  log('OK mobil banner genişlik: ' + Math.round(bw.width) + 'px (viewport 390)')
  if (bw.width > 390) throw new Error('mobil banner taşıyor')

  log('\nTÜM KONTROLLER GEÇTİ ✅')
} catch (e) {
  log('\nHATA ❌ ' + e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
