// src/boardThemes.ts yerleşik tahtalarını (+ avatar çerçeveleri, pul tasarımları) backend'e JSON olarak aktarır
// (Filament "Tavla Tasarımı" sayfası tüm tahtaları renk önizlemesiyle listeler).
// Kullanım: node scripts/export-board-themes.mjs  (boardThemes.ts değişince çalıştır;
// src/boardThemesExport.test.ts senkron olmayan JSON'u yakalar).
import { build } from 'esbuild'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

async function load(entry) {
  const out = join(mkdtempSync(join(tmpdir(), 'bt-')), 'm.mjs')
  await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent', loader: { '.webp': 'empty', '.png': 'empty', '.svg': 'empty', '.css': 'empty' } })
  return import(pathToFileURL(out).href)
}
const m = await load('src/boardThemes.ts')
const rows = m.ALL_THEMES.map((t, i) => ({
  id: t.id,
  name: t.name,
  group: m.boardRarityOf(t),
  free: m.FREE_BOARDS.has(t.id),
  sort: i,
  colors: { panel: t.panel, frame: t.frame ?? null, a: t.a, b: t.b, checker: t.checker, light: t.light ?? null },
  surface: t.surface ?? null,
  checker_style: t.checkerStyle ?? null,
}))
writeFileSync('backend/database/data/board_themes.json', JSON.stringify(rows, null, 1) + '\n')
console.log(`exported ${rows.length} board themes`)

// Avatar çerçeveleri + satılan pul tasarımları (admin "Avatar Tasarımı" / "Pul Tasarımı").
const fr = await load('src/ui/avatarFrames.ts')
const ck = await load('src/checkers.ts')
const items = [
  ...fr.AVATAR_FRAMES.filter((f) => !f.earned).map((f, i) => ({ kind: 'frame', id: f.id, name: f.name, group: f.rarity, sort: i, meta: { accent: f.accent } })),
  ...ck.CHECKER_FINISHES.map((c, i) => ({ kind: 'checker', id: c.id, name: c.name, group: c.rarity, sort: i, meta: { dark: c.dark, light: c.light, family: c.family } })),
]
writeFileSync('backend/database/data/cosmetics.json', JSON.stringify(items, null, 1) + '\n')
console.log(`exported ${items.length} cosmetics`)
