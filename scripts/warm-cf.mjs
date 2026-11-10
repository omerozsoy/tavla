// Deploy sonrasi Cloudflare cache'ini "isitir": canli index.html'in referans ettigi
// YENI hash'li asset'leri bir kez fetch'ler -> CF onlari 200 olarak cache'ler.
//
// NEDEN: Forge zero-downtime symlink flip'i ile index.html yeni hash'e gecerken, o hash'li
// asset'i ilk isteyen (crawler/kullanici) origin-gap'inde 404 alabilir; CF bu gecici 404'u
// `Cache-Control: max-age=31536000` (immutable) ile 1 YIL cache'ler -> site "yuklenemedi"
// ekranina duser (giris chunk'i olu). Bu script deploy iner inmez asset'leri 200'le isitarak
// o yarisi KAZANIR -> gecici 404 hic cache'lenmez.
//
// AKIS: commit'li backend/public/index.html'den beklenen hash'leri oku -> canli index.html
// AYNI giris hash'ine gelene kadar bekle (= QD deploy indi) -> her asset'i fetch'le -> dogrula.
//
// ponytail: isitma = ONLEME (yarisi kazan), tedavi degil. 404 ZATEN cache'lenmisse CF purge
// sart (creds yok). Bulletproof istenirse: CF_API_TOKEN secret + bu asamada purge cagrisi ekle.

import { readFileSync } from 'node:fs'

const ORIGIN = process.env.WARM_ORIGIN ?? 'https://tavlatv.com'
const LOCAL_INDEX = 'backend/public/index.html'
const TIMEOUT_MS = 10 * 60 * 1000 // QD "oynak" gecikme: CI-yesilinden +2-5dk (bkz CLAUDE.md)
const POLL_MS = 15 * 1000

// Yalniz src="/assets/..." / href="/assets/..." attribute'larini al — index.html'deki inline
// yorum/glob (orn. "/assets/*.js yuklenemezse") gercek asset sanilmasin (CI false-404 bug'i).
const assetsOf = (html) => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const expected = assetsOf(readFileSync(LOCAL_INDEX, 'utf8'))
// Giris chunk'i (index-*.js) deploy'un indigini anlamanin en guvenilir isareti.
const entry = expected.find((a) => /\/assets\/index-[^/]+\.js$/.test(a))
if (!entry) {
  console.error(`✗ ${LOCAL_INDEX} icinde giris chunk'i (assets/index-*.js) bulunamadi — build bozuk?`)
  process.exit(1)
}
console.log(`Beklenen giris: ${entry}  (toplam ${expected.length} asset)`)

// 1) Deploy'un canliya inmesini bekle: canli index.html ayni giris hash'ini gostermeli.
const deadline = Date.now() + TIMEOUT_MS
let landed = false
while (Date.now() < deadline) {
  try {
    const live = await fetch(`${ORIGIN}/?_warm=${Date.now()}`, { cache: 'no-store' })
    const html = await live.text()
    if (html.includes(entry)) { landed = true; break }
    console.log(`… deploy henuz inmedi (canli giris hash farkli), ${POLL_MS / 1000}s sonra tekrar`)
  } catch (e) {
    console.log(`… canli index.html alinamadi (${e.message}), tekrar denenecek`)
  }
  await sleep(POLL_MS)
}
if (!landed) {
  console.error(`✗ ${TIMEOUT_MS / 60000}dk icinde deploy inmedi — isitma atlandi (QD/CI'yi kontrol et).`)
  process.exit(1)
}
console.log('✓ Deploy canli. Asset\'ler isitiliyor…')

// 2) Her asset'i fetch'le (normal istek -> gercek CF cache anahtarini 200'le doldurur).
//    200 gelmeyenler = zaten cache'lenmis stale 404 -> isitma yetmez, purge sart.
const warmAll = async () => {
  const stale = []
  for (const path of expected) {
    try {
      const res = await fetch(`${ORIGIN}${path}`)
      if (!res.ok) stale.push(path)
      console.log(`  ${res.ok ? '✓' : '✗'} ${res.status}  ${path}`)
    } catch (e) {
      stale.push(path)
      console.log(`  ✗ ERR  ${path}  (${e.message})`)
    }
  }
  return stale
}

let stale = await warmAll()

// 3) Stale 404 varsa ve CF creds mevcutsa, o URL'leri purge et -> bir kez daha isit.
//    Creds yoksa: onleme-modunda kal, stale'i hata olarak bildir (elle purge gerekir).
const { CF_API_TOKEN, CF_ZONE_ID } = process.env
if (stale.length && CF_API_TOKEN && CF_ZONE_ID) {
  const files = stale.map((p) => `${ORIGIN}${p}`)
  console.log(`\n${stale.length} stale asset -> CF purge ediliyor…`)
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }), // ponytail: <=30 dosya/cagri; asset sayisi hep altinda
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok || !body.success) {
    console.error(`✗ CF purge basarisiz (HTTP ${res.status}): ${JSON.stringify(body.errors ?? body)}`)
    process.exit(1)
  }
  console.log('✓ Purge kabul edildi, 5s sonra yeniden isitiliyor…')
  await sleep(5000)
  stale = await warmAll()
}

if (stale.length) {
  const why = CF_API_TOKEN && CF_ZONE_ID
    ? 'purge sonrasi hala 200 degil (origin gercekten eksik olabilir?)'
    : 'zaten cache\'lenmis 404 -> CF_API_TOKEN+CF_ZONE_ID secret\'lari ekle (oto-purge) ya da elle purge et'
  console.error(`\n✗ ${stale.length} asset 200 degil: ${why}`)
  process.exit(1)
}
console.log(`\n✓ ${expected.length} asset 200. CF immutable-404 tuzagi onlendi.`)
