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
    proxy: {
      '/api': {
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
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
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
