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
  onClose: () => void
}

export default function BoardSettings({ boardTheme, setBoardTheme, boardThemes, onClose }: Props) {
  const { t } = useT()
  return (
    <div className="register-overlay modal" onClick={onClose}>
      <div className="register-card board-settings-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>
        <h2>🎨 {t('menu.boardSettings')}</h2>
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
    </div>
  )
}
