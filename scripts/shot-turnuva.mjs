import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })
await p.goto('https://tavlatv.com/online-turnuvalar', { waitUntil: 'load' }).catch(() => {})
await p.waitForTimeout(4000)
const info = await p.evaluate(() => {
  const btn = document.querySelector('.tourn-more-btn')
  const past = document.querySelectorAll('.tourn-past .tcard').length
  return { hasBtn: !!btn, btnText: btn?.textContent?.trim() ?? null, pastShown: past }
})
console.log(JSON.stringify(info))
const btn = p.locator('.tourn-more-btn')
if (await btn.count()) {
  await btn.scrollIntoViewIfNeeded()
  await p.waitForTimeout(500)
  await p.screenshot({ path: 'turnuva-more-btn.png' })
} else {
  // buton yoksa (biten turnuva <=10) sayfanin sonunu goster
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await p.waitForTimeout(500)
  await p.screenshot({ path: 'turnuva-more-btn.png', fullPage: false })
}
await b.close()
