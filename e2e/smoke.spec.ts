import { expect, test } from '@playwright/test'

// SMOKE: E2E harness bu ortamda çalışıyor mu? (Vite dev — backend gerekmez; app render eder.)
// Faz 2 authoritative 2-istemci E2E'sine geçmeden önce temeli kanıtlar.
test('app render oluyor (smoke)', async ({ page }) => {
  // 'load' harici kaynakları (font/analytics) da bekler; render kanıtı için DOM yeter.
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('#root')).toBeVisible()
  await expect(page).toHaveTitle(/Tavla/i)
})
