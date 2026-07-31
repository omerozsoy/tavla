import { useT } from '../i18n'

interface Props {
  playerName: string
  loggedIn: boolean
  onNewGame: () => void
  onBoardSettings: () => void
  onAnalyzer: () => void
  onLeaderboard: () => void
  onMyStats: () => void
  onFairness: () => void
  onFriends: () => void
  onLessons: () => void
  canInstall: boolean
  onInstall: () => void
}

export default function Home({
  playerName,
  loggedIn,
  onNewGame,
  onBoardSettings,
  onAnalyzer,
  onLeaderboard,
  onMyStats,
  onFairness,
  onFriends,
  onLessons,
  canInstall,
  onInstall,
}: Props) {
  const { t } = useT()
  return (
    <div className="app lobby">
      <aside className="side-menu">
        <div className="brand">
          <span className="brand-badge">{t('brand.short')}</span>
          <span className="brand-full">{t('brand.name')}</span>
        </div>

        <div className="menu-group">
          <button className="menu-btn lobby-new" onClick={onNewGame}>
            🎮 {t('setup.newGame')}
          </button>
        </div>

        <div className="menu-group">
          <button className="menu-btn" onClick={onLeaderboard}>
            🏆 {t('menu.leaderboard')}
          </button>
          {loggedIn && (
            <button className="menu-btn" onClick={onMyStats}>
              📊 {t('menu.myStats')}
            </button>
          )}
          {loggedIn && (
            <button className="menu-btn" onClick={onFriends}>
              👥 {t('menu.friends')}
            </button>
          )}
          <button className="menu-btn" onClick={onAnalyzer}>
            🔬 {t('pa.title')}
          </button>
          <button className="menu-btn" onClick={onLessons}>
            📚 {t('menu.lessons')}
          </button>
          <button className="menu-btn" onClick={onFairness}>
            🎲 {t('fair.title')}
          </button>
          <button className="menu-btn" onClick={onBoardSettings}>
            ⚙️ {t('menu.settings')}
          </button>
          {canInstall && (
            <button className="menu-btn menu-install" onClick={onInstall}>
              📲 {t('menu.install')}
            </button>
          )}
        </div>
      </aside>

      <main className="main lobby-main">
        <div className="lobby-welcome">
          <h1 className="lobby-title">{t('brand.name')}</h1>
          <p className="lobby-tagline">{t('home.tagline')}</p>
          {playerName && <p className="lobby-hello">{t('home.hello', { name: playerName })}</p>}
          <button className="galaxy-btn roll lobby-start" onClick={onNewGame}>
            🎮 {t('setup.newGame')}
          </button>
          <button className="menu-btn lobby-analyzer" onClick={onAnalyzer}>
            🔬 {t('pa.title')}
          </button>
        </div>
      </main>
    </div>
  )
}
