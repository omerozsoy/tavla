// PR ÇİFT-TARAF TESTİ: iki kimlikli oyuncu (A=beyaz, B=siyah) GERÇEK authoritative online
// maç oynar (script her iki tarafı sürer), analiz log'u kurar, İKİSİ DE reportRating ile bildirir,
// sonra HER İKİ oyuncu için self PR + rakip PR'ın (gnubg async) hesaplandığını doğrular.
//
// Kullanım:  BASE=https://www.tavlatv.com/api node scripts/_prtest.mjs
import { generateMoves } from '../src/engine/moves'
import { newTurn } from '../src/engine/game'
import type { GameState } from '../src/engine/types'
import { randomUUID } from 'node:crypto'

const BASE = process.env.BASE || 'https://www.tavlatv.com/api'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rnd = () => Math.random().toString(36).slice(2, 10)

async function req(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  for (let a = 0; a < 8; a++) {
    const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' }
    if (opts.token) headers.authorization = `Bearer ${opts.token}`
    const res = await fetch(BASE + path, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
    if (res.status === 429) { await sleep(2500); continue }
    const text = await res.text(); let json: any = null; try { json = text ? JSON.parse(text) : null } catch {}
    return { status: res.status, json, text }
  }
  return { status: 429, json: null, text: 'throttle' }
}
async function register(tag: string) {
  const r = await req('POST', '/register', { body: { first_name: 'PR', last_name: tag, nickname: `prt_${tag}_${rnd()}`, email: `prt_${tag}_${rnd()}@example.com`, password: 'test123456' } })
  if (r.status !== 201) throw new Error(`register(${tag}) -> ${r.status} ${r.text.slice(0, 100)}`)
  return { bearer: r.json.token as string, id: r.json.user.id as number, rating: (r.json.user.rating ?? 1500) as number, rt: 'rt-' + rnd() }
}
function asGS(s: any): GameState {
  return { points: s.points.slice(), bar: { ...s.bar }, off: { ...s.off }, turn: s.turn, dice: (s.dice ?? []).slice(), diceUsed: (s.diceUsed ?? []).slice() }
}
// Hesap-tabanlı (invite) authoritative odada slot BEARER'dan (sanctum user) türetilir -> show/roll/move
// BEARER ile yapılmalı (oda-token'ı tek başına 403 verir). Oda-token'ı body'de yine gönderilir.
const show = async (code: string, bearer: string) => (await req('GET', `/rooms/${code}`, { token: bearer })).json?.room

async function main() {
  console.log(`\n=== PR ÇİFT-TARAF TESTİ — ${BASE} ===\n`)
  const A = await register('A'); const B = await register('B')
  console.log(`   A(beyaz) id=${A.id}  B(siyah) id=${B.id}`)

  // Authoritative online oda: davet akışı
  const inv = await req('POST', `/friends/${B.id}/invite`, { token: A.bearer, body: { target: 1, time_control: 'normal' } })
  if (inv.status !== 200) throw new Error(`invite -> ${inv.status} ${inv.text}`)
  const code = inv.json.code
  await req('POST', `/rooms/${code}/enter`, { token: A.bearer, body: { token: A.rt, name: 'PRA', time_control: 'normal' } })
  const ping = await req('POST', '/ping', { token: B.bearer })
  const invId = (ping.json?.invites || []).find((i: any) => i.code === code)?.id
  await req('POST', `/invites/${invId}/respond`, { token: B.bearer, body: { accept: true } })
  const enterB = await req('POST', `/rooms/${code}/enter`, { token: B.bearer, body: { token: B.rt, name: 'PRB', time_control: 'normal' } })
  const room0 = enterB.json?.room
  console.log(`   oda ${code}  status=${room0?.status}  authoritative=${room0?.authoritative}`)
  if (!room0?.authoritative) console.log('   ⚠ UYARI: oda authoritative değil -> online PR yolu tam test edilmeyebilir')

  const tokenOf = (turn: string) => (turn === 'white' ? A.rt : B.rt)       // body oda-token'ı
  const bearerOf = (turn: string) => (turn === 'white' ? A.bearer : B.bearer) // auth (slot bundan gelir)
  const entries: any[] = []
  let guard = 0, lastVer = -1, stale = 0, resigned = false

  while (guard++ < 3000) {
    const room = await show(code, A.bearer)
    if (!room) { console.log('   ⚠ show null (yetki/oda?)'); await sleep(300); continue }
    const sm = room.server_match ?? {}; const ver = Number(room.server_version ?? 0); const st = room.server_state
    if (ver === lastVer) stale++; else { stale = 0; lastVer = ver }
    if (stale > 40) { console.log(`   ⚠ KİLİT: v${ver} ilerlemedi (st=${st ? 'var' : 'NULL'} turn=${st?.turn} dice=${JSON.stringify(st?.dice)} status=${room.status})`); break }
    if (!st) {
      // Invite (authoritative) oda: server_state ilk roll'da lazy-init olur. p1 (beyaz) açılış roll'unu tetikle.
      const r = await req('POST', `/rooms/${code}/roll`, { token: A.bearer, body: { token: A.rt, expected_version: ver, command_id: randomUUID() } })
      console.log(`   … açılış roll (lazy-init) -> ${r.status} ${(r.text || '').slice(0, 90)}`)
      await sleep(300); continue
    }
    if (sm.done) { console.log(`   ✓ maç bitti — skor ${sm.score?.white ?? 0}-${sm.score?.black ?? 0}, ${entries.length} hamle log'landı`); break }

    const turn = st.turn as string
    const cmd = randomUUID()
    // Maçı SINIRLA: yeterince hamle loglandıysa beyaz PES etsin -> maç hızla biter, PR yine hesaplanır.
    if (entries.length >= 14 && !resigned && turn === 'white' && (!st.dice || st.dice.length === 0)) {
      const rs = await req('POST', `/rooms/${code}/resign`, { token: A.bearer, body: { token: A.rt, resign_type: 'single', expected_version: ver, command_id: cmd } })
      console.log(`   … beyaz PES etti (${entries.length} hamle sonra) -> ${rs.status}`)
      if (rs.status === 200) resigned = true
      await sleep(150); continue
    }
    if (!st.dice || st.dice.length === 0) {
      const r = await req('POST', `/rooms/${code}/roll`, { token: bearerOf(turn), body: { token: tokenOf(turn), expected_version: ver, command_id: cmd } })
      if (r.status !== 200 && r.status !== 409 && r.status !== 428) console.log(`   ⚠ roll ${turn} -> ${r.status} ${(r.text||'').slice(0,70)}`)
      await sleep(120); continue
    }
    const gs = asGS(st)
    const pos = { points: gs.points.slice(), bar: { ...gs.bar }, off: { ...gs.off } }
    const moves = generateMoves(newTurn({ ...gs, dice: [], diceUsed: [] }, gs.dice))
    const steps = moves.length ? moves[Math.floor(Math.random() * moves.length)].steps : []
    const mv = await req('POST', `/rooms/${code}/move`, { token: bearerOf(turn), body: { token: tokenOf(turn), steps: steps.map((s: any) => ({ from: s.from, to: s.to, die: s.die })), expected_version: ver, command_id: cmd } })
    if (mv.status === 200) {
      if (steps.length) { entries.push({ player: turn, pos, dice: gs.dice.slice(), playedSteps: steps.map((s: any) => ({ from: s.from, to: s.to, die: s.die })) }); if (entries.length % 5 === 0) console.log(`   … ${entries.length} hamle`) }
    } else if (mv.status !== 409 && mv.status !== 428) console.log(`   ⚠ move ${turn} -> ${mv.status} ${(mv.text||'').slice(0,70)}`)
    await sleep(120)
  }

  console.log(`\n   İki taraf da reportRating ile bildiriyor (log ekli)…`)
  const logA = JSON.stringify({ hc: 'white', log: entries })
  const logB = JSON.stringify({ hc: 'black', log: entries })
  const rrA = await req('POST', '/rating/report', { token: A.bearer, body: { won: true, opponent_rating: B.rating, room_code: code, pr: null, log: logA, match_type: 'match' } })
  const rrB = await req('POST', '/rating/report', { token: B.bearer, body: { won: false, opponent_rating: A.rating, room_code: code, pr: null, log: logB, match_type: 'match' } })
  console.log(`   reportRating A -> ${rrA.status}   B -> ${rrB.status}`)

  // Match id'leri myMatches'ten (en yeni)
  const findMatch = async (bearer: string) => {
    const m = await req('GET', '/me/matches', { token: bearer })
    const list = m.json?.matches ?? m.json ?? []
    return Array.isArray(list) && list.length ? list[0] : null
  }
  const mA = await findMatch(A.bearer); const mB = await findMatch(B.bearer)
  console.log(`   match id A=${mA?.id} B=${mB?.id}`)

  // gnubg PR (async) hazır olana kadar poll (~3dk)
  const pollPr = async (bearer: string, id: number, who: string) => {
    for (let i = 0; i < 60; i++) {
      const r = await req('GET', `/me/match-pr-tavlatv/${id}`, { token: bearer })
      if (r.json?.ready) return r.json
      await sleep(3000)
    }
    return null
  }
  console.log(`   gnubg PR bekleniyor (async)…`)
  const [prA, prB] = await Promise.all([pollPr(A.bearer, mA?.id, 'A'), pollPr(B.bearer, mB?.id, 'B')])

  // myMatches'ten son opponent_pr'ı da oku (fallback kolonu)
  const finalA = await findMatch(A.bearer); const finalB = await findMatch(B.bearer)

  const line = (who: string, pr: any, m: any) =>
    `   ${who}: self gnubg_pr=${pr?.pr ?? '—'}  gnubg_opponent_pr=${pr?.opponent_pr ?? pr?.gnubg_opponent_pr ?? '—'}  | myMatches: pr=${m?.pr ?? '—'} opponent_pr=${m?.opponent_pr ?? '—'}`
  console.log(`\n=== SONUÇ ===`)
  console.log(line('A(beyaz)', prA, finalA))
  console.log(line('B(siyah)', prB, finalB))
  console.log('\n   [HAM] matchGnubgPr A:', JSON.stringify(prA))
  console.log('   [HAM] myMatches[0] A:', JSON.stringify(finalA))
  console.log('   [HAM] logEntries:', entries.length, ' white:', entries.filter((e:any)=>e.player==='white').length, ' black:', entries.filter((e:any)=>e.player==='black').length)

  const selfA = prA?.pr ?? finalA?.pr, oppA = prA?.opponent_pr ?? prA?.gnubg_opponent_pr ?? finalA?.opponent_pr
  const selfB = prB?.pr ?? finalB?.pr, oppB = prB?.opponent_pr ?? prB?.gnubg_opponent_pr ?? finalB?.opponent_pr
  const ok = (v: any) => v != null && v !== '—'
  console.log(`\n   A: self=${ok(selfA) ? '✅' : '❌'} opponent=${ok(oppA) ? '✅' : '❌'}`)
  console.log(`   B: self=${ok(selfB) ? '✅' : '❌'} opponent=${ok(oppB) ? '✅' : '❌'}`)
  console.log(ok(selfA) && ok(oppA) && ok(selfB) && ok(oppB)
    ? '\n   ✅ HER İKİ TARAFTA da HER İKİ oyuncunun PR\'ı hesaplandı.'
    : '\n   ⚠ Eksik PR var — yukarı bak (gnubg/queue worker down olabilir ya da fallback eksik).')
}
main().catch((e) => { console.error('HATA:', e?.message || e); process.exit(1) })
