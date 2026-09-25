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
  // title: admin "Footer Kolonları" başlık override'ı (varsa i18n titleKey'i ezer).
  columns: { key?: string; titleKey: string; title?: string; items: FooterItem[] }[]
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
            {/* Slogan: duz HTML metin (SVG textLength=%100 Firefox'ta bozuluyordu). */}
            <span className="foot-tag">{t('foot.tag')}</span>
          </div>
        </div>
        <nav className="foot-cols">
          {columns
            .filter((c) => c.items.length > 0)
            .map((col) => (
              <div className="foot-col" key={col.titleKey}>
                <div className="foot-col-title">{col.title ?? t(col.titleKey)}</div>
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
