/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Surum TEK KAYNAK: package.json. Uygulamada __APP_VERSION__ ile okunur (elle yazilmaz).
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), tailwindcss()],
  server: {
    // Tek dev server garantisi: 5173 doluysa sessizce 5174'e KAYMA, hata ver.
    // Aksi halde her 'npm run dev' eskisini öldürmeden yeni server açar -> zombi vite birikir
    // -> commit/pagefile tükenir -> PhpStorm native-OOM ile kendini kapatır (2026-11-12 vakası).
    port: 5173,
    strictPort: true,
    // Yalnız DEV: giriş modülünü sunucu açılınca önceden derle -> ilk goto soğuk-derleme beklemesin
    // (E2E ilk navigasyon 45 sn timeout'u). Üretim build'ini etkilemez.
    warmup: { clientFiles: ['./src/main.tsx'] },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Admin yüklemeleri (hane resimleri vb.) — canlıda aynı köken; yerelde backend'den
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // Admin yüklemeleri (hane resimleri vb.) — canlıda aynı köken; yerelde backend'den
      '/uploads': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Eski Android System WebView (<Chrome 85) beyaz ekran fix: Vite 8 varsayilan hedefi
    // (baseline-widely-available ~Chrome 107) ??= ve ||= gibi sozdizimini bundle'da birakir,
    // guncellenmemis WebView parse edemeyip tum modul coker -> bos #root. es2019 hedefi
    // bu operatorleri eski sozdizimine indirger, eski cihazlarda site/uygulama acilir.
    // Uygulama canli siteyi yukledigi icin bu fix sadece dist deploy ister (yeni APK GEREKMEZ).
    target: 'es2019',
    // Vendor ayristirma: React + Radix UI gibi STATIK + nadir degisen kutuphaneleri ayri chunk'a
    // al -> ana app chunk kuculur + deploy'lar arasi vendor chunk hash'i sabit kalir (SW/tarayici
    // onbellegi korunur, her deploy'da 1MB yeniden inmez). onnxruntime/gsap/tsparticles ZATEN
    // dinamik import -> kendi lazy chunk'lari; burada DOKUNMA (undefined don = rollup varsayilani).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('onnxruntime') || id.includes('gsap') || id.includes('tsparticles')) return
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor'
          }
          if (id.includes('@radix-ui') || id.includes('radix-ui')) return 'ui-vendor'
        },
      },
    },
  },
  // onnxruntime-web'i esbuild on-paketlemesinden hariç tut: import.meta.url tabanli
  // wasm cozumlemesi bozulmasin (Vite native asset olarak servis etsin).
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  // Test yalnizca kendi kaynagimizi tarasin. Onceden config yoktu -> vitest tum
  // agaci (ornegin .chrome-cdp altindaki uzanti spec'leri) tariyordu ve patliyordu.
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'backend', '.chrome-cdp', '.shots'],
  },
})
