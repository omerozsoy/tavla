import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // onnxruntime-web'i esbuild on-paketlemesinden hariç tut: import.meta.url tabanli
  // wasm cozumlemesi bozulmasin (Vite native asset olarak servis etsin).
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
})
