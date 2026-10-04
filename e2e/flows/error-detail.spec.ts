import { expect, test } from '@playwright/test'
import { users } from './helpers'
import { initialState } from '../../src/engine/board'
import { generateMoves } from '../../src/engine/moves'
import { moveNotation } from '../../src/engine/notation'

// KULLANICI ŞİKÂYETİ (Hata Günlüğü detayı): (1) zar metin "5-4" -> ikon olmalı; (2) siyah oyuncunun
// hamlesi "23/18 18/14" yazarken tahta beyaz bakışından numaralıydı (oklar 2→7→11 görünüyordu);
// (3) gnubg hakemli kayıtta "En İyi Hamle" boş ("—") ve tıklanınca tahtada gösterilmiyordu.
// Hata günlüğü API'si sahte kayıtla taklit edilir. Vite (dev :5199 ya da PREVIEW_URL) + e2e backend.
const BASE = process.env.PREVIEW_URL || 'http://localhost:5199'
const U = users[1]

test('hata detayı: zar ikonları, oyuncu bakışı, tıklanınca en iyi hamle', async ({ page }) => {
  const pos = { ...initialState(), turn: 'black' as const, dice: [5, 4], diceUsed: [false, false] }
  const moves = generateMoves(pos)
  const played = moves.find((m) => moveNotation(m, 'black') === '24/20 24/19') ?? moves[moves.length - 1]
  const playedNotation = moveNotation(played, 'black')
  const entry = {
    id: '1', matchId: '1', playedAt: new Date().toISOString(), moveNumber: 1, category: 'blitz',
    // Şikâyet senaryosu: eski kayıt — kayıp gnubg'den, 'best' wildbg'den ve OYNANANLA AYNI.
    tags: [], severity: 'blunder', equityLoss: 0.274, playedMove: playedNotation, bestMove: playedNotation, engine: 'gnubg',
    playedEquity: null, bestEquity: null, dice: [5, 4], player: 'black', myPip: 167, opponentPip: 167,
    position: pos, bestSteps: played.steps, playedSteps: played.steps, alternatives: [],
  }
  await page.route('**/api/me/error-journal**', (r) =>
    r.fulfill({
      json: {
        period: '7d', from: null, to: null, entries: [entry], categoryOrder: ['blitz'],
        summary: { totalDecisions: 10, totalErrors: 1, inaccuracies: 0, mistakes: 0, blunders: 1, totalEquityLoss: 0.274, averageEquityLoss: 0.027, categories: [{ id: 'blitz', decisions: 10, errors: 1, blunders: 1, mistakes: 0, inaccuracies: 0, equityLoss: 0.274, errorRate: 0.1, avgLoss: 0.274 }] },
        insights: { topWeakness: null, biggestLoss: null },
      },
    }),
  )
  // Hata Günlüğü premium özelliği: /api/me yanıtında planı 'star' göster (test kullanıcısı değişmez).
  await page.route(/\/api\/me(\?.*)?$/, async (r) => {
    const res = await r.fetch()
    const body = await res.json().catch(() => null)
    if (body && typeof body === 'object') {
      const u = (body as { user?: Record<string, unknown> }).user ?? (body as Record<string, unknown>)
      u.plan_active = 'star'
    }
    await r.fulfill({ response: res, json: body })
  })
  // Tek motor gnubg: en iyi hamle /api/analyze-position'dan (gnubg) gelir — burada taklit.
  let gnubgAsked = 0
  await page.route('**/api/analyze-position', (r) => {
    gnubgAsked++
    return r.fulfill({ json: { engine: 'tavlatv', moves: [{ notation: '13/8 24/20', equity: 0.1, probs: null }, { notation: playedNotation, equity: -0.174, probs: null }] } })
  })
  await page.addInitScript((tok) => localStorage.setItem('tavla.token', tok), U.token)
  await page.goto(BASE + '/hata-gunlugu', { waitUntil: 'domcontentloaded' })
  // Derin link (/hata-gunlugu) kullanıcı yüklenmeden işlenebilir -> menüden aç.
  await expect(page.getByText('Bonus').first()).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Tümünü Kabul Et' }).click().catch(() => {})
  if (!(await page.locator('.ej-err').count())) {
    await page.getByText('Araçlar', { exact: false }).first().click()
    await page.getByText('Hata Günlüğü').first().click()
  }
  await page.locator('.ej-err').first().click({ timeout: 30_000 })
  const detail = page.locator('.ej-detail')
  await expect(detail.locator('.ej-dice .ej-die')).toHaveCount(2)
  // Siyah oyuncu -> tahta siyahın bakışından: alt-sağ köşe etiketi 1 = siyahın 1 noktası (abs 24).
  await expect(detail.locator('.ej-drow-btn.active')).toContainText(playedNotation)
  // Numaralar hamleyi yapanın bakışından: alt-sağ köşe 1, üst-sağ köşe 24 (yazılı notasyonla aynı).
  const nums = (await detail.locator('.board').innerText()).match(/\d+/g) ?? []
  expect(nums).toContain('24')
  const bestBtn = detail.locator('.ej-drow-btn').nth(1)
  await expect(bestBtn.locator('code')).not.toHaveText(/^(—|…)$/, { timeout: 30_000 })
  const bestText = (await bestBtn.locator('code').innerText()).trim()
  expect(gnubgAsked).toBeGreaterThan(0)
  expect(bestText).not.toBe(playedNotation) // "Senin Hamlen = En İyi Hamle" çelişkisi yok
  expect(bestText.split(' ').sort()).toEqual(['13/8', '24/20'])
  await bestBtn.click()
  await expect(bestBtn).toHaveClass(/active/)
  await page.screenshot({ path: process.env.EJ_SHOT || test.info().outputPath('error-detail.png') })
})
