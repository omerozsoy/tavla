import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { generateMoves } from '../src/engine/moves'

type User = { id: number; token: string; nick: string }
type Step = { from: number | 'bar'; to: number | 'off'; die: number }
type Room = {
  code: string
  status: string
  server_version: number
  server_state: Parameters<typeof generateMoves>[0]
  server_match: { score?: { white?: number; black?: number }; done?: boolean; opened?: boolean }
}
const API = 'http://127.0.0.1:8000/api'

async function getRoom(request: APIRequestContext, code: string, user: User, roomToken: string): Promise<Room> {
  const r = await request.get(`${API}/rooms/${code}?token=${encodeURIComponent(roomToken)}`, { headers: { Authorization: `Bearer ${user.token}` } })
  expect(r.ok(), `oda okunamadı: ${r.status()}`).toBeTruthy()
  return (await r.json()).room as Room
}
async function clickButton(page: Page, re: RegExp) {
  const b = page.getByRole('button', { name: re }).last()
  await expect(b).toBeVisible({ timeout: 15_000 })
  await b.click()
}
async function post(request: APIRequestContext, url: string, bearer: string, data: unknown) {
  const res = await request.post(url, { timeout: 10_000, headers: { Authorization: `Bearer ${bearer}` }, data })
  return { status: res.status(), body: await res.json().catch(() => null) }
}
// Tarayıcının ÇİZDİĞİ tahta -> motor konvansiyonunda points[24] (beyaz +, siyah -). >5 taşlı
// yığında üst taş sayıyı etiket olarak taşır (.checker-count), yoksa taş elemanları sayılır.
async function readBoard(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const pts = Array<number>(24).fill(0)
    document.querySelectorAll<HTMLElement>('.board .point[data-point]').forEach((pt) => {
      const idx = Number(pt.dataset.point)
      const cs = pt.querySelectorAll('.checkers > .checker')
      if (!cs.length || !(idx >= 0 && idx < 24)) return
      const label = Number(pt.querySelector('.checkers .checker-count')?.textContent || 0)
      const n = label > cs.length ? label : cs.length
      pts[idx] = cs[0].classList.contains('black') ? -n : n
    })
    return pts
  })
}
// İki tarayıcı da sunucu tahtasını göstermeli (istemci ~1 sn'de bir yoklar -> poll ile bekle).
async function expectUiSynced(pages: Page[], nicks: string[], points: number[], label: string) {
  await Promise.all(pages.map((p, i) =>
    expect.poll(() => readBoard(p), { timeout: 15_000, message: `${nicks[i]} arayüzü sunucu tahtasını göstermiyor (${label})` }).toEqual(points),
  ))
}

