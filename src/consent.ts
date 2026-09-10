// Çerez onay (consent) yönetimi — SADECE görsel banner değil; teknik consent kaydı.
// Kullanıcı onay vermeden zorunlu-olmayan script/çerezler ÇALIŞTIRILMAZ.
// Tercih localStorage'da saklanır: kategori bayrakları + consentVersion + updatedAt.
// Politika/consent yapısı önemli ölçüde değişirse (admin consent_version'ı artırınca)
// tekrar onay istenir.

export interface ConsentRecord {
  necessary: true // zorunlu her zaman açık
  functional: boolean
  analytics: boolean
  marketing: boolean
  consentVersion: number
  updatedAt: string // ISO
}

// Admin panelden gelen çerez-onay yapılandırması (metinler + opsiyonel script ID'leri).
export interface ConsentConfig {
  banner_title?: string | null
  banner_body?: string | null
  modal_title?: string | null
  modal_desc?: string | null
  categories?: {
    necessary?: string | null
    functional?: string | null
    analytics?: string | null
    marketing?: string | null
  }
  consent_version: number
  ga_id?: string | null
  gtm_id?: string | null
  meta_pixel_id?: string | null
}

const KEY = 'tavla.cookieConsent'

export function getConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as ConsentRecord
    if (typeof p?.consentVersion !== 'number') return null
    return { ...p, necessary: true }
  } catch {
    return null
  }
}

// Banner gösterilmeli mi? Kayıt yoksa VEYA saklı sürüm güncel sürümden eskiyse.
export function needsConsent(currentVersion: number): boolean {
  const c = getConsent()
  if (!c) return true
  return c.consentVersion < (currentVersion || 1)
}

// Tercihi kaydet (necessary daima true). updatedAt + consentVersion damgalanır.
export function saveConsent(
  cats: { functional: boolean; analytics: boolean; marketing: boolean },
  version: number,
): ConsentRecord {
  const rec: ConsentRecord = {
    necessary: true,
    functional: !!cats.functional,
    analytics: !!cats.analytics,
    marketing: !!cats.marketing,
    consentVersion: version || 1,
    updatedAt: new Date().toISOString(),
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(rec))
  } catch {
    /* localStorage yoksa yok say */
  }
  return rec
}

export const ACCEPT_ALL = { functional: true, analytics: true, marketing: true }
export const ONLY_NECESSARY = { functional: false, analytics: false, marketing: false }

// ---- Script gating (yalnız onaylı kategori + admin ID varsa yüklenir) ----
const injected = new Set<string>()

function injectScript(src: string, id: string): void {
  if (injected.has(id)) return
  injected.add(id)
  const s = document.createElement('script')
  s.async = true
  s.src = src
  s.setAttribute('data-consent', id)
  document.head.appendChild(s)
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Onaya göre analitik/pazarlama script'lerini yükle. ID boşsa hiçbir şey yüklenmez.
// Yalnızca ekleme yapar; bir kategori KAPATILDIYSA (önceden yüklüyse) sayfa yeniden
// yüklenerek script temizlenmelidir (bkz applyConsentOrReload).
export function applyConsent(rec: ConsentRecord, cfg: ConsentConfig | null): void {
  if (!cfg) return
  const w = window as any

  // Google Analytics 4 (gtag) — analitik
  if (rec.analytics && cfg.ga_id && !injected.has('ga')) {
    w.dataLayer = w.dataLayer || []
    if (!w.gtag) {
      w.gtag = function gtag() {
        // gtag, arguments nesnesini dataLayer'a iter (GA sözleşmesi)
        // eslint-disable-next-line prefer-rest-params
        w.dataLayer.push(arguments)
      }
    }
    w.gtag('js', new Date())
    w.gtag('config', cfg.ga_id)
    injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga_id)}`, 'ga')
  }

  // Google Tag Manager — analitik (kap; içindeki etiketler ayrıca yönetilmeli)
  if (rec.analytics && cfg.gtm_id && !injected.has('gtm')) {
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    injectScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(cfg.gtm_id)}`, 'gtm')
  }

  // Meta (Facebook) Pixel — pazarlama
  if (rec.marketing && cfg.meta_pixel_id && !injected.has('meta')) {
    injected.add('meta')
    if (!w.fbq) {
      const n: any = function () {
        // eslint-disable-next-line prefer-rest-params
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
      }
      n.queue = []
      n.loaded = true
      n.version = '2.0'
      w.fbq = n
      w._fbq = w._fbq || n
    }
    injectScript('https://connect.facebook.net/en_US/fbevents.js', 'meta-lib')
    w.fbq('init', cfg.meta_pixel_id)
    w.fbq('track', 'PageView')
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// Onaydan sonra çağrılır. Yeni onay, DAHA ÖNCE yüklenmiş bir kategoriyi kapatıyorsa
// (izin geri çekme) script'i tam temizlemek için sayfayı yeniler; aksi halde uygular.
export function applyConsentOrReload(rec: ConsentRecord, cfg: ConsentConfig | null): void {
  const revoked =
    (!rec.analytics && (injected.has('ga') || injected.has('gtm'))) ||
    (!rec.marketing && injected.has('meta'))
  if (revoked) {
    window.location.reload()
    return
  }
  applyConsent(rec, cfg)
}
