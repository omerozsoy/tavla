import { chromium } from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } })
await p.goto('https://tavlatv.com/magaza', { waitUntil: 'networkidle' }).catch(()=>{})
await p.waitForTimeout(3500)
const info = await p.evaluate(() => {
  const img = document.querySelector('.mgz-card-media img')
  if (!img) return { err: 'no img' }
  const media = img.closest('.mgz-card-media')
  return {
    imgClient: img.clientWidth + 'x' + img.clientHeight,
    mediaBox: Math.round(media.clientWidth)+'x'+Math.round(media.clientHeight),
    objectFit: getComputedStyle(img).objectFit,
    fits: img.clientHeight <= media.clientHeight + 1 && img.clientWidth <= media.clientWidth + 1,
  }
})
console.log(JSON.stringify(info))
const card = p.locator('.mgz-card').first()
if (await card.count()) await card.screenshot({ path: 'magaza-card.png' })
await b.close()
