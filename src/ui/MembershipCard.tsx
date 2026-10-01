import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import type { ServerUser } from '../api'
import PhoneVerify from './PhoneVerify'
import EmailVerify from './EmailVerify'

interface Props {
  user: ServerUser
  onRenew?: () => void
  onToggleAutoRenew?: (enabled: boolean) => void
  // E-posta dogrulama uyarisi uyelik kartinda gosterilir (dogrulamayan premium olamaz;
  // Google ile giren zaten dogrulanmistir -> emailUnverified false gelir).
  emailUnverified?: boolean
  resendState?: 'idle' | 'sending' | 'sent'
  onResendVerification?: () => void
  // Telefon OTP dogrulandiginda guncel kullaniciyi yukari tasir (global user guncelle).
  onUserUpdate?: (u: ServerUser) => void
}

// Uyelik durumu karti (Premium): tip + baslangic/bitis + kalan gun + otomatik yenileme +
// Yenile / Yenilemeyi iptal. Profil ANA sayfasinda (ProfileOverview) baslikin altinda.
export default function MembershipCard({ user, onRenew, onToggleAutoRenew, emailUnverified, onUserUpdate }: Props) {
  const { t } = useT()
  const [confirmOpen, setConfirmOpen] = useState(false) // oto-yenileme iptal onay modali
  const plan = user.plan_active ?? 'free'
  const premium = plan === 'star'
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
      {/* E-posta dogrulama: "Tekrar gönder" -> e-postaya 6 haneli kod + link; kodu kutuya girince
          hesap ANINDA doğrulanır. (Eski link-only bar yerine EmailVerify; PhoneVerify ile simetrik.) */}
      {emailUnverified && <EmailVerify onVerified={(u) => onUserUpdate?.(u)} />}
      {/* Telefon doğrulama (OTP): numara var + doğrulanmamışsa gösterilir (bileşen kendi karar verir). */}
      <PhoneVerify user={user} onVerified={(u) => onUserUpdate?.(u)} />
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
