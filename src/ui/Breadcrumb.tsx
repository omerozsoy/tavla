import { useT } from '../i18n'

/**
 * SEO uyumlu içerik-yolu (breadcrumb). Görünür kısım burada; BreadcrumbList JSON-LD
 * sunucuda (backend/app/Support/SeoMeta.php injectBreadcrumbJsonLd) AYNI hiyerarşiyle
 * üretilir — ikinci bir şema sistemi YOK. Görünür yol ile JSON-LD hiyerarşisi elle
 * senkron tutulur (aynı desen: SEO_TITLES ↔ SeoMeta::META).
 *
 * Kullanım: sayfa başlığının (h2) HEMEN ÜSTÜNE <Breadcrumb items=[...] /> koy.
 * items: kökten (Ana Sayfa) mevcut sayfaya sıralı. Son öğe = mevcut sayfa (href YOK →
 * tıklanamaz, aria-current="page"). Ara öğeler gerçek /rota'ya link.
 */
export interface Crumb {
  name: string
  /** Tıklanabilir üst basamak yolu (ör. '/makaleler'). Verilmezse mevcut sayfa (link yok). */
  href?: string
}

// SPA içi gezinme: gerçek <a href> (taranabilir) + tıklamada pushState + popstate
// (App.tsx applyFromPath popstate'i dinler → sayfa açılır, tam yeniden yükleme olmaz).
function navTo(href: string) {
  try {
    window.history.pushState(null, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
  } catch {
    window.location.href = href
  }
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  const { t } = useT()
  // Yalnız anlamlı yol (en az Ana Sayfa + 1 basamak) çizilir; ana sayfada breadcrumb yok.
  if (!items || items.length < 2) return null
  return (
    <nav className="breadcrumb" aria-label={t('breadcrumb.aria')}>
      <ol className="breadcrumb-list">
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <li key={i} className="breadcrumb-item">
              {last || !c.href ? (
                <span className="breadcrumb-current" aria-current="page">{c.name}</span>
              ) : (
                <a
                  className="breadcrumb-link"
                  href={c.href}
                  onClick={(e) => {
                    e.preventDefault()
                    navTo(c.href!)
                  }}
                >
                  {c.name}
                </a>
              )}
              {!last && (
                <span className="breadcrumb-sep" aria-hidden="true">›</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Ana Sayfa kökü (her yolun ilk basamağı). */
export function homeCrumb(t: (k: string) => string): Crumb {
  return { name: t('breadcrumb.home'), href: '/' }
}
