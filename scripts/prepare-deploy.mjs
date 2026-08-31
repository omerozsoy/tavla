// React'i derleyip Laravel'in public/ klasorune kopyalar (tek-domain deploy).
// Laravel'in index.php ve .htaccess dosyalarina DOKUNMAZ.
// Kullanim: node scripts/prepare-deploy.mjs
import { cpSync, rmSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

console.log('1) React derleniyor…')
execSync('npm run build', { stdio: 'inherit' })

const dest = 'backend/public'
console.log('2) dist -> backend/public kopyalaniyor…')

// Eski frontend asset'lerini temizle (Laravel'e ait degil)
rmSync(`${dest}/assets`, { recursive: true, force: true })
rmSync(`${dest}/models`, { recursive: true, force: true })

// Sadece frontend ciktilarini kopyala (.htaccess ve index.php haric)
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
