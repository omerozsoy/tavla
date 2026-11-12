// DEV: boardshot.html'i portrait telefon viewport'unda acip screenshot alir.
// Kullanim: node scripts/shot-board.mjs [out.png]
import { chromium } from 'playwright'

const out = process.argv[2] || 'board-portrait.png'
const b = await chromium.launch()
const p = await b.newPage({
  viewport: { width: 412, height: 892 },
  deviceScaleFactor: 2,
  isMobile: true,
})
const errs = []
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message))
await p.goto('http://localhost:5173/boardshot.html', { waitUntil: 'load' }).catch(() => {})
await p.waitForTimeout(1800)
const hasBoard = await p.locator('.board').count()
const diag = await p.evaluate(() => {
  const board = document.querySelector('.board')
  const bo = document.querySelector('.bearoff')
  const cs = document.querySelector('.clock-stack')
  const r = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height), x: Math.round(el.getBoundingClientRect().left), y: Math.round(el.getBoundingClientRect().top) } : null
  return { board: r(board), bearoff: r(bo), clockStack: r(cs), vw: window.innerWidth }
})
console.log('board count:', hasBoard, 'errors:', errs.length)
if (errs.length) console.log(errs.slice(0, 5).join('\n'))
console.log('diag:', JSON.stringify(diag))
await p.screenshot({ path: out, fullPage: true })
console.log('saved', out)
await b.close()
