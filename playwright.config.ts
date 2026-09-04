import { defineConfig, devices } from '@playwright/test'

// Faz 2 sunucu-otoriter 2-istemci E2E harness'i. TÜM süreçleri (backend e2e + validator + vite)
// Playwright yönetir ve test bitince KAPATIR -> orphan/makine-kilidi riski en aza iner.
// AYRI test DB (.env.e2e -> database/e2e.sqlite); prod/dev verisine dokunmaz. globalSetup seed'ler.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  // NOT: DB seed'i MANUEL yapılır (APP_ENV=e2e php artisan e2e:seed) — backend serve sqlite'ı
  // açıkken migrate:fresh KİLİTLENEBİLİR. globalSetup bu yüzden devrede değil (seed dışarıda).
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Backend (e2e env -> ayrı sqlite + validator localhost + allow-list 1,2).
      command: 'php artisan serve --host=127.0.0.1 --port=8000',
      cwd: 'backend',
      env: { APP_ENV: 'e2e' },
      url: 'http://127.0.0.1:8000/api/live-matches',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // Node move-validator (istemci TS motoru); backend VALIDATOR_URL buraya bakar.
      command: 'node validator/dist/server.mjs',
      env: { VALIDATOR_PORT: '8091', VALIDATOR_SECRET: 'e2esecret' },
      url: 'http://127.0.0.1:8091/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      // Frontend (Vite dev; DEV modda API'yi localhost:8000'e yollar). Varsa mevcut server kullanılır.
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
