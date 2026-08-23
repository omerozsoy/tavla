import { useT } from '../i18n'
import { TavlaTvLogo } from './TavlaTvLogo'
import { Icon } from './Icon'

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
  onMyStats: () => void
  onFriends: () => void
  onAnalyzer: () => void
  onBlunders?: () => void
  onQuiz?: () => void
  onLessons: () => void
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
  onHome?: () => void
  onToggleAnalysis?: () => void
  onResign?: () => void
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

// Ana sayfa ve oyun ekraninda ortak tek menu.
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
          <button className="menu-btn" onClick={p.onSolo}>
            <Icon name="play" /> {t('menu.solo')}
          </button>
        )}
        {!p.inGame && (
          <button className="menu-btn menu-match" onClick={p.onNewGame}>
            <Icon name="target" /> {t('menu.match')}
          </button>
        )}
        {!p.inGame && p.onAiGame && (
          <button className="menu-btn" onClick={p.onAiGame}>
            <Icon name="dice" /> {t('menu.aiGame')}
          </button>
        )}
        {p.hasActiveGame && !p.inGame && (
          <button className="menu-btn menu-active-game" onClick={p.onResume}>
            <Icon name="live" /> {t('menu.activeGames')}
          </button>
        )}
      </div>

      {p.inGame && (
        <div className="menu-group">
          {p.onToggleAnalysis && (
            <button
              className={p.showAnalysis ? 'menu-btn active' : 'menu-btn'}
              onClick={p.onToggleAnalysis}
            >
              {t('menu.analysis')}
            </button>
          )}
          {p.canResign && p.onResign && (
            <button className="menu-btn resign-btn" onClick={p.onResign}>
              <Icon name="flag" /> {t('resign.button')}
            </button>
          )}
        </div>
      )}

      {/* Rekabet + sosyal (en cok kullanilanlar ust sirada) */}
      <div className="menu-group">
        <button className="menu-btn" onClick={p.onTournaments}>
          <Icon name="medal" /> {t('menu.tournaments')}
        </button>
        <button className="menu-btn" onClick={p.onLeaderboard}>
          <Icon name="trophy" /> {t('menu.leaderboard')}
        </button>
        {p.loggedIn && (
          <button className="menu-btn" onClick={p.onFriends}>
            <Icon name="users" /> {t('menu.friends')}
          </button>
        )}
      </div>

      {/* Hesap */}
      {p.loggedIn && (
        <div className="menu-group">
          <button className="menu-btn" onClick={p.onMyStats}>
            <Icon name="chart" /> {t('menu.myStats')}
          </button>
        </div>
      )}

      {/* Bilgi / icerik sayfalari (herkese acik) */}
      {!p.inGame && (p.onCalendar || p.onClubs || p.onServices || p.onBlog || p.onNews) && (
        <div className="menu-group">
          {p.onCalendar && (
            <button className="menu-btn" onClick={p.onCalendar}>
              <Icon name="calendar" /> {t('menu.calendar')}
            </button>
          )}
          {p.onClubs && (
            <button className="menu-btn" onClick={p.onClubs}>
              <Icon name="pin" /> {t('menu.clubs')}
            </button>
          )}
          {p.onServices && (
            <button className="menu-btn" onClick={p.onServices}>
              <Icon name="star" /> {t('menu.services')}
            </button>
          )}
          {p.onBlog && (
            <button className="menu-btn" onClick={p.onBlog}>
              <Icon name="book" /> {t('menu.blog')}
            </button>
          )}
          {p.onNews && (
            <button className="menu-btn" onClick={p.onNews}>
              <Icon name="chat" /> {t('menu.news')}
            </button>
          )}
        </div>
      )}

      {/* Araclar (dogrudan; "Daha fazla" acilir menu yok) */}
      <div className="menu-group">
        <div className="menu-label">{t('menu.tools')}</div>
        <button className="menu-btn" onClick={p.onAnalyzer}>
          <Icon name="analyze" /> {t('pa.title')}
        </button>
        {p.onBlunders && (
          <button className="menu-btn" onClick={p.onBlunders}>
            <Icon name="alert" /> {t('menu.blunders')}
          </button>
        )}
        <button className="menu-btn" onClick={p.onFairness}>
          <Icon name="dice" /> {t('fair.title')}
        </button>
      </div>

      {/* Ayarlar en altta sabit */}
      <div className="menu-group menu-bottom">
        <button className="menu-btn" onClick={p.onBoardSettings}>
          <Icon name="settings" /> {t('menu.settings')}
        </button>
        {/* "Uygulamayi Yukle" dugmesi simdilik gizli (altyapi p.canInstall/onInstall duruyor) */}
      </div>
    </aside>
  )
}
