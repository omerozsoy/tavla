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
for (const item of ['index.html', 'favicon.svg', 'icons.svg', 'assets', 'models']) {
  const src = `dist/${item}`
  if (existsSync(src)) cpSync(src, `${dest}/${item}`, { recursive: true })
}

console.log('✓ Hazir. backend/ klasorunu Plesk\'e yukleyip document root = backend/public yap.')
