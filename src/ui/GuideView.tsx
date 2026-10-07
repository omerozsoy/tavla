/**
 * GuideView — "Tavla Rehberi" (/tavla-rehberi). ÖZEL editoryal tasarım (guideView.css, .tgx scope):
 *  - slug === null -> HUB: hero + numaralı dergi kartları (öne çıkan ilk kart geniş) + WBF referansı.
 *  - slug dolu     -> YAZI: hero (h1) + uzun-metin (.tgx-prose, drop-cap + üçgen başlık işareti) + CTA.
 *
 * İçerik/veri DEĞİŞMEDİ: GUIDES (data/guides.ts) + DB override (useInfoPageBody) + SEO iç linkler
 * (<a href> SPA fallback) + Breadcrumb korunur. onOpen verilirse SPA içi gezinir, yoksa tam-yenileme.
 */

import './guideView.css'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useInfoPageBody } from './useInfoPage'
import { GUIDES, findGuide } from '../data/guides'
import { useT } from '../i18n'
import Breadcrumb, { homeCrumb, type Crumb } from './Breadcrumb'
import { RawHtml } from './RawHtml'

interface Props {
  slug: string | null
  onClose?: () => void
  onOpen?: (slug: string) => void
}

const no2 = (n: number) => String(n).padStart(2, '0')

// Hub: numaralı editoryal kartlar (ilk kart öne çıkan/geniş) + WBF referans kartı.
function GuideHub({ onOpen }: { onOpen?: (slug: string) => void }) {
  return (
    <div className="tgx-grid">
      {GUIDES.map((g, i) => (
        <a
          key={g.slug}
          href={'/tavla-rehberi/' + g.slug}
          className={`tgx-card${i === 0 ? ' tgx-card--feature' : ''}`}
          data-no={no2(i + 1)}
          onClick={(e) => {
            if (onOpen) {
              e.preventDefault()
              onOpen(g.slug)
            }
          }}
        >
          <span className="tgx-card-no">REHBER {no2(i + 1)}</span>
          <h2 className="tgx-card-title">{g.h1}</h2>
          <p className="tgx-card-excerpt">{g.excerpt}</p>
          <span className="tgx-card-more">
            Devamını oku <Icon name="caret-right" size={14} />
          </span>
        </a>
      ))}
      {/* Referans: WBF resmî turnuva kuralları (tam sayfa /turnuva-kurallari). */}
      <a href="/turnuva-kurallari" className="tgx-card tgx-card--ref" data-no="WBF">
        <span className="tgx-card-no">REFERANS</span>
        <h2 className="tgx-card-title">Tavla Turnuva Kuralları (WBF)</h2>
        <p className="tgx-card-excerpt">
          Dünya Tavla Federasyonu resmî turnuva kuralları: format, süre, zar ve küp kuralları, kural
          dışı hareketler ve anlaşmazlıkların çözümü — eksiksiz Türkçe kural metni.
        </p>
        <span className="tgx-card-more">
          Kuralları oku <Icon name="caret-right" size={14} />
        </span>
      </a>
    </div>
  )
}

// Tek yazı gövdesi (uzun metin).
function GuideArticle({ slug, onOpen }: { slug: string; onOpen?: (slug: string) => void }) {
  const guide = findGuide(slug)
  // DB'de (admin-düzenlenebilir) body varsa onu render et; yoksa hardcoded guide (fallback).
  const dbBody = useInfoPageBody(guide ? 'tavla-rehberi/' + slug : null)
  if (!guide) return <GuideHub onOpen={onOpen} />
  return (
    <>
      <div className="tgx-prose">
        {dbBody ? (
          <RawHtml html={dbBody} />
        ) : (
          guide.sections.map((s, i) => (
            <section key={i}>
              <h2>{s.h}</h2>
              {s.body.map((para, j) => (
                <RawHtml key={j} as="p" html={para} />
              ))}
            </section>
          ))
        )}
      </div>

      <div className="tgx-cta-box">
        <span className="tgx-cta-box-txt">Öğrendiklerini gerçek bir maçta dene.</span>
        <a className="tgx-btn" href="/yeni-oyun">
          <Icon name="play" size={18} /> Hemen Tavla Oyna
        </a>
      </div>

      <p className="tgx-back">
        <a href="/tavla-rehberi">← Tüm Rehberler</a>
      </p>
    </>
  )
}

export default function GuideView({ slug, onClose, onOpen }: Props) {
  const { t } = useT()
  useEscape(onClose)

  const guide = slug ? findGuide(slug) : null
  const h1 = guide ? guide.h1 : 'Tavla Rehberi'
  const crumbs: Crumb[] = guide
    ? [homeCrumb(t), { name: t('breadcrumb.guide'), href: '/tavla-rehberi' }, { name: guide.h1 }]
    : [homeCrumb(t), { name: t('breadcrumb.guide') }]
  const lede = guide
    ? 'TavlaTv rehber yazısı — özgün, pratik ve doğrudan uygulanabilir.'
    : 'Açılıştan küpe, taktiklerden puanlamaya: tavlanı bir üst seviyeye taşıyacak özgün rehber yazıları.'

  return (
    <div className="register-card info-card seo-landing-card tgx-shell" onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <button type="button" className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
      )}
      <Breadcrumb items={crumbs} />
      <div className={`tgx${guide ? ' tgx--article' : ''}`}>
        <header className={`tgx-hero${guide ? ' tgx-hero--article' : ''}`}>
          <span className="tgx-eyebrow">Tavla Rehberi</span>
          <h1 className="tgx-title">{h1}</h1>
          <p className="tgx-lede">{lede}</p>
          <div className="tgx-hero-cta">
            <a className="tgx-btn" href="/yeni-oyun">
              <Icon name="play" size={18} /> Hemen Tavla Oyna
            </a>
            {!guide && (
              <span className="tgx-hero-meta">
                <b>{GUIDES.length}</b> rehber yazısı · açılış · küp · taktik · puanlama
              </span>
            )}
          </div>
        </header>

        {slug ? <GuideArticle slug={slug} onOpen={onOpen} /> : <GuideHub onOpen={onOpen} />}
      </div>
    </div>
  )
}
