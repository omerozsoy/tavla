// Otoriter bot maci — ESZAMANLI COKLU SENARYO hata avcisi + SONUC EKRANI dogrulamasi.
// Siyah = gercek gnubg (sunucu surer); beyaz = script (legal-random). Her maç bitince
// "sonuc ekranini gordu mu" DOGRULANIR: server_match.done KALICI + kazanan turetilebilir
// (skor lideri hedefe ulasmis) -> istemcinin sonuc ekrani cizecegi kesin.
// 10 maç = 5'erli 2 GRUP (ayni anda 5 maç = 10 bot). Tum senaryolar: target 1/3/5,
// kup take/drop, resign, Crawford, farkli seviyeler. 429 throttle -> backoff (anomali degil).
//
// Kullanim:  BASE=https://www.tavlatv.com/api node scripts/_errhunt2.mjs
import { generateMoves } from '../src/engine/moves'
import { newTurn } from '../src/engine/game'
import type { GameState } from '../src/engine/types'
import { randomUUID } from 'node:crypto'

const BASE = process.env.BASE || 'https://www.tavlatv.com/api'
const GAP = Number(process.env.GAP || 900)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const jitter = (ms: number) => ms + Math.floor(Math.random() * 400)

type Anom = { m: string; kind: string; detail: string }
const anomalies: Anom[] = []
const results: { m: string; outcome: string; score: string; sawResult: boolean }[] = []

async function req(method: string, path: string, body?: unknown) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (res.status === 429) { await sleep(jitter(2500)); continue } // throttle -> backoff (anomali DEGIL)
    const text = await res.text()
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch {}
    return { status: res.status, json, text }
  }
  return { status: 429, json: null, text: 'throttle-timeout' }
}
function asGameState(s: any): GameState {
  return { points: s.points.slice(), bar: { ...s.bar }, off: { ...s.off },
    turn: s.turn, dice: (s.dice ?? []).slice(), diceUsed: (s.diceUsed ?? []).slice() }
}
const show = async (code: string, token: string) =>
  (await req('GET', `/rooms/${code}?token=${encodeURIComponent(token)}`)).json?.room

type Cfg = { id: string; target: number; level: number; cube: 'take' | 'drop'; resignAfter?: number }

