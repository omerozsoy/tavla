// Sunucu-otoriter hamle doğrulama servisini (validator/server.ts) tek Node bundle'ına derler.
// TS motorunu (src/engine) inline eder + uzantıları çözer -> Plesk'te `node validator/dist/server.mjs`.
import { build } from 'esbuild'

await build({
  entryPoints: ['validator/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'validator/dist/server.mjs',
  logLevel: 'info',
})

// eslint-disable-next-line no-console
console.log('✓ validator bundled -> validator/dist/server.mjs')
