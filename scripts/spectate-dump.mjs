import { chromium } from 'playwright'
const code = process.argv[2] || 'J545B'
const browser = await chromium.launch()
const page = await (await browser.newContext()).newPage()
let done=false
page.on('response', async (r) => {
  if (done) return
  const u=r.url()
  if (u.includes(`/rooms/${code}`) && r.request().method()==='GET'){
    try{const j=await r.json(); const s=j.room&&j.room.state; if(j.room && !(s&&s.turnStart)){ done=true; console.log('BOZUK STATE:', JSON.stringify(s).slice(0,500)); console.log('status:', j.room.status) }}catch{}
  }
})
await page.goto(`https://tavlai.com/izle/${code}`, { waitUntil:'domcontentloaded', timeout:60000 })
await page.waitForTimeout(40000)
if(!done) console.log('bozuk state yakalanmadi')
await browser.close()