async function playMatch(cfg: Cfg) {
  const M = cfg.id
  const note = (kind: string, detail: string) => {
    anomalies.push({ m: M, kind, detail })
    console.log(`   ⚠ [${M}] ${kind}: ${detail}`)
  }
  const TOKEN = 'bot-' + Math.random().toString(36).slice(2, 12)
  const created = await req('POST', '/bot/rooms', { token: TOKEN, name: `EH-${M}`, level: cfg.level, target: cfg.target })
  if (created.status !== 200) { note('ODA-ACMA', `${created.status} ${created.text.slice(0, 80)}`); results.push({ m: M, outcome: 'ODA-ACILAMADI', score: '-', sawResult: false }); return }
  const code = created.json.room.code
  console.log(`   ▶ [${M}] oda ${code}  (t=${cfg.target} L${cfg.level} küp=${cfg.cube}${cfg.resignAfter != null ? ' resign@' + cfg.resignAfter : ''})`)

  let guard = 0, lastVer = -1, stale = 0, lastTurnKey = '', rejThisTurn = 0
  let hMoves = 0, bMoves = 0, dances = 0, resigned = false

  while (guard++ < 5000) {
    const room = await show(code, TOKEN)
    if (!room) { stale++; if (stale > 10) { note('POLL', 'oda surekli null'); break } await sleep(GAP); continue }
    const sm = room.server_match ?? {}
    const ver = Number(room.server_version ?? 0)
    const st = room.server_state
    if (!st) { await sleep(GAP); continue }
    if (ver === lastVer) stale++; else { stale = 0; lastVer = ver }
    if (stale > 90) { note('KILIT', `v${ver} takildi (turn=${st.turn} dice=${JSON.stringify(st.dice)} cubePending=${JSON.stringify(sm.cube?.pending)})`); break }

    // ---- MAÇ BITTI -> SONUC EKRANI DOGRULAMASI ----
    if (sm.done) {
      const w = (sm.score?.white ?? 0) > (sm.score?.black ?? 0) ? 'white' : 'black'
      const lead = Math.max(sm.score?.white ?? 0, sm.score?.black ?? 0)
      const score = `${sm.score?.white ?? 0}-${sm.score?.black ?? 0}`
      // (a) done KALICI mi? tekrar poll et -> istemci yeniden yuklese de sonuc ekrani gorunur olmali
      await sleep(300)
      const again = await show(code, TOKEN)
      const durable = !!again?.server_match?.done
      // (b) kazanan turetilebilir mi (lider hedefe ulasti)?
      const winnerOk = lead >= cfg.target
      const sawResult = durable && winnerOk
      if (!durable) note('SONUC-KALICISIZ', 'done ilk poll true ama ikinci poll false -> sonuc ekrani kararsiz')
      if (!winnerOk) note('SONUC-KAZANAN', `done ama lider ${lead} < hedef ${cfg.target} (${score}) -> kazanan belirsiz`)
      console.log(`   ✓ [${M}] BITTI ${score} kazanan=${w === 'white' ? 'BEYAZ' : 'gnubg'} | sonuç-ekrani=${sawResult ? 'GÖRÜLDÜ ✅' : 'SORUN ❌'} | beyaz ${hMoves}h gnubg ${bMoves}h dans ${dances}${resigned ? ' (resign)' : ''}`)
      results.push({ m: M, outcome: (w === 'white' ? 'BEYAZ' : 'gnubg') + ' kazandi', score, sawResult })
      return
    }

    const turnKey = `${ver}:${st.turn}`
    if (turnKey !== lastTurnKey) { rejThisTurn = 0; lastTurnKey = turnKey }

    // 1) Bekleyen kup (gnubg cift cekti) -> cfg.cube
    if (sm.cube?.pending != null) {
      const cr = await req('POST', `/rooms/${code}/cube/respond`, { token: TOKEN, action: cfg.cube, expected_version: ver, command_id: randomUUID() })
      if (cr.status >= 500) { note('KUP-500', `${cr.status} ${cr.text.slice(0, 100)}`); break }
      else if (cr.status !== 200 && cr.status !== 409 && cr.status !== 428) note('KUP', `${cr.status} ${cr.text.slice(0, 100)}`)
      await sleep(GAP); continue
    }

    // 2) Siyah gnubg -> durt
    if (st.turn === 'black') {
      const n = await req('POST', `/rooms/${code}/bot`, { token: TOKEN })
      if (n.status >= 500) note('BOT-500', `${n.status} ${n.text.slice(0, 80)}`)
      else if (n.status !== 200) note('BOT', `${n.status} ${n.text.slice(0, 80)}`)
      else if (n.json?.bot_status === 'unavailable') await sleep(400)
      else if (Array.isArray(n.json?.bot)) bMoves += n.json.bot.length
      await sleep(GAP); continue
    }

    const cmd = randomUUID()
    // RESIGN senaryosu: beyaz N hamleden sonra pes eder (zar ATMADAN, sira sahibi hakki)
    if (cfg.resignAfter != null && !resigned && hMoves >= cfg.resignAfter && (!st.dice || st.dice.length === 0)) {
      const rs = await req('POST', `/rooms/${code}/resign`, { token: TOKEN, resign_type: 'single', expected_version: ver, command_id: cmd })
      if (rs.status === 200) { resigned = true; console.log(`   … [${M}] beyaz PES etti`) }
      else if (rs.status >= 500) { note('RESIGN-500', `${rs.status} ${rs.text.slice(0, 100)}`); break }
      else if (rs.status !== 409 && rs.status !== 428) note('RESIGN', `${rs.status} ${rs.text.slice(0, 100)}`)
      await sleep(GAP); continue
    }

    // 3) Beyaz zar
    if (!st.dice || st.dice.length === 0) {
      const r = await req('POST', `/rooms/${code}/roll`, { token: TOKEN, expected_version: ver, command_id: cmd })
      if (r.status >= 500) { note('ROLL-500', `${r.status} ${r.text.slice(0, 100)}`); break }
      else if (r.status !== 200 && r.status !== 409 && r.status !== 428) note('ROLL', `${r.status} ${r.text.slice(0, 100)}`)
      else if (Array.isArray(r.json?.bot)) bMoves += r.json.bot.length
      await sleep(GAP); continue
    }

    // 4) Beyaz hamle (legal-random)
    const gs = asGameState(st)
    const moves = generateMoves(newTurn({ ...gs, dice: [], diceUsed: [] }, gs.dice))
    let steps: any[] = []
    if (moves.length > 0) steps = moves[Math.floor(Math.random() * moves.length)].steps
    else dances++
    const mv = await req('POST', `/rooms/${code}/move`, {
      token: TOKEN, steps: steps.map((s: any) => ({ from: s.from, to: s.to, die: s.die })),
      expected_version: ver, command_id: cmd,
    })
    if (mv.status === 200) { if (!mv.json?.ignored) hMoves++; if (Array.isArray(mv.json?.bot)) bMoves += mv.json.bot.length }
    else if (mv.status === 409 || mv.status === 428) { /* yaris */ }
    else if (mv.status === 422) {
      rejThisTurn++
      note('HAMLE-RED-422', `LEGAL hamle reddedildi: ${JSON.stringify(steps.map((s:any)=>`${s.from}/${s.to}`))} dice=${JSON.stringify(gs.dice)} -> ${mv.text.slice(0, 100)}`)
      if (rejThisTurn > 3) { note('HAMLE-KILIT', 'ayni turda 3+ red'); break }
    } else if (mv.status >= 500) { note('HAMLE-500', `${mv.status} ${mv.text.slice(0, 100)}`); break }
    else note('HAMLE', `${mv.status} ${mv.text.slice(0, 100)}`)
    await sleep(GAP)
  }
  if (guard >= 5000) { note('GUARD', 'poll limiti — bitmedi'); results.push({ m: M, outcome: 'BITMEDI', score: '-', sawResult: false }) }
}

