import { expect, test, type APIRequestContext } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Faz 2 tam-stack OYUN E2E'si: gerçek backend + Node validator üzerinden 2 oyuncu EŞLEŞİR ve
// GERÇEKTEN HAMLE OYNAR. Amaç: "iki oyuncu da (beyaz p1 VE siyah p2) authoritative modda zar
// atıp hamle yapabiliyor mu, sıra dönüyor mu" sorusunu uçtan uca kanıtlamak.
//
// NEDEN: canlıda p2(siyah) authoritative'de HİÇ oynayamıyordu ("zar atıldı oynayamadım").
// O bug'ın istemci-render (onlineReady) tarafı isOnlineReady saf testiyle kapandı; BU test ise
// SUNUCU tarafını kanıtlar: backend her iki rengin de roll/move'unu kabul eder + sıra alternatif.
// Hamleleri validator'ın KENDİ legal-move üreticisinden alıp geri gönderiyoruz (round-trip yasal).
//
// Not: tam-stack (backend e2e + validator + vite) Playwright tarafından yönetilir; bu test API
// (request fixture) ile oynar, tarayıcı gerekmez — deterministik + hızlı. Vite yalnız smoke için.
const API = 'http://127.0.0.1:8000/api'
const VALIDATOR = 'http://127.0.0.1:8091'
const VALIDATOR_SECRET = 'e2esecret'
const users = JSON.parse(readFileSync('backend/storage/app/e2e-users.json', 'utf8')) as {
  id: number
  token: string
  nick: string
}[]

type Step = { from: unknown; to: unknown; die: number }
type Move = { steps: Step[]; resultKey: string }

async function post(request: APIRequestContext, url: string, bearer: string, data: unknown) {
  const res = await request.post(url, { headers: { Authorization: `Bearer ${bearer}` }, data })
  const body = await res.json().catch(() => null)
  return { status: res.status(), body }
}

// Oda durumunu OKU (showRoom -> {room}). server_state.turn + dice ile kimin oynayacağını bulur.
async function getRoom(request: APIRequestContext, code: string, bearer: string, token: string) {
  const res = await request.get(`${API}/rooms/${code}?token=${token}`, {
    headers: { Authorization: `Bearer ${bearer}` },
  })
  const body = await res.json()
  return body.room as {
    authoritative: boolean
    server_version: number
    server_state: { turn: 'white' | 'black'; dice: number[] } & Record<string, unknown>
    server_match: Record<string, unknown>
  }
}

// Validator'ın KENDİ legal-move üreticisi (backend move doğrulaması ile AYNI TS motoru).
async function legalMoves(request: APIRequestContext, state: unknown): Promise<Move[]> {
  const res = await request.post(`${VALIDATOR}/legal-moves`, {
    headers: { 'x-validator-secret': VALIDATOR_SECRET },
    data: { state },
  })
  expect(res.status(), 'validator /legal-moves 200').toBe(200)
  return (await res.json()).moves as Move[]
}

const mmBody = (token: string, name: string) => ({
  token,
  name,
  rating: 1500,
  stake: 100,
  targets: [1],
  time_control: 'normal',
})

