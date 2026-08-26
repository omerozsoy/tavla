// Form dogrulama: headless Chrome ile formlari acip light+dark screenshot alir.
// Usage: node scripts/form-shot.mjs
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5175/'
const CHROME = 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
const PORT = 9334
const OUT = 'C:/Users/Master/PhpstormProjects/tavla/.shots'
mkdirSync(OUT, { recursive: true })
const PROFILE = `C:/Users/Master/PhpstormProjects/tavla/.chrome-cdp/form-${process.pid}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1440,980', '--hide-scrollbars', 'about:blank',
])
chrome.on('error', (e) => { console.error('chrome spawn error', e); process.exit(1) })

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/json/version`); return (await r.json()).webSocketDebuggerUrl }
    catch { await sleep(250) }
  }
  throw new Error('CDP not reachable')
}
let id = 0
function cdp(ws, method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const mid = ++id; const msg = { id: mid, method, params }; if (sessionId) msg.sessionId = sessionId
    const onMsg = (ev) => { const d = JSON.parse(ev.data); if (d.id === mid) { ws.removeEventListener('message', onMsg); d.error ? reject(new Error(d.error.message)) : resolve(d.result) } }
    ws.addEventListener('message', onMsg); ws.send(JSON.stringify(msg))
  })
}

const main = async () => {
  const wsUrl = await getWsUrl()
  const browser = new WebSocket(wsUrl); await new Promise((r) => (browser.onopen = r))
  const { targetId } = await cdp(browser, 'Target.createTarget', { url: 'about:blank' })
  const { sessionId: S } = await cdp(browser, 'Target.attachToTarget', { targetId, flatten: true })
  await cdp(browser, 'Page.enable', {}, S); await cdp(browser, 'Runtime.enable', {}, S)
  await cdp(browser, 'Emulation.setDeviceMetricsOverride', { width: 1440, height: 980, deviceScaleFactor: 1, mobile: false }, S)

  const evalJs = (expr) => cdp(browser, 'Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, S).then((r) => r.result?.value)
  const navigate = async (u) => { await cdp(browser, 'Page.navigate', { url: u }, S); await sleep(1500) }
  const shot = async (name) => { const { data } = await cdp(browser, 'Page.captureScreenshot', { format: 'png' }, S); writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64')); console.log('shot ->', `${name}.png`) }
  const click = (text) => evalJs(`(() => {
    const t = ${JSON.stringify(text)}.trim();
    const els = [...document.querySelectorAll('button,a,[role=button],.menu-btn,label')];
    const hit = els.find(e => (e.innerText||e.getAttribute('aria-label')||'').trim() === t)
      || els.find(e => (e.innerText||e.getAttribute('aria-label')||'').trim().includes(t));
    if (!hit) return false; hit.click(); return true;
  })()`)
  const setTheme = (mode) => evalJs(`(() => { localStorage.setItem('tavla.theme', ${JSON.stringify(mode)}); return localStorage.getItem('tavla.theme') })()`)
  const clickRegisterTab = () => evalJs(`(() => {
    const tabs = [...document.querySelectorAll('.auth-tabs .menu-btn, .auth-tabs button')];
    const reg = tabs[1] || tabs.find(b => /kay|regist|sign ?up/i.test(b.innerText));
    if (reg) { reg.click(); return true } return false;
  })()`)

  for (const theme of ['dark', 'light']) {
    await navigate(BASE)
    await setTheme(theme)
    await navigate(BASE)

    // 1) Register modal (en cok input + ulke select)
    await click('Giriş / Kayıt'); await sleep(700)
    await clickRegisterTab(); await sleep(700)
    await shot(`form-register-${theme}`)

    // 2) Pozisyon Analizi (number input + dice select)
    await navigate(BASE)
    await click('Pozisyon Analizi'); await sleep(900)
    await shot(`form-analyzer-${theme}`)

    // 3) Adil Zar (text + number inputs)
    await navigate(BASE)
    await click('Adil Zar'); await sleep(700)
    await shot(`form-fairness-${theme}`)

    // 4) Tavla Kulupleri -> kulup kur (input + textarea)
    await navigate(BASE)
    await click('Tavla Kulüpleri'); await sleep(900)
    await click('Kur'); await sleep(500)
    await shot(`form-clubs-${theme}`)
  }

  await cdp(browser, 'Target.closeTarget', { targetId }); chrome.kill()
}
main().catch((e) => { console.error('ERR', e); chrome.kill(); process.exit(1) })
