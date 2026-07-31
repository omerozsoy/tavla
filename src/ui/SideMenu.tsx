import { useT } from '../i18n'

export interface SideMenuProps {
  loggedIn: boolean
  inGame: boolean
  hasActiveGame: boolean
  canInstall: boolean
  showAnalysis?: boolean
  canResign?: boolean
  onNewGame: () => void
  onResume: () => void
  onLeaderboard: () => void
  onTournaments: () => void
  onShop: () => void
  onMyStats: () => void
  onFriends: () => void
  onAnalyzer: () => void
  onLessons: () => void
  onFairness: () => void
  onBoardSettings: () => void
  onInstall: () => void
  onHome?: () => void
  onToggleAnalysis?: () => void
  onResign?: () => void
}

// Ana sayfa ve oyun ekraninda ortak tek menu.
export default function SideMenu(p: SideMenuProps) {
  const { t } = useT()
  return (
    <aside className="side-menu">
      <button
        type="button"
        className="brand brand-link"
        onClick={p.onHome}
        title={t('home.title')}
      >
        <span className="brand-badge">{t('brand.short')}</span>
        <span className="brand-full">{t('brand.name')}</span>
      </button>

      <div className="menu-group">
        <button className="menu-btn lobby-new" onClick={p.onNewGame}>
          🎮 {t('setup.newGame')}
        </button>
        {p.hasActiveGame && !p.inGame && (
          <button className="menu-btn menu-active-game" onClick={p.onResume}>
            🔴 {t('menu.activeGames')}
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
              🏳️ {t('resign.button')}
            </button>
          )}
        </div>
      )}

      <div className="menu-group">
        <button className="menu-btn" onClick={p.onLeaderboard}>
          🏆 {t('menu.leaderboard')}
        </button>
        <button className="menu-btn" onClick={p.onTournaments}>
          🏅 {t('menu.tournaments')}
        </button>
        {p.loggedIn && (
          <button className="menu-btn" onClick={p.onShop}>
            🛍️ {t('shop.title')}
          </button>
        )}
        {p.loggedIn && (
          <button className="menu-btn" onClick={p.onMyStats}>
            📊 {t('menu.myStats')}
          </button>
        )}
        {p.loggedIn && (
          <button className="menu-btn" onClick={p.onFriends}>
            👥 {t('menu.friends')}
          </button>
        )}
        <button className="menu-btn" onClick={p.onAnalyzer}>
          🔬 {t('pa.title')}
        </button>
        <button className="menu-btn" onClick={p.onFairness}>
          🎲 {t('fair.title')}
        </button>
        <button className="menu-btn" onClick={p.onBoardSettings}>
          ⚙️ {t('menu.settings')}
        </button>
        {p.canInstall && (
          <button className="menu-btn menu-install" onClick={p.onInstall}>
            📲 {t('menu.install')}
          </button>
        )}
      </div>
    </aside>
  )
}
