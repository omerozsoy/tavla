// BOT SAAT ATFETME TEŞHİSİ — "sıra bilgisayarda ama benim vaktim azalıyor" (özellikle mobil).
//
// KÖK NEDEN: Bot maçında bot hamlesi SUNUCUDA anında oynanır ve driveBot, sırayı/saati aynı
// istekte insana (p1) geri devreder (started_at = şimdi). Ama insanın İSTEMCİSİ botun hamlesini
// reveal/animasyonla gösterip (zar ~0.85sn + adımlar + tur-devri ~0.5sn) sonra oto-roll (~0.5sn)
// eder — bu wall-clock süre gerçekte "botun turu" gibi görünür ama saat p1'e döndüğü için insanın
// bankasından işler. Mobilde timer kısıldığında bu pencere `delay`'i aşar → her turda banka sızar.
//
// FIX: driveBot bot turunu sürdükten sonra graceHumanAfterBot() insanın İLK segmentinin started_at'ını
// MatchClock::BOT_REVEAL_GRACE (4.5sn) kadar İLERİ iter → reveal süresi insana yazılmaz.
//
// BU TEST insan istemcisi gibi davranır: açılış + bir beyaz hamle (bu hamle botu senkron oynatır),
// sonra ROLL ETMEDEN saati ~9sn boyunca poll eder. clientView `delay` remaining sinyali:
//   • GRACE VARSA: bot turundan sonra `delay` ~grace sn DÜZ kalır (elapsed 0'a kırpılır), sonra düşer.
//   • GRACE YOKSA (eski davranış): `delay` t0'dan İTİBAREN hemen düşmeye başlar.
// Ölçülen "düz süre" (flat duration) ≈ BOT_REVEAL_GRACE ise FIX çalışıyor demektir.
//
// Fix undeployed olduğu için VARSAYILAN yerel sunucu (php artisan serve). Override: BASE=...
//   BASE=http://127.0.0.1:8000/api npx tsx scripts/botclocktest.ts
import { generateMoves } from '../src/engine/moves'
import { newTurn } from '../src/engine/game'
import type { GameState } from '../src/engine/types'
import { randomUUID } from 'node:crypto'

const BASE = process.env.BASE || 'http://127.0.0.1:8000/api'
const GRACE_EXPECTED = 4.5 // MatchClock::BOT_REVEAL_GRACE ile AYNI olmalı
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rnd = () => Math.random().toString(36).slice(2, 10)

