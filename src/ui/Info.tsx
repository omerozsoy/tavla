/**
 * Info — menüden açılan "Bilgi" sayfası. Sekmeler kendi URL'lerine sahiptir:
 * /bilgi/hakkinda, /bilgi/hizmetler, /bilgi/rutbeler, /bilgi/puanlama,
 * /bilgi/basarilarim, /bilgi/adil-zar.
 *
 * Hakkında ve Hizmetler admin panelden (İçerik › Bilgi Sayfaları) RichEditor ile
 * düzenlenir (info_pages). Rütbeler/Puanlama/Başarılarım/Adil Zar ise CANLI/hesaplı
 * bileşenlerdir (RankProgression/Scoring/Achievements/FairnessModal) — olduğu gibi korunur.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { listInfoPages, type InfoPage, type InfoPageSlug } from '../api'
import { Lightbox, mediaSrc } from './ContentView'
import { RankProgression } from './RankProgression'
import FairDiceInfo from './FairDiceInfo'
import Achievements from './Achievements'
import Scoring from './Scoring'

export type InfoTab = InfoPageSlug

// Sabit sekme sırası + varsayılan etiket (admin başlığı yoksa / bileşen sekmeleri için).
const TABS: { slug: InfoTab; labelKey: string }[] = [
  { slug: 'about', labelKey: 'info.tab.about' },
  { slug: 'services', labelKey: 'menu.services' },
  { slug: 'ranks', labelKey: 'menu.ranks' },
  { slug: 'scoring', labelKey: 'info.tab.scoring' },
  { slug: 'badges', labelKey: 'ach.title' },
  { slug: 'fair', labelKey: 'fair.title' },
]

// Admin panelden düzenlenen (info_pages) rich-text sekmeler. Diğerleri canlı bileşen.
const EDITABLE: InfoTab[] = ['about', 'services']

interface Props {
  onClose: () => void
  tab: InfoTab
  onTab: (t: InfoTab) => void
  currentRating?: number
  loggedIn?: boolean
  fair: { commitment: string; clientSeed: string; serverSeed?: string; rolls: number }
}

export default function Info({ onClose, tab, onTab, currentRating, loggedIn = false }: Props) {
  const { t } = useT()
  const [pages, setPages] = useState<Record<string, InfoPage>>({})
  useEscape(onClose)

  useEffect(() => {
    listInfoPages()
      .then((list) => {
        const map: Record<string, InfoPage> = {}
        for (const p of list) map[p.slug] = p
        setPages(map)
      })
      .catch(() => {})
  }, [])

  // Tek format: modal başlığı = aktif sekmenin adı (düzenlenebilir sekmelerde admin başlığı).
  const activeLabelKey = TABS.find((x) => x.slug === tab)?.labelKey ?? 'info.title'
  const activeTitle = (EDITABLE.includes(tab) && pages[tab]?.title) || t(activeLabelKey)

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card info-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        {/* Sekmeler ÜSTTE (başlıktan önce); başlık altında gösterilir. */}
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
              {(EDITABLE.includes(slug) && pages[slug]?.title) || t(labelKey)}
            </button>
          ))}
        </div>

        <h2 className="info-title">{activeTitle}</h2>

        {/* Hakkında / Hizmetler: admin panelden düzenlenen içerik (info_pages) */}
        {EDITABLE.includes(tab) && (
          <div className="info-tab-pane">
            <InfoPane page={pages[tab]} />
          </div>
        )}

        {tab === 'ranks' && (
          <div className="info-tab-pane">
            <RankProgression currentRating={currentRating} />
          </div>
        )}

        {tab === 'scoring' && (
          <div className="info-tab-pane">
            <Scoring currentRating={currentRating} />
          </div>
        )}

        {tab === 'badges' && (
          <div className="info-tab-pane">
            <p className="ach-howto-intro">{t('ach.howtoIntro')}</p>
            <Achievements embed loggedIn={loggedIn} />
          </div>
        )}

        {tab === 'fair' && (
          <div className="info-tab-pane">
            <FairDiceInfo />
          </div>
        )}
      </div>
    </div>
  )
}

// Tek galeri bloğu: küçük thumbnail'lar + kendi lightbox'ı (her galeri bağımsız).
function GalleryBlock({ images }: { images: string[] }) {
  const { t } = useT()
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

  if (!images.length) return null
  return (
    <>
      <div className="service-gallery">
        {images.map((g, i) => (
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
      {lightbox !== null && (
        <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />
      )}
    </>
  )
}

// Regex özel karakterlerini kaçır (galeri adı token'ı için).
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Düzenlenebilir bilgi sayfası: RichEditor HTML + isimli/varsayılan galeriler.
// İçerikte <ad> (veya varsayılan <resimgalerisi>) yazılan yere ilgili galeri serpiştirilir;
// referans verilmeyen varsayılan galeri en alta eklenir (geriye dönük uyum).
function InfoPane({ page }: { page?: InfoPage }) {
  const { t } = useT()
  if (!page) return <div className="admin-empty">{t('admin.loading')}</div>

  const body = page.body ?? ''
  const named = (page.galleries ?? [])
    .map((g) => ({
      token: (g.name || '').trim().toLowerCase(),
      images: (g.images ?? []).map((x) => mediaSrc(x)).filter((x): x is string => !!x),
    }))
    .filter((g) => g.token && g.images.length > 0)
  const legacy = (page.gallery ?? []).map((x) => mediaSrc(x)).filter((x): x is string => !!x)
  const all = [...named]
  if (legacy.length) all.push({ token: 'resimgalerisi', images: legacy })

  // Galeri yoksa düz gövde.
  if (all.length === 0) {
    return <div className="info-rich rich" dangerouslySetInnerHTML={{ __html: body }} />
  }

  // <ad> / &lt;ad&gt; (tek başına paragrafsa çevreleyen <p> dahil) tüm token'ları yakala.
  const alt = all
    .map((g) => escapeRe(g.token))
    .sort((a, b) => b.length - a.length)
    .join('|')
  const re = new RegExp(
    `<p>\\s*(?:&lt;|<)\\s*(${alt})\\s*(?:&gt;|>)\\s*</p>|(?:&lt;|<)\\s*(${alt})\\s*(?:&gt;|>)`,
    'gi',
  )

  const nodes: ReactNode[] = []
  const used = new Set<string>()
  let last = 0
  let mm: RegExpExecArray | null
  let k = 0
  while ((mm = re.exec(body)) !== null) {
    const name = (mm[1] ?? mm[2] ?? '').toLowerCase()
    const seg = body.slice(last, mm.index)
    if (seg) nodes.push(<div key={`h${k}`} className="info-rich rich" dangerouslySetInnerHTML={{ __html: seg }} />)
    const g = all.find((x) => x.token === name)
    if (g) {
      nodes.push(<GalleryBlock key={`g${k}`} images={g.images} />)
      used.add(name)
    }
    last = mm.index + mm[0].length
    k++
  }
  const tail = body.slice(last)
  if (tail) nodes.push(<div key="ht" className="info-rich rich" dangerouslySetInnerHTML={{ __html: tail }} />)
  // Referans verilmeyen varsayılan galeri en alta (geriye dönük uyum).
  if (legacy.length && !used.has('resimgalerisi')) nodes.push(<GalleryBlock key="glegacy" images={legacy} />)

  return <>{nodes}</>
}
