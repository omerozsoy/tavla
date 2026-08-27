/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Rive binary sahneleri (.riv) native asset olarak servis edilsin -> `import x from
  // './y.riv'` cozumlenmis URL doner (RiveLayer bunu useRive'a verir). Vite'in varsayilan
  // asset listesinde .riv yok; eklemezsek import "kaynak ayristirilamadi" hatasi verir.
  assetsInclude: ['**/*.riv'],
  build: {
    // .riv dosyalarini ASLA base64 data-URI olarak JS'e gomme. Kucuk olanlar (epic/legendary
    // <4KB) varsayilan inline esigine takilirdi; boylece hepsi gercek binary asset dosyasi
    // olarak yayinlanir (Rive runtime tutarli fetch eder + prepare-deploy dosyalari toplar).
    assetsInlineLimit: (file: string) => (file.endsWith('.riv') ? false : undefined),
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
