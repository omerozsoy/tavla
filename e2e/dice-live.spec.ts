import { test, expect } from '@playwright/test'
import { ALL_THEMES } from '../src/boardThemes'

// CANLI test: tavlatv.com'un GERÇEK yayındaki CSS'ini çekip her boardda zar çizer.
// Böylece "üretimdeki stylesheet" tüm tema renkleriyle (--cream/--navy) gerçekten görünür zar
// üretiyor mu kanıtlanır. Markup app ile aynı: .board-dice > .die-face.{white,black} > .pip-dot.

const PIP5 = [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]]
const die = (owner: 'white' | 'black') =>
  `<div class="die-face ${owner}">${PIP5.map(([x, y]) => `<span class="pip-dot" style="left:${x}%;top:${y}%"></span>`).join('')}</div>`
const cell = (bg: string) => `<div class="dcell" style="background:${bg}"><div class="board-dice">${die('white')}${die('black')}</div></div>`

const LAYOUT = `
  :root { --dice-size: 44px; --cream:#f0e8d8; --navy:#14243a; }
  * { animation: none !important; transition: none !important; }
  body { margin:0; background:#0b0b0d; font-family:system-ui,sans-serif; }
  .grid { display:grid; grid-template-columns:160px repeat(3,1fr); gap:2px; }
  .hcell { color:#cfcfd4; font-size:11px; padding:6px 8px; display:flex; align-items:center; }
  .lab { color:#e8e8ee; font-size:12px; padding:6px 8px; display:flex; align-items:center; }
  .dcell { display:flex; align-items:center; justify-content:center; padding:12px; min-height:66px; }
  .board-dice { display:flex; gap:10px; }
`

async function liveCss(): Promise<string> {
  const idx = await fetch('https://www.tavlatv.com/')
  const html = await idx.text()
  const m = html.match(/assets\/index-[A-Za-z0-9_-]+\.css/)
  if (!m) throw new Error('live css href not found')
  const css = await fetch('https://www.tavlatv.com/' + m[0])
  return css.text()
}

test('dice visible on all boards — LIVE css', async ({ page }) => {
  const css = await liveCss()
  const rows = ALL_THEMES.map((th) => {
    const style = `--cream:${th.light ?? '#f0e8d8'};--navy:${th.checker ?? '#14243a'}`
    return (
      `<div class="lab" style="${style}">${th.name} <span style="opacity:.5;margin-left:6px">${th.id}</span></div>` +
      `<div style="${style}">${cell(th.panel)}</div>` +
      `<div style="${style}">${cell(th.a)}</div>` +
      `<div style="${style}">${cell(th.b)}</div>`
    )
  }).join('')
  const doc =
    `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style><style>${LAYOUT}</style></head><body>` +
    `<div class="grid"><div class="hcell">LIVE · Tema (${ALL_THEMES.length})</div><div class="hcell">panel</div><div class="hcell">A</div><div class="hcell">B</div>` +
    rows + `</div></body></html>`
  await page.setContent(doc, { waitUntil: 'load' })

  await page.locator('.grid').screenshot({ path: 'e2e/__out__/dice-live-all.png' })
  await expect(page.locator('.die-face')).toHaveCount(ALL_THEMES.length * 3 * 2)

  // Her zarın ölçülü bir box-shadow (halka) taşıdığını doğrula -> kenar daima var.
  const shadows = await page.locator('.die-face').evaluateAll((els) =>
    els.map((e) => getComputedStyle(e as HTMLElement).boxShadow))
  const withoutRing = shadows.filter((s) => !s || s === 'none').length
  expect(withoutRing).toBe(0)
})
