// Veri-yoğun sayfalar için "içerik yüklenene kadar bekle" + tara + ekran görüntüsü.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const T = process.env.AUDIT_TOKEN || ''
const BASE = process.env.AUDIT_BASE || 'http://localhost:4183'
const OUT = '.shots/audit/deep'
mkdirSync(OUT, { recursive: true })
const ROUTES = [
  'lider-tablosu','online-turnuvalar','kulupler','haberler','tavla-magazin','urunler',
  'mac-analizleri','magaza','mesajlar','siparislerim','hata-gunlugu','turnuva-takvimi',
]
const VPS = [{w:320,h:640,l:'320'},{w:390,h:844,l:'390'},{w:768,h:1024,l:'768'}]
function scan(){
  const dW=document.documentElement.scrollWidth, wW=window.innerWidth
  const off=[]
  if(dW-wW>1){document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect(); if(!r.width||!r.height)return; if(r.right>wW+1||r.left<-1){let ch=false;for(const c of el.children){const cr=c.getBoundingClientRect();if(cr.right>wW+1||cr.left<-1){ch=true;break}} if(!ch){const cls=typeof el.className==='string'?el.className:'';off.push(`${el.tagName.toLowerCase()}.${cls.slice(0,50)} [w${Math.round(r.width)} r${Math.round(r.right)}]`)}}})}
  return {ovf:dW-wW, off:off.slice(0,6), len:(document.body.innerText||'').length}
}
const b=await chromium.launch()
for(const slug of ROUTES){
  for(const vp of VPS){
    const ctx=await b.newContext({viewport:{width:vp.w,height:vp.h}, isMobile:vp.w<820, hasTouch:true})
    if(T) await ctx.addInitScript(t=>{try{localStorage.setItem('tavla.token',t)}catch{}},T)
    const p=await ctx.newPage()
    const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,100)))
    await p.goto(`${BASE}/${slug}`,{waitUntil:'domcontentloaded'}).catch(()=>{})
    // "Yükleniyor" kaybolana kadar bekle (maks 8s)
    await p.waitForFunction(()=>{const t=document.body.innerText||'';return t.length>0 && !/Yükleniyor/.test(t)},{timeout:8000}).catch(()=>{})
    await p.waitForTimeout(700)
    const s=await p.evaluate(scan)
    const name=slug.replace(/\//g,'-')
    await p.screenshot({path:`${OUT}/${name}_${vp.l}.png`})
    const flag=s.ovf>1?`OVERFLOW +${s.ovf}`:''
    console.log(`${name.padEnd(20)} @${vp.l}  len=${String(s.len).padStart(5)} ${flag} ${s.off.length?('\n     '+s.off.join('\n     ')):''} ${errs.length?('ERR:'+errs[0]):''}`)
    await ctx.close()
  }
}
await b.close()
console.log('done')
