import { useT } from '../i18n'

interface BoardThemeOpt {
  id: string
  name: string
  a: string
  b: string
}

interface Props {
  boardTheme: string
  setBoardTheme: (id: string) => void
  boardThemes: BoardThemeOpt[]
  theme: 'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
  showPip: boolean
  setShowPip: (v: boolean) => void
  showAnalysis: boolean
  setShowAnalysis: (v: boolean) => void
  learnMode: boolean
  setLearnMode: (v: boolean) => void
  onClose: () => void
}

export default function BoardSettings({
  boardTheme,
  setBoardTheme,
  boardThemes,
  theme,
  setTheme,
  showPip,
  setShowPip,
  showAnalysis,
  setShowAnalysis,
  learnMode,
  setLearnMode,
  onClose,
}: Props) {
  const { t } = useT()
  return (
    <div className="register-overlay modal" onClick={onClose}>
      <div className="register-card board-settings-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>
        <h2>⚙️ {t('menu.settings')}</h2>

        {/* Tema (koyu/acik) */}
        <div className="setup-row">
          <div className="setup-label">{t('menu.theme')}</div>
          <div className="menu-targets">
            <button
              className={theme === 'dark' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setTheme('dark')}
            >
              🌙 {t('theme.dark')}
            </button>
            <button
              className={theme === 'light' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setTheme('light')}
            >
              ☀️ {t('theme.light')}
            </button>
          </div>
        </div>

        {/* Tahta rengi */}
        <div className="setup-row">
          <div className="setup-label">{t('menu.board')}</div>
          <div className="board-swatches big">
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

        {/* Pip goster */}
        <button className={`setup-toggle ${showPip ? 'on' : ''}`} onClick={() => setShowPip(!showPip)}>
          <span>{t('setup.pip')}</span>
          <span className="setup-switch">{showPip ? t('setup.on') : t('setup.off')}</span>
        </button>

        {/* Analiz goster */}
        <button
          className={`setup-toggle ${showAnalysis ? 'on' : ''}`}
          onClick={() => setShowAnalysis(!showAnalysis)}
        >
          <span>{t('setup.analysis')}</span>
          <span className="setup-switch">{showAnalysis ? t('setup.on') : t('setup.off')}</span>
        </button>

        {/* Ogrenme modu */}
        <button
          className={`setup-toggle ${learnMode ? 'on' : ''}`}
          onClick={() => setLearnMode(!learnMode)}
        >
          <span>🎓 {t('hint.learnMode')}</span>
          <span className="setup-switch">{learnMode ? t('setup.on') : t('setup.off')}</span>
        </button>
        <p className="setup-note">{t('hint.learnNote')}</p>
      </div>
    </div>
  )
}
