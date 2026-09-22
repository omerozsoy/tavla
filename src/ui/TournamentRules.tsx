/**
 * TournamentRules — WBF Uluslararası Turnuva Kuralları referans sayfası (/turnuva-kurallari).
 * emil-design-eng: referans-doküman düzeni — hero + içindekiler (anchor nav) + numaralı bölümler
 * + "Yorumlar" callout'ları + edisyon altbilgisi + CTA. SeoContent (.seo-*) tasarım diline uyumlu,
 * taranabilir (gerçek H2/H3/p). İç içindekiler smooth-scroll (.app.lobby scroller; reduced-motion guard).
 */
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { Button } from '@/components/ui/button'
import { TOURNAMENT_RULES, RULE_COMMENTS, RULE_EDITION } from '../data/tournamentRules'

interface Props {
  onClose?: () => void
}

const groupId = (num: string) => 'kural-' + num.replace('.', '-') // '1.0' -> 'kural-1-0'

export default function TournamentRules({ onClose }: Props) {
  useEscape(onClose)

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <div className="register-card info-card seo-landing-card doc-card" onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </Button>
      )}

      <header className="seo-hero">
        <span className="seo-eyebrow">WBF Resmî Kuralları</span>
        <h1 className="info-title seo-hero-title">Tavla Turnuva Kuralları</h1>
        <p className="seo-hero-sub">
          Dünya Tavla Federasyonu (WBF) Uluslararası Turnuva Kural ve Prosedürleri — turnuva formatı,
          süre, zar ve küp kuralları, kural dışı hareketler ve anlaşmazlıkların çözümü.
        </p>
      </header>

      {/* İçindekiler — anchor nav */}
      <nav className="doc-toc" aria-label="İçindekiler">
        <span className="doc-toc-label">İçindekiler</span>
        <ol className="doc-toc-list">
          {TOURNAMENT_RULES.map((g) => (
            <li key={g.num}>
              <a
                href={'#' + groupId(g.num)}
                className="doc-toc-link"
                onClick={(e) => {
                  e.preventDefault()
                  scrollTo(groupId(g.num))
                }}
              >
                <span className="doc-toc-num">{g.num}</span>
                {g.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="info-rich rich doc-body">
        {TOURNAMENT_RULES.map((g) => (
          <section key={g.num} id={groupId(g.num)} className="doc-group">
            <h2 className="doc-group-head">
              <span className="doc-group-num">{g.num}</span>
              {g.title}
            </h2>
            {g.sections.map((s) => (
              <div key={s.num} className="doc-section">
                <h3 className="doc-section-head">
                  <span className="doc-section-num">{s.num}</span>
                  {s.title}
                </h3>
                {s.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ))}
          </section>
        ))}

        {/* Yorumlar */}
        <section className="doc-group" id="kural-yorumlar">
          <h2 className="doc-group-head">
            <span className="doc-group-num">✦</span>
            Yorumlar
          </h2>
          {RULE_COMMENTS.map((c) => (
            <aside key={c.ref} className="doc-note">
              <span className="doc-note-ref">{c.ref}</span>
              <p>{c.text}</p>
            </aside>
          ))}
        </section>

        <p className="doc-edition">{RULE_EDITION}</p>
      </div>

      <div className="seo-cta">
        <Button asChild className="seo-cta-btn">
          <a href="/yeni-oyun">
            <Icon name="play" size={18} /> Hemen Tavla Oyna
          </a>
        </Button>
        <p className="doc-cta-sub">
          Kuralları öğrenmek için <a href="/nasil-oynanir">tavla nasıl oynanır</a> rehberine ve{' '}
          <a href="/tavla-rehberi">Tavla Rehberi</a> yazılarına göz atabilirsin.
        </p>
      </div>
    </div>
  )
}