async function main() {
  console.log(`\n=== ESZAMANLI BOT HATA AVI + SONUC EKRANI — ${BASE} ===`)
  const scenarios: Cfg[][] = [
    [ // GRUP 1 (aynı anda 5 maç = 10 bot)
      { id: 'A1', target: 1, level: 10, cube: 'take' },                 // tek oyun, küp yok
      { id: 'A2', target: 3, level: 10, cube: 'take' },                 // küp take
      { id: 'A3', target: 3, level: 10, cube: 'drop' },                 // çok oyun (drop)
      { id: 'A4', target: 5, level: 7,  cube: 'take' },                 // uzun + küp
      { id: 'A5', target: 3, level: 10, cube: 'drop', resignAfter: 3 }, // RESIGN
    ],
    [ // GRUP 2
      { id: 'B1', target: 1, level: 1,  cube: 'take' },                 // düşük seviye
      { id: 'B2', target: 3, level: 5,  cube: 'drop' },                 // çok oyun + Crawford ihtimali
      { id: 'B3', target: 5, level: 10, cube: 'drop' },                 // uzun çok-oyun
      { id: 'B4', target: 3, level: 3,  cube: 'take' },                 // orta seviye
      { id: 'B5', target: 1, level: 10, cube: 'take', resignAfter: 4 }, // tek oyunda RESIGN
    ],
  ]
  for (let g = 0; g < scenarios.length; g++) {
    console.log(`\n----- GRUP ${g + 1} başlıyor (5 eşzamanlı maç) -----`)
    await Promise.all(scenarios[g].map(playMatch))
    console.log(`----- GRUP ${g + 1} bitti -----`)
  }

  console.log(`\n=== SONUÇLAR ===`)
  for (const r of results) console.log(`  ${r.m}: ${r.outcome}  skor ${r.score}  sonuç-ekranı=${r.sawResult ? '✅' : '❌'}`)
  const allSaw = results.length > 0 && results.every((r) => r.sawResult)
  console.log(`\n=== ÖZET ===`)
  console.log(`  Maç: ${results.length}  |  Sonuç ekranını gören: ${results.filter((r) => r.sawResult).length}/${results.length}`)
  console.log(`  Toplam anomali: ${anomalies.length}`)
  if (anomalies.length) {
    const byKind: Record<string, number> = {}
    for (const a of anomalies) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1
    console.log('  Türlere göre:', JSON.stringify(byKind))
    for (const a of anomalies) console.log(`   - [${a.m}] ${a.kind}: ${a.detail}`)
  }
  console.log(allSaw && !anomalies.length
    ? '\n  ✅ TÜM maçlar sonuç ekranını gördü, hiç anomali yok.'
    : '\n  ⚠ Yukarıdaki sorunlara bak.')
}
main().catch((e) => { console.error('HATA:', e?.message || e); process.exit(1) })
