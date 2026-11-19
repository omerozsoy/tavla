// Müfredat cevaplı pozisyonları CANLI sunucu gnubg (/analyze-position, money game 2-ply) ile doğrular.
// Opt-in: GNUBG_TOKEN=<premium sanctum token> npx vitest run src/engine/verifyGnubg.node.test.ts --disable-console-intercept
import { describe, it, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseXgid } from './xgid'
import { parseGnuId } from './gnubgId'
import { gnubgNotationKey } from './gnubgMove'

const TOKEN = process.env.GNUBG_TOKEN ?? ''
const API = 'https://tavlatv.com/api/analyze-position'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Pos { xgid?: string; gnuPos?: string; gnuMatch?: string; answer: string; title: string }
function extract(): Pos[] {
  const txt = readFileSync('src/ui/trainingCurriculum.ts', 'utf8')
  const out: Pos[] = []
  let m: RegExpExecArray | null
  const reX = /xgid:\s*'([^']+)'[^\n}]*?answer:\s*'([^']+)'[^\n}]*?title:\s*'((?:[^'\\]|\\.)*)'/g
  while ((m = reX.exec(txt))) out.push({ xgid: m[1], answer: m[2], title: m[3].replace(/\\'/g, "'") })
  const reG = /gnuPos:\s*'([^']+)'[^\n}]*?gnuMatch:\s*'([^']*)'[^\n}]*?answer:\s*'([^']+)'[^\n}]*?title:\s*'((?:[^'\\]|\\.)*)'/g
  while ((m = reG.exec(txt))) out.push({ gnuPos: m[1], gnuMatch: m[2], answer: m[3], title: m[4].replace(/\\'/g, "'") })
  return out
}

describe.skipIf(!TOKEN)('gnubg canlı doğrulama', () => {
  beforeAll(() => { if (!TOKEN) console.log('GNUBG_TOKEN yok -> atlanıyor') })

  it('saklanan cevabı gnubg-best ile karşılaştır', async () => {
    const positions = extract()
    const rows: { loss: number; line: string }[] = []
    for (const p of positions) {
      const r = p.gnuPos ? parseGnuId(p.gnuPos, p.gnuMatch ?? '') : parseXgid(p.xgid!)
      if (!r || !r.dice) { rows.push({ loss: 99, line: `PARSE-FAIL | ${p.title}` }); continue }
      const body = {
        points: r.state.points,
        bar: { white: r.state.bar.white, black: r.state.bar.black },
        turn: 'white',
        dice: [r.dice[0], r.dice[1]],
        cube: { value: 1, owner: null },
        score: { white: 0, black: 0 },
        matchLength: 0,
        plies: 2,
      }
      let resp: { moves?: { notation: string; equity: number }[] } | null = null
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${TOKEN}` },
            body: JSON.stringify(body),
          })
          if (res.status === 429) { await sleep(3000); continue }
          resp = await res.json()
          break
        } catch { await sleep(1500) }
      }
      const moves = resp?.moves ?? []
      if (!moves.length) { rows.push({ loss: 97, line: `NO-GNUBG | ${p.title}` }); await sleep(2200); continue }
      const best = moves[0]
      const ansKey = gnubgNotationKey(p.answer)
      const found = moves.find((mv) => gnubgNotationKey(mv.notation) === ansKey)
      if (!found) {
        rows.push({ loss: 96, line: `NOT-IN-LIST "${p.answer}" | gnubg-best "${best.notation}" (${best.equity.toFixed(3)}) | ${p.title}` })
      } else {
        const loss = best.equity - found.equity
        if (loss > 0.04) rows.push({ loss, line: `LOSS ${loss.toFixed(3)} | stored "${p.answer}" (${found.equity.toFixed(3)}) vs gnubg-best "${best.notation}" (${best.equity.toFixed(3)}) | ${p.title}` })
      }
      await sleep(2200) // throttle 30/dk
    }
    rows.sort((a, b) => b.loss - a.loss)
    console.log('\nGNUBG ANSWERED=' + positions.length + ' FLAGGED=' + rows.length + '\n' + rows.map((r) => r.line).join('\n'))
  }, 600000)
})
