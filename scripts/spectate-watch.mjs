import { chromium } from 'playwright'
const code = process.argv[2] || 'J545B'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1200, height: 760 } })
const page = await ctx.newPage()
const log = []
page.on('response', async (r) => {
  const u = r.url()
  if (u.includes(`/rooms/${code}`) && r.request().method()==='GET') {
    let ts='?'; try{const j=await r.json(); ts = j.room? (!!(j.room.state&&j.room.state.turnStart)) : 'noRoom'}catch{ts='nojson'}
    log.push(`GET room status=${r.status()} turnStart=${ts}`)
  }
})
await page.goto(`https://tavlai.com/izle/${code}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
for (let i=0;i<40;i++){
  await page.waitForTimeout(1000)
  const black = await page.locator('.spectate-status').count().catch(()=>0)
  if (black) log.push(`>>> t=${i} SIYAH EKRAN`)
}
console.log(log.join('\n'))
await browser.close()
