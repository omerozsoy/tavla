import { defineConfig, devices } from '@playwright/test'

// OYUN AKIŞI E2E'leri (e2e/flows): API düzeyinde tam oyun/maç döngüleri + tarayıcı senkron
// kontrolleri. Sunucular ÖNCEDEN ayağa kaldırılır (uzun koşular için her seferinde yeniden
// başlatılmaz) ve ayrı e2e DB kullanılır:
//   cd backend && APP_ENV=e2e php artisan e2e:seed --users=8
//   cd backend && APP_ENV=e2e PHP_CLI_SERVER_WORKERS=6 php artisan serve --port=8000
//   VALIDATOR_PORT=8091 VALIDATOR_SECRET=e2esecret node validator/dist/server.mjs
//   (bot senaryoları için) GNUBG_PORT=8092 GNUBG_SECRET=<.env.e2e> gnubg -t -q -p gnubg-service/gnubg_service.py
//   npx playwright test -c playwright.flows.config.ts
// Tarayıcı senaryoları Vite dev'i (5199) gerektirir; PW_CHROMIUM ile yerel chromium yolu verilebilir.
export default defineConfig({
  testDir: './e2e/flows',
  timeout: 30 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    headless: true,
    trace: 'retain-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
