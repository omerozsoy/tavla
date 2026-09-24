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

function injectGtag(rawId: string): void {
  if (injected || typeof document === 'undefined') return
  // COKLU ID destegi: admin ID alanina virgulle birden fazla etiket yazabilir (orn. Ads + GA4:
  // "AW-123,G-XYZ"). gtag.js TEK id ile yuklenir, sonra HER id icin ayri gtag('config', id) cagrilir
  // (Google'in cok-urunlu kurulumu). Tek id ise dizi tek elemanli olur.
  const ids = rawId
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (ids.length === 0) return
  injected = true
  const w = window as unknown as GtagWindow
  w.dataLayer = w.dataLayer || []
  // Verilen snippet ile birebir: gtag arguments'i dataLayer'a iter.
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments)
  }
  // 1) Harici gtag.js (async) — ilk id ile yukle. CSP script-src googletagmanager.com'a izinli.
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ids[0])
  document.head.appendChild(s)
  // 2) Baslangic + HER etiket icin config.
  w.gtag('js', new Date())
  for (const id of ids) w.gtag('config', id)
}
