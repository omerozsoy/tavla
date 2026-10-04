import { expect, test } from '@playwright/test'
import { users } from './helpers'

// KULLANICI ŞİKÂYETİ: giriş yapmışken yazı sayfalarında (gizlilik politikası, makale, kurallar…)
// seçilen yazı 1-3 sn içinde kendiliğinden kayboluyordu. Kök sebep: React 19, her render'da yeni
// `dangerouslySetInnerHTML={{ __html }}` nesnesi görünce innerHTML'i karşılaştırmadan YENİDEN
// yazar; girişli kullanıcıda uygulama sık yeniden çizildiği için metin düğümleri sürekli yenileniyordu.
// Düzeltme: RawHtml (memo). NOT: yalnız PRODUCTION derlemesinde görülür (dev derlemesi farklı):
//   npx vite build --outDir /tmp/dist-prod && npx vite preview --outDir /tmp/dist-prod --port 4173
// + e2e backend (:8000). PREVIEW_URL ile başka adres verilebilir.
const BASE = process.env.PREVIEW_URL || 'http://localhost:4173'

test('girişli kullanıcı: yazı sayfasında seçilen metin kendiliğinden kaybolmaz (production derlemesi)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  await ctx.addInitScript((tok) => localStorage.setItem('tavla.token', tok), users[0].token)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/gizlilik-politikasi`, { waitUntil: 'commit' })
  await page.locator('.info-rich p').nth(1).waitFor({ timeout: 30_000 })
  for (let round = 0; round < 2; round++) {
    await page.waitForTimeout(1500)
    await page.evaluate(() => {
      const el = document.querySelectorAll('.info-rich p')[1]
      const r = document.createRange()
      r.selectNodeContents(el)
      const s = window.getSelection()!
      s.removeAllRanges()
      s.addRange(r)
    })
    for (let i = 0; i < 32; i++) {
      const len = await page.evaluate(() => (window.getSelection()?.toString() || '').length)
      expect(len, `seçim ${((i * 250) / 1000).toFixed(1)} sn sonra kayboldu (tur ${round + 1})`).toBeGreaterThan(0)
      await page.waitForTimeout(250)
    }
  }
  await ctx.close()
})