test('tam stack: 2 oyuncu eşleşir + GERÇEKTEN oynar (beyaz VE siyah hamle yapar, sıra döner)', async ({
  request,
}) => {
  // ---- 1) Eşleşme -> authoritative oda ----
  const r1 = await post(request, `${API}/matchmaking`, users[0].token, mmBody('e2e-room-p1', users[0].nick))
  expect(r1.status).toBe(200)
  expect(r1.body.matched, 'p1 havuza girer (rakip yok)').toBeFalsy()

  const r2 = await post(request, `${API}/matchmaking`, users[1].token, mmBody('e2e-room-p2', users[1].nick))
  expect(r2.status).toBe(200)
  expect(r2.body.matched, 'p2 p1 ile eşleşmeli').toBe(true)
  expect(r2.body.room.authoritative, 'allow-list 1,2 -> authoritative').toBe(true)
  const code: string = r2.body.room.code
  expect(code).toBeTruthy()

  // Renk -> (bearer, oda-token). p1=beyaz, p2=siyah (slotColor).
  const P = {
    white: { bearer: users[0].token, token: 'e2e-room-p1' },
    black: { bearer: users[1].token, token: 'e2e-room-p2' },
  } as const

  // ---- 2) Açılış elini tetikle (kim çağırırsa sunucu adil başlayanı seçer) ----
  const open = await post(request, `${API}/rooms/${code}/roll`, P.white.bearer, { token: P.white.token })
  expect(open.status, 'açılış roll 200').toBe(200)
  expect(open.body.opening, 'ilk roll açılış eli olmalı').toBe(true)

  // ---- 3) GERÇEK OYUN DÖNGÜSÜ: sırası gelen zar atar (yoksa) + validator'dan yasal hamleyi oynar ----
  const movedColors = new Set<'white' | 'black'>()
  const turnOrder: ('white' | 'black')[] = []
  let matchDone = false
  let winner: string | null = null
  const MAX_PLIES = 20 // iki rengi de + sıra alternasyonunu kanıtlamaya fazlasıyla yeter (throttle-altı)

  for (let ply = 0; ply < MAX_PLIES && !matchDone; ply++) {
    let room = await getRoom(request, code, P.white.bearer, P.white.token)
    const color = room.server_state.turn
    const me = P[color]

    // Zar yoksa sıra sahibi atar (açılışta başlayanın zarı zaten dolu).
    if (!room.server_state.dice || room.server_state.dice.length === 0) {
      const rr = await post(request, `${API}/rooms/${code}/roll`, me.bearer, { token: me.token })
      expect(rr.status, `roll(${color}) 200`).toBe(200)
      room = await getRoom(request, code, P.white.bearer, P.white.token)
    }

    // Validator'dan tam-tur yasal hamle dizisi (boş = pas). İlkini oyna.
    const moves = await legalMoves(request, room.server_state)
    expect(Array.isArray(moves), 'legal-moves dizi döndürür').toBe(true)
    const steps = moves.length ? moves[0].steps : []

    const preVersion = room.server_version
    const mv = await post(request, `${API}/rooms/${code}/move`, me.bearer, { token: me.token, steps })
    expect(mv.status, `move(${color}) 200 — steps=${JSON.stringify(steps)}`).toBe(200)
    expect(mv.body.version, 'hamle server_version artırmalı').toBeGreaterThan(preVersion)

    movedColors.add(color)
    turnOrder.push(color)
    matchDone = !!mv.body.match_done
    winner = mv.body.winner ?? winner

    // Maç bitmediyse sıra RAKİBE geçmeli (tur alternasyonu).
    if (!matchDone && mv.body.state) {
      expect(mv.body.state.turn, 'hamle sonrası sıra rakibe geçmeli').toBe(color === 'white' ? 'black' : 'white')
    }
  }

  // ---- KANIT: iki renk de en az bir hamle yaptı -> hem p1(beyaz) hem p2(SİYAH) OYNAYABİLDİ ----
  // (Canlı bug'ın tam tersi: siyah artık kilitli değil, sunucu hamlesini kabul ediyor.)
  expect(movedColors.has('white'), 'beyaz (p1) en az bir hamle yapmalı').toBe(true)
  expect(movedColors.has('black'), 'siyah (p2) en az bir hamle yapmalı').toBe(true)

  // Sıra gerçekten ALTERNATİF aktı (arka arkaya aynı renk iki tam-tur oynamadı).
  for (let i = 1; i < turnOrder.length; i++) {
    expect(turnOrder[i], `ply ${i}: sıra alternatif olmalı`).not.toBe(turnOrder[i - 1])
  }

  // Maç erken bittiyse kazanan tutarlı olmalı (nadiren <20 ply; genelde bitmez, sorun değil).
  if (matchDone) expect(['white', 'black']).toContain(winner)
})
