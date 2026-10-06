// Additive deploy (prepare-deploy.mjs) backend/public/assets'i hic silmez -> eski hash'li
// bundle'lar birikir. Bu arac CANLI index.html'in referans kapanisinda OLMAYAN asset'leri budar.
//
// GUVENLIK: keep-set, index.html (+ demo html'ler) kokunden baslayip referans edilen her
// dosyada GECEN asset dosya-adlarini izleyerek (fixpoint, substring-icerme) hesaplanir.
// Konservatif: fazla tutmak zararsiz (daha az budama), eksik tutmak CANLIYI KIRAR. Build
// hash'leri YENIDEN URETILEMEDIGI icin (rolldown nondeterminizmi) rebuild'e GUVENILMEZ ->
// kapanis dogrudan canli dosyalardan cikarilir.
//
// Kullanim:
//   node scripts/prune-assets.mjs           # DRY-RUN: ne silinecek, kac dosya, ne kadar yer
//   node scripts/prune-assets.mjs --apply   # gercekten sil (git rm)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'

const PUB = 'backend/public'
const ASSETS = `${PUB}/assets`
const apply = process.argv.includes('--apply')

// Kapanis kokleri: canli giris + varsa demo html'ler (asset referanslayabilir).
const rootTexts = []
for (const f of ['index.html', 'checker-demo.html', 'dice-demo.html']) {
  try {
    rootTexts.push(readFileSync(`${PUB}/${f}`, 'utf8'))
  } catch {
    /* yok */
  }
}

// GUVENLIK MARJI: son RECENT_DEPLOYS deploy'un index.html'ini de kok yap -> yeni-deploy aninda
// hala onceki bundle'da olan (acik sekme) kullanicilarin lazy-chunk'lari KORUNUR (ChunkLoadError
// yerine normal yuklenir). Eski chunk'lar zaten diskte; sadece kapanisa dahil ederiz. Kadim
// deploy'lar yine budanir. 0 verirsen yalniz canli kapanis tutulur (maksimal budama).
const RECENT_DEPLOYS = 4
try {
  const hashes = execSync('git log -n 60 --format=%H -- backend/public/index.html', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
  const seenEntry = new Set()
  for (const h of hashes) {
    if (seenEntry.size >= RECENT_DEPLOYS) break
    let html
    try {
      html = execSync(`git show ${h}:backend/public/index.html`, { encoding: 'utf8' })
    } catch {
      continue
    }
    const entry = (html.match(/index-[A-Za-z0-9_-]+\.js/) || [])[0]
    if (!entry || seenEntry.has(entry)) continue
    seenEntry.add(entry)
    rootTexts.push(html)
  }
} catch {
  /* git yok -> yalniz canli kapanis (yine guvenli, sadece daha agresif budar) */
}

const allAssets = readdirSync(ASSETS).filter((f) => {
  try {
    return statSync(`${ASSETS}/${f}`).isFile()
  } catch {
    return false
  }
})

// BFS kapanis: her dosyayi BIR kez oku, icinden dosya-adi token'larini (Foo-hash.js, *.css,
// *.wasm, *.mjs) tek regex ile cikar, GERCEK asset'lerle kesistir -> referansli olanlari
// kuyruga ekle. O(toplam icerik). Genis regex (hash-sekli varsaymaz) -> eksik eslesme riski yok;
// gercek-asset kesisimi de yanlis-pozitifi eler.
const assetSet = new Set(allAssets)
// HER uzanti: js/css'ten resim(webp/png/svg), font(woff2/ttf), wasm, ses vb. hepsi referans
// olabilir -> genis regex + gercek-asset kesisimi (yanlis-pozitifi eler). Sadece js/css/wasm
// aramak kod-olmayan asset'leri YANLISLIKLA SILER.
const FILE_RE = /[A-Za-z0-9._-]+\.[A-Za-z0-9]{2,6}/g
const refsIn = (content) => content.match(FILE_RE) || []
// Yalniz metin asset'leri (js/mjs/css) baska asset'e isaret eder -> sadece onlari tekrar tara.
// Binary'leri (wasm, resim, font) utf8 okuyup taramak anlamsiz (yaprak dugum).
const TEXT_EXT = new Set(['js', 'mjs', 'css'])

const keep = new Set()
const queue = []
const enqueue = (name) => {
  if (!assetSet.has(name) || keep.has(name)) return
  keep.add(name)
  if (TEXT_EXT.has(name.split('.').pop())) queue.push(name)
}
for (const t of rootTexts) for (const r of refsIn(t)) enqueue(r)
while (queue.length) {
  const name = queue.shift()
  for (const r of refsIn(readFileSync(`${ASSETS}/${name}`, 'utf8'))) enqueue(r)
}

const toDelete = allAssets.filter((f) => !keep.has(f))
const size = (f) => {
  try {
    return statSync(`${ASSETS}/${f}`).size
  } catch {
    return 0
  }
}
const mb = (b) => (b / 1024 / 1024).toFixed(1)
const freed = toDelete.reduce((s, f) => s + size(f), 0)

console.log(`Toplam asset: ${allAssets.length}`)
console.log(`Tutulacak (canli kapanis): ${keep.size}`)
console.log(`Silinecek (eski/referanssiz): ${toDelete.length}  (~${mb(freed)} MB)`)

if (toDelete.length === 0) {
  console.log('Budanacak bir sey yok.')
  process.exit(0)
}

if (!apply || process.argv.includes('--list')) {
  const byExt = {}
  for (const f of keep) {
    const e = f.split('.').pop()
    ;(byExt[e] ||= []).push(f)
  }
  console.log('\nTUTULACAK kapanis (' + keep.size + '):')
  for (const e of Object.keys(byExt).sort())
    console.log(`  .${e} (${byExt[e].length}): ${byExt[e].sort().join(', ')}`)
}

if (!apply) {
  console.log('\n(DRY-RUN) Ornek silinecekler:')
  for (const f of toDelete.slice(0, 15)) console.log('  -', f)
  if (toDelete.length > 15) console.log(`  ... +${toDelete.length - 15} daha`)
  console.log('\nGercekten silmek icin: node scripts/prune-assets.mjs --apply')
  process.exit(0)
}

// git rm (tracked'lari indeksten + diskten kaldir). Argumanlari parti parti ver (komut satiri siniri).
for (let i = 0; i < toDelete.length; i += 100) {
  const batch = toDelete.slice(i, i + 100).map((f) => `"${ASSETS}/${f}"`)
  execSync(`git rm ${batch.join(' ')}`, { stdio: 'inherit' })
}
console.log(`\n✓ ${toDelete.length} eski asset git rm edildi (~${mb(freed)} MB). Simdi commit + push.`)
