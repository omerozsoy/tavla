import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { Icon, type IconName } from './Icon'

// Alt gezinme çubuğu (Bottom Navigation Bar). YALNIZ kurulu APK WebView'ında gösterilir (App.tsx'te
// `inApp` ile gate'lenir) ve maç sırasında gizlenir (home=true iken render edilir). document.body'ye
// portal ile basılır -> konteyner layout'una karışmaz; body'ye `.has-bottom-nav` ekleyip içeriğin
// altına güvenli-alan + çubuk yüksekliği kadar boşluk bırakır (son öğeler çubuğun altında kalmasın).
export type BottomNavItem = { key: string; label: string; icon: IconName; onClick: () => void }

export default function BottomNav({ items, active }: { items: BottomNavItem[]; active?: string }) {
  useEffect(() => {
    document.body.classList.add('has-bottom-nav')
    return () => document.body.classList.remove('has-bottom-nav')
  }, [])

  return createPortal(
    <nav className="bottom-nav" role="navigation" aria-label="Alt menü">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          className={`bottom-nav__item${active === it.key ? ' is-active' : ''}`}
          aria-current={active === it.key ? 'page' : undefined}
          onClick={it.onClick}
        >
          <Icon name={it.icon} size={22} weight={active === it.key ? 'fill' : 'regular'} />
          <span className="bottom-nav__label">{it.label}</span>
        </button>
      ))}
    </nav>,
    document.body,
  )
}
