// Otoriter bot-vs-bot maci HATA AVCISI (canli). TEK cok-puanli mac (target).
// Script BEYAZ'i (insan) rastgele LEGAL hamlelerle oynar; sunucu SIYAH'i (gnubg bot) surer.
// = fiilen 2 bot. Cok oyun + kup yolu test edilir. gnubg cift cekerse beyaz TAKE der.
// TUM anomalileri (409 taskin, 422 hamle-red, 500, kilit, skor tutarsizligi) toplar.
//
// Kullanim:  BASE=https://www.tavlatv.com/api TARGET=5 node scripts/_errhunt.mjs
import { generateMoves } from '../src/engine/moves'
import { newTurn } from '../src/engine/game'
import type { GameState } from '../src/engine/types'
import { randomUUID } from 'node:crypto'

const BASE = process.env.BASE || 'https://www.tavlatv.com/api'
const TARGET = Number(process.env.TARGET || 5)
const LEVEL = Number(process.env.LEVEL || 10)
const GAP = Number(process.env.GAP || 500)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Anom = { kind: string; detail: string }
const anomalies: Anom[] = []
const note = (kind: string, detail: string) => {
  anomalies.push({ kind, detail })
  console.log(`   ⚠ ${kind}: ${detail}`)
}

async function req(method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch {}
  return { status: res.status, json, text }
}
function asGameState(s: any): GameState {
  return {
    points: s.points.slice(), bar: { ...s.bar }, off: { ...s.off },
    turn: s.turn, dice: (s.dice ?? []).slice(), diceUsed: (s.diceUsed ?? []).slice(),
  }
}
const show = async (code: string, token: string) =>
  (await req('GET', `/rooms/${code}?token=${encodeURIComponent(token)}`)).json?.room

