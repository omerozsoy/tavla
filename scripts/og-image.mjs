// TavlaTv sosyal paylasim karti (Open Graph / Twitter) 1200x630 uretici.
// Marka rengi = tema kiremiti (#A83A2B, index.html theme-color ile ayni).
// Cikti: public/og-image.png (+ backend/public/og-image.png kopyasi build sonrasi).
import { chromium } from 'playwright'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'og-image.png')

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1200px; height:630px; }
  .card {
    width:1200px; height:630px; position:relative; overflow:hidden;
    background:
      radial-gradient(1200px 700px at 78% -10%, rgba(168,58,43,.55), transparent 60%),
      linear-gradient(135deg, #201612 0%, #2b1a14 45%, #1a110d 100%);
    color:#F3E9D6; font-family:'Outfit',system-ui,sans-serif;
    display:flex; flex-direction:column; justify-content:center;
    padding:78px 96px;
  }
  /* Alt kenarda tavla ucgen seridi (marka motifi) */
  .strip { position:absolute; left:0; right:0; bottom:0; height:120px; display:flex; }
  .strip i { flex:1; height:100%; }
  .strip i:nth-child(odd){ background:linear-gradient(to top, rgba(168,58,43,.9), rgba(168,58,43,0)); }
  .strip i:nth-child(even){ background:linear-gradient(to top, rgba(243,233,214,.28), rgba(243,233,214,0)); }
  .brand { font-family:'Playfair Display',serif; font-weight:800; font-size:118px; letter-spacing:-1px; line-height:1; }
  .brand b { color:#E4805E; font-weight:800; }
  .tag { font-size:52px; font-weight:600; margin-top:18px; color:#fff; }
  .sub { font-size:29px; font-weight:400; margin-top:20px; color:#D9C9AE; }
  .url { position:absolute; right:96px; bottom:150px; font-size:30px; font-weight:600; color:#E4805E; }
  .dot { display:inline-block; width:16px; height:16px; border-radius:50%; background:#E4805E; margin:0 14px 6px 0; }
</style></head>
<body>
  <div class="card">
    <div class="brand">Tavla<b>Tv</b></div>
    <div class="tag">Ücretsiz Online Tavla</div>
    <div class="sub"><span class="dot"></span>Arkadaşınla oyna · Yapay zekâya karşı yarış · Rating kazan</div>
    <div class="url">www.tavlatv.com</div>
    <div class="strip">${'<i></i>'.repeat(15)}</div>
  </div>
</body></html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle' })
await page.waitForTimeout(400) // font render
await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: 1200, height: 630 } })
await browser.close()
console.log('wrote', OUT)
