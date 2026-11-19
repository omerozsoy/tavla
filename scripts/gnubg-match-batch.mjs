// TÜM açılış pozisyonlarını gerçek MATCH bağlamıyla (xgid skor/küp/matchLen) gnubg'le analiz eder;
// current (money) cevaptan FARKLI match-best'leri /tmp/opening-match-fixes.json'a toplar. RESUMABLE.
// node scripts/gnubg-match-batch.mjs <TOKEN>
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const token = process.argv[2]
const OUT = 'C:/tmp/opening-match-fixes.json'
const PROG = 'C:/tmp/opening-match-progress.json'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function charVal(ch) { if (ch >= 'a' && ch <= 'z') return { count: ch.charCodeAt(0) - 96, white: true }; if (ch >= 'A' && ch <= 'Z') return { count: ch.charCodeAt(0) - 64, white: false }; return null }
function parse(xgid) {
  const parts = xgid.replace(/^XGID=/i, '').split(':')
  const pos = parts[0]; const points = new Array(24).fill(0); let barW = 0, barB = 0
  for (let i = 0; i < 26; i++) { const v = charVal(pos[i]); if (!v) continue; if (i === 0 || i === 25) { if (v.white) barW += v.count; else barB += v.count; continue } const p = 25 - i; points[p - 1] += v.white ? v.count : -v.count }
  // turn=-1 ise parseXgid gibi aynala (sıradaki=white)
  const xOnRoll = parts[3] === '1'
  let pts = points, bw = barW, bb = barB
  if (!xOnRoll) { pts = new Array(24).fill(0); for (let i = 0; i < 24; i++) pts[i] = -points[23 - i]; bw = barB; bb = barW }
  const d = parts[4]
  const cubeVal = Math.pow(2, Number(parts[1]) || 0)
  const cp = parts[2]; let owner = null
  if (cp === '1') owner = xOnRoll ? 'white' : 'black'; else if (cp === '-1') owner = xOnRoll ? 'black' : 'white'
  const sX = Number(parts[5]) || 0, sO = Number(parts[6]) || 0, to = Number(parts[8]) || 0
  return { points: pts, barW: bw, barB: bb, dice: [Number(d[0]), Number(d[1])], cube: { value: cubeVal, owner }, score: { white: xOnRoll ? sX : sO, black: xOnRoll ? sO : sX }, matchLength: to }
}
function normKey(n) { const legs = []; for (const tok of n.trim().split(/\s+/)) { const mult = tok.match(/\((\d+)\)\s*$/); const k = mult ? +mult[1] : 1; const core = mult ? tok.slice(0, mult.index) : tok; const segs = core.split('/').map((s) => s.replace(/\*/g, '')); for (let r = 0; r < k; r++) for (let i = 0; i + 1 < segs.length; i++) legs.push(segs[i] + '>' + segs[i + 1]) } let ch = true; while (ch) { ch = false; for (let i = 0; i < legs.length; i++) { const [a, b] = legs[i].split('>'); if (b === 'off') continue; for (let j = 0; j < legs.length; j++) { if (i !== j) { const [c, d] = legs[j].split('>'); if (b === c) { legs[i] = a + '>' + d; legs.splice(j, 1); ch = true; break } } } if (ch) break } } return legs.sort().join(',') }

const txt = readFileSync('src/ui/difficultyPositions.ts', 'utf8')
const re = /xgid: '([^']+)'[^\n}]*?answer: '([^']+)'[^\n}]*?title: '([^']*)'/g
const all = []; let m; while ((m = re.exec(txt))) all.push({ xgid: m[1], answer: m[2], title: m[3] })

const fixes = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : []
const doneKeys = new Set(existsSync(PROG) ? JSON.parse(readFileSync(PROG, 'utf8')) : [])
console.log('toplam:', all.length, 'tamamlanan:', doneKeys.size, 'mevcut fix:', fixes.length)

let changed = fixes.length, same = 0, i = 0
for (const p of all) {
  i++
  if (doneKeys.has(p.xgid)) continue
  const b = parse(p.xgid)
  const body = { points: b.points, bar: { white: b.barW, black: b.barB }, turn: 'white', dice: b.dice, cube: b.cube, score: { white: b.score.white, black: b.score.black }, matchLength: b.matchLength, plies: 2 }
  let j = null
  for (let a = 0; a < 4; a++) { try { const res = await fetch('https://tavlatv.com/api/analyze-position', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) }); if (res.status === 429) { await sleep(3500); continue } j = await res.json(); break } catch { await sleep(2000) } }
  const best = (j?.moves || [])[0]
  if (best && best.notation) {
    doneKeys.add(p.xgid)
    if (normKey(best.notation) !== normKey(p.answer)) { fixes.push({ key: p.xgid, oldAnswer: p.answer, best: best.notation }); changed++ } else same++
  }
  if (i % 10 === 0) { writeFileSync(OUT, JSON.stringify(fixes)); writeFileSync(PROG, JSON.stringify([...doneKeys])); process.stdout.write(`\r${i}/${all.length} fark=${changed} ayni=${same}`) }
  await sleep(2150)
}
writeFileSync(OUT, JSON.stringify(fixes)); writeFileSync(PROG, JSON.stringify([...doneKeys]))
console.log(`\nBITTI: ${all.length} analiz, ${fixes.length} match-fark, ${same} ayni`)
