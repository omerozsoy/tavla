import { chromium } from 'playwright'
const b = await chromium.launch()
async function shot(url, file, w = 460) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 } })
  await p.goto(url, { waitUntil: 'networkidle' }).catch(() => {})
  await p.waitForTimeout(2800)
  // Çerez banner'ını kapat (üste binmesin)
  const accept = p.getByRole('button', { name: /Tümünü Kabul Et|Accept/i }).first()
  if (await accept.count()) await accept.click().catch(() => {})
  await p.waitForTimeout(400)
  const info = await p.evaluate(() => ({
    exists: !!document.querySelector('.prinfo'),
    cards: document.querySelectorAll('.prinfo-card').length,
    rows: document.querySelectorAll('.prinfo-row').length,
  }))
  console.log(file, JSON.stringify(info))
  const el = p.locator('.prinfo').first()
  if (await el.count()) await el.screenshot({ path: file })
  await p.close()
}
await shot('http://localhost:5173/bilgi/pr-nedir', 'pr-page-mobile.png', 460)
await shot('http://localhost:5173/bilgi/pr-nedir?lang=en', 'pr-page-en.png', 460)
await b.close()
