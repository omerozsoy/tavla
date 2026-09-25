// TAVLA (backgammon) TAM SENARYO sweep — SIRALI (tek tek -> throttle artefaktı YOK, temiz sinyal).
// Her senaryo: script BEYAZ (legal-random) ↔ sunucu SIYAH (gerçek gnubg). Otoriter pipeline'ın
// TÜM maç türlerini test eder + her maçın SONUÇ EKRANINI gördüğünü doğrular.
// Kapsam: uzunluk 1/3/5/7/9/11, küp take/drop, resign single/gammon/backgammon, seviye 1-10, Crawford.
//
// Kullanim:  BASE=https://www.tavlatv.com/api node scripts/_tavlahunt.mjs
import { generateMoves } from '../src/engine/moves'
import { newTurn } from '../src/engine/game'
import type { GameState } from '../src/engine/types'
import { randomUUID } from 'node:crypto'

const BASE = process.env.BASE || 'https://www.tavlatv.com/api'
const GAP = Number(process.env.GAP || 250)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Cfg = { id: string; target: number; level: number; cube: 'take' | 'drop'; resignAfter?: number; resignType?: 'single' | 'gammon' | 'backgammon' }
type Res = { id: string; desc: string; outcome: string; score: string; sawResult: boolean; anoms: string[] }
const results: Res[] = []

async function req(method: string, path: string, body?: unknown) {
  for (let a = 0; a < 10; a++) {
    const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    if (res.status === 429) { await sleep(2500); continue }
    const text = await res.text(); let json: any = null; try { json = text ? JSON.parse(text) : null } catch {}
    return { status: res.status, json, text }
  }
  return { status: 429, json: null, text: 'throttle' }
}
function asGameState(s: any): GameState {
  return { points: s.points.slice(), bar: { ...s.bar }, off: { ...s.off }, turn: s.turn, dice: (s.dice ?? []).slice(), diceUsed: (s.diceUsed ?? []).slice() }
}
const show = async (code: string, token: string) => (await req('GET', `/rooms/${code}?token=${encodeURIComponent(token)}`)).json?.room

