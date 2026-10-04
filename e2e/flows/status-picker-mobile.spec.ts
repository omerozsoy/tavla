import { expect, test, devices } from '@playwright/test'
import { call, users } from './helpers'

// KULLANICI ŞİKÂYETİ: mobilde kullanıcılar durumlarını "Müsait" yapamıyordu (masaüstünde oluyordu).
// Sebep: mobilde durum seçici hesap menüsünün İÇİNDE; seçenek listesi document.body'ye portal
// edildiği için seçeneğe dokunmak hesap menüsünün "dışarı tıklama" kapatıcısını tetikliyor, menü
// (ve seçici) seçim işlenmeden kapanıyordu. Vite (dev :5199 ya da PREVIEW_URL) + e2e backend gerekir.
const BASE = process.env.PREVIEW_URL || 'http://localhost:5199'
const U = users[6]

test('mobil: hesap menüsündeki durum seçiciden durum değiştirilebilir', async ({ browser, request }) => {
  await call(request, 'POST', '/me/presence-status', U.token, { status: 'busy' })
  const ctx = await browser.newContext({ ...devices['iPhone 13'] })
  await ctx.addInitScript((tok) => localStorage.setItem('tavla.token', tok), U.token)
  const page = await ctx.newPage()
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  const trigger = page.locator('.acct-trigger')
  await expect(trigger).toBeVisible({ timeout: 30_000 })
  await trigger.tap()
  await page.locator('.acct-pop .status-cur').tap()
  const sent = page.waitForRequest((r) => r.url().includes('/me/presence-status') && r.method() === 'POST', { timeout: 8_000 })
  await page.locator('.status-menu .status-opt').first().tap() // "Müsait"
  await sent
  await expect.poll(async () => (await call(request, 'POST', '/ping', U.token)).body?.status, { timeout: 10_000 }).toBe('available')
  // Menünün dışına dokunmak hesap menüsünü hâlâ kapatmalı.
  await expect(page.locator('.acct-pop')).toBeVisible()
  await page.mouse.click(20, 400)
  await expect(page.locator('.acct-pop')).toBeHidden()
  await ctx.close()
})
