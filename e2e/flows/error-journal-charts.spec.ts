import { expect, test } from '@playwright/test'
import { users } from './helpers'

// Hata Günlüğü Özet grafikleri: çizgi (zaman içinde hata oranı), halka (derece payı), yatay çubuk
// (kategori hata oranı). Masaüstü / tablet / mobil genişlikte taşma olmamalı; hover/dokunmada değer;
// veri yoksa "Henüz veri bulunmuyor". API taklit edilir (test verisi; uygulamada gerçek veri kullanılır).
const BASE = process.env.PREVIEW_URL || 'http://localhost:5199'
const U = users[1]
const SHOT = process.env.EJC_SHOT_DIR

const cats = [
  ['backgame_late', 20, 11, 4], ['close_out', 44, 17, 6], ['opening', 57, 22, 9], ['mutual_holding', 83, 29, 12],
  ['holding_game', 29, 10, 3], ['middle_game', 140, 28, 10], ['race', 150, 2, 0], ['blitz_early', 113, 35, 15],
  ['blitz_mid_late', 85, 28, 11], ['attacking_game', 138, 29, 12], ['one_checker_back', 91, 21, 8], ['deep_anchor', 96, 23, 9],
  ['crunch', 100, 15, 5], ['six_prime', 35, 6, 2], ['backgame_early', 3, 1, 0], ['late_game_hit', 23, 3, 1],
].map(([category, decisions, errors, blunders]) => ({
  category, decisions, errors, blunders, errorRate: (errors as number) / (decisions as number), equityLoss: (errors as number) * 0.09,
}))
const trend = Array.from({ length: 7 }, (_, i) => {
  const decisions = 120 + i * 13
  const errors = Math.round(decisions * (0.28 - i * 0.015))
  return { date: `2026-10-0${i + 1}`, decisions, errors, blunders: Math.round(errors * 0.4), errorRate: errors / decisions, weekly: false }
})

function journal(empty: boolean) {
  const summary = empty
    ? { gamesAnalyzed: 1, decisionsAnalyzed: 3, totalErrors: 0, inaccuracies: 0, mistakes: 0, blunders: 0, totalEquityLoss: 0, averageEquityLoss: 0, categories: [], trend: [] }
    : { gamesAnalyzed: 51, decisionsAnalyzed: 1222, totalErrors: 280, inaccuracies: 95, mistakes: 65, blunders: 120, totalEquityLoss: 27.654, averageEquityLoss: 0.099, categories: cats, trend }
  return {
    period: '7d', from: null, to: null, entries: [], summary,
    categoryOrder: [...cats.map((c) => c.category), 'endgame_contact'],
    insights: { topWeakness: null, biggestLoss: null },
  }
}