async function main() {
  console.log(`\n=== BOT-vs-BOT HATA AVCISI — ${BASE}  (target=${TARGET}, seviye ${LEVEL}) ===\n`)
  const TOKEN = 'bot-' + Math.random().toString(36).slice(2, 12)

  // Oda ac (429 -> backoff + tekrar)
  let code = ''
  for (let a = 0; a < 5; a++) {
    const created = await req('POST', '/bot/rooms', { token: TOKEN, name: 'HataAvcisi', level: LEVEL, target: TARGET })
    if (created.status === 200) { code = created.json.room.code; break }
    if (created.status === 429) { console.log(`   … create 429 (throttle) — 30sn bekliyorum`); await sleep(30000); continue }
    note('ODA-ACMA', `bot/rooms -> ${created.status} ${created.text.slice(0, 100)}`)
    return report()
  }
  if (!code) { note('ODA-ACMA', 'oda acilamadi (429 kalici)'); return report() }
  console.log(`Oda: ${code}  (izle: /izle/${code})\n`)

  let guard = 0, lastVer = -1, staleVerPolls = 0, moveRejectsThisTurn = 0, lastTurnKey = ''
  let humanMoves = 0, botMoves = 0, dances = 0, roll409 = 0, move409 = 0, takes = 0
  let lastScore = ''

  while (guard++ < 6000) {
    const room = await show(code, TOKEN)
    if (!room) { // gecici null -> birkac kez tekrar dene
      staleVerPolls++
      if (staleVerPolls > 8) { note('POLL', 'oda tekrar tekrar null dondu'); return report() }
      await sleep(GAP); continue
    }
    const sm = room.server_match ?? {}
    const ver = Number(room.server_version ?? 0)
    const st = room.server_state
    if (!st) { await sleep(GAP); continue }

    if (ver === lastVer) staleVerPolls++
    else { staleVerPolls = 0; lastVer = ver }
    if (staleVerPolls > 80) {
      note('KILIT', `version ${ver}'de takildi (turn=${st.turn}, dice=${JSON.stringify(st.dice)}, cubePending=${JSON.stringify(sm.cube?.pending)})`)
      return report()
    }

    const score = `${sm.score?.white ?? 0}-${sm.score?.black ?? 0}`
    if (score !== lastScore) { console.log(`  skor ${score}${sm.isCrawford ? ' [Crawford]' : ''}  (küp ${sm.cube?.value ?? 1})`); lastScore = score }

    if (sm.done) {
      const total = (sm.score?.white ?? 0) + (sm.score?.black ?? 0)
      const w = (sm.score?.white ?? 0) > (sm.score?.black ?? 0) ? 'BEYAZ' : 'SIYAH(gnubg)'
      if ((sm.score?.white ?? 0) < TARGET && (sm.score?.black ?? 0) < TARGET)
        note('SKOR', `done ama iki taraf da hedefe (${TARGET}) ulasmadi: ${score}`)
      console.log(`\n=== MAC BITTI === Kazanan: ${w} | Skor ${score} | toplam puan ${total}`)
      console.log(`  beyaz ${humanMoves} hamle, gnubg ${botMoves}, dans ${dances}, roll409 ${roll409}, move409 ${move409}, take ${takes}`)
      return report()
    }

    const turnKey = `${ver}:${st.turn}`
    if (turnKey !== lastTurnKey) { moveRejectsThisTurn = 0; lastTurnKey = turnKey }

    // 1) Bekleyen kup teklifi (gnubg cift cekti) -> beyaz cevap (env CUBE=take|drop; drop -> cok oyun/Crawford test)
    if (sm.cube?.pending != null) {
      const action = process.env.CUBE === 'drop' ? 'drop' : 'take'
      const cr = await req('POST', `/rooms/${code}/cube/respond`, {
        token: TOKEN, action, expected_version: ver, command_id: randomUUID(),
      })
      if (cr.status === 200) { takes++; console.log(`  ✓ küp ${action.toUpperCase()} (deger ${cr.json?.match?.cube?.value ?? '?'})`) }
      else if (cr.status === 409 || cr.status === 428) { /* yaris */ }
      else if (cr.status >= 500) { note('KUP-500', `${cr.status} ${cr.text.slice(0, 120)}`); return report() }
      else note('KUP-RESPOND', `beklenmedik ${cr.status} ${cr.text.slice(0, 120)}`)
      await sleep(GAP); continue
    }

    // 2) Siyah = gnubg botu -> durt
    if (st.turn === 'black') {
      const nudge = await req('POST', `/rooms/${code}/bot`, { token: TOKEN })
      if (nudge.status !== 200) note('BOT', `bot -> ${nudge.status} ${nudge.text.slice(0, 80)}`)
      else if (nudge.json?.bot_status === 'unavailable') await sleep(400)
      else if (Array.isArray(nudge.json?.bot)) botMoves += nudge.json.bot.length
      await sleep(GAP); continue
    }

    const cmd = randomUUID()
    // 3) Beyaz zar at
    if (!st.dice || st.dice.length === 0) {
      const r = await req('POST', `/rooms/${code}/roll`, { token: TOKEN, expected_version: ver, command_id: cmd })
      if (r.status === 200) { if (Array.isArray(r.json?.bot)) botMoves += r.json.bot.length }
      else if (r.status === 409 || r.status === 428) roll409++
      else if (r.status >= 500) { note('ROLL-500', `${r.status} ${r.text.slice(0, 100)}`); return report() }
      else note('ROLL', `beklenmedik ${r.status} ${r.text.slice(0, 100)}`)
      await sleep(GAP); continue
    }

    // 4) Beyaz hamle: rastgele LEGAL
    const gs = asGameState(st)
    const withDice = newTurn({ ...gs, dice: [], diceUsed: [] }, gs.dice)
    const moves = generateMoves(withDice)
    let steps: any[] = []
    if (moves.length > 0) steps = moves[Math.floor(Math.random() * moves.length)].steps
    else dances++

    const mv = await req('POST', `/rooms/${code}/move`, {
      token: TOKEN,
      steps: steps.map((s: any) => ({ from: s.from, to: s.to, die: s.die })),
      expected_version: ver, command_id: cmd,
    })
    if (mv.status === 200) {
      if (!mv.json?.ignored) humanMoves++
      if (Array.isArray(mv.json?.bot)) botMoves += mv.json.bot.length
    } else if (mv.status === 409 || mv.status === 428) {
      move409++
    } else if (mv.status === 422) {
      moveRejectsThisTurn++
      note('HAMLE-RED-422', `motorun LEGAL dedigi hamle reddedildi: steps=${JSON.stringify(steps.map((s:any)=>`${s.from}/${s.to}`))} dice=${JSON.stringify(gs.dice)} -> ${mv.text.slice(0, 120)}`)
      if (moveRejectsThisTurn > 3) { note('HAMLE-KILIT', 'ayni turda 3+ hamle reddi'); return report() }
    } else if (mv.status >= 500) {
      note('HAMLE-500', `${mv.status} ${mv.text.slice(0, 120)}`); return report()
    } else {
      note('HAMLE', `beklenmedik ${mv.status} ${mv.text.slice(0, 120)}`)
    }
    await sleep(GAP)
  }
  note('GUARD', '6000 poll asildi — mac bitmedi')
  return report()
}

function report() {
  console.log(`\n=== ÖZET ===`)
  console.log(`  Toplam anomali: ${anomalies.length}`)
  if (anomalies.length) {
    const byKind: Record<string, number> = {}
    for (const a of anomalies) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1
    console.log('  Türlere göre:', JSON.stringify(byKind))
    for (const a of anomalies) console.log(`   - ${a.kind}: ${a.detail}`)
  } else {
    console.log('  ✅ Hiç anomali yok — otoriter bot maç pipeline temiz (roll/move/küp/skor/maç-sonu).')
  }
}
main().catch((e) => { console.error('HATA:', e?.message || e); process.exit(1) })
