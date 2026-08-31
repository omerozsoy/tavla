import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import SetupBoard from './SetupBoard'

// Kurulum ekranlarindan "Tahtayi Degistir" -> tam sayfa ayarlar YERINE
// ortalanmis hizli secim modali. Yalnizca SAHIP OLUNAN tahtalar; tiklayinca
// aninda uygular + kapanir. "Tum tahtalar ve magaza" tam ayarlari acar.

interface BoardOpt {
  id: string
  name: string
  panel?: string
  a: string
  b: string
  checker?: string
  owned?: boolean
}

interface Props {
  current: string
  boards: BoardOpt[]
  onSelect: (id: string) => void
  onMore?: () => void
  onClose: () => void
}

export default function BoardPickerModal({ current, boards, onSelect, onMore, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const owned = boards.filter((b) => b.owned)

  return (
    <div className="register-overlay modal board-picker-ov" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="register-card board-picker-card" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="modal-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <Icon name="x" size={16} />
        </Button>
        <h2>
          <Icon name="dice" size={20} /> {t('boardPick.title')}
        </h2>
        <p className="register-sub">{t('boardPick.sub')}</p>

        <div className="board-picker-grid">
          {owned.map((b) => (
            <button
              key={b.id}
              type="button"
              className={`board-picker-item ${current === b.id ? 'selected' : ''}`}
              onClick={() => {
                onSelect(b.id)
                onClose()
              }}
              title={b.name}
            >
              <SetupBoard panel={b.panel ?? b.b} a={b.a} b={b.b} checker={b.checker ?? b.b} />
              <span className="board-picker-name">
                {current === b.id && <Icon name="check" size={14} />} {b.name}
              </span>
            </button>
          ))}
        </div>

        {onMore && (
          <div className="board-picker-foot">
            <Button type="button" variant="secondary" onClick={onMore}>
              <Icon name="shop" size={16} /> {t('boardPick.more')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
