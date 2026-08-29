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
  isAdmin?: boolean
  onAdmin?: () => void
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
}

// Ana sayfa ve oyun ekraninda ortak tek menu. Tum ogeler paylasilan <Button> (nav ->
// ghost, tam genislik + sola hizali); yalniz variant/renk degisir, fiziksel yapi ayni.
const NAV = 'w-full justify-start'

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
          <Button variant="ghost" className={NAV} onClick={p.onSolo}>
            <Icon name="coin" size={24} /> {t('menu.solo')}
          </Button>
        )}
        {!p.inGame && (
          <Button variant="ghost" className={NAV} onClick={p.onNewGame}>
            <Icon name="chart" size={24} /> {t('menu.match')}
          </Button>
        )}
        {!p.inGame && p.onAiGame && (
          <Button variant="ghost" className={NAV} onClick={p.onAiGame}>
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
        <Button variant="ghost" className={NAV} onClick={p.onTournaments}>
          <Icon name="ranking" size={24} /> {t('menu.tournaments')}
        </Button>
        <Button variant="ghost" className={NAV} onClick={p.onLeaderboard}>
          <Icon name="trophy" size={24} /> {t('menu.leaderboard')}
        </Button>
        {p.loggedIn && (
          <Button variant="ghost" className={NAV} onClick={p.onFriends}>
            <Icon name="users" size={24} /> {t('menu.friends')}
          </Button>
        )}
      </div>

      {/* Hesap. Uyelik (premium) uye OLMAYANA da gorunur -> tiklayinca uyelik ekrani.
          Istatistiklerim ise yalniz giris yapana (misafirin istatistigi yok). */}
      {(p.onMembership || p.loggedIn) && (
        <div className="menu-group">
          {p.onMembership && (
            <Button variant="ghost" className={NAV} onClick={p.onMembership}>
              <Icon name="crown" size={24} /> {t('mem.menu')}
            </Button>
          )}
          {p.loggedIn && (
            <Button variant="ghost" className={NAV} onClick={p.onMyStats}>
              <Icon name="chart" size={24} /> {t('menu.myStats')}
            </Button>
          )}
        </div>
      )}

      {/* Bilgi / icerik sayfalari (herkese acik) */}
      {!p.inGame && (p.onCalendar || p.onClubs || p.onServices || p.onBlog || p.onNews) && (
        <div className="menu-group">
          {p.onCalendar && (
            <Button variant="ghost" className={NAV} onClick={p.onCalendar}>
              <Icon name="calendar" size={24} /> {t('menu.calendar')}
            </Button>
          )}
          {p.onClubs && (
            <Button variant="ghost" className={NAV} onClick={p.onClubs}>
              <Icon name="pin" size={24} /> {t('menu.clubs')}
            </Button>
          )}
          {p.onServices && (
            <Button variant="ghost" className={NAV} onClick={p.onServices}>
              <Icon name="star" size={24} /> {t('menu.services')}
            </Button>
          )}
          {p.onNews && (
            <Button variant="ghost" className={NAV} onClick={p.onNews}>
              <Icon name="chat" size={24} /> {t('menu.news')}
            </Button>
          )}
          {p.onMagazine && (
            <Button variant="ghost" className={NAV} onClick={p.onMagazine}>
              <Icon name="play" size={24} /> {t('menu.magazine')}
            </Button>
          )}
        </div>
      )}

      {/* Araclar (dogrudan; "Daha fazla" acilir menu yok) */}
      <div className="menu-group">
        <div className="menu-label">{t('menu.tools')}</div>
        <Button variant="ghost" className={NAV} onClick={p.onAnalyzer}>
          <Icon name="analyze" size={24} /> {t('pa.title')}
        </Button>
        {p.onBlunders && (
          <Button variant="ghost" className={NAV} onClick={p.onBlunders}>
            <Icon name="alert" size={24} /> {t('menu.blunders')}
          </Button>
        )}
        {p.onMatchHistory && (
          <Button variant="ghost" className={NAV} onClick={p.onMatchHistory}>
            <Icon name="analyze" size={24} /> {t('menu.matchHistory')}
          </Button>
        )}
        <Button variant="ghost" className={NAV} onClick={p.onFairness}>
          <Icon name="dice" size={24} /> {t('fair.title')}
        </Button>
      </div>
    </aside>
  )
}
