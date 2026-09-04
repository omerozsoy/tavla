// Sunucu-otoriter hamle doğrulama servisini (validator/server.ts) tek Node bundle'ına derler.
// TS motorunu (src/engine) inline eder + uzantıları çözer -> Plesk'te `node validator/dist/server.mjs`.
import { build } from 'esbuild'
import { copyFileSync, mkdirSync } from 'node:fs'

await build({
  entryPoints: ['validator/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'validator/dist/server.mjs',
  // onnxruntime-node NATIVE modul -> bundle EDILEMEZ; runtime'da node_modules'tan cozulur.
  // Sunucuda: validator/ (veya kok) icinde `npm i onnxruntime-node` sart (PR analizi icin).
  external: ['onnxruntime-node'],
  logLevel: 'info',
})

// PR modelleri (contact/race.onnx) bundle yanina kopyalanir -> analyzePr modelsDir() bulur.
// (MODELS_DIR env verilmezse validator/dist/models/ kullanilir.)
mkdirSync('validator/dist/models', { recursive: true })
for (const m of ['contact.onnx', 'race.onnx']) {
  copyFileSync(`public/models/${m}`, `validator/dist/models/${m}`)
}

// eslint-disable-next-line no-console
console.log('✓ validator bundled -> validator/dist/server.mjs (+ models/)')
