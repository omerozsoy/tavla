import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
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
async function waitVersion(request: APIRequestContext, code: string, user: User, roomToken: string, before: number) {
  await expect.poll(async () => (await getRoom(request, code, user, roomToken)).server_version, { timeout: 15_000 }).toBeGreaterThan(before)
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
    await expect(pages[0].getByRole('heading', { name: /Rakip aranıyor/ })).toBeVisible({ timeout: 20_000 })
    await pages[1].getByRole('button', { name: /^Maç Oyunu$/ }).first().click()
    await expect(pages[1].locator('.setup-page')).toBeVisible()
    await pages[1].locator('.target-chip').filter({ hasText: '5' }).click()
    await clickButton(pages[1], /Başla|Başlat|Oyuna Başla|Devam/)
    await Promise.all(pages.map((p) => expect(p.locator('.board')).toBeVisible({ timeout: 30_000 })))
    await expect.poll(() => code, { timeout: 10_000 }).not.toBe('')
    const roomTokens = await Promise.all(pages.map((p) => p.evaluate(() => localStorage.getItem('tavla.playerToken') || '')))
    expect(roomTokens.every(Boolean), 'iki oturumun oda tokenı olmalı').toBeTruthy()

    let completedGames = 0
    const seenScores = new Set<string>()
    for (let turn = 0; turn < 1200 && completedGames < 5; turn++) {
      let r = await getRoom(request, code, users[0], roomTokens[0])
      if (r.server_match.done) break
      const score = `${r.server_match.score?.white ?? 0}-${r.server_match.score?.black ?? 0}`
      if (!seenScores.has(score) && score !== '0-0') {
        seenScores.add(score); completedGames++
        const started = gameRows.length ? Number(gameRows.at(-1)?.startedAt ?? t0) : t0
        gameRows.push({ game: completedGames, score, startedAt: started, finishedAt: Date.now(), durationMs: Date.now() - started })
        await Promise.all(pages.map((p, i) => p.screenshot({ path: `test-results/ui-five-game-audit/game-${completedGames}-${users[i].nick}.png` })))
      }
      if (!r.server_state) { await pages[0].waitForTimeout(500); continue }
      const color = r.server_state.turn
      const playerIndex = color === 'white' ? 0 : 1
      const me = users[playerIndex]
      const page = pages[playerIndex]
      if (!r.server_state.dice?.length) {
        const before = r.server_version
        const roll = page.getByRole('button', { name: /Zar At/ }).last()
        if (await roll.isVisible().catch(() => false)) await roll.click()
        await waitVersion(request, code, me, roomTokens[playerIndex], before)
        r = await getRoom(request, code, me, roomTokens[playerIndex])
      }
      const moves = generateMoves(r.server_state) as { steps: Step[] }[]
      if (!moves.length) { await page.waitForTimeout(1200); continue }
      const before = r.server_version
      for (const s of moves[0].steps) {
        if (s.from === 'bar') await page.locator('[data-slot="bar"]').click()
        else await page.locator(`.point[data-point="${s.from}"]`).click()
        if (s.to === 'off') await page.locator('[data-slot="off"]').click()
        else await page.locator(`.point[data-point="${s.to}"]`).click()
      }
      await clickButton(page, /Onayla|Onay/)
      await waitVersion(request, code, me, roomTokens[playerIndex], before)
      const a = await getRoom(request, code, users[0], roomTokens[0]); const b = await getRoom(request, code, users[1], roomTokens[1])
      expect(a.server_version, `desync turn ${turn}`).toBe(b.server_version)
      expect(a.server_state, `state desync turn ${turn}`).toEqual(b.server_state)
    }
    expect(completedGames, 'beş tam oyun tamamlanmalı').toBe(5)
  } finally {
    writeFileSync('test-results/ui-five-game-audit/summary.json', JSON.stringify({ code, elapsedMs: Date.now() - t0, games: gameRows, errors }, null, 2))
    await Promise.all(contexts.map((c) => c.close()))
  }
})
