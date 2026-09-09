/**
 * Info — menüden açılan "Bilgi" sayfası. Sekmeler artık admin panelden (İçerik ›
 * Bilgi Sayfaları) RichEditor ile düzenlenen içeriklerden gelir. Her sekme kendi
 * URL'sine sahiptir: /bilgi/hakkinda, /bilgi/hizmetler, /bilgi/rutbeler, /bilgi/puanlama,
 * /bilgi/basarilarim, /bilgi/adil-zar. Eski canlı bileşenler (RankProgression/Scoring/
 * Achievements/Fairness) yerini düzenlenebilir metne bıraktı.
 */

import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { listInfoPages, type InfoPage, type InfoPageSlug } from '../api'
import { Lightbox, mediaSrc } from './ContentView'

export type InfoTab = InfoPageSlug

// Sabit sekme sırası + varsayılan etiket (sayfa yüklenene kadar / başlık boşsa).
const TABS: { slug: InfoTab; labelKey: string }[] = [
  { slug: 'about', labelKey: 'info.tab.about' },
  { slug: 'services', labelKey: 'menu.services' },
  { slug: 'ranks', labelKey: 'menu.ranks' },
  { slug: 'scoring', labelKey: 'info.tab.scoring' },
  { slug: 'badges', labelKey: 'ach.title' },
  { slug: 'fair', labelKey: 'fair.title' },
]

interface Props {
  onClose: () => void
  tab: InfoTab
  onTab: (t: InfoTab) => void
}

export default function Info({ onClose, tab, onTab }: Props) {
  const { t } = useT()
  const [pages, setPages] = useState<Record<string, InfoPage>>({})
  const [loading, setLoading] = useState(true)
  useEscape(onClose)

  useEffect(() => {
    listInfoPages()
      .then((list) => {
        const map: Record<string, InfoPage> = {}
        for (const p of list) map[p.slug] = p
        setPages(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const active = pages[tab]

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card info-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2>
          <Icon name="info" size={20} /> {t('info.title')}
        </h2>

        {/* Sekmeler (etiket = admin başlığı, yoksa i18n) */}
        <div className="prof-ov-tabs" role="tablist">
          {TABS.map(({ slug, labelKey }) => (
            <button
              key={slug}
              type="button"
              role="tab"
              aria-selected={tab === slug}
              className={tab === slug ? 'active' : ''}
              onClick={() => onTab(slug)}
            >
              {pages[slug]?.title || t(labelKey)}
            </button>
          ))}
        </div>

        <div className="info-tab-pane">
          {loading && !active ? (
            <div className="admin-empty">{t('admin.loading')}</div>
          ) : (
            <InfoPane page={active} />
          )}
        </div>
      </div>
    </div>
  )
}

// Tek bilgi sayfası: RichEditor HTML gövdesi + (varsa) altında minik galeri (lightbox).
function InfoPane({ page }: { page?: InfoPage }) {
  const { t } = useT()
  const gallery = useMemo(
    () => (page?.gallery ?? []).map((x) => mediaSrc(x)).filter((x): x is string => !!x),
    [page],
  )
  const [lightbox, setLightbox] = useState<number | null>(null)

  // Lightbox açıkken Esc sayfayı kapatmasın (capture + stopImmediatePropagation).
  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        setLightbox(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [lightbox])

  if (!page) return <div className="admin-empty">{t('content.empty')}</div>

  return (
    <>
      <div className="info-rich rich" dangerouslySetInnerHTML={{ __html: page.body ?? '' }} />
      {gallery.length > 0 && (
        <div className="service-gallery">
          {gallery.map((g, i) => (
            <button
              key={i}
              className="service-gallery-thumb"
              onClick={() => setLightbox(i)}
              aria-label={t('content.image', { n: i + 1 })}
            >
              <img src={g} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {lightbox !== null && gallery.length > 0 && (
        <Lightbox
          images={gallery}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onIndex={setLightbox}
        />
      )}
    </>
  )
}
