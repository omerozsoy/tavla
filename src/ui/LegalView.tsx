import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { getCookies, getLegalPage, type CookieRow, type LegalPage } from '../api'
import { OPEN_COOKIE_PREFS } from './CookieConsent'
import './cookieConsent.css'

const COOKIE_TOKEN = '[[COOKIE_TABLE]]'

const CAT_LABEL: Record<string, string> = {
  necessary: 'Zorunlu',
  functional: 'İşlevsel',
  analytics: 'Analitik',
  marketing: 'Pazarlama',
}

function CookieTable({ rows }: { rows: CookieRow[] }) {
  if (!rows.length) return null
  return (
    <div className="cc-cookie-table-wrap">
      <table className="cc-cookie-table">
        <thead>
          <tr>
            <th>Çerez Adı</th>
            <th>Sağlayıcı</th>
            <th>Amaç</th>
            <th>Kategori</th>
            <th>Süre</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={i}>
              <td>{c.name}</td>
              <td>{c.provider || '—'}</td>
              <td>{c.purpose || '—'}</td>
              <td><span className="cc-cat-badge">{CAT_LABEL[c.category] ?? c.category}</span></td>
              <td>{c.duration || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Hukuki sayfa görüntüleyici (KVKK/Gizlilik/Çerez/Kullanım/Üyelik). İçerik veritabanından
 * (slug) gelir; React'e gömülü DEĞİL. Çerez Politikası'nda [[COOKIE_TABLE]] token'ı canlı
 * çerez tablosuyla değiştirilir. SEO başlığı/açıklaması belge <head>'ine uygulanır.
 */
export function LegalView({
  slug,
  onClose,
}: {
  slug: string
  onClose: () => void
}) {
  const [page, setPage] = useState<LegalPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [cookies, setCookies] = useState<CookieRow[]>([])
  useEscape(onClose)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setPage(null)
    getLegalPage(slug)
      .then((p) => {
        if (!alive) return
        setPage(p)
        setLoading(false)
      })
      .catch(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [slug])

  // Çerez tablosu yalnız gerekince (token içeren sayfa) çekilir.
  useEffect(() => {
    if (page?.body?.includes(COOKIE_TOKEN)) {
      getCookies().then(setCookies).catch(() => {})
    }
  }, [page])

  // SEO: belge başlığı + meta açıklaması (kapanışta eski haline döner).
  useEffect(() => {
    if (!page) return
    const prevTitle = document.title
    document.title = page.seo_title || page.title
    const meta = document.querySelector('meta[name="description"]')
    const prevDesc = meta?.getAttribute('content') ?? null
    if (meta && page.seo_description) meta.setAttribute('content', page.seo_description)
    return () => {
      document.title = prevTitle
      if (meta && prevDesc !== null) meta.setAttribute('content', prevDesc)
    }
  }, [page])

  const body = page?.body ?? ''
  const [before, after] = body.includes(COOKIE_TOKEN) ? body.split(COOKIE_TOKEN) : [body, null]

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="register-card info-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </Button>

        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : !page ? (
          <div className="admin-empty">Sayfa bulunamadı.</div>
        ) : (
          <>
            <h2 className="info-title">{page.title}</h2>
            <div className="info-tab-pane">
              <div className="info-rich rich" dangerouslySetInnerHTML={{ __html: before }} />
              {after !== null && (
                <>
                  <CookieTable rows={cookies} />
                  <div className="info-rich rich" dangerouslySetInnerHTML={{ __html: after }} />
                  <div className="cc-modal-actions" style={{ marginTop: 12 }}>
                    <Button variant="outline" onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PREFS))}>
                      Çerez Tercihlerini Yönet
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
