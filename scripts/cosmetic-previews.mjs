// Admin "Avatar Tasarımı" / "Pul Tasarımı" listeleri için önizleme görselleri: sitedeki gerçek
// mağaza kartlarını (FrameShop / CheckerShop) Playwright ile tek tek fotoğraflar ->
// backend/public/admin-previews/{frame,checker}-<id>.png. Çerçeve/pul eklenince yeniden çalıştır.
// Gerekli: vite dev (VITE_URL, varsayılan http://127.0.0.1:5199) + e2e backend + giriş token'ı
// (backend/storage/app/e2e-users.json ilk kullanıcı ya da PREVIEW_TOKEN).
import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'

const base = process.env.VITE_URL || 'http://127.0.0.1:5199'
const token = process.env.PREVIEW_TOKEN || JSON.parse(readFileSync('backend/storage/app/e2e-users.json', 'utf8'))[0].token
const out = 'backend/public/admin-previews'
mkdirSync(out, { recursive: true })

const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })
await p.addInitScript((tok) => localStorage.setItem('tavla.token', tok), token)
// Kilitli kart soluk/gri çizilir; önizlemede gerçek görünüm + fiyat/rozet gizli.
const css = `.shop-anim.locked,.shop-anim.locked *{opacity:1!important;filter:none!important}
  .bp-price,.bp-selected,.shop-earn{display:none!important}`

async function openTab(re) {
  await p.goto(base + '/')
  await p.waitForTimeout(2500)
  await p.getByRole('button', { name: 'Tümünü Kabul Et' }).click().catch(() => {})
  await p.mouse.click(492, 43) // üst bar avatar -> hesap menüsü -> Profil
  await p.waitForTimeout(1200)
  await p.getByText(/^Profil/).first().click().catch(() => {})
  await p.waitForTimeout(1200)
  await p.getByText(re).first().click()
  await p.waitForTimeout(1500)
  await p.addStyleTag({ content: css })
}

let n = 0
await openTab(/Avatarlar/)
for (const el of await p.locator('[data-frame-id]').all()) {
  const id = await el.getAttribute('data-frame-id')
  await el.scrollIntoViewIfNeeded()
  await el.locator('.shop-anim-preview').screenshot({ path: `${out}/frame-${id}.png`, omitBackground: true })
  n++
}
await openTab(/Pul Tasarımları/)
for (const el of await p.locator('[data-checker-id]').all()) {
  const id = await el.getAttribute('data-checker-id')
  await el.scrollIntoViewIfNeeded()
  await el.screenshot({ path: `${out}/checker-${id}.png`, omitBackground: true })
  n++
}
console.log(`${n} preview images -> ${out}`)
await b.close()
