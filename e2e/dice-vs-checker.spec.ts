import { test, expect } from '@playwright/test'
import { ALL_THEMES } from '../src/boardThemes'

// Her tema için PUL (checker) ile ZAR'ı yan yana, GERÇEK canlı CSS ile çiz; görsel + ölçümle
// hangi boardda zar pul'dan farklı göründüğünü bul (gloss/ice/neon sheen, ring=içi boş halka).

const PIP5 = [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]]
const die = (o: 'white' | 'black') =>
  `<div class="die-face ${o}">${PIP5.map(([x, y]) => `<span class="pip-dot" style="left:${x}%;top:${y}%"></span>`).join('')}</div>`
const checker = (o: 'white' | 'black') =>
  `<div class="checker ${o}" style="width:46px;height:46px;border-radius:50%"></div>`

const LAYOUT = `
  :root{--dice-size:46px;--checker:46px}
  *{animation:none!important;transition:none!important}
  body{margin:0;background:#0b0b0d;font-family:system-ui,sans-serif}
  .grid{display:grid;grid-template-columns:150px 1fr 1fr;gap:2px}
  .h{color:#cfcfd4;font-size:11px;padding:6px 8px;display:flex;align-items:center}
  .lab{color:#e8e8ee;font-size:11px;padding:6px 8px;display:flex;align-items:center;line-height:1.2}
  .pair{display:flex;align-items:center;justify-content:center;gap:14px;padding:12px}
  .pair .checker{box-shadow:0 1px 3px rgba(0,0,0,.4)}
`

async function liveCss(): Promise<string> {
  // LOCAL_CSS=1 -> yeni derlenmiş yerel CSS (fix doğrulaması); yoksa canlı CSS.
  if (process.env.LOCAL_CSS) {
    const fs = await import('node:fs')
    const dir = 'dist/assets'
    const f = fs.readdirSync(dir).find((x) => /^index-.*\.css$/.test(x))!
    return fs.readFileSync(`${dir}/${f}`, 'utf8')
  }
  const idx = await fetch('https://www.tavlatv.com/')
  const m = (await idx.text()).match(/assets\/index-[A-Za-z0-9_-]+\.css/)
  const css = await fetch('https://www.tavlatv.com/' + m![0])
  return css.text()
}

// Sadece STİLLİ pul temaları (flat olmayan) + bir flat referans — zar/pul farkı burada doğar.
const STYLED = ALL_THEMES.filter((t) => t.checkerStyle && t.checkerStyle !== 'flat')

test('checker vs die per styled board — LIVE', async ({ page }) => {
  const css = await liveCss()
  const row = (th: typeof ALL_THEMES[number]) => {
    const vars = `--cream:${th.light ?? '#f0e8d8'};--navy:${th.checker ?? '#14243a'};--panel:${th.panel}`
    const attrs = `data-board="${th.id}" data-checker="${th.checkerStyle ?? 'flat'}" data-surface="${th.surface ?? 'plain'}"`
    return (
      `<div class="lab" style="${vars}">${th.name}<br><span style="opacity:.5">${th.id} · ${th.checkerStyle}</span></div>` +
      `<div ${attrs} style="${vars};background:${th.panel}"><div class="pair">${checker('white')}${die('white')}</div></div>` +
      `<div ${attrs} style="${vars};background:${th.panel}"><div class="pair">${checker('black')}${die('black')}</div></div>`
    )
  }
  const doc =
    `<!doctype html><html data-board="x"><head><meta charset="utf-8"><style>${css}</style><style>${LAYOUT}</style></head><body>` +
    `<div class="grid"><div class="h">PUL vs ZAR (${STYLED.length} stilli board)</div><div class="h">açık: pul | zar</div><div class="h">koyu: pul | zar</div>` +
    STYLED.map(row).join('') + `</div></body></html>`
  await page.setContent(doc, { waitUntil: 'load' })
  await page.locator('.grid').screenshot({ path: 'e2e/__out__/checker-vs-die.png' })
  expect(STYLED.length).toBeGreaterThan(0)
})
