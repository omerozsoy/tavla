import { defineConfig, devices } from '@playwright/test'

// Hafif config: zar-görünürlük kanıtı (setContent; sunucu gerektirmez).
export default defineConfig({
  testDir: './e2e',
  testMatch: /dice-(visibility|live)\.spec\.ts/,
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: { headless: true, viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