async function req(method: string, path: string, opts: { bearer?: string; body?: unknown } = {}) {
  for (let a = 0; a < 8; a++) {
    const h: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' }
    if (opts.bearer) h.authorization = `Bearer ${opts.bearer}`
    const res = await fetch(BASE + path, { method, headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
    if (res.status === 429) { await sleep(2000); continue }
    const text = await res.text(); let json: any = null; try { json = text ? JSON.parse(text) : null } catch {}
    return { status: res.status, json, text }
  }
  return { status: 429, json: null, text: 'throttle' }
}
const asGS = (s: any): GameState => ({ points: s.points.slice(), bar: { ...s.bar }, off: { ...s.off }, turn: s.turn, dice: (s.dice ?? []).slice(), diceUsed: (s.diceUsed ?? []).slice() })
const show = async (code: string, b: string) => (await req('GET', `/rooms/${code}`, { bearer: b })).json?.room

async function main() {
  console.log(`\n=== BOT SAAT ATFETME TEŞHİSİ — ${BASE} ===\n`)
  const reg = await req('POST', '/register', { body: { first_name: 'B', last_name: 'CLK', nickname: `bclk_${rnd()}`, email: `bclk_${rnd()}@example.com`, password: 'test123456' } })
  if (reg.status !== 201) throw new Error(`register -> ${reg.status} ${reg.text.slice(0, 160)}  (yerel sunucu ayakta mı? BASE=${BASE})`)
  const bearer = reg.json.token as string
  const rt = 'rt-' + rnd()

  // normal mod: delay=10sn, per-point 60sn -> banka=60sn. target=1.
  const created = await req('POST', '/bot/rooms', { bearer, body: { token: rt, name: 'BCLK', level: 10, target: 1, time_control: 'normal' } })
  if (created.status !== 200) throw new Error(`bot/rooms -> ${created.status} ${created.text.slice(0, 160)}`)
  const code = created.json.room.code
  console.log(`   oda ${code} (normal, t=1, L10)  authoritative=${created.json.room.authoritative}\n`)

  // 1) Açılış + İLK beyaz hamleyi yap. move yanıtı botu SENKRON oynatır (bot[]) ve sıra beyaza döner.
  let t0 = 0
  let guard = 0
  while (guard++ < 200) {
    const room = await show(code, bearer)
    if (!room) { await sleep(150); continue }
    const ver = Number(room.server_version ?? 0)
    const st = room.server_state
    if (!st) { await req('POST', `/rooms/${code}/roll`, { bearer, body: { token: rt, expected_version: ver, command_id: randomUUID() } }); await sleep(200); continue }
    if (st.turn === 'black') { await req('POST', `/rooms/${code}/bot`, { bearer, body: { token: rt } }); await sleep(150); continue }
    if (!st.dice || st.dice.length === 0) { await req('POST', `/rooms/${code}/roll`, { bearer, body: { token: rt, expected_version: ver, command_id: randomUUID() } }); await sleep(150); continue }
    // Beyaz turu + zar var -> rastgele legal hamle yap (bu hamle botu senkron oynatır).
    const gs = asGS(st)
    const moves = generateMoves(newTurn({ ...gs, dice: [], diceUsed: [] }, gs.dice))
    const steps = moves.length ? moves[Math.floor(Math.random() * moves.length)].steps : []
    const cmd = randomUUID()
    const mv = await req('POST', `/rooms/${code}/move`, { bearer, body: { token: rt, steps: steps.map((s: any) => ({ from: s.from, to: s.to, die: s.die })), expected_version: ver, command_id: cmd } })
    if (mv.status !== 200) { console.log(`   move -> ${mv.status} ${mv.text.slice(0, 100)}`); await sleep(150); continue }
    const botTurns = Array.isArray(mv.json?.bot) ? mv.json.bot.length : 0
    // t0 = botun senkron oynadığı, sıranın beyaza döndüğü an. Bundan sonra ROLL ETMEYECEĞİZ.
    t0 = Date.now()
    console.log(`   ✓ beyaz hamlesi yapıldı, bot senkron ${botTurns} tur oynadı -> sıra/saat sunucuda beyaza döndü (t0).`)
    console.log(`   Şimdi ROLL ETMEDEN saat ~9sn poll ediliyor (yavaş/mobil istemci simülasyonu)...\n`)
    break
  }
  if (!t0) throw new Error('Gözlem başlangıcı (t0) yakalanamadı — açılış/hamle akışı beklenmedik.')

  // 2) ROLL ETMEDEN saati poll et. `delay` remaining zaman serisini kaydet.
  type Sample = { t: number; delay: number; white: number; black: number; active: string | null }
  const series: Sample[] = []
  const OBSERVE_MS = 9000
  while (Date.now() - t0 < OBSERVE_MS) {
    const room = await show(code, bearer)
    const clk = room?.clock
    if (clk) {
      series.push({ t: (Date.now() - t0) / 1000, delay: Number(clk.delay), white: Number(clk.white), black: Number(clk.black), active: clk.active ?? null })
    }
    await sleep(500)
  }

  // 3) Analiz: `delay` remaining ilk kez baştan >0.7sn düştüğü an = "sızıntı başlangıcı".
  console.log('   t(sn)  delay  white  black  active')
  for (const s of series) console.log(`   ${s.t.toFixed(1).padStart(4)}   ${s.delay.toFixed(1).padStart(4)}  ${s.white.toFixed(1).padStart(5)} ${s.black.toFixed(1).padStart(6)}  ${s.active ?? '-'}`)

  const d0 = series[0]?.delay ?? 0
  let onset = Number.POSITIVE_INFINITY
  for (const s of series) { if (d0 - s.delay > 0.7) { onset = s.t; break } }
  const active0 = series[0]?.active ?? null

  console.log(`\n=== ANALİZ ===`)
  console.log(`   ilk örnek: delay=${d0.toFixed(1)}sn  active=${active0}  (t0 sonrası ~${series[0]?.t.toFixed(1)}sn)`)
  console.log(`   'delay' remaining düşmeye başladığı an (sızıntı başlangıcı): ${Number.isFinite(onset) ? onset.toFixed(1) + 'sn' : '9sn içinde düşmedi'}`)
  console.log(`   beklenen grace (BOT_REVEAL_GRACE): ~${GRACE_EXPECTED}sn\n`)

  // Sunucu, botun senkron oynamasının HEMEN ardından sırayı beyaza (p1) devrettiği için active
  // beklendiği gibi 'white' olmalı (bu zaten "saat botun turunda insana yazılıyor" gerçeğini kanıtlar).
  if (active0 !== 'white') {
    console.log(`   ℹ Not: ilk örnekte active=${active0} (beklenen 'white'). Örnekleme t0'dan geç başlamış olabilir.`)
  }
  // FIX doğrulaması: grace varsa delay ~grace sn düz kalır (onset >= ~grace - margin).
  if (onset >= GRACE_EXPECTED - 1.5) {
    console.log(`   ✅ GEÇTİ: 'delay' ~${Number.isFinite(onset) ? onset.toFixed(1) : '≥9'}sn düz kaldı (≈ grace). Reveal süresi insana YAZILMIYOR — FIX çalışıyor.`)
  } else {
    console.log(`   ❌ KALDI: 'delay' t0'dan ~${onset.toFixed(1)}sn sonra düşmeye başladı (grace yok). Bot turu penceresi hâlâ insana yazılıyor.`)
    console.log(`      -> Sunucu fix'i deploy edilmemiş olabilir (php artisan serve yeniden başlat) ya da graceHumanAfterBot çağrılmıyor.`)
  }
}
main().catch((e) => { console.error('HATA:', e?.message || e); process.exit(1) })
