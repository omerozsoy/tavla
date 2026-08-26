// Zero-dep CDP driver: launch headless Chrome, drive the SPA, screenshot boards.
// Usage:
//   node scripts/cdp-shot.mjs              -> capture the default verification set
//   node scripts/cdp-shot.mjs id1 id2 ...  -> capture specific board theme ids
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5175/'
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
const PORT = 9333
const OUT = 'C:/Users/Master/PhpstormProjects/tavla/.shots'
mkdirSync(OUT, { recursive: true })

// Bu turda dogrulanacak boardlar: 26 Galaksi ek + Horizon (yeniden tasarim) + galaxy (varsayilan sanity).
const DEFAULT_THEMES = [
  'galaxy', 'horizon',
  // rare
  'gamma', 'cosmos', 'titan', 'jupiter', 'helix', 'solaris', 'orion', 'kepler',
  // epic
  'andromeda', 'orbit', 'cassio', 'quasar', 'polaris', 'apollo', 'aurora', 'pandora', 'matrix',
  // legendary
  'gutenberg', 'krypton', 'infinity', 'vega', 'quantum', 'singularity',
  // common
  'bazaar', 'miami',
]
const THEMES = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_THEMES

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Her run icin BENZERSIZ profil dizini: paylasilan user-data-dir singleton kilidi
// onceki (yarim kalan) chrome'la cakisip navigate'i hang ettiriyordu.
const PROFILE = `C:/Users/Master/PhpstormProjects/tavla/.chrome-cdp/run-${process.pid}`
const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--window-size=1440,900',
  '--hide-scrollbars',
  'about:blank',
])
chrome.on('error', (e) => { console.error('chrome spawn error', e); process.exit(1) })

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/json/version`)
      const j = await r.json()
      return j.webSocketDebuggerUrl
    } catch { await sleep(250) }
  }
  throw new Error('CDP not reachable')
}

let id = 0
function cdp(ws, method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const mid = ++id
    const msg = { id: mid, method, params }
    if (sessionId) msg.sessionId = sessionId
    const onMsg = (ev) => {
      const d = JSON.parse(ev.data)
      if (d.id === mid) {
        ws.removeEventListener('message', onMsg)
        d.error ? reject(new Error(d.error.message)) : resolve(d.result)
      }
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify(msg))
  })
}

const main = async () => {
  const wsUrl = await getWsUrl()
  const browser = new WebSocket(wsUrl)
  await new Promise((r) => (browser.onopen = r))

  const { targetId } = await cdp(browser, 'Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp(browser, 'Target.attachToTarget', { targetId, flatten: true })
  const S = sessionId
  await cdp(browser, 'Page.enable', {}, S)
  await cdp(browser, 'Runtime.enable', {}, S)
  await cdp(browser, 'Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 2, mobile: false,
  }, S)

  const evalJs = (expr) => cdp(browser, 'Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  }, S).then((r) => r.result?.value)

  const navigate = async (u) => {
    await cdp(browser, 'Page.navigate', { url: u }, S)
    await sleep(1600)
  }

  const shot = async (name) => {
    const { data } = await cdp(browser, 'Page.captureScreenshot', { format: 'png' }, S)
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
    console.log('shot ->', `${name}.png`)
  }

  // Bir elemani metnine gore bul + tikla (buton/link/role=button oncelikli).
  // Dondurur: tiklanabildi mi (bool).
  const clickByText = (text) => evalJs(`(() => {
    const t = ${JSON.stringify(text)}.trim();
    const els = [...document.querySelectorAll('button,a,[role=button]')];
    const hit = els.find(e => (e.innerText||e.getAttribute('aria-label')||'').trim() === t)
      || els.find(e => (e.innerText||e.getAttribute('aria-label')||'').trim().includes(t));
    if (!hit) return false;
    hit.click();
    return true;
  })()`)

  // localStorage'a board temasini yaz + rebrand/v2 migration bayraklarini set et
  // (yoksa init tema secimini 'galaxy'e ezer). Guest oturum.
  const setBoard = (theme) => evalJs(`(() => {
    localStorage.setItem('tavla.board', ${JSON.stringify(theme)});
    localStorage.setItem('tavla.board.rebrand', '1');
    localStorage.setItem('tavla.board.v2galaxy', '1');
    return localStorage.getItem('tavla.board');
  })()`)

  // Board DOM'da gorunur mu? (watermark her boardda var)
  const boardVisible = () => evalJs(`!!document.querySelector('.board-watermark, .board, [class*="board-grid"]')`)

  // Ilk yukleme: localStorage'a erisebilmek icin origin'e gir
  await navigate(BASE)

  let ok = 0, fail = 0
  for (const theme of THEMES) {
    await setBoard(theme)
    await navigate(BASE) // reload: boardTheme localStorage'dan init edilir
    // AI ile Oyna kurulum ekrani -> Basla
    const c1 = await clickByText('Yapay Zekaya Karşı')
    await sleep(500)
    const c2 = await clickByText('Başla')
    await sleep(1400)
    const vis = await boardVisible()
    const active = await evalJs(`document.documentElement.getAttribute('data-board')`)
    if (!c1 || !c2 || !vis || active !== theme) {
      console.warn(`WARN ${theme}: setup1=${c1} start=${c2} boardVisible=${vis} data-board=${active}`)
      fail++
    } else ok++
    await shot(`board-${theme}`)
  }
  console.log(`\nDONE: ${ok} ok, ${fail} warn, ${THEMES.length} total`)

  await cdp(browser, 'Target.closeTarget', { targetId })
  chrome.kill()
}

main().catch((e) => { console.error('ERR', e); chrome.kill(); process.exit(1) })
