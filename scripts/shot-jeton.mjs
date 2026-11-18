import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 1100 } })
await p.goto('https://tavlatv.com/magaza', { waitUntil: 'networkidle' }).catch(()=>{})
await p.waitForTimeout(3500)
const info = await p.evaluate(() => {
  const jeton = document.querySelector('.mgz-jeton')
  const urunler = document.querySelector('#urunler')
  const cards = document.querySelectorAll('.mgz-jeton-card')
  const names = [...document.querySelectorAll('.mgz-jeton-name')].map(n => n.textContent)
  return {
    jetonExists: !!jeton,
    cardCount: cards.length,
    names,
    jetonTop: jeton ? Math.round(jeton.getBoundingClientRect().top + window.scrollY) : null,
    urunlerTop: urunler ? Math.round(urunler.getBoundingClientRect().top + window.scrollY) : null,
    jetonAboveProducts: jeton && urunler ? (jeton.getBoundingClientRect().top < urunler.getBoundingClientRect().top) : null,
  }
})
console.log(JSON.stringify(info, null, 2))
const sec = p.locator('.mgz-jeton').first()
if (await sec.count()) { await sec.scrollIntoViewIfNeeded(); await p.waitForTimeout(400); await sec.screenshot({ path: 'jeton-live.png' }) }
await b.close()
