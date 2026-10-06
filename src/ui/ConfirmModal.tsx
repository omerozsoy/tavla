import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import { Button } from '@/components/ui/button'

// Uygulama-ici onay penceresi: native window.confirm (markasiz tarayici "site says" popup'i)
// yerine site stiliyle (register-overlay modal + resign-card). body'ye portal -> tam-ekran
// portallarin (spectate/game-view z-index 5000) ARKASINDA kalmaz, her yerden gorunur.
// Kullanim: cagiran bir `{ ...props, run }` state tutar; onay -> state'i temizle + run().
export default function ConfirmModal({
  title,
  message,
  icon = 'info',
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  icon?: IconName
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useT()
  return createPortal(
    <div className="register-overlay modal confirm-overlay" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="register-card resign-card" onClick={(e) => e.stopPropagation()}>
        <h2>
          <Icon name={icon} size={20} /> {title}
        </h2>
        <p className="register-sub">{message}</p>
        <Button variant={destructive ? 'destructive' : 'default'} onClick={onConfirm}>
          {confirmLabel ?? t('btn.confirm')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel ?? t('mp.cancel')}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
