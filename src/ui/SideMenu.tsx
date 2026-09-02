import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import { Button } from '@/components/ui/button'
import { TavlaTvLogo } from './TavlaTvLogo'
import type { MenuGroup } from '../pages'

// Ana sayfa ve oyun ekraninda ortak tek menu. Ogeler MERKEZI SAYFA KAYDINDAN (pages.ts)
// turetilir; bu bilesen yalnizca RENDER eder. Yeni menu sayfasi = pages.ts'e bir giris.
// Not: shadcn Button base'i ikonlari 16px'e sabitler -> menu ikonlarini !important ile buyut.
const NAV = 'w-full justify-start [&_svg]:size-[24px]!'

export interface NavItem {
  key: string // aktif-vurgu anahtari (activeKey ile eslesir)
  labelKey: string // i18n
  icon: IconName
  onClick: () => void
  hideInGame?: boolean // oyun ekraninda gizle
}

export interface SideMenuProps {
  inGame: boolean
  hasActiveGame: boolean
  showAnalysis?: boolean
  canResign?: boolean
  groups: { group: MenuGroup; items: NavItem[] }[] // pages.ts sirasinda, gate uygulanmis
  onResume: () => void
  onToggleAnalysis?: () => void
  onResign?: () => void
  active?: string
  mobileOpen?: boolean
  onCloseMobile?: () => void
  onHome?: () => void // drawer logosuna tiklayinca ana sayfa
}

export default function SideMenu(p: SideMenuProps) {
  const { t } = useT()
  return (
    <aside
      className={`side-menu ${p.mobileOpen ? 'open' : ''}`}
      onClickCapture={(e) => {
        // Mobilde bir menu ogesine dokununca drawer'i kapat
        if (p.onCloseMobile && (e.target as HTMLElement).closest('button')) p.onCloseMobile()
      }}
    >
      {/* Mobil drawer basligi: TavlaTV logosu (desktop sabit yan menude CSS ile gizli).
          Tiklayinca ana sayfa; onClickCapture (closest button) drawer'i da kapatir. */}
      <button
        type="button"
        className="side-menu-brand"
        onClick={p.onHome}
        aria-label={t('brand.name')}
      >
        <TavlaTvLogo size={34} />
      </button>

      {/* Oyun ici eylemler (analiz / pes) — oyun ekraninda, play grubunun yerinde */}
      {p.inGame && (p.onToggleAnalysis || (p.canResign && p.onResign)) && (
        <div className="menu-group">
          {p.onToggleAnalysis && (
            <Button variant={p.showAnalysis ? 'secondary' : 'ghost'} className={NAV} onClick={p.onToggleAnalysis}>
              {t('menu.analysis')}
            </Button>
          )}
          {p.canResign && p.onResign && (
            <Button variant="destructive" className={NAV} onClick={p.onResign}>
              <Icon name="flag" size={24} /> {t('resign.button')}
            </Button>
          )}
        </div>
      )}

      {p.groups.map((g) => {
        const items = g.items.filter((it) => !(it.hideInGame && p.inGame))
        const showResume = g.group === 'play' && !p.inGame && p.hasActiveGame
        if (items.length === 0 && !showResume) return null
        return (
          <div className="menu-group" key={g.group}>
            {items.map((it) => (
              <Button
                key={it.key}
                variant="ghost"
                className={NAV}
                data-active={p.active === it.key || undefined}
                onClick={it.onClick}
              >
                <Icon name={it.icon} size={24} /> {t(it.labelKey)}
              </Button>
            ))}
            {showResume && (
              <Button variant="secondary" className={NAV} onClick={p.onResume}>
                <Icon name="live" size={24} /> {t('menu.activeGames')}
              </Button>
            )}
          </div>
        )
      })}
    </aside>
  )
}
