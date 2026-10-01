// GEÇİCİ ÖLÇÜM — Safari "sayfa çok yenileniyor" şikâyetinin kökünü canlı veriyle ayırmak için.
// İki aday var: (1) autoUpdate'in deploy sonrası otomatik reload'u, (2) iOS Safari'nin bellek
// dolu (WASM sinir ağı) sekmeyi öldürüp native reload etmesi. Her bilinçli reload'u NEDENİYLE
// damgalarız; boot'ta son yüklenmeyi sınıflandırıp (bizim reload'umuz mu, native mi; hangi
// ekrandaydı) /api/diag/reload'a beacon'larız. Ölçüm bitince bu dosya + route + çağrılar silinir.

const CAUSE_KEY = 'tavla:reloadcause' // bizim bilinçli reload'umuzun nedeni (sonraki boot okur+siler)
const VIEW_KEY = 'tavla:lastview' // son gizlenme anındaki görünüm (game/other) + zaman

export type ReloadCause = 'autoupdate' | 'ptr' | 'consent' | 'chunk' | 'error-button' | 'gate'

/** Bilinçli her location.reload() bunun üzerinden geçer -> nedeni damgalar, sonra yeniler. */
export function reloadWithCause(cause: ReloadCause): void {
  try {
    localStorage.setItem(CAUSE_KEY, cause)
  } catch {
    /* storage yok -> yine de yenile */
  }
  window.location.reload()
}

function navType(): string {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return nav?.type || 'unknown'
  } catch {
    return 'unknown'
  }
}

/** main.tsx'ten bir kez. Gizlenmede ekranı kaydeder; boot'ta son reload'u sınıflandırıp yollar. */
export function installReloadDiag(): void {
  if (typeof window === 'undefined') return

  // Gizlenirken (app-switch / arka plan) o anki ekranı + zamanı yaz -> native reload sonrası
  // "hangi ekrandaydı, ne kadar önce gizlendi" bilinir (durum 2'yi doğrular).
  const snapshot = () => {
    try {
      const view = document.querySelector('.app.game-view') ? 'game' : 'other'
      localStorage.setItem(VIEW_KEY, JSON.stringify({ view, t: Date.now() }))
    } catch {
      /* yoksay */
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') snapshot()
  })
  window.addEventListener('pagehide', snapshot)

  // Boot: bu yüklenme bizim bir reload'umuz mu (CAUSE_KEY var) yoksa native mi ('native')?
  let cause = 'native'
  try {
    const c = localStorage.getItem(CAUSE_KEY)
    if (c) {
      cause = c
      localStorage.removeItem(CAUSE_KEY)
    }
  } catch {
    /* yoksay */
  }

  const nav = navType()
  // GÜRÜLTÜ FİLTRESİ: yalnız gerçek bir yenilenmeyi ölç. İlk ziyaret / normal link gezintisi
  // (cause='native' + nav='navigate') RAPORLANMAZ -> log şişmez, throttle dolmaz.
  const looksLikeRefresh = cause !== 'native' || nav === 'reload' || nav === 'back_forward'
  if (!looksLikeRefresh) return

  let prevView = 'unknown'
  let hiddenForMs = -1
  try {
    const raw = localStorage.getItem(VIEW_KEY)
    if (raw) {
      const last = JSON.parse(raw) as { view: string; t: number }
      prevView = last.view
      hiddenForMs = Date.now() - last.t
    }
  } catch {
    /* yoksay */
  }

  const payload = { cause, nav, prevView, hiddenForMs, ua: navigator.userAgent }
  try {
    const body = JSON.stringify(payload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/diag/reload', new Blob([body], { type: 'application/json' }))
    } else {
      void fetch('/api/diag/reload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    /* ölçüm başarısız -> sessiz */
  }
}
