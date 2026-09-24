// Google Etiketi (gtag.js) — admin panelden (Ayarlar > Site Ayarlari > Google Etiketi) yonetilen
// ID ile DINAMIK yuklenir. NEDEN client-side: ana sayfa '/' Plesk/Apache tarafindan STATIK servis
// edilir (Laravel'e ugramaz) -> SeoMeta server-side enjeksiyonu home'a ULASMAZ. Client-side enjekte
// edince home dahil TUM rotalar kapsanir + tek yerden (Setting) yonetilir. Verdigimiz snippet'in
// birebir esdegeri; ID Setting'ten gelir. Kapaliyken/ID bosken HICBIR Google script'i yuklenmez.
import { getSiteTags } from './api'

let injected = false

interface GtagWindow {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
}

// Boot'ta cagrilir. /api/site-tags okunur; aktif + id doluysa gtag script + config head'e eklenir.
// Sessiz fail: olcum etiketi uygulamayi ASLA bozmaz.
export async function initGoogleTag(): Promise<void> {
  if (injected) return
  try {
    const { gtag } = await getSiteTags()
    if (!gtag?.enabled || !gtag.id) return
    injectGtag(gtag.id)
  } catch {
    /* sessiz */
  }
}

function injectGtag(id: string): void {
  if (injected || typeof document === 'undefined') return
  injected = true
  const w = window as unknown as GtagWindow
  w.dataLayer = w.dataLayer || []
  // Verilen snippet ile birebir: gtag arguments'i dataLayer'a iter.
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments)
  }
  // 1) Harici gtag.js (async) — CSP script-src googletagmanager.com'a izinli.
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id)
  document.head.appendChild(s)
  // 2) Baslangic config'i.
  w.gtag('js', new Date())
  w.gtag('config', id)
}
