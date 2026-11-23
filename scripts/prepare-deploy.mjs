// React'i derleyip Laravel'in public/ klasorune kopyalar (tek-domain deploy).
// Laravel'in index.php ve .htaccess dosyalarina DOKUNMAZ.
// Kullanim: node scripts/prepare-deploy.mjs
import { cpSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'

// rolldown-vite .vite cache'i bazen DEGISEN kaynak modulu stale servis ediyor -> commit'lenen
// dist eski kod iceriyor, CI kaynaktan temiz derledigi icin YAKALAMAZ, canliya sessizce stale
// gider (2026-11-16: acilis dagitim degisikligi stale chunk'la deploy edildi). Build ONCESI cache'i
// temizle -> deploy her zaman guncel kaynagi yansitir. ponytail: ucuz, deploy-butunlugu icin sart.
console.log('0) vite cache temizleniyor (stale-modul deploy tuzagi onleme)…')
rmSync('node_modules/.vite', { recursive: true, force: true })
rmSync('node_modules/.vite-temp', { recursive: true, force: true })

console.log('1) React derleniyor…')
// Vite/rolldown büyük bundle'da V8 varsayılan heap'ini (~2-4GB) aşıp OOM (exit 134) veriyordu.
// ponytail: sabit 8GB heap, build daha da büyürse artır.
execSync('npm run build', {
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=8192`.trim() },
})

const dest = 'backend/public'
console.log('2) dist -> backend/public kopyalaniyor (ADDITIVE)…')

// ADDITIVE DEPLOY: eski hash'li asset'ler (assets/*, models/*) SILINMEZ. cpSync varsayilan
// force:true ile ayni isimdekileri (index.html vb.) uzerine yazar, YENI hash'li chunk'lari
// ekler, ESKI hash'li chunk'lari KORUR. Neden: deploy sonrasi sekmesi acik kullanicinin
// tarayicisi hala eski chunk'i (lazy import) ister; dosya dururse ChunkLoadError OLMAZ, "bir
// seyler ters gitti" flash + otomatik reload gerekmez. (Bkz ErrorBoundary chunk fix + memory
// ters-gitti-chunk-flash.) Bedeli: backend/public/assets zamanla buyur -> gerekince ELLE
// budanabilir (cok eski, artik referans edilmeyen hash'ler). rmSync KASITLI kaldirildi.

// Sadece frontend ciktilarini kopyala (.htaccess ve index.php haric); index.html DAIMA
// ustune yazilir (en guncel giris) — cpSync force:true.
for (const item of [
  'index.html',
  'favicon.svg',
  'icons.svg',
  'robots.txt',
  'sitemap.xml',
  'og-image.png', // sosyal paylasim karti (OG/Twitter)
  'manifest.webmanifest',
  'turkiye.svg', // kulüp rehberi haritası (statik)
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png', // iOS ana ekran ikonu (180x180)
  'tavlatv-logo.png', // marka logosu — acik tema (gri harf)
  'tavlatv-logo-dishi2.png', // marka logosu — koyu tema disi (beyaz harf, acik logoyla esit boyut)
  'takimlar-ligi-logo.png', // Takimlar Ligi sezon rozeti (TeamsView SeasonBanner)
  'iyzico-band.svg', // footer "iyzico ile Öde" kabul-kartı bandı
  'iyzico-band.png', // ^ raster yedek
  'pay-visa-mastercard.png', // footer ödeme rozeti: Visa + Mastercard
  'assets',
  'models',
  'fonts', // self-hosted Google Fonts woff2 (Spectral+Outfit); src/fonts.css -> /fonts/*.woff2
  'flags', // ulke bayraklari (circle-flags, CountryFlag -> /flags/xx.svg)
  'checker-demo.html', // animasyon demo (gecici)
  'dice-demo.html', // animasyon demo (gecici)
]) {
  const src = `dist/${item}`
  if (existsSync(src)) cpSync(src, `${dest}/${item}`, { recursive: true })
}

// 3) RETENTION: additive deploy orphan'lari sinirsiz birikiyordu (577 eski index-*.js, ~1.3GB
// git'e commit'li -> clone/CI sisiyordu). dist/assets = BU build'in TAM seti (emptyOutDir ile temiz).
// backend/public'te olup dist'te OLMAYAN = orphan. KRITIK: content-hash + additive'de degismeyen
// bir chunk HALA referansli olabilir -> ONLY dist'te-yok olani aday al (dist'tekine ASLA dokunma).
// Yas sinyali = GIT AUTHOR ZAMANI (%at). mtime DEGIL (git checkout tum dosyalara guncel mtime
// verir -> hep "yeni"). committer-time (%ct) de DEGIL: rebase onu bugune resetler -> tum chunk'lar
// yanlis "yeni" gorunur, hic budanmaz. author-date rebase'de KORUNUR = gercek build zamani.
// Grace penceresi: o tarihten once sekmesi acik kullanici hala eski lazy-chunk'i ister; daha
// eskisi silinince self-heal reload (index.html) ile kurtulur.
// 7 gun: bu repo cok sik deploy ediyor (~hafta icinde yuzlerce chunk) -> daha uzun grace boyutu
// hic sinirlamaz. Ana chunk eski-sekmede zaten bellekte (reload gerekmez); yalniz >7gun acik
// sekmenin yeni bir lazy-rotaya gitmesi (nadir) self-heal reload ile kurtulur.
const GRACE_DAYS = 7
const cutoffSec = Date.now() / 1000 - GRACE_DAYS * 86_400
console.log(`3) eski orphan asset'ler budaniyor (dist'te yok + git-author >${GRACE_DAYS}gun)…`)
// Tek git log gecisi: her yol -> onu EN SON ekleyen commit'in author unix zamani.
const lastCommit = {}
try {
  const log = execSync('git log --format=%at --name-only -- backend/public/assets backend/public/models', { encoding: 'utf8', maxBuffer: 1 << 28 })
  let t = 0
  for (const line of log.split('\n')) {
    if (/^\d+$/.test(line)) { t = +line; continue }
    if (line && lastCommit[line] === undefined) lastCommit[line] = t // ilk gorulen = en yeni commit
  }
} catch { /* git yoksa budama yapma (guvenli taraf) */ }
for (const dir of ['assets', 'models']) {
  const liveDir = `${dest}/${dir}`
  if (!existsSync(liveDir)) continue
  const current = existsSync(`dist/${dir}`) ? new Set(readdirSync(`dist/${dir}`)) : new Set()
  let pruned = 0
  let bytes = 0
  for (const name of readdirSync(liveDir)) {
    if (current.has(name)) continue // bu build'in cikti seti -> KORU
    const rel = `${dest}/${dir}/${name}`
    const committed = lastCommit[rel.replace(/\\/g, '/')]
    if (committed === undefined || committed > cutoffSec) continue // commit'siz ya da grace icinde -> KORU
    const p = `${liveDir}/${name}`
    const st = statSync(p)
    if (!st.isFile()) continue
    bytes += st.size
    rmSync(p, { force: true })
    pruned++
  }
  if (pruned) console.log(`   budandi ${dir}/: ${pruned} orphan, ${(bytes / 1_048_576).toFixed(0)}MB geri kazanildi`)
}

console.log('✓ Hazir. backend/ klasorunu Plesk\'e yukleyip document root = backend/public yap.')

// SIK HATA: derlenmis cikti backend/public'e kopyalanir ama COMMIT edilmezse canli
// site sessizce eski kalir (deploy.sh frontend build ETMEZ). Degisiklikleri goster +
// commit hatirlat ki bu tuzak fark edilsin.
try {
  const changed = execSync('git status --short backend/public', { encoding: 'utf8' }).trim()
  if (changed) {
    console.log('\n⚠ backend/public altinda commit BEKLEYEN degisiklikler var:')
    console.log(changed)
    console.log('\n→ Canliya almak icin: git add backend/public && git commit && git push')
    console.log('  (Plesk git pull + deploy.sh calisacak. Commit unutulursa site DEGISMEZ.)')
  } else {
    console.log('\nℹ backend/public degismedi (yeni derleme oncekiyle ayni ya da zaten commit\'li).')
  }
} catch {
  // git yoksa/uygun degilse sessiz gec — kopyalama zaten tamamlandi.
}
