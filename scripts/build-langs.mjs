import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.cwd())
const I18N = path.join(ROOT, 'src', 'i18n.tsx')
const FRAG = path.join(ROOT, 'scripts', 'langfrag')
const TR = path.join(ROOT, '.claude-tool-results') // unused

const EL_JSON = process.argv[2]
const RU_JSON = process.argv[3]

function extractFromJson(file, marker) {
  const raw = fs.readFileSync(file, 'utf8')
  const arr = JSON.parse(raw)
  const text = arr.map((p) => p.text ?? '').join('')
  const start = text.indexOf(marker)
  if (start < 0) throw new Error(`marker not found in ${file}: ${marker}`)
  const end = text.lastIndexOf('}')
  return text.slice(start, end + 1)
}

const EL = extractFromJson(EL_JSON, 'const EL: Dict = {')
const RU = extractFromJson(RU_JSON, 'const RU: Dict = {')
const FA = fs.readFileSync(path.join(FRAG, 'fa.txt'), 'utf8').trim()

// sanity: count keys roughly by counting "': " occurrences
const count = (s) => (s.match(/':\s/g) || []).length
console.log('key counts →', 'EL', count(EL), 'RU', count(RU), 'FA', count(FA))

let src = fs.readFileSync(I18N, 'utf8')

// 1) Lang type
const langOld = "export type Lang = 'tr' | 'en' | 'es' | 'de' | 'fr'"
const langNew = "export type Lang = 'tr' | 'en' | 'es' | 'de' | 'fr' | 'el' | 'ru' | 'fa'"
if (!src.includes(langOld)) throw new Error('Lang type line not found')
src = src.replace(langOld, langNew)

// 2) LANGS array
const frEntry = "  { code: 'fr', flag: '🇫🇷', label: 'Français' },"
if (!src.includes(frEntry)) throw new Error('LANGS fr entry not found')
const newEntries =
  frEntry +
  "\n  { code: 'el', flag: '🇬🇷', label: 'Ελληνικά' }," +
  "\n  { code: 'ru', flag: '🇷🇺', label: 'Русский' }," +
  "\n  { code: 'fa', flag: '🇮🇷', label: 'فارسی' },"
src = src.replace(frEntry, newEntries)

// 3) insert dict blocks + 4) update DICT map
const dictOld = 'const DICT: Record<Lang, Dict> = { tr: TR, en: EN, es: ES, de: DE, fr: FR }'
if (!src.includes(dictOld)) throw new Error('DICT map line not found')
const dictNew =
  EL + '\n\n' + RU + '\n\n' + FA + '\n\n' +
  'const DICT: Record<Lang, Dict> = { tr: TR, en: EN, es: ES, de: DE, fr: FR, el: EL, ru: RU, fa: FA }'
src = src.replace(dictOld, dictNew)

fs.writeFileSync(I18N, src, 'utf8')
console.log('i18n.tsx patched OK')
