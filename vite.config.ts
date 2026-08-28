/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