async function open(page: import('@playwright/test').Page, empty = false) {
  await page.route('**/api/me/error-journal**', (r) => r.fulfill({ json: journal(empty) }))
  await page.route(/\/api\/me(\?.*)?$/, async (r) => {
    const res = await r.fetch()
    const body = await res.json().catch(() => null)
    if (body?.user) body.user.plan_active = 'star'
    await r.fulfill({ response: res, json: body })
  })
  await page.addInitScript((tok) => localStorage.setItem('tavla.token', tok), U.token)
  const me = page.waitForResponse((r) => /\/api\/me(\?.*)?$/.test(r.url()), { timeout: 30_000 })
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await me
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: 'Tümünü Kabul Et' }).click().catch(() => {})
  // Kullanıcı yüklendikten sonra uygulama içi yönlendirme (SPA popstate) ile aç.
  await page.evaluate(() => {
    window.history.pushState(null, '', '/hata-gunlugu')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.locator('.ej-card').first().waitFor({ timeout: 15_000 })
}

for (const [name, vp] of [
  ['masaustu', { width: 1400, height: 1000 }],
  ['tablet', { width: 820, height: 1100 }],
  ['mobil', { width: 390, height: 844 }],
] as const) {
  test(`özet grafikleri (${name}): render, taşma yok, değer gösterimi`, async ({ page }) => {
    await page.setViewportSize(vp)
    await open(page)
    const bars = page.locator('.ejc-bar-row')
    await expect(bars).toHaveCount(16)
    // Sıralı: ilk çubuk en yüksek oran (Geri oyun, geç %55), vurgulu ilk 5
    await expect(bars.first()).toContainText('%55')
    await expect(page.locator('.ejc-bar-row.hot')).toHaveCount(5)
    await expect(page.locator('.ejc-note')).toContainText('Henüz verisi olmayan')
    // Halka: toplam + 3 dilim
    await expect(page.locator('.ejc-donut-num')).toHaveText('280')
    await expect(page.locator('.ejc-legend li')).toHaveCount(3)
    await expect(page.locator('.ejc-line')).toHaveCount(1)

    // Yatay taşma yok: grafik kartları sayfadan/kaptan taşmıyor
    const overflow = await page.evaluate(() => {
      const bad: string[] = []
      for (const el of document.querySelectorAll('.ejc-card, .ejc-trend svg, .ejc-bar-row, .ejc-donut')) {
        const r = el.getBoundingClientRect()
        const parent = (el.closest('.ej-card') ?? document.body).getBoundingClientRect()
        if (r.right > parent.right + 1 || r.left < parent.left - 1) bad.push(el.className.toString())
      }
      return { bad, docW: document.documentElement.scrollWidth, winW: window.innerWidth }
    })
    expect(overflow.bad).toEqual([])
    expect(overflow.docW).toBeLessThanOrEqual(overflow.winW)

    // Değer gösterimi: halka (dokun/hover) + çizgi crosshair + çubuk tooltip
    await page.locator('.ejc-legend li').nth(2).hover()
    await expect(page.locator('.ejc-donut-sub')).toContainText('Blunder')
    await page.locator('.ejc-trend').scrollIntoViewIfNeeded()
    const trendBox = (await page.locator('.ejc-trend').boundingBox())!
    await page.mouse.move(trendBox.x + trendBox.width * 0.6, trendBox.y + trendBox.height / 2)
    await expect(page.locator('.ejc-trend .ejc-tip')).toContainText('karar')
    if (SHOT) await page.screenshot({ path: `${SHOT}/ejc-${name}-trend.png` })
    if (name !== 'mobil') {
      await bars.first().hover()
      await expect(page.locator('.ejc-bar-tip')).toContainText('blunder')
    }
    if (SHOT) {
      await page.locator('.ejc-row').scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${SHOT}/ejc-${name}.png`, fullPage: true })
    }
    // Çubuğa tıkla -> kategori filtresi
    await bars.first().click()
    await expect(bars.first()).toHaveClass(/\bon\b/)
  })
}

test('özet grafikleri: veri yoksa "Henüz veri bulunmuyor"', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, true)
  await expect(page.locator('.ejc-empty')).toHaveCount(3)
  await expect(page.locator('.ejc-empty').first()).toContainText('Henüz veri bulunmuyor')
  if (SHOT) await page.screenshot({ path: `${SHOT}/ejc-empty.png`, fullPage: true })
})

test('özet grafikleri: koyu tema', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.addInitScript(() => localStorage.setItem('tavla.theme', 'dark'))
  await open(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('.ejc-bar-row.hot')).toHaveCount(5)
  if (SHOT) {
    await page.locator('.ejc-row').scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${SHOT}/ejc-dark.png` })
  }
})

// KULLANICI ŞİKÂYETİ: "/hata-gunlugu sayfayı yenileyince en üste atıyor; kaldığım yerden devam etmek
// istiyorum". Yenilemede kaydırma konumu + sekme/dönem korunur (src/scrollRestore.ts).
for (const [name, vp] of [
  ['masaustu', { width: 1280, height: 800 }],
  ['mobil', { width: 390, height: 844 }],
] as const) {
  test(`yenilemede kaldığı yerden devam (${name})`, async ({ page }) => {
    await page.setViewportSize(vp)
    await open(page)
    await page.getByRole('tab', { name: '30 Gün' }).click()
    const pos = async () =>
      page.evaluate(() => {
        for (const sel of ['.register-overlay.page', '.app.lobby', '.lobby-main', '.page-host', '.main', '.register-card']) {
          const el = document.querySelector(sel) as HTMLElement | null
          if (el && el.scrollTop > 0) return el.scrollTop
        }
        return window.scrollY
      })
    // Kategori grafiğinin ortasına kadar kaydır
    await page.locator('.ejc-bar-row').nth(8).scrollIntoViewIfNeeded()
    await page.mouse.wheel(0, 200)
    // Kaydırma (yumuşak) bitene kadar bekle -> kararlı konum
    let before = -1
    for (let k = 0; k < 20; k++) {
      await page.waitForTimeout(150)
      const p = await pos()
      if (p === before) break
      before = p
    }
    await page.waitForTimeout(300)
    expect(before).toBeGreaterThan(300)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/hata-gunlugu$/)
    await expect.poll(pos, { timeout: 15_000 }).toBeGreaterThan(before - 40)
    expect(Math.abs((await pos()) - before)).toBeLessThanOrEqual(40)
    await expect(page.getByRole('tab', { name: '30 Gün' })).toHaveClass(/active/)
  })
}
