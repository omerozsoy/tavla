/**
 * RankInfo — menüden açılan "Rütbeler" sayfa-modalı. RankProgression infografiğini
 * barındırır; giriş yapan kullanıcının rating'ini geçirir (misafirde düz merdiven).
 * Diğer sayfa-modallarıyla aynı kalıp (register-overlay modal page + modal-close +
 * useEscape). Backdrop onClick YOK (nested modal tuzağı).
 */

import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { RankProgression } from './RankProgression'

interface Props {
  currentRating?: number
  onClose: () => void
}

export default function RankInfo({ currentRating, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card rank-info-card" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="modal-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <Icon name="x" size={16} />
        </Button>
        <RankProgression currentRating={currentRating} />
      </div>
    </div>
  )
}
