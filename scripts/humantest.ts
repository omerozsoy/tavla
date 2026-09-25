// 2-İNSAN FRIENDLY MAÇ e2e — asıl bug (#TP9K4: kaybeden kilidi + PUT 409) regresyonu.
// create(P1=beyaz) + join(P2=siyah) -> room.authoritative TRUE olmalı (shouldAuthoritative fix
// + FPM restart teyidi). Sonra 1-puanlık maçı İKİ taraf da serverRoll/serverMove ile oynar;
// bitişte HER İKİ token da server_match.done görmeli (kaybeden de sonucu alır). 409/500/kilit = FAIL.
//
// Kullanim:  BASE=https://www.tavlatv.com/api npx tsx scripts/humantest.ts
import { generateMoves } from '../src/engine/moves'
import { newTurn } from '../src/engine/game'
import type { GameState } from '../src/engine/types'
import { randomUUID } from 'node:crypto'

const BASE = process.env.BASE || 'https://www.tavlatv.com/api'
const GAP = Number(process.env.GAP || 300)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const anoms: string[] = []
const note = (k: string, d: string) => { anoms.push(`${k}: ${d}`); console.log(`   ⚠ ${k}: ${d}`) }

async function req(method: string, path: string, body?: unknown) {
  for (let a = 0; a < 12; a++) {
    const res = await fetch(BASE + path, { method, headers: { 'content-type': 'application/json', accept: 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    if (res.status === 429) { await sleep(2500); continue }
    const text = await res.text(); let json: any = null; try { json = text ? JSON.parse(text) : null } catch {}
    return { status: res.status, json, text }
  }
  return { status: 429, json: null, text: 'throttle' }
}
const asGS = (s: any): GameState => ({ points: s.points.slice(), bar: { ...s.bar }, off: { ...s.off }, turn: s.turn, dice: (s.dice ?? []).slice(), diceUsed: (s.diceUsed ?? []).slice() })
const show = async (code: string, token: string) => (await req('GET', `/rooms/${code}?token=${encodeURIComponent(token)}`)).json?.room
// GERÇEK İSTEMCİ gibi delta poll (since=server_version). 204 -> {status:204, room:null}.
const showSince = async (code: string, token: string, since: number) => {
  const r = await req('GET', `/rooms/${code}?token=${encodeURIComponent(token)}&since=${since}`)
  return { status: r.status, room: r.json?.room ?? null }
}

async function main() {
  console.log(`\n=== 2-İNSAN FRIENDLY MAÇ e2e — ${BASE} ===\n`)
  const T1 = 'h1-' + Math.random().toString(36).slice(2, 12) // beyaz (p1, davet eden)
  const T2 = 'h2-' + Math.random().toString(36).slice(2, 12) // siyah (p2, katılan)

  // 1) P1 oda kurar (target=1 -> küpsüz, hızlı)
  const c = await req('POST', '/rooms', { token: T1, name: 'HT-Beyaz', rating: 1400, target: 1 })
  if (c.status !== 200) { note('CREATE', `${c.status} ${c.text.slice(0, 120)}`); return finish() }
  const code = c.json.room.code
  console.log(`▶ Oda: #${code}  create.authoritative=${c.json.room.authoritative}`)

  // 2) P2 katılır
  const j = await req('POST', `/rooms/${code}/join`, { token: T2, name: 'HT-Siyah', rating: 1350 })
  if (j.status !== 200) { note('JOIN', `${j.status} ${j.text.slice(0, 120)}`); return finish() }
  console.log(`▶ Katıldı: join.authoritative=${j.json.room.authoritative} slot=${j.json.slot}`)

  // 3) KRİTİK: oda otoriter mi? (shouldAuthoritative koşulsuz true + FPM restart teyidi)
  const r1 = await show(code, T1)
  const authoritative = !!(r1?.authoritative ?? c.json.room.authoritative)
  if (!authoritative) {
    note('OTORİTER-DEĞİL', 'room.authoritative=false -> backend eski / FPM restart YAPILMADI. Bu maç eski legacy-PUT yolunu kullanır (bug SÜRER).')
    return finish()
  }
  console.log(`✅ Oda OTORİTER (server_state pipeline aktif; legacy PUT devre-dışı -> 409 sınıfı kapalı)\n`)

  // 4) Maçı oyna: sıra sahibi (white=T1, black=T2) roll+move
  const tokenFor = (turn: string) => (turn === 'white' ? T1 : T2)
  let guard = 0, lastVer = -1, stale = 0
  while (guard++ < 3000) {
    const room = await show(code, T1)
    if (!room) { stale++; if (stale > 12) { note('POLL', 'sürekli null'); break } await sleep(GAP); continue }
    const sm = room.server_match ?? {}, ver = Number(room.server_version ?? 0), st = room.server_state
    if (!st) {
      // Otoriter insan odası: server_state AÇILIŞ roll'una dek null. Server seed'li açılışı
      // (SeededOpening, idempotent) tek roll POST'u tetikler -> starter + açılış zarı gelir.
      const r = await req('POST', `/rooms/${code}/roll`, { token: T1, command_id: randomUUID(), expected_version: ver })
      if (r.status >= 500) { note('OPENING-500', `${r.status} ${r.text.slice(0, 100)}`); break }
      else if (r.status !== 200 && r.status !== 409 && r.status !== 428) note('OPENING', `${r.status} ${r.text.slice(0, 100)}`)
      await sleep(GAP); continue
    }
    if (ver === lastVer) stale++; else { stale = 0; lastVer = ver }
    if (stale > 80) { note('KİLİT', `v${ver} takıldı turn=${st.turn} dice=${JSON.stringify(st.dice)}`); break }

    if (sm.done) {
      const score = `${sm.score?.white ?? 0}-${sm.score?.black ?? 0}`
      const w = (sm.score?.white ?? 0) > (sm.score?.black ?? 0) ? 'BEYAZ(P1)' : 'SİYAH(P2)'
      const finalVer = ver
      // 5) KAYBEDEN KİLİDİ — GERÇEK İSTEMCİ YOLU (#29ZZT KÖK FIX): istemci poll'u `since=server_version`
      // gönderir. Kaybeden, kazananın bitiren hamlesinden ÖNCEKİ sürümdedir (finalVer-1). O `since`
      // ile poll ederken backend TAM server_state + done DÖNMELİ (204 DEĞİL). Bug: backend `since`'i
      // legacy `version`(otoriterde ~0) ile kıyaslıyordu -> daima unchanged -> saat durunca 204 ->
      // kaybeden done'ı HİÇ almaz. İki token için de finalVer-1 ile delta poll'u doğrula.
      await sleep(300)
      const dP1 = await showSince(code, T1, finalVer - 1)
      const dP2 = await showSince(code, T2, finalVer - 1)
      const p1ok = dP1.status === 200 && !!dP1.room?.server_state && !!dP1.room?.server_match?.done
      const p2ok = dP2.status === 200 && !!dP2.room?.server_state && !!dP2.room?.server_match?.done
      if (!p1ok) note('P1-DELTA-KİLİT', `since=${finalVer - 1} -> status=${dP1.status} server_state=${!!dP1.room?.server_state} done=${!!dP1.room?.server_match?.done}`)
      if (!p2ok) note('P2-DELTA-KİLİT', `since=${finalVer - 1} -> status=${dP2.status} server_state=${!!dP2.room?.server_state} done=${!!dP2.room?.server_match?.done} (KAYBEDEN KİLİDİ!)`)
      console.log(`\n✓ MAÇ BİTTİ -> ${score} kazanan=${w} (finalVer=${finalVer})`)
      console.log(`  Delta poll (since=${finalVer - 1}, gerçek istemci yolu):`)
      console.log(`    P1(beyaz): status=${dP1.status} done=${p1ok ? 'GÖRÜR ✅' : 'GÖRMEZ ❌'}`)
      console.log(`    P2(siyah): status=${dP2.status} done=${p2ok ? 'GÖRÜR ✅' : 'GÖRMEZ ❌'}`)
      return finish(score)
    }

    const turn = st.turn as string
    const tok = tokenFor(turn)
    if (!st.dice || st.dice.length === 0) {
      const r = await req('POST', `/rooms/${code}/roll`, { token: tok, command_id: randomUUID(), expected_version: ver })
      if (r.status >= 500) { note('ROLL-500', `${r.status} ${r.text.slice(0, 100)}`); break }
      else if (r.status === 409) note('ROLL-409', `v${ver} turn=${turn} (otoriter modda beklenmez!)`)
      else if (r.status !== 200 && r.status !== 428) note('ROLL', `${r.status} ${r.text.slice(0, 100)}`)
      await sleep(GAP); continue
    }
    const gs = asGS(st)
    const moves = generateMoves(newTurn({ ...gs, dice: [], diceUsed: [] }, gs.dice))
    const steps = moves.length ? moves[Math.floor(Math.random() * moves.length)].steps : []
    const mv = await req('POST', `/rooms/${code}/move`, { token: tok, command_id: randomUUID(), steps: steps.map((s: any) => ({ from: s.from, to: s.to, die: s.die })), expected_version: ver })
    if (mv.status >= 500) { note('MOVE-500', `${mv.status} ${mv.text.slice(0, 100)}`); break }
    else if (mv.status === 409) note('MOVE-409', `v${ver} turn=${turn} (otoriter modda beklenmez!)`)
    else if (mv.status === 422) note('MOVE-422', `${JSON.stringify(steps.map((s: any) => `${s.from}/${s.to}`))} dice=${JSON.stringify(gs.dice)} -> ${mv.text.slice(0, 100)}`)
    else if (mv.status !== 200 && mv.status !== 428) note('MOVE', `${mv.status}`)
    await sleep(GAP)
  }
  if (guard >= 3000) note('GUARD', 'maç bitmedi (3000 tur)')
  finish()
}

function finish(score?: string) {
  console.log(`\n=== ÖZET ===`)
  console.log(`  Skor: ${score ?? '-'}  |  Anomali: ${anoms.length}`)
  console.log(anoms.length === 0 && score ? '  ✅ 2-insan otoriter maç TEMİZ bitti; her iki oyuncu da sonucu gördü. Bug KAPALI.' : `  ⚠ ${anoms.length ? anoms.join('; ') : 'maç tamamlanmadı'}`)
  process.exit(anoms.length === 0 && score ? 0 : 1)
}
main().catch((e) => { console.error('HATA:', e?.message || e); process.exit(1) })