test('UI audit: iki test hesabı ile beş tam oyun', async ({ browser, request }) => {
  // 5 tam oyun (yüzlerce hamle) genel 120 sn test sınırına sığmaz.
  test.setTimeout(20 * 60_000)
  mkdirSync('test-results/ui-five-game-audit', { recursive: true })
  const users = JSON.parse(readFileSync('backend/storage/app/e2e-users.json', 'utf8')) as User[]
  const errors: { player: string; type: string; message: string }[] = []
  let code = ''
  const contexts = await Promise.all(users.map(async (u) => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 720 } })
    await c.addInitScript((token) => localStorage.setItem('tavla.token', token), u.token)
    return c
  }))
  const pages = await Promise.all(contexts.map((c, i) => c.newPage().then((p) => {
    p.on('pageerror', (e) => errors.push({ player: users[i].nick, type: 'pageerror', message: e.message }))
    p.on('console', (m) => { if (m.type() === 'error' && !/google|doubleclick|analytics/i.test(m.text())) errors.push({ player: users[i].nick, type: 'console', message: m.text() }) })
    p.on('response', async (r) => { if (r.url().endsWith('/matchmaking')) { try { const body = await r.json(); if (body.room?.code) code = body.room.code } catch {} } })
    p.on('response', (r) => { if (r.status() >= 400 && /127\.0\.0\.1:8000|localhost:5199/.test(r.url())) errors.push({ player: users[i].nick, type: `http-${r.status()}`, message: r.url() }) })
    return p
  })))
  const t0 = Date.now()
  const gameRows: Record<string, unknown>[] = []
  try {
    // Paralel: sıralı goto'da ikinci sayfa ilk sayfanın soğuk-derleme süresini de bekliyordu.
    await Promise.all(pages.map((p) => p.goto('/', { waitUntil: 'domcontentloaded' })))
    await Promise.all(pages.map((p) => expect(p.locator('.app')).toBeVisible({ timeout: 15_000 })))
    await pages[0].getByRole('button', { name: /^Maç Oyunu$/ }).first().click()
    await expect(pages[0].locator('.setup-page')).toBeVisible()
    await pages[0].locator('.target-chip').filter({ hasText: '5' }).click()
    await clickButton(pages[0], /Başla|Başlat|Oyuna Başla|Devam/)
    // Arama artık BLOKLAYAN "Rakip aranıyor" kartını göstermez: oyuncu ana sayfaya döner ve
    // "Oyun Arayanlar"da kendini "Rakip Bekleniyor…" (.seek-waiting) ile görür.
    await expect(pages[0].locator('.seek-waiting')).toBeVisible({ timeout: 20_000 })
    await pages[1].getByRole('button', { name: /^Maç Oyunu$/ }).first().click()
    await expect(pages[1].locator('.setup-page')).toBeVisible()
    await pages[1].locator('.target-chip').filter({ hasText: '5' }).click()
    await clickButton(pages[1], /Başla|Başlat|Oyuna Başla|Devam/)
    await Promise.all(pages.map((p) => expect(p.locator('.board')).toBeVisible({ timeout: 30_000 })))
    await expect.poll(() => code, { timeout: 10_000 }).not.toBe('')
    const roomTokens = await Promise.all(pages.map((p) => p.evaluate(() => localStorage.getItem('tavla.playerToken') || '')))
    expect(roomTokens.every(Boolean), 'iki oturumun oda tokenı olmalı').toBeTruthy()

    // OYUN: zar/hamle doğrudan SUNUCUYA (/roll, /move) gider -> fare/animasyon zamanlamasına bağlı
    // değil. ARAYÜZ ayrıca doğrulanır: her hamleden sonra İKİ tarayıcının çizdiği tahta sunucu
    // tahtasıyla aynı olmalı. Hamleler istemci motorundan (backend validator ile aynı TS motoru).
    const nicks = users.map((u) => u.nick)
    let completedGames = 0
    let matchDone = false
    let uiChecks = 0
    const seenScores = new Set<string>()
    for (let ply = 0; ply < 3000 && completedGames < 5 && !matchDone; ply++) {
      let r = await getRoom(request, code, users[0], roomTokens[0])
      matchDone = !!r.server_match.done
      const score = `${r.server_match.score?.white ?? 0}-${r.server_match.score?.black ?? 0}`
      if (!seenScores.has(score) && score !== '0-0') {
        seenScores.add(score); completedGames++
        const started = gameRows.length ? Number(gameRows.at(-1)?.finishedAt ?? t0) : t0
        gameRows.push({ game: completedGames, score, startedAt: started, finishedAt: Date.now(), durationMs: Date.now() - started })
        await Promise.all(pages.map((p, i) => p.screenshot({ path: `test-results/ui-five-game-audit/game-${completedGames}-${users[i].nick}.png` })))
      }
      if (matchDone || completedGames >= 5) break
      if (!r.server_state) { await pages[0].waitForTimeout(500); continue }
      const color = r.server_state.turn
      const idx = color === 'white' ? 0 : 1
      const me = users[idx]
      if (!r.server_state.dice?.length) {
        const rr = await post(request, `${API}/rooms/${code}/roll`, me.token, {
          token: roomTokens[idx], expected_version: r.server_version, command_id: randomUUID(),
        })
        // 409 = yeni oyun açılışı vb. ara durum -> durumu yeniden oku.
        if (rr.status !== 200) { await pages[0].waitForTimeout(500); continue }
        r = await getRoom(request, code, me, roomTokens[idx])
        if (!r.server_state.dice?.length || r.server_state.turn !== color) continue
      }
      const moves = generateMoves(r.server_state) as { steps: Step[] }[]
      const steps = moves.length ? moves[0].steps : [] // boş = pas
      const mv = await post(request, `${API}/rooms/${code}/move`, me.token, {
        token: roomTokens[idx], steps, expected_version: r.server_version, command_id: randomUUID(),
      })
      if (mv.status === 409) continue // sunucu sırayı zaten geçirmiş (otomatik pas) / sürüm ilerlemiş
      expect(mv.status, `move(${color}) ply ${ply} steps=${JSON.stringify(steps)}`).toBe(200)

      const a = await getRoom(request, code, users[0], roomTokens[0]); const b = await getRoom(request, code, users[1], roomTokens[1])
      expect(a.server_version, `desync ply ${ply}`).toBe(b.server_version)
      expect(a.server_state, `state desync ply ${ply}`).toEqual(b.server_state)
      // Oyun bitmediyse arayüz kontrolü (oyun sonunda tahta yeni oyuna sıfırlanır -> o anı atla).
      if (a.server_state && !a.server_match.done && `${a.server_match.score?.white ?? 0}-${a.server_match.score?.black ?? 0}` === score) {
        await expectUiSynced(pages, nicks, a.server_state.points, `ply ${ply}, ${color}`)
        uiChecks++
      }
    }
    console.log(`UI audit: ${completedGames} oyun, ${uiChecks} arayüz senkron kontrolü, maç bitti=${matchDone}`)
    // 5 sayılık maç gammon/küp ile 5 oyundan önce bitebilir: o durumda maçın bitmesi de geçerli.
    expect(completedGames === 5 || matchDone, `beş tam oyun ya da maç sonu (oyun: ${completedGames})`).toBeTruthy()
    expect(uiChecks, 'arayüz senkron kontrolü yapılmalı').toBeGreaterThan(0)
  } finally {
    writeFileSync('test-results/ui-five-game-audit/summary.json', JSON.stringify({ code, elapsedMs: Date.now() - t0, games: gameRows, errors }, null, 2))
    await Promise.all(contexts.map((c) => c.close()))
  }
})
