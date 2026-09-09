import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import type { ServerUser } from '../api'

interface Props {
  user: ServerUser
  onRenew?: () => void
  onToggleAutoRenew?: (enabled: boolean) => void
}

// Uyelik durumu karti (Premium): tip + baslangic/bitis + kalan gun + otomatik yenileme +
// Yenile / Yenilemeyi iptal. Profil ANA sayfasinda (ProfileOverview) baslikin altinda.
export default function MembershipCard({ user, onRenew, onToggleAutoRenew }: Props) {
  const { t } = useT()
  const [confirmOpen, setConfirmOpen] = useState(false) // oto-yenileme iptal onay modali
  const plan = user.plan_active ?? 'free'
  const premium = plan === 'star' || plan === 'starpro'
  const until = user.plan_until ?? null
  const daysLeft = until ? Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86400000)) : null
  const untilFmt = until ? new Date(until).toLocaleDateString() : ''
  const since = user.plan_since ?? null
  const sinceFmt = since ? new Date(since).toLocaleDateString() : ''
  const autoRenew = user.auto_renew ?? false

  return (
    <div className="mem-status" data-plan={plan}>
      <div className="mem-status-head">
        <span className={`mem-status-plan ${premium ? 'is-premium' : 'is-free'}`}>
          <Icon name={premium ? 'crown' : 'star'} size={22} />
          {premium ? t('mem.status.premium') : t('mem.status.free')}
        </span>
        {premium && (
          <span className={`mem-status-auto ${autoRenew ? 'on' : 'off'}`}>
            {autoRenew ? t('mem.status.autoOn') : t('mem.status.autoOff')}
          </span>
        )}
      </div>
      {premium && (
        <div className="mem-status-detail">
          {since && <span>{t('mem.status.since', { date: sinceFmt })}</span>}
          {until ? (
            <>
              <span>{t('mem.status.expires', { date: untilFmt })}</span>
              {daysLeft != null && (
                <span className="mem-status-days">{t('mem.status.daysLeft', { days: daysLeft })}</span>
              )}
            </>
          ) : (
            <span>{t('mem.status.lifetime')}</span>
          )}
        </div>
      )}
      {premium && (onRenew || onToggleAutoRenew) && (
        <div className="mem-status-actions">
          {onRenew && (
            <Button type="button" variant="ghost" onClick={onRenew}>
              <Icon name="crown" size={16} /> {t('mem.status.renew')}
            </Button>
          )}
          {onToggleAutoRenew && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                // Yalniz IPTAL ederken onay iste (acarken gerek yok). Native confirm yerine
                // site-tasarimli in-app modal (register-overlay) -> mobil + tema tutarli.
                if (autoRenew) setConfirmOpen(true)
                else onToggleAutoRenew(true)
              }}
            >
              {autoRenew ? t('mem.status.cancelRenew') : t('mem.status.enableRenew')}
            </Button>
          )}
        </div>
      )}
      {/* Oto-yenileme iptal onayi: site-tasarimli modal (native confirm yerine). Kart profil
          icinde (transform'lu ata olabilir) -> position:fixed overlay kirpilmasin diye
          createPortal ile body'ye tasinir. Bkz [[fixed-portal-transform-tuzagi]]. */}
      {confirmOpen &&
        createPortal(
          <div
            className="register-overlay modal"
            role="dialog"
            aria-modal="true"
            onClick={() => setConfirmOpen(false)}
          >
            <div className="register-card resign-card" onClick={(e) => e.stopPropagation()}>
              <h2>
                <Icon name="crown" size={20} /> {t('mem.status.cancelRenew')}
              </h2>
              <p className="register-sub">{t('mem.status.cancelConfirm')}</p>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmOpen(false)
                  onToggleAutoRenew?.(false)
                }}
              >
                {t('mem.status.cancelRenew')}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                {t('reg.cancel')}
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
