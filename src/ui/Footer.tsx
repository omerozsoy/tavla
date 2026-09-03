import { useEffect, useState } from 'react'
import './footer.css'
import { useT } from '../i18n'
import { TavlaTvLogo } from './TavlaTvLogo'
import { listContents, type Content } from '../api'

// Medya yolu: tam URL / mutlak ise oldugu gibi; ciplak ise panelden yuklenmis -> /uploads/
function mediaSrc(img?: string | null): string | undefined {
  if (!img) return undefined
  return /^(https?:|\/)/.test(img) ? img : '/uploads/' + img
}

export interface FooterItem {
  key: string
  labelKey: string
  label?: string // admin panelden ozel ad (varsa i18n'i ezer)
  onClick: () => void
}

interface Props {
  columns: { titleKey: string; items: FooterItem[] }[]
}

// Ana sayfa footer'i — kolonlar MERKEZI SAYFA KAYDINDAN (pages.ts) turetilir; App
// footerColumns'u kurar, bu bilesen salt-render. Linkler ilgili sayfayi acar.
export default function Footer({ columns }: Props) {
  const { t } = useT()
  const year = new Date().getFullYear()
  // Kurumlar listesindeki ILK 3 kurum (sira: sort) -> logolari markanin altinda goster.
  const [partners, setPartners] = useState<Content[]>([])
  useEffect(() => {
    let alive = true
    listContents('kurum')
      .then((ks) => alive && setPartners(ks.filter((k) => k.image).slice(0, 3)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  return (
    <footer className="site-footer">
      <div className="foot-inner">
        <div className="foot-brand">
          {/* Logo + slogan tek "kilit"te: kilit logo genisligine buzulur. Slogan
              SVG <text> textLength=100% ile TEK SATIR ve TAM logo genisliginde yaslanir. */}
          <div className="foot-brandlock">
            <TavlaTvLogo size={34} tone="dark" className="foot-logo" />
            <svg className="foot-tag" height="12" role="img" aria-label={t('foot.tag')}>
              <text x="0" y="10" textLength="100%">
                {t('foot.tag')}
              </text>
            </svg>
          </div>
          {/* Ilk 3 kurumun logosu — beyaz yuvarlak cip (koyu footer'da okunur). Web
              sitesi varsa yeni sekmede acilir. */}
          {partners.length > 0 && (
            <div className="foot-partners" aria-label={t('menu.clubs')}>
              {partners.map((k) => {
                const logo = mediaSrc(k.image)
                const site = k.links?.website?.trim() || null
                const inner = (
                  <img className="foot-partner-logo" src={logo} alt={k.title} loading="lazy" />
                )
                return site ? (
                  <a
                    key={k.id}
                    href={/^https?:/.test(site) ? site : `https://${site}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="foot-partner"
                    title={k.title}
                  >
                    {inner}
                  </a>
                ) : (
                  <span key={k.id} className="foot-partner" title={k.title}>
                    {inner}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        <nav className="foot-cols">
          {columns
            .filter((c) => c.items.length > 0)
            .map((col) => (
              <div className="foot-col" key={col.titleKey}>
                <div className="foot-col-title">{t(col.titleKey)}</div>
                <ul>
                  {col.items.map((it) => (
                    <li key={it.key}>
                      <button type="button" className="foot-link" onClick={it.onClick}>
                        {it.label ?? t(it.labelKey)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </nav>
      </div>
      <div className="foot-bottom">© {year} TavlaTV</div>
    </footer>
  )
}
