import { useT } from '../i18n'

interface Props {
  playerName: string
  onNewGame: () => void
  onBoardSettings: () => void
  onAnalyzer: () => void
}

export default function Home({ playerName, onNewGame, onBoardSettings, onAnalyzer }: Props) {
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
          <button className="menu-btn" onClick={onAnalyzer}>
            🔬 {t('pa.title')}
          </button>
          <button className="menu-btn" onClick={onBoardSettings}>
            ⚙️ {t('menu.settings')}
          </button>
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
        </div>
      </main>
    </div>
  )
}
