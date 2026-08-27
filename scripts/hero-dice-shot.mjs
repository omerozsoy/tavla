// Hero 3D zar dogrulamasi: headless Chrome (SwiftShader WebGL) ile ana sayfayi ac,
// zar kanvasini + konsol hatalarini kontrol et, roll tetikle, desktop+mobil sise cek.
// Kullanim: node scripts/hero-dice-shot.mjs [baseUrl]
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

const BASE = process.argv[2] || 'http://localhost:4188/'
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
const PORT = 9344
const OUT = 'C:/Users/Master/PhpstormProjects/tavla/.shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const PROFILE = `C:/Users/Master/PhpstormProjects/tavla/.chrome-cdp/hero-${process.pid}`
const chrome = spawn(CHROME, [
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--enable-unsafe-swiftshader', // GPU yok -> yazilim WebGL (three.js render etsin)
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
      return (await r.json()).webSocketDebuggerUrl
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
  const { sessionId: S } = await cdp(browser, 'Target.attachToTarget', { targetId, flatten: true })
  await cdp(browser, 'Page.enable', {}, S)
  await cdp(browser, 'Runtime.enable', {}, S)

  const errors = []
  browser.addEventListener('message', (ev) => {
    const d = JSON.parse(ev.data)
    if (d.sessionId !== S) return
    if (d.method === 'Runtime.exceptionThrown') {
      errors.push(d.params.exceptionDetails?.exception?.description || d.params.exceptionDetails?.text)
    }
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
      errors.push(d.params.args.map((a) => a.value || a.description).join(' '))
    }
  })

  const evalJs = (expr) => cdp(browser, 'Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  }, S).then((r) => r.result?.value)

  const setMetrics = (w, h, dsf, mobile) => cdp(browser, 'Emulation.setDeviceMetricsOverride',
    { width: w, height: h, deviceScaleFactor: dsf, mobile }, S)
  const navigate = async (u) => { await cdp(browser, 'Page.navigate', { url: u }, S); await sleep(1800) }
  const shot = async (name) => {
    const { data } = await cdp(browser, 'Page.captureScreenshot', { format: 'png' }, S)
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
    console.log('shot ->', `${name}.png`)
  }

  // --- Desktop ---
  await setMetrics(1440, 900, 2, false)
  await navigate(BASE)
  await sleep(2600) // chunk yukle + intro dususu + oturma

  const diag = await evalJs(`(() => {
    const host = document.querySelector('.hero-dice3d');
    const canvas = host && host.querySelector('canvas');
    let gl = false;
    try { gl = !!(canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'))); } catch {}
    return {
      hostFound: !!host,
      canvasFound: !!canvas,
      canvasW: canvas ? canvas.width : 0,
      canvasH: canvas ? canvas.height : 0,
      hasGL: gl,
    };
  })()`)
  console.log('DIAG desktop:', JSON.stringify(diag))
  await shot('hero-desktop-settled')

  // --- Reroll (kanvasa tikla) ---
  await evalJs(`document.querySelector('.hero-dice3d')?.click()`)
  await sleep(700)
  await shot('hero-desktop-rolling')
  await sleep(2200)
  await shot('hero-desktop-reroll-settled')

  // --- Resize testi ---
  await setMetrics(900, 720, 2, false)
  await sleep(900)
  await shot('hero-resize-900')

  // --- Mobil ---
  await setMetrics(390, 844, 3, true)
  await navigate(BASE)
  await sleep(2600)
  const diagM = await evalJs(`(() => {
    const c = document.querySelector('.hero-dice3d canvas');
    return { canvasFound: !!c, w: c?.width||0, h: c?.height||0 };
  })()`)
  console.log('DIAG mobile:', JSON.stringify(diagM))
  await shot('hero-mobile')

  console.log('\nCONSOLE ERRORS:', errors.length ? JSON.stringify(errors, null, 2) : 'none')

  await cdp(browser, 'Target.closeTarget', { targetId })
  chrome.kill()
}
main().catch((e) => { console.error('ERR', e); chrome.kill(); process.exit(1) })
