/**
 * GuideView — "Tavla Rehberi" blog bölümü. İki mod:
 *  - slug === null  -> HUB: hero + yazı kartları grid (/tavla-rehberi).
 *  - slug dolu      -> YAZI: hero (h1) + zengin gövde + CTA (/tavla-rehberi/<slug>).
 *
 * Tasarım dili SeoContent.tsx ile aynıdır (.seo-hero / .info-rich.rich / .seo-cta-btn);
 * mevcut .seo-* CSS'i yeniden kullanır. "haberler" (news) bölümünden tamamen bağımsızdır.
 *
 * İç linkler normal <a href> (SPA fallback web.php ile 200 döner); tam-yenileme kabul
 * edilebilir ve taranabilir gerçek bağlantı sağlar. onOpen verilirse SPA içinde de gezinir.
 */

import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useInfoPageBody } from './useInfoPage'
import { Button } from '@/components/ui/button'
import { GUIDES, findGuide } from '../data/guides'

interface Props {
  slug: string | null
  onClose?: () => void
  onOpen?: (slug: string) => void
}

// Hub: yazı listesi (kartlar).
function GuideHub({ onOpen }: { onOpen?: (slug: string) => void }) {
  return (
    <div className="info-rich rich seo-landing-body">
      <p className="rules-intro">
        Tavlada gerçekten gelişmek isteyenler için hazırladığımız rehber yazıları. Açılış
        stratejilerinden küp kullanımına, kazanma taktiklerinden mars ve backgammon puanlamasına
        kadar oyununu bir üst seviyeye taşıyacak her şey burada.
      </p>
      <div className="guide-grid">
        {GUIDES.map((g) => (
          <a
            key={g.slug}
            href={'/tavla-rehberi/' + g.slug}
            className="guide-card"
            onClick={(e) => {
              if (onOpen) {
                e.preventDefault()
                onOpen(g.slug)
              }
            }}
          >
            <h2 className="guide-card-title">{g.h1}</h2>
            <p className="guide-card-excerpt">{g.excerpt}</p>
            <span className="guide-card-more">
              Devamını oku <Icon name="caret-right" size={14} />
            </span>
          </a>
        ))}
        {/* Referans makale: WBF resmî turnuva kuralları (tam sayfa /turnuva-kurallari). */}
        <a href="/turnuva-kurallari" className="guide-card">
          <h2 className="guide-card-title">Tavla Turnuva Kuralları (WBF)</h2>
          <p className="guide-card-excerpt">
            Dünya Tavla Federasyonu resmî turnuva kuralları: format, süre, zar ve küp kuralları,
            kural dışı hareketler ve anlaşmazlıkların çözümü — eksiksiz Türkçe kural metni.
          </p>
          <span className="guide-card-more">
            Kuralları oku <Icon name="caret-right" size={14} />
          </span>
        </a>
      </div>
    </div>
  )
}

// Tek yazı gövdesi.
function GuideArticle({ slug, onOpen }: { slug: string; onOpen?: (slug: string) => void }) {
  const guide = findGuide(slug)
  // DB'de (admin-duzenlenebilir) body varsa onu render et; yoksa hardcoded guide (fallback).
  const dbBody = useInfoPageBody(guide ? 'tavla-rehberi/' + slug : null)
  if (!guide) {
    // Bulunamadı -> hub göster (yönlendirme yerine güvenli fallback).
    return <GuideHub onOpen={onOpen} />
  }
  return (
    <div className="info-rich rich seo-landing-body">
      {dbBody ? (
        <div dangerouslySetInnerHTML={{ __html: dbBody }} />
      ) : (
        guide.sections.map((s, i) => (
          <section key={i}>
            <h2>{s.h}</h2>
            {s.body.map((para, j) => (
              <p key={j} dangerouslySetInnerHTML={{ __html: para }} />
            ))}
          </section>
        ))
      )}

      <div className="seo-cta">
        <Button asChild className="seo-cta-btn">
          <a href="/yeni-oyun">
            <Icon name="play" size={18} /> Hemen Tavla Oyna
          </a>
        </Button>
      </div>

      <p className="guide-back">
        {/* Hub'a dönüş: tam-yenileme ile /tavla-rehberi açılır (web.php fallback). */}
        <a href="/tavla-rehberi">← Tüm Rehberler</a>
      </p>
    </div>
  )
}

export default function GuideView({ slug, onClose, onOpen }: Props) {
  useEscape(onClose)

  const guide = slug ? findGuide(slug) : null
  const h1 = guide ? guide.h1 : 'Tavla Rehberi'
  const eyebrow = 'TAVLA REHBERİ'
  const heroSub = guide
    ? 'TavlaTv rehber yazısı — özgün, pratik ve doğrudan uygulanabilir.'
    : 'Açılıştan küpe, taktiklerden puanlamaya: tavlanı geliştirecek özgün rehber yazıları.'

  return (
    <div className="register-card info-card seo-landing-card" onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </Button>
      )}
      <header className="seo-hero">
        <span className="seo-eyebrow">{eyebrow}</span>
        <h1 className="info-title seo-hero-title">{h1}</h1>
        <p className="seo-hero-sub">{heroSub}</p>
        {!guide && (
          <div className="seo-hero-cta">
            <Button asChild className="seo-cta-btn">
              <a href="/yeni-oyun">
                <Icon name="play" size={18} /> Hemen Tavla Oyna
              </a>
            </Button>
          </div>
        )}
      </header>
      <div className="info-tab-pane seo-landing-body-wrap">
        {slug ? <GuideArticle slug={slug} onOpen={onOpen} /> : <GuideHub onOpen={onOpen} />}
      </div>
    </div>
  )
}
