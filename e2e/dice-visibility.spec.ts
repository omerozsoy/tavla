import { test, expect } from '@playwright/test'
import { ALL_THEMES } from '../src/boardThemes'

// Zarların TÜM boardlarda görünür olduğunu kanıtla: her tema için zar, boardun 3 yüzeyinde
// (panel / point-a / point-b) hem açık (white=--cream) hem koyu (black=--navy) olarak çizilir.
// Üretimdeki .die-face kuralları (çift halka + pip) birebir inline kopyalanır. Çıktı: tek grid PNG.

const DIE_CSS = `
  :root { --dice-size: 40px; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b0b0d; font-family: system-ui, sans-serif; }
  .grid { display: grid; grid-template-columns: 150px repeat(3, 1fr); gap: 2px; align-items: stretch; }
  .hcell { color: #cfcfd4; font-size: 11px; padding: 6px 8px; display: flex; align-items: center; }
  .cell { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px; min-height: 64px; }
  .lab { color: #e8e8ee; font-size: 12px; padding: 6px 8px; display: flex; align-items: center; }
  /* ---- Üretim .die-face kurallarının birebir kopyası ---- */
  .die-face {
    position: relative;
    width: var(--dice-size);
    height: var(--dice-size);
    border-radius: 18%;
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.45),
      0 0 0 1.5px rgba(0, 0, 0, 0.5),
      inset 0 0 0 1.5px rgba(255, 255, 255, 0.5);
  }
  .die-face.white { background: var(--cream); }
  .die-face.black { background: var(--navy); }
  .pip-dot {
    position: absolute;
    width: 17%; height: 17%;
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }
  .die-face.white .pip-dot { background: #18181b; }
  .die-face.black .pip-dot { background: #f2f3f7; }
`

// 5 pip konumu (yüzde) — Dice.tsx PIP_POS[5] ile aynı.
const PIP5 = [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]]
const die = (owner: 'white' | 'black') =>
  `<div class="die-face ${owner}">${PIP5.map(([x, y]) => `<span class="pip-dot" style="left:${x}%;top:${y}%"></span>`).join('')}</div>`

const cell = (bg: string) => `<div class="cell" style="background:${bg}">${die('white')}${die('black')}</div>`

test('dice visible on all boards', async ({ page }) => {
  const rows = ALL_THEMES.map((th) => {
    const cream = th.light ?? '#f0e8d8'
    const navy = th.checker ?? '#14243a'
    const style = `--cream:${cream};--navy:${navy}`
    return (
      `<div class="lab" style="${style}">${th.name} <span style="opacity:.5;margin-left:6px">${th.id}</span></div>` +
      `<div style="${style}">${cell(th.panel)}</div>` +
      `<div style="${style}">${cell(th.a)}</div>` +
      `<div style="${style}">${cell(th.b)}</div>`
    )
  }).join('')

  const html =
    `<!doctype html><html><head><meta charset="utf-8"><style>${DIE_CSS}</style></head><body>` +
    `<div class="grid">` +
    `<div class="hcell">Tema (${ALL_THEMES.length})</div><div class="hcell">panel</div><div class="hcell">point A</div><div class="hcell">point B</div>` +
    rows +
    `</div></body></html>`

  await page.setContent(html, { waitUntil: 'load' })
  const grid = page.locator('.grid')
  await grid.screenshot({ path: 'e2e/__out__/dice-all-boards.png' })

  const dice0 = page.locator('.die-face')
  await expect(dice0).toHaveCount(ALL_THEMES.length * 3 * 2)
  const box0 = await dice0.first().boundingBox()
  expect(box0?.width).toBeGreaterThan(10)

  // EN ZOR vakalar (zar-zemini ≈ board yüzeyi) BÜYÜK: çift halkanın kurtardığını net göster.
  const WORST = ['obsidian', 'blackdiamond', 'retroclub', 'tokyonight', 'nightowl', 'ayu',
    'sollight', 'gruvlight', 'marrakesh', 'dawn', 'glacier', 'besiktas']
  const worstRows = WORST.map((id) => {
    const th = ALL_THEMES.find((t) => t.id === id)
    if (!th) return ''
    const style = `--cream:${th.light ?? '#f0e8d8'};--navy:${th.checker ?? '#14243a'}`
    return (
      `<div class="lab" style="${style};font-size:16px">${th.name}</div>` +
      `<div style="${style}">${cell(th.panel)}</div>` +
      `<div style="${style}">${cell(th.a)}</div>` +
      `<div style="${style}">${cell(th.b)}</div>`
    )
  }).join('')
  const worstHtml =
    `<!doctype html><html><head><meta charset="utf-8"><style>${DIE_CSS.replace('--dice-size: 40px', '--dice-size: 72px')}` +
    `.grid{grid-template-columns:200px repeat(3,1fr)} .cell{min-height:120px;gap:18px}</style></head><body>` +
    `<div class="grid"><div class="hcell">EN ZOR VAKALAR</div><div class="hcell">panel</div><div class="hcell">A</div><div class="hcell">B</div>` +
    worstRows + `</div></body></html>`
  await page.setContent(worstHtml, { waitUntil: 'load' })
  await page.locator('.grid').screenshot({ path: 'e2e/__out__/dice-worst-cases.png' })
})
