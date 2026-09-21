// CANLI gnubg botuna karsi tam bir mac oynar (sunucu-otoriter bot odasi).
// Insan tarafini (beyaz) bu script surer: legal hamleler YEREL motordan uretilir,
// zar + botun (SIYAH) hamleleri CANLI SUNUCUDAKI gnubg tarafindan uretilir.
// Boylece "yapay zeka ile mac" GERCEKTEN gnubg ile oynanmis olur.
//
//   BASE=https://www.tavlatv.com/api TARGET=7 node scripts/_gnubg-live-match.mjs
import { initialState } from '../src/engine/board'
import { generateMoves } from '../src/engine/moves'
import { newTurn } from '../src/engine/game'
import type { GameState, Step } from '../src/engine/types'
import { randomUUID } from 'node:crypto'

const BASE = process.env.BASE || 'https://www.tavlatv.com/api'
const TARGET = Number(process.env.TARGET || 7)
const LEVEL = Number(process.env.LEVEL || 10)
const GAP = Number(process.env.GAP || 250) // istekler arasi nazik bekleme (ms)

const TOKEN = 'bot-' + Math.random().toString(36).slice(2, 12)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const H = { 'content-type': 'application/json', accept: 'application/json' }

async function req(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(BASE + path, {
    method,
    headers: H,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* non-json */
  }
  return { status: res.status, json, text }
}

// server_state -> GameState (motor tipiyle uyumlu; generateMoves icin yeterli)
function asGameState(s: any): GameState {
  return {
    points: s.points.slice(),
    bar: { ...s.bar },
    off: { ...s.off },
    turn: s.turn,
    dice: (s.dice ?? []).slice(),
    diceUsed: (s.diceUsed ?? []).slice(),
  }
}

const label = (c: string) => (c === 'white' ? 'BEYAZ (ben)' : 'SIYAH (gnubg)')

async function show(code: string): Promise<any> {
  const r = await req('GET', `/rooms/${code}`)
  return r.json?.room ?? r.json
}

async function main() {
  console.log(`\ngnubg CANLI mac — ${BASE}  hedef=${TARGET} seviye=${LEVEL}\n`)

  const created = await req('POST', '/bot/rooms', {
    token: TOKEN,
    name: 'Motor Testi',
    level: LEVEL,
    target: TARGET,
  })
  if (created.status !== 200) throw new Error(`bot/rooms -> ${created.status} ${created.text}`)
  const code: string = created.json.room.code
  console.log(`Oda: ${code}  (izle: /izle/${code})\n`)

  let guard = 0
  let lastScore = ''
  let botMoves = 0
  let humanMoves = 0
  let dances = 0

  while (guard++ < 4000) {
    const room = await show(code)
    const sm = room.server_match ?? {}
    const ver = Number(room.server_version ?? 0)
    const st = room.server_state
    if (!st) {
      await sleep(GAP)
      continue
    }

    // skor degisince yaz
    const score = `${sm.score?.white ?? 0}-${sm.score?.black ?? 0}`
    if (score !== lastScore) {
      const cw = sm.isCrawford ? '  [Crawford]' : ''
      console.log(`  skor ${score}${cw}`)
      lastScore = score
    }

    if (sm.done) {
      const w = (sm.score?.white ?? 0) >= (sm.score?.black ?? 0) ? 'white' : 'black'
      console.log(`\n=== MAC BITTI === Kazanan: ${label(w)} | Skor ${score}`)
      console.log(`Insan hamlesi: ${humanMoves}, bot(gnubg) hamlesi: ${botMoves}, dans: ${dances}\n`)
      return
    }

    const turn = st.turn as string
    const cmd = randomUUID()

    if (turn === 'black') {
      // Sira botta: normalde hamlem sonrasi senkron surulur; takildiysa durt.
      const nudge = await req('POST', `/rooms/${code}/bot`, { token: TOKEN })
      if (nudge.json?.bot_status === 'unavailable') {
        console.log(`  ! gnubg mesgul/kapali (${nudge.json?.bot_reason ?? '?'}) — tekrar deniyorum`)
        await sleep(800)
      } else if (Array.isArray(nudge.json?.bot)) {
        botMoves += nudge.json.bot.length
      }
      await sleep(GAP)
      continue
    }

    // Sira bende (beyaz)
    if (!st.dice || st.dice.length === 0) {
      // Zar at (acilis veya normal)
      const r = await req('POST', `/rooms/${code}/roll`, {
        token: TOKEN,
        expected_version: ver,
        command_id: cmd,
      })
      if (r.status === 428 || r.status === 409) {
        await sleep(GAP)
        continue
      } // senkron sorunu -> tekrar oku
      if (r.status !== 200) {
        console.log(`  roll -> ${r.status} ${r.text.slice(0, 120)}`)
        await sleep(GAP)
      }
      if (Array.isArray(r.json?.bot)) botMoves += r.json.bot.length // acilis botu basladiysa
      await sleep(GAP)
      continue
    }

    // Zar dolu -> legal hamle uret, birini sec (rastgele), oyna
    const gs = asGameState(st)
    const withDice = newTurn({ ...gs, dice: [], diceUsed: [] }, gs.dice)
    const moves = generateMoves(withDice)
    let steps: Step[] = []
    if (moves.length > 0) {
      steps = moves[Math.floor(Math.random() * moves.length)].steps
    } else {
      dances++ // oynanacak hamle yok -> pas (bos steps)
    }

    const mv = await req('POST', `/rooms/${code}/move`, {
      token: TOKEN,
      steps: steps.map((s) => ({ from: s.from, to: s.to, die: s.die })),
      expected_version: ver,
      command_id: cmd,
    })
    if (mv.status === 200) {
      if (!mv.json?.ignored) humanMoves++
      if (Array.isArray(mv.json?.bot)) botMoves += mv.json.bot.length
      const w = mv.json?.winner
      if (w) {
        const pts =
          (mv.json?.match?.score?.white ?? 0) + (mv.json?.match?.score?.black ?? 0)
        console.log(`  oyun bitti: ${label(w)} kazandi (toplam puan ${pts})`)
      }
    } else if (mv.status === 409 || mv.status === 428 || mv.status === 422) {
      // desync / gecersiz (yaris) -> yeniden oku
    } else {
      console.log(`  move -> ${mv.status} ${mv.text.slice(0, 160)}`)
    }
    await sleep(GAP)
  }
  console.log('\nGUARD limiti — durduruldu (mac cok uzadi?).\n')
}

main().catch((e) => {
  console.error('HATA:', e?.message || e)
  process.exit(1)
})
