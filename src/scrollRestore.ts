// Sayfa YENİLEMEDE kaldığın yere dön ("/hata-gunlugu refresh edince en üste atıyor").
// Tarayıcının kendi kaydırma geri-yüklemesi SPA'da çalışmıyor: yenilemede içerik (kullanıcı, API
// verisi) geç geldiği için o an sayfa kısa -> konum 0'a kırpılıyor. Burada:
//  - kaydırırken / sayfadan çıkarken konum (hangi kaydırma kabı + y) sessionStorage'a yazılır
//    (yol başına; sekme kapanınca silinir),
//  - yalnız YENİLEME ile açılışta, içerik o yüksekliğe ulaşınca konuma dönülür (en fazla ~10 sn),
//  - kullanıcı bu sırada kendisi kaydırırsa/dokunursa geri-yükleme bırakılır (zıplatma yok).
// SPA içi gezinmede dokunmaz (App'teki "sayfa değişince en üste" davranışı aynen kalır).

const KEY = 'tavla.scroll.v1'
// Olası kaydırma kapları (sayfa türüne göre biri kayar); yoksa pencere.
const SCROLLERS = ['.register-overlay.page', '.app.lobby', '.lobby-main', '.page-host', '.main', '.register-card']
const MAX_WAIT_MS = 10_000

type Saved = { path: string; sel: string | null; y: number }

function current(): Saved {
  const path = location.pathname + location.search
  for (const sel of SCROLLERS) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (el && el.scrollTop > 0 && el.scrollHeight > el.clientHeight) return { path, sel, y: Math.round(el.scrollTop) }
  }
  return { path, sel: null, y: Math.round(window.scrollY) }
}

function save() {
  try {
    const s = current()
    const all = JSON.parse(sessionStorage.getItem(KEY) || '{}') as Record<string, Saved>
    if (s.y > 0) all[s.path] = s
    else delete all[s.path]
    sessionStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* depolama yok: sessiz */
  }
}

function isReload(): boolean {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return nav?.type === 'reload'
  } catch {
    return false
  }
}

export function installScrollRestore(): void {
  if (typeof window === 'undefined') return
  try {
    history.scrollRestoration = 'manual' // tarayıcı 0'a kırpıp bizimkiyle yarışmasın
  } catch {
    /* eski tarayıcı */
  }

  // Kaydırma -> kısıtlı (rAF) kaydet; çıkışta kesin kaydet.
  let pending = false
  const onScroll = () => {
    if (pending) return
    pending = true
    requestAnimationFrame(() => {
      pending = false
      save()
    })
  }
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  window.addEventListener('pagehide', save)
  window.addEventListener('beforeunload', save)

  if (!isReload()) return
  let saved: Saved | undefined
  try {
    saved = (JSON.parse(sessionStorage.getItem(KEY) || '{}') as Record<string, Saved>)[location.pathname + location.search]
  } catch {
    saved = undefined
  }
  if (!saved || saved.y <= 0) return
  const target = saved

  let done = false
  const stop = () => {
    done = true
    for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.removeEventListener(ev, stop, true)
  }
  for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.addEventListener(ev, stop, true)

  // İçerik geç yüklenir (kullanıcı, API, grafikler): yükseklik ~400ms SABİT kalana kadar bekle,
  // sonra konuma dön. Erken dönersek üstteki içerik büyüyünce (scroll anchoring) konum kayıyordu.
  const t0 = performance.now()
  let lastH = -1
  let stable = 0
  const tick = () => {
    if (done) return
    const el = target.sel ? (document.querySelector(target.sel) as HTMLElement | null) : null
    if (!target.sel || el) {
      const h = el ? el.scrollHeight : document.documentElement.scrollHeight
      const max = el ? el.scrollHeight - el.clientHeight : h - window.innerHeight
      stable = h === lastH ? stable + 1 : 0
      lastH = h
      if (max >= target.y - 2 && stable >= 4) {
        if (el) el.scrollTop = target.y
        else window.scrollTo(0, target.y)
        stop()
        return
      }
    }
    if (performance.now() - t0 < MAX_WAIT_MS) setTimeout(tick, 100)
    else stop()
  }
  setTimeout(tick, 50)
}
