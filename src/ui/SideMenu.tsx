import { useT } from '../i18n'
import { TavlaTvLogo } from './TavlaTvLogo'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'

export interface SideMenuProps {
  loggedIn: boolean
  inGame: boolean
  hasActiveGame: boolean
  canInstall: boolean
  showAnalysis?: boolean
  canResign?: boolean
  onNewGame: () => void
  onSolo?: () => void
  onAiGame?: () => void
  onResume: () => void
  onLeaderboard: () => void
  onRanks?: () => void
  onTournaments: () => void
  onShop: () => void
  onMembership?: () => void
  onMyStats: () => void
  onFriends: () => void
  onAnalyzer: () => void
  onBlunders?: () => void
  onMatchHistory?: () => void
  onQuiz?: () => void
  onLessons: () => void
  onRules?: () => void
  onFairness: () => void
  onBoardSettings: () => void
  onInstall: () => void
  onCalendar?: () => void
  onClubs?: () => void
  onServices?: () => void
  onBlog?: () => void
  onNews?: () => void
  onMagazine?: () => void
  onHome?: () => void
  onToggleAnalysis?: () => void
  onResign?: () => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
  /** Acik olan sayfanin anahtari -> ilgili nav item navy highlight (data-active) */
  active?: string
}

// Ana sayfa ve oyun ekraninda ortak tek menu. Tum ogeler paylasilan <Button> (nav ->
// ghost, tam genislik + sola hizali); yalniz variant/renk degisir, fiziksel yapi ayni.
// Not: shadcn Button base'i [&_svg:not([class*='size-'])]:size-4 ile buton icindeki
// ikonlari 16px'e SABITLER (Icon'un size prop'unu ezer). Menu ikonlarini buyutmek icin
// svg boyutunu !important ile burada override ediyoruz — tek nokta, tum menu ikonlari.
const NAV = "w-full justify-start [&_svg]:size-[24px]!"

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
      <button
        type="button"
        className="brand brand-link"
        onClick={p.onHome}
        title={t('home.title')}
        aria-label={t('brand.name')}
      >
        <TavlaTvLogo size={32} />
      </button>

      <div className="menu-group">
        {!p.inGame && p.onSolo && (
          <Button variant="ghost" className={NAV} data-active={p.active === 'solo' || undefined} onClick={p.onSolo}>
            <Icon name="coins" size={24} /> {t('menu.solo')}
          </Button>
        )}
        {!p.inGame && (
          <Button variant="ghost" className={NAV} data-active={p.active === 'match' || undefined} onClick={p.onNewGame}>
            <Icon name="ranking" size={24} /> {t('menu.match')}
          </Button>
        )}
        {!p.inGame && p.onAiGame && (
          <Button variant="ghost" className={NAV} data-active={p.active === 'aiGame' || undefined} onClick={p.onAiGame}>
            <Icon name="robot" size={24} /> {t('menu.aiGame')}
          </Button>
        )}
        {p.hasActiveGame && !p.inGame && (
          <Button variant="secondary" className={NAV} onClick={p.onResume}>
            <Icon name="live" size={24} /> {t('menu.activeGames')}
          </Button>
        )}
      </div>

      {p.inGame && (
        <div className="menu-group">
          {p.onToggleAnalysis && (
            <Button
              variant={p.showAnalysis ? 'secondary' : 'ghost'}
              className={NAV}
              onClick={p.onToggleAnalysis}
            >
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

      {/* Rekabet + sosyal (en cok kullanilanlar ust sirada) */}
      <div className="menu-group">
        <Button variant="ghost" className={NAV} data-active={p.active === 'tournaments' || undefined} onClick={p.onTournaments}>
          <Icon name="trophy" size={24} /> {t('menu.tournaments')}
        </Button>
        <Button variant="ghost" className={NAV} data-active={p.active === 'leaderboard' || undefined} onClick={p.onLeaderboard}>
          <Icon name="crown" size={24} /> {t('menu.leaderboard')}
        </Button>
        {p.onRanks && (
          <Button variant="ghost" className={NAV} data-active={p.active === 'ranks' || undefined} onClick={p.onRanks}>
            <Icon name="medal" size={24} /> {t('menu.ranks')}
          </Button>
        )}
        {p.loggedIn && (
          <Button variant="ghost" className={NAV} data-active={p.active === 'friends' || undefined} onClick={p.onFriends}>
            <Icon name="users" size={24} /> {t('menu.friends')}
          </Button>
        )}
      </div>

      {/* Hesap. Uyelik (premium) uye OLMAYANA da gorunur -> tiklayinca uyelik ekrani.
          Istatistiklerim ise yalniz giris yapana (misafirin istatistigi yok). */}
      {(p.onMembership || p.loggedIn) && (
        <div className="menu-group">
          {p.onMembership && (
            <Button variant="ghost" className={NAV} data-active={p.active === 'membership' || undefined} onClick={p.onMembership}>
              <Icon name="star" size={24} /> {t('mem.menu')}
            </Button>
          )}
          {/* İstatistiklerim menüden KALDIRILDI → Profilim içinde "İstatistikler" sekmesi */}
        </div>
      )}

      {/* Bilgi / icerik sayfalari (herkese acik) */}
      {!p.inGame && (p.onCalendar || p.onClubs || p.onServices || p.onBlog || p.onNews) && (
        <div className="menu-group">
          {p.onCalendar && (
            <Button variant="ghost" className={NAV} data-active={p.active === 'calendar' || undefined} onClick={p.onCalendar}>
              <Icon name="calendar-dots" size={24} /> {t('menu.calendar')}
            </Button>
          )}
          {p.onClubs && (
            <Button variant="ghost" className={NAV} data-active={p.active === 'clubs' || undefined} onClick={p.onClubs}>
              <Icon name="building-office" size={24} /> {t('menu.clubs')}
            </Button>
          )}
          {p.onServices && (
            <Button variant="ghost" className={NAV} data-active={p.active === 'services' || undefined} onClick={p.onServices}>
              <Icon name="briefcase" size={24} /> {t('menu.services')}
            </Button>
          )}
          {p.onNews && (
            <Button variant="ghost" className={NAV} data-active={p.active === 'news' || undefined} onClick={p.onNews}>
              <Icon name="newspaper" size={24} /> {t('menu.news')}
            </Button>
          )}
          {p.onMagazine && (
            <Button variant="ghost" className={NAV} data-active={p.active === 'magazine' || undefined} onClick={p.onMagazine}>
              <Icon name="monitor-play" size={24} /> {t('menu.magazine')}
            </Button>
          )}
        </div>
      )}

      {/* Araclar (dogrudan; "Daha fazla" acilir menu yok) */}
      <div className="menu-group">
        <div className="menu-label">{t('menu.tools')}</div>
        <Button variant="ghost" className={NAV} data-active={p.active === 'analyzer' || undefined} onClick={p.onAnalyzer}>
          <Icon name="search" size={24} /> {t('pa.title')}
        </Button>
        {p.onBlunders && (
          <Button variant="ghost" className={NAV} data-active={p.active === 'blunders' || undefined} onClick={p.onBlunders}>
            <Icon name="warning-circle" size={24} /> {t('menu.blunders')}
          </Button>
        )}
        {p.onMatchHistory && (
          <Button variant="ghost" className={NAV} data-active={p.active === 'matchHistory' || undefined} onClick={p.onMatchHistory}>
            <Icon name="chart-line" size={24} /> {t('menu.matchHistory')}
          </Button>
        )}
        <Button variant="ghost" className={NAV} data-active={p.active === 'fairness' || undefined} onClick={p.onFairness}>
          <Icon name="shield-check" size={24} /> {t('fair.title')}
        </Button>
      </div>
    </aside>
  )
}