async function playMatch(cfg: Cfg, desc: string) {
  const anoms: string[] = []
  const note = (k: string, d: string) => { anoms.push(`${k}: ${d}`); console.log(`   ⚠ [${cfg.id}] ${k}: ${d}`) }
  const TOKEN = 'bot-' + Math.random().toString(36).slice(2, 12)
  const created = await req('POST', '/bot/rooms', { token: TOKEN, name: `TH-${cfg.id}`, level: cfg.level, target: cfg.target })
  if (created.status !== 200) { note('ODA-ACMA', `${created.status} ${created.text.slice(0, 80)}`); results.push({ id: cfg.id, desc, outcome: 'AÇILAMADI', score: '-', sawResult: false, anoms }); return }
  const code = created.json.room.code

  let guard = 0, lastVer = -1, stale = 0, lastTurnKey = '', rej = 0
  let hMoves = 0, bMoves = 0, dances = 0, resigned = false, cubes = 0

  while (guard++ < 4000) {
    const room = await show(code, TOKEN)
    if (!room) { stale++; if (stale > 10) { note('POLL', 'sürekli null'); break } await sleep(GAP); continue }
    const sm = room.server_match ?? {}, ver = Number(room.server_version ?? 0), st = room.server_state
    if (!st) { await sleep(GAP); continue }
    if (ver === lastVer) stale++; else { stale = 0; lastVer = ver }
    if (stale > 100) { note('KİLİT', `v${ver} takıldı (turn=${st.turn} dice=${JSON.stringify(st.dice)} cubePending=${JSON.stringify(sm.cube?.pending)})`); break }

    if (sm.done) {
      const w = (sm.score?.white ?? 0) > (sm.score?.black ?? 0) ? 'white' : 'black'
      const lead = Math.max(sm.score?.white ?? 0, sm.score?.black ?? 0)
      const score = `${sm.score?.white ?? 0}-${sm.score?.black ?? 0}`
      await sleep(250)
      const again = await show(code, TOKEN)
      const durable = !!again?.server_match?.done
      const winnerOk = lead >= cfg.target
      if (!durable) note('SONUÇ-KALICISIZ', 'done ikinci pollda kayboldu')
      if (!winnerOk) note('SONUÇ-KAZANAN', `lider ${lead} < hedef ${cfg.target} (${score})`)
      const sawResult = durable && winnerOk
      console.log(`   ✓ [${cfg.id}] ${desc} -> ${score} kazanan=${w === 'white' ? 'BEYAZ' : 'gnubg'} | sonuç-ekranı=${sawResult ? 'GÖRÜLDÜ ✅' : 'SORUN ❌'} | küp${cubes} dans${dances}${resigned ? ' resign' : ''}`)
      results.push({ id: cfg.id, desc, outcome: (w === 'white' ? 'BEYAZ' : 'gnubg'), score, sawResult, anoms })
      return
    }

    const tk = `${ver}:${st.turn}`; if (tk !== lastTurnKey) { rej = 0; lastTurnKey = tk }

    if (sm.cube?.pending != null) {
      const cr = await req('POST', `/rooms/${code}/cube/respond`, { token: TOKEN, action: cfg.cube, expected_version: ver, command_id: randomUUID() })
      if (cr.status === 200) cubes++
      else if (cr.status >= 500) { note('KÜP-500', `${cr.status} ${cr.text.slice(0, 80)}`); break }
      else if (cr.status !== 409 && cr.status !== 428) note('KÜP', `${cr.status} ${cr.text.slice(0, 80)}`)
      await sleep(GAP); continue
    }
    if (st.turn === 'black') {
      const n = await req('POST', `/rooms/${code}/bot`, { token: TOKEN })
      if (n.status >= 500) note('BOT-500', `${n.status} ${n.text.slice(0, 60)}`)
      else if (n.status !== 200) note('BOT', `${n.status}`)
      else if (n.json?.bot_status === 'unavailable') await sleep(400)
      else if (Array.isArray(n.json?.bot)) bMoves += n.json.bot.length
      await sleep(GAP); continue
    }
    const cmd = randomUUID()
    if (cfg.resignAfter != null && !resigned && hMoves >= cfg.resignAfter && (!st.dice || st.dice.length === 0)) {
      const rs = await req('POST', `/rooms/${code}/resign`, { token: TOKEN, resign_type: cfg.resignType ?? 'single', expected_version: ver, command_id: cmd })
      if (rs.status === 200) { resigned = true; console.log(`   … [${cfg.id}] beyaz PES (${cfg.resignType ?? 'single'})`) }
      else if (rs.status >= 500) { note('RESIGN-500', `${rs.status} ${rs.text.slice(0, 80)}`); break }
      else if (rs.status !== 409 && rs.status !== 428) note('RESIGN', `${rs.status} ${rs.text.slice(0, 80)}`)
      await sleep(GAP); continue
    }
    if (!st.dice || st.dice.length === 0) {
      const r = await req('POST', `/rooms/${code}/roll`, { token: TOKEN, expected_version: ver, command_id: cmd })
      if (r.status >= 500) { note('ROLL-500', `${r.status} ${r.text.slice(0, 80)}`); break }
      else if (r.status !== 200 && r.status !== 409 && r.status !== 428) note('ROLL', `${r.status} ${r.text.slice(0, 80)}`)
      else if (Array.isArray(r.json?.bot)) bMoves += r.json.bot.length
      await sleep(GAP); continue
    }
    const gs = asGameState(st)
    const moves = generateMoves(newTurn({ ...gs, dice: [], diceUsed: [] }, gs.dice))
    let steps: any[] = []
    if (moves.length > 0) steps = moves[Math.floor(Math.random() * moves.length)].steps; else dances++
    const mv = await req('POST', `/rooms/${code}/move`, { token: TOKEN, steps: steps.map((s: any) => ({ from: s.from, to: s.to, die: s.die })), expected_version: ver, command_id: cmd })
    if (mv.status === 200) { if (!mv.json?.ignored) hMoves++; if (Array.isArray(mv.json?.bot)) bMoves += mv.json.bot.length }
    else if (mv.status === 409 || mv.status === 428) {}
    else if (mv.status === 422) { rej++; note('HAMLE-RED-422', `${JSON.stringify(steps.map((s:any)=>`${s.from}/${s.to}`))} dice=${JSON.stringify(gs.dice)} -> ${mv.text.slice(0,80)}`); if (rej > 3) { note('HAMLE-KİLİT', '3+ red'); break } }
    else if (mv.status >= 500) { note('HAMLE-500', `${mv.status} ${mv.text.slice(0, 80)}`); break }
    else note('HAMLE', `${mv.status}`)
    await sleep(GAP)
  }
  if (guard >= 4000) { note('GUARD', 'bitmedi'); results.push({ id: cfg.id, desc, outcome: 'BİTMEDİ', score: '-', sawResult: false, anoms }) }
}

