// GEÇİCİ TANI: "maç içinde kendi kendine F5" şikayetinin GERÇEK nedenini topla.
// Kod kaynaklı her reload öncesi markReload(reason) ile sessionStorage'a bir işaret bırakılır;
// açılışta reportReloadDiag() bunu + navigation type'ı okuyup sunucuya beacon'lar. İşaret YOKsa
// ama navigation 'reload'/'back_forward' ise -> neden 'browser/manual' (mobil sekme-atma veya elle F5).
// Backend: POST /diag/reload (reload_events tablosu). Analiz sonrası tablo+bu dosya kaldırılabilir.

const RR_KEY = 'tavla.rr'
const MATCH_KEY = 'tavla.inMatch'

// Bir reload'un nedenini işaretle (location.reload() ÇAĞRISINDAN HEMEN ÖNCE çağır).
export function markReload(reason: string): void {
  try {
    sessionStorage.setItem(RR_KEY, reason)
  } catch {
    /* gizli mod / storage yok -> işaretsiz; beacon 'browser/manual' der */
  }
}

// Maç ekranı açık mı? (App state'inden güncellenir; beacon in_match bayrağını buradan okur.)
export function setInMatch(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(MATCH_KEY, '1')
    else sessionStorage.removeItem(MATCH_KEY)
  } catch {
    /* yoksay */
  }
}

// Açılışta bir kez çağrılır. Reload ise sunucuya neden/bağlam beacon'lar (normal yüklemede sessiz).
export function reportReloadDiag(): void {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const navType = nav?.type ?? ''
    let reason: string | null = null
    try {
      reason = sessionStorage.getItem(RR_KEY)
      sessionStorage.removeItem(RR_KEY)
    } catch {
      /* yoksay */
    }
    // Yalnız gerçek bir reload/geri-ileri ya da kod-işaretli durumda beacon (her normal açılışta değil).
    if (navType !== 'reload' && navType !== 'back_forward' && !reason) return
    let inMatch = false
    try {
      inMatch = sessionStorage.getItem(MATCH_KEY) === '1'
    } catch {
      /* yoksay */
    }
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
    const payload = JSON.stringify({
      reason: reason || 'browser/manual',
      in_match: inMatch,
      is_mobile: isMobile,
      nav_type: navType,
      path: location.pathname,
    })
    const url = ((import.meta.env.VITE_API_URL as string | undefined) || '/api') + '/diag/reload'
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))
    } else {
      void fetch(url, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
    }
  } catch {
    /* tanı asla uygulamayı etkilemesin */
  }
}
