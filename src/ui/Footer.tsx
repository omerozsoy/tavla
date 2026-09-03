import './footer.css'
import { useT } from '../i18n'
import { TavlaTvLogo } from './TavlaTvLogo'

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
  return (
    <footer className="site-footer">
      <div className="foot-inner">
        <div className="foot-brand">
          {/* Logo + slogan tek "kilit"te: kilit logo genisligine buzulur. Slogan
              SVG <text> textLength=100% ile TEK SATIR ve TAM logo genisliginde yaslanir. */}
          <div className="foot-brandlock">
            <TavlaTvLogo size={34} tone="dark" className="foot-logo" />
            <svg className="foot-tag" height="12" role="img" aria-label={t('foot.tag')}>
              <text x="0" y="10" textLength="100%" lengthAdjust="spacingAndGlyphs">
                {t('foot.tag')}
              </text>
            </svg>
          </div>
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