async function main() {
  console.log(`\n=== TAVLA TAM SENARYO SWEEP (SIRALI) — ${BASE} ===\n`)
  const S: { cfg: Cfg; desc: string }[] = [
    // Tüm maç uzunlukları (küp take, seviye 10)
    { cfg: { id: 'L1',  target: 1,  level: 10, cube: 'take' }, desc: '1 puan (küpsüz)' },
    { cfg: { id: 'L3',  target: 3,  level: 10, cube: 'take' }, desc: '3 puan küp-take' },
    { cfg: { id: 'L5',  target: 5,  level: 10, cube: 'take' }, desc: '5 puan küp-take' },
    { cfg: { id: 'L7',  target: 7,  level: 10, cube: 'take' }, desc: '7 puan küp-take' },
    { cfg: { id: 'L9',  target: 9,  level: 10, cube: 'take' }, desc: '9 puan küp-take' },
    { cfg: { id: 'L11', target: 11, level: 10, cube: 'take' }, desc: '11 puan küp-take' },
    // Küp DROP (çok oyun + Crawford)
    { cfg: { id: 'D3',  target: 3,  level: 10, cube: 'drop' }, desc: '3 puan küp-DROP (çok oyun)' },
    { cfg: { id: 'D5',  target: 5,  level: 5,  cube: 'drop' }, desc: '5 puan küp-DROP (Crawford)' },
    { cfg: { id: 'D7',  target: 7,  level: 10, cube: 'drop' }, desc: '7 puan küp-DROP (Crawford)' },
    // RESIGN türleri
    { cfg: { id: 'RS',  target: 3,  level: 10, cube: 'take', resignAfter: 3, resignType: 'single' },     desc: 'resign SINGLE' },
    { cfg: { id: 'RG',  target: 3,  level: 10, cube: 'take', resignAfter: 3, resignType: 'gammon' },     desc: 'resign GAMMON' },
    { cfg: { id: 'RB',  target: 5,  level: 10, cube: 'take', resignAfter: 3, resignType: 'backgammon' }, desc: 'resign BACKGAMMON' },
    // Seviye kapsaması
    { cfg: { id: 'V1',  target: 3,  level: 1,  cube: 'take' }, desc: 'seviye 1' },
    { cfg: { id: 'V5',  target: 3,  level: 5,  cube: 'take' }, desc: 'seviye 5' },
  ]
  for (const s of S) { console.log(`\n▶ ${s.cfg.id}: ${s.desc}`); await playMatch(s.cfg, s.desc) }

  console.log(`\n=== SONUÇLAR ===`)
  for (const r of results) console.log(`  ${r.id.padEnd(4)} ${r.desc.padEnd(30)} ${(''+r.outcome).padEnd(6)} ${r.score.padEnd(6)} sonuç-ekranı=${r.sawResult ? '✅' : '❌'}${r.anoms.length ? '  ⚠ ' + r.anoms.join('; ') : ''}`)
  const saw = results.filter(r => r.sawResult).length
  const anomTotal = results.reduce((a, r) => a + r.anoms.length, 0)
  console.log(`\n=== ÖZET ===`)
  console.log(`  Senaryo: ${results.length}  |  Sonuç ekranını gören: ${saw}/${results.length}  |  Anomali: ${anomTotal}`)
  console.log(saw === results.length && anomTotal === 0 ? '  ✅ TÜM tavla senaryoları temiz geçti, hepsi sonuç ekranını gördü.' : '  ⚠ Yukarıdaki işaretlere bak.')
}
main().catch((e) => { console.error('HATA:', e?.message || e); process.exit(1) })
