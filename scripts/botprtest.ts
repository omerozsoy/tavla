// BOT MAÇI PR TEŞHİSİ: tek hesap + /bot/rooms (siyah=gnubg). Beyaz RASTGELE (kötü) oynar ->
// gnubg PR'ı YÜKSEK olmalı. reportRating(ai)+log -> gnubg async PR poll. PR 0 gelirse pvb PR
// pipeline'ında bug var; yüksek gelirse RKYFH'nin 0'ı meşru (kısa/optimal maç) demektir.
import { generateMoves } from '../src/engine/moves'
import { newTurn } from '../src/engine/game'
import type { GameState } from '../src/engine/types'
import { randomUUID } from 'node:crypto'

const BASE = process.env.BASE || 'https://www.tavlatv.com/api'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rnd = () => Math.random().toString(36).slice(2, 10)
async function req(method: string, path: string, opts: { bearer?: string; body?: unknown } = {}) {
  for (let a = 0; a < 8; a++) {
    const h: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' }
    if (opts.bearer) h.authorization = `Bearer ${opts.bearer}`
    const res = await fetch(BASE + path, { method, headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
    if (res.status === 429) { await sleep(2500); continue }
    const text = await res.text(); let json: any = null; try { json = text ? JSON.parse(text) : null } catch {}
    return { status: res.status, json, text }
  }
  return { status: 429, json: null, text: 'throttle' }
}
const asGS = (s: any): GameState => ({ points: s.points.slice(), bar: { ...s.bar }, off: { ...s.off }, turn: s.turn, dice: (s.dice ?? []).slice(), diceUsed: (s.diceUsed ?? []).slice() })
const show = async (code: string, b: string) => (await req('GET', `/rooms/${code}`, { bearer: b })).json?.room

async function main() {
  console.log(`\n=== BOT MAÇI PR TEŞHİSİ — ${BASE} ===\n`)
  const reg = await req('POST', '/register', { body: { first_name: 'B', last_name: 'PR', nickname: `bpr_${rnd()}`, email: `bpr_${rnd()}@example.com`, password: 'test123456' } })
  if (reg.status !== 201) throw new Error(`register -> ${reg.status} ${reg.text.slice(0, 100)}`)
  const bearer = reg.json.token as string
  const rt = 'rt-' + rnd()
  const created = await req('POST', '/bot/rooms', { bearer, body: { token: rt, name: 'BPR', level: 10, target: 1 } })
  if (created.status !== 200) throw new Error(`bot/rooms -> ${created.status} ${created.text.slice(0, 120)}`)
  const code = created.json.room.code
  console.log(`   oda ${code} (t=1 L10)  authoritative=${created.json.room.authoritative}`)

  const entries: any[] = []
  let guard = 0, lastVer = -1, stale = 0, hMoves = 0, bMoves = 0
  while (guard++ < 3000) {
    const room = await show(code, bearer)
    if (!room) { await sleep(150); continue }
    const sm = room.server_match ?? {}, ver = Number(room.server_version ?? 0), st = room.server_state
    if (!st) { await req('POST', `/rooms/${code}/roll`, { bearer, body: { token: rt, expected_version: ver, command_id: randomUUID() } }); await sleep(250); continue }
    if (ver === lastVer) stale++; else { stale = 0; lastVer = ver }
    if (stale > 60) { console.log(`   ⚠ KİLİT v${ver} turn=${st.turn}`); break }
    if (sm.done) { console.log(`   ✓ maç bitti ${sm.score?.white ?? 0}-${sm.score?.black ?? 0}, beyaz ${hMoves}h gnubg ${bMoves}h, log ${entries.length}`); break }
    const cmd = randomUUID()
    if (st.turn === 'black') {
      const n = await req('POST', `/rooms/${code}/bot`, { bearer, body: { token: rt } })
      if (Array.isArray(n.json?.bot)) bMoves += n.json.bot.length; await sleep(150); continue
    }
    if (!st.dice || st.dice.length === 0) {
      await req('POST', `/rooms/${code}/roll`, { bearer, body: { token: rt, expected_version: ver, command_id: cmd } }); await sleep(120); continue
    }
    const gs = asGS(st)
    const pos = { points: gs.points.slice(), bar: { ...gs.bar }, off: { ...gs.off } }
    const moves = generateMoves(newTurn({ ...gs, dice: [], diceUsed: [] }, gs.dice))
    const steps = moves.length ? moves[Math.floor(Math.random() * moves.length)].steps : []
    const mv = await req('POST', `/rooms/${code}/move`, { bearer, body: { token: rt, steps: steps.map((s: any) => ({ from: s.from, to: s.to, die: s.die })), expected_version: ver, command_id: cmd } })
    if (mv.status === 200) { if (!mv.json?.ignored) hMoves++; if (steps.length) entries.push({ player: 'white', pos, dice: gs.dice.slice(), playedSteps: steps.map((s: any) => ({ from: s.from, to: s.to, die: s.die })) }); if (Array.isArray(mv.json?.bot)) bMoves += mv.json.bot.length }
    await sleep(120)
  }

  console.log(`   reportRating(ai)…`)
  const rr = await req('POST', '/rating/report', {
    bearer,
    body: { won: false, opponent_rating: 1900, room_code: code, pr: null, match_type: 'ai', log: JSON.stringify({ hc: 'white', log: entries }) },
  })
  const mid = rr.json?.match_result_id
  console.log(`   report -> ${rr.status}  match_result_id=${mid}  pr_self(anlık)=${rr.json?.pr_self}  gnubg_authoritative=${rr.json?.gnubg_authoritative}`)

  console.log(`   gnubg PR bekleniyor (async)…`)
  let pr: any = null
  for (let i = 0; i < 60; i++) {
    const g = await req('GET', `/me/match-pr-tavlatv/${mid}`, { bearer })
    if (g.json?.ready) { pr = g.json; break }
    await sleep(3000)
  }
  console.log(`\n=== SONUÇ ===`)
  console.log(`   log kararları (beyaz hamle): ${entries.length}`)
  console.log(`   gnubg PR: self=${pr?.pr ?? '—'}  opponent(bot)=${pr?.opponent_pr ?? '—'}  checker=${pr?.checker_pr ?? '—'}`)
  console.log(`   [HAM] ${JSON.stringify(pr)}`)
  if (pr?.pr && pr.pr > 5) console.log('\n   ✅ Rastgele oynanan maçta gnubg PR YÜKSEK -> pvb PR pipeline ÇALIŞIYOR. RKYFH 0.00 muhtemelen MEŞRU (kısa/optimal maç).')
  else if (pr && (pr.pr === 0 || pr.pr == null)) console.log('\n   ⚠ Rastgele oynadığı halde PR 0/null -> pvb gnubg PR pipeline\'ında BUG var (checkerPr karar bulamıyor).')
}
main().catch((e) => { console.error('HATA:', e?.message || e); process.exit(1) })
