import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

// Kız Tavlası (yalnız istemci, bilgisayara karşı): 5 tam oyun UI'dan. İnsan sırasında oynanabilir
// (draggable) ilk haneye dokunulur; zar otomatik. Her oyun sonunda sonuç kartı + "Yeniden Oyna".
const OUT = 'test-kanitlari/flows'
mkdirSync(OUT, { recursive: true })

for (const [label, device] of [['masaüstü', { viewport: { width: 1280, height: 800 } }], ['mobil', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]] as const) {
  test(`Kız Tavlası ${label}: bilgisayara karşı tam oyunlar`, async ({ browser }) => {
    test.setTimeout(20 * 60_000)
    const ctx = await browser.newContext(device)
    const page = await ctx.newPage()
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error' && !/google|analytics|ERR_|fonts|Failed to load resource/i.test(m.text())) errors.push(m.text()) })
    // Vite DEV'de derin bağlantı overlay'i açmaz (bkz responsive.spec) -> menüden aç.
    await page.goto('/kiz-tavlasi', { waitUntil: 'domcontentloaded' })
    if (!(await page.locator('.kiz-topbar').isVisible({ timeout: 8000 }).catch(() => false))) {
      const menu = page.getByRole('button', { name: /menü|menu/i }).first()
      if (await menu.isVisible().catch(() => false)) await menu.click()
      const fun = page.getByRole('button', { name: /^EĞLENCE$/ }).first()
      if (await fun.isVisible().catch(() => false)) await fun.click()
      await page.getByRole('button', { name: /Kız Tavlası/ }).first().click()
    }
    await expect(page.locator('.kiz-topbar')).toBeVisible({ timeout: 30_000 })
    const games: { result: string; ms: number; clicks: number }[] = []
    const target = label === 'masaüstü' ? 5 : 2
    let t0 = Date.now(), clicks = 0
    for (let i = 0; i < 4000 && games.length < target; i++) {
      if (await page.locator('.kiz-result').isVisible().catch(() => false)) {
        const txt = (await page.locator('.kiz-result-card').innerText()).replace(/\s+/g, ' ').trim()
        games.push({ result: txt, ms: Date.now() - t0, clicks })
        await page.screenshot({ path: `${OUT}/kiz-${label}-oyun-${games.length}.png` })
        await page.getByRole('button', { name: 'Yeniden Oyna' }).click()
        t0 = Date.now(); clicks = 0
        continue
      }
      const pt = page.locator('.point:has(.checker.draggable)').first()
      if (await pt.count()) {
        if (device.hasTouch) await pt.tap().catch(() => {}); else await pt.click().catch(() => {})
        clicks++
      }
      await page.waitForTimeout(250)
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    writeFileSync(`${OUT}/kiz-${label}.json`, JSON.stringify({ games, overflow, errors }, null, 2))
    expect(games.length, 'tamamlanan oyun').toBe(target)
    for (const g of games) { expect(g.result).toMatch(/Kazandın!|Bilgisayar kazandı!/); expect(g.result).not.toContain('Sen kazandı') }
    expect(overflow, 'yatay taşma').toBeLessThanOrEqual(1)
    expect(errors).toEqual([])
    await ctx.close()
  })
}
