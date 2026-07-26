import { useT } from '../i18n'

interface BoardThemeOpt {
  id: string
  name: string
  a: string
  b: string
}

interface Props {
  playerName: string
  onNewGame: () => void
  boardTheme: string
  setBoardTheme: (id: string) => void
  boardThemes: BoardThemeOpt[]
}

export default function Home({
  playerName,
  onNewGame,
  boardTheme,
  setBoardTheme,
  boardThemes,
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
          <div className="menu-label">{t('menu.boardSettings')}</div>
          <div className="board-swatches">
            {boardThemes.map((bt) => (
              <button
                key={bt.id}
                className={`swatch ${boardTheme === bt.id ? 'active' : ''}`}
                title={bt.name}
                onClick={() => setBoardTheme(bt.id)}
                style={{ background: `linear-gradient(135deg, ${bt.a} 0 50%, ${bt.b} 50% 100%)` }}
              />
            ))}
          </div>
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
