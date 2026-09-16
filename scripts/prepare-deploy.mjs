// React'i derleyip Laravel'in public/ klasorune kopyalar (tek-domain deploy).
// Laravel'in index.php ve .htaccess dosyalarina DOKUNMAZ.
// Kullanim: node scripts/prepare-deploy.mjs
import { cpSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

console.log('1) React derleniyor…')
execSync('npm run build', { stdio: 'inherit' })

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
  'manifest.webmanifest',
  'turkiye.svg', // kulüp rehberi haritası (statik)
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  'assets',
  'models',
  'checker-demo.html', // animasyon demo (gecici)
  'dice-demo.html', // animasyon demo (gecici)
]) {
  const src = `dist/${item}`
  if (existsSync(src)) cpSync(src, `${dest}/${item}`, { recursive: true })
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
