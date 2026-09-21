// Bot-vs-bot CANLI online maç: iki misafir token'ıyla gerçek bir oda açar ve rastgele
// legal hamlelerle oynar; her turda gerçek istemcinin gönderdiği AYNI `snap` durumunu
// PUT'lar -> maç "Canlı Maçlar"da belirir, tarayıcıdan izlenebilir.
//
// Kullanım:
//   Yerel:  BASE=http://127.0.0.1:8000/api node scripts/_bot-match.mjs
//   Canlı:  BASE=https://tavlai.com/api  node scripts/_bot-match.mjs
// (Önce esbuild ile _bot-match.mjs üretilir; bkz scripts/build-bot-match komutu.)

import { initialState, opponent, winner } from '../src/engine/board'
import { generateMoves } from '../src/engine/moves'
import { newTurn, applyMove } from '../src/engine/game'
import { newMatch, scoreGame, matchWinner, setupNextGame, type MatchState } from '../src/engine/match'
import type { GameState, Player, Step } from '../src/engine/types'

const BASE = process.env.BASE || 'https://tavlai.com/api'
const TARGET = Number(process.env.TARGET || 3)
const STEP_MS = Number(process.env.STEP_MS || 1400) // her adım arası bekleme (izlenebilir tempo)

const tokenW = 'bot-' + Math.random().toString(36).slice(2, 12)
const tokenB = 'bot-' + Math.random().toString(36).slice(2, 12)
const tokenOf = (p: Player) => (p === 'white' ? tokenW : tokenB)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const roll = (): number[] => {
  const a = 1 + Math.floor(Math.random() * 6)
  const b = 1 + Math.floor(Math.random() * 6)
  return a === b ? [a, a, a, a] : [a, b]
}

const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' }
async function post(path: string, body: Record<string, unknown>, token: string): Promise<any> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ token, ...body }),
  })
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status} ${await res.text()}`)
  return res.json()
}
async function putRoom(code: string, state: unknown, status: string | undefined, token: string): Promise<any> {
  const res = await fetch(`${BASE}/rooms/${encodeURIComponent(code)}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ token, state, status }),
  })
  if (!res.ok) throw new Error(`PUT room -> ${res.status} ${await res.text()}`)
  return res.json()
}

// Oyun sonu puanı: tek(1) / mars(2) / çifte mars(3), küp çarpanı dışta uygulanır.
function gamePoints(s: GameState, w: Player): number {
  const loser = opponent(w)
  if (s.off[loser] > 0) return 1 // en az bir taş toplamış -> tek
  // Çifte mars: kaybedenin barda ya da kazananın iç sahasında taşı varsa.
  let bg = s.bar[loser] > 0
  for (let i = 0; i < 6; i++) {
    const idx = w === 'white' ? i : 18 + i // beyaz iç saha 1-6 (idx 0-5), siyah 19-24 (idx 18-23)
    const v = s.points[idx]
    if ((loser === 'white' && v > 0) || (loser === 'black' && v < 0)) bg = true
  }
  return bg ? 3 : 2
}

async function main() {
  const created = await post('/rooms', { name: 'Bot Beyaz', rating: 1500 }, tokenW)
  const code: string = created.room.code
  console.log(`\n🎲 Oda açıldı: ${code}`)
  console.log(`   İzle: siteyi aç -> Canlı Maçlar -> "${code}" (veya /izle/${code})\n`)
  await post(`/rooms/${encodeURIComponent(code)}/join`, { name: 'Bot Siyah', rating: 1500 }, tokenB)

  let match: MatchState = newMatch(TARGET)
  let starter: Player = Math.random() < 0.5 ? 'white' : 'black'
  let turnsPlayed = 0

  const pushSnap = async (turnStart: GameState, played: Step[], gameEnd: unknown, status?: string) => {
    const snap = {
      mode: 'online',
      difficulty: 1,
      match,
      starter,
      turnsPlayed,
      turnStart,
      played,
      clock: { delay: 12, white: 600, black: 600 },
      gameEnd: gameEnd ?? null,
      cubePending: null,
      pr: { white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } },
      luck: { white: 0, black: 0 },
      moves: [],
    }
    // Sırası gelen (hamleyi yapan) oyuncunun token'ıyla PUT (legacy: mover state'i yazar).
    await putRoom(code, snap, status, tokenOf(turnStart.turn))
  }

  while (!matchWinner(match)) {
    let state = initialState()
    state.turn = starter
    while (!winner(state)) {
      const dice = roll()
      const ts = newTurn(state, dice)
      await pushSnap(ts, [], null) // zar gösterildi
      await sleep(STEP_MS)

      const moves = generateMoves(ts)
      const mv = moves[Math.floor(Math.random() * moves.length)] ?? { steps: [] as Step[], resultKey: '' }
      const next = applyMove(ts, mv)
      turnsPlayed++

      const w = winner(next)
      if (w) {
        const pts = gamePoints(next, w) * match.cube.value
        match = scoreGame(match, w, pts)
        const over = !!matchWinner(match)
        const gameEnd = { winner: w, points: pts, mult: pts, resigned: false, dropped: false, timeout: false }
        await pushSnap(ts, mv.steps, gameEnd, over ? 'finished' : undefined)
        console.log(`  oyun bitti: ${w} +${pts}  |  skor ${match.score.white}-${match.score.black}`)
        await sleep(STEP_MS * 2)
        break // oyun bitti -> iç döngüden çık; dış döngü matchWinner'ı kontrol eder
      } else {
        await pushSnap(ts, mv.steps, null) // hamle gösterildi
        await sleep(STEP_MS)
        state = next
      }
    }
    starter = opponent(starter)
    match = setupNextGame(match)
  }
  console.log(`\n✅ Maç bitti. Skor: ${match.score.white}-${match.score.black}\n`)
}

main().catch((e) => {
  console.error('HATA:', e.message || e)
  process.exit(1)
})
