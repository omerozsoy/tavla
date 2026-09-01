import './footer.css'
import { useT } from '../i18n'

export interface FooterItem {
  key: string
  labelKey: string
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
          <div className="foot-logo">TAVLATV</div>
          <p className="foot-tag">{t('foot.tag')}</p>
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
                        {t(it.labelKey)}
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
