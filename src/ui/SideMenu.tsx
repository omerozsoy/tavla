import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import { Button } from '@/components/ui/button'
import { TavlaTvLogo } from './TavlaTvLogo'

// Katlanabilir grup durumu (localStorage'da kalici). Anahtar -> kapali mi.
const COLLAPSE_KEY = 'menuCollapsed'
const SIG_KEY = 'menuCollapsedSig' // admin varsayilan imzasi (degisince override sifirlanir)
const loadCollapsed = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}')
  } catch {
    return {}
  }
}

// Ana sayfa ve oyun ekraninda ortak tek menu. Ogeler MERKEZI SAYFA KAYDINDAN (pages.ts)
// turetilir; bu bilesen yalnizca RENDER eder. Yeni menu sayfasi = pages.ts'e bir giris.
// Not: shadcn Button base'i ikonlari 16px'e sabitler -> menu ikonlarini !important ile buyut.
const NAV = 'w-full justify-start [&_svg]:size-[20px]!'

export interface NavItem {
  key: string // aktif-vurgu anahtari (activeKey ile eslesir)
  labelKey: string // i18n (varsayilan)
  label?: string // admin panelden ozel ad (varsa i18n'i ezer)
  icon: IconName
  onClick: () => void
  hideInGame?: boolean // oyun ekraninda gizle
}

export interface SideMenuProps {
  inGame: boolean
  hasActiveGame: boolean
  showAnalysis?: boolean
  canResign?: boolean
  // Gruplar admin panelinden yonetilir: group=anahtar, label=cozumlenmis baslik (null=basliksiz),
  // defaultCollapsed=baslangicta katli mi (admin ayari; kullanici tiklamasi uzerine yazar).
  groups: { group: string; label: string | null; defaultCollapsed: boolean; items: NavItem[] }[]
  // Admin katlama-varsayilanlarinin imzasi; degisince kullanici override'lari sifirlanir.
  groupSig?: string
  onResume: () => void
  onToggleAnalysis?: () => void
  onResign?: () => void
  active?: string
  badges?: Record<string, number> // menu ogesi key -> rozet sayisi (or. okunmamis mesaj)
  mobileOpen?: boolean
  onCloseMobile?: () => void
  onHome?: () => void // drawer logosuna tiklayinca ana sayfa
}

export default function SideMenu(p: SideMenuProps) {
  const { t } = useT()
  // Katlanabilir gruplar: varsayilan ilk 2 grup acik, gerisi kapali; kullanici degistirince
  // localStorage'da saklanir (grup anahtarina gore override).
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed)
  // Admin katlama-varsayilanlari degisince (groupSig) kullanici override'larini SIFIRLA ->
  // admin panelinden yapilan degisiklik her tarayicida gecerli olur (localStorage tuzagi biter).
  useEffect(() => {
    if (!p.groupSig) return
    let stored = ''
    try {
      stored = localStorage.getItem(SIG_KEY) || ''
    } catch {
      /* yok say */
    }
    if (stored !== p.groupSig) {
      setCollapsed({})
      try {
        localStorage.setItem(COLLAPSE_KEY, '{}')
        localStorage.setItem(SIG_KEY, p.groupSig)
      } catch {
        /* yok say */
      }
    }
  }, [p.groupSig])
  // Baslangic durumu admin ayarindan (def); kullanicinin kendi tiklamasi (localStorage) uzerine yazar.
  const isCollapsed = (key: string, def: boolean) => collapsed[key] ?? def
  const toggleGroup = (key: string, def: boolean) => {
    setCollapsed((c) => {
      const next = { ...c, [key]: !(c[key] ?? def) }
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next))
      } catch {
        /* yok say */
      }
      return next
    })
  }
  return (
    <aside
      className={`side-menu ${p.mobileOpen ? 'open' : ''}`}
      onClickCapture={(e) => {
        // Mobilde bir menu ogesine dokununca drawer'i kapat — ama grup basligina (accordion
        // ac/kapa) dokununca KAPATMA.
        const btn = (e.target as HTMLElement).closest('button')
        if (p.onCloseMobile && btn && !btn.classList.contains('menu-group-title')) p.onCloseMobile()
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

      {(() => {
        // "Oyuna devam" yalnizca ILK play grubuna eklenir (admin menuyu bolerse tekrar etmesin)
        const firstPlayIdx = p.groups.findIndex((g) => g.group === 'play')
        return p.groups.map((g, gi) => {
        const items = g.items.filter((it) => !(it.hideInGame && p.inGame))
        const showResume = gi === firstPlayIdx && !p.inGame && p.hasActiveGame
        if (items.length === 0 && !showResume) return null
        // Grup basligi: admin cozumlemesi (g.label) varsa + oyun disinda + gercekten oge varsa.
        const showTitle = !!g.label && !p.inGame && items.length > 0
        // Katlama yalnizca basligi olan (oyun disi) gruplarda; oyun ekraninda hep acik.
        const collapsedNow = showTitle && isCollapsed(g.group, g.defaultCollapsed)
        // Kapali grupta gizli kalan rozetleri baslikta topla (or. okunmamis mesaj kaybolmasin).
        const groupBadge = collapsedNow ? items.reduce((s, it) => s + (p.badges?.[it.key] ?? 0), 0) : 0
        return (
          <div className={`menu-group ${collapsedNow ? 'collapsed' : ''}`} key={`${g.group}-${gi}`}>
            {showTitle && (
              <button
                type="button"
                className="menu-group-title"
                onClick={() => toggleGroup(g.group, g.defaultCollapsed)}
                aria-expanded={!collapsedNow}
              >
                <span className="menu-group-label">{g.label}</span>
                {groupBadge > 0 && <span className="menu-badge">{groupBadge > 99 ? '99+' : groupBadge}</span>}
                <Icon name="chevron" size={13} className={`menu-group-caret ${collapsedNow ? 'closed' : ''}`} />
              </button>
            )}
            {!collapsedNow &&
              items.map((it) => {
                const badge = p.badges?.[it.key] ?? 0
                return (
                  <Button
                    key={it.key}
                    variant="ghost"
                    className={NAV}
                    data-active={p.active === it.key || undefined}
                    onClick={it.onClick}
                  >
                    <Icon name={it.icon} size={24} /> <span className="nav-label">{it.label ?? t(it.labelKey)}</span>
                    {badge > 0 && <span className="menu-badge">{badge > 99 ? '99+' : badge}</span>}
                  </Button>
                )
              })}
            {!collapsedNow && showResume && (
              <Button variant="secondary" className={NAV} onClick={p.onResume}>
                <Icon name="live" size={24} /> {t('menu.activeGames')}
              </Button>
            )}
          </div>
        )
        })
      })()}
    </aside>
  )
}
