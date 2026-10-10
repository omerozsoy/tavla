import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { useT } from '../i18n'
import EmailVerify from './EmailVerify'
import type { ServerUser } from '../api'

interface Props {
  email: string
  onVerified: (u: ServerUser) => void
  onLogout: () => void
}

// E-POSTA DOGRULAMA DUVARI: girisli ama e-postasi dogrulanmamis kullaniciya tam ekran engel.
// Dogrulama zorunlu -> siteyi kullanamaz; yalniz kodla dogrulayabilir, tekrar gonderebilir veya cikis.
// Tasarim: marka (sicak koyu + coral) ile tutarli; kod girisi EmailVerify tone="gate" ile.
export default function EmailGate({ email, onVerified, onLogout }: Props) {
  const { t } = useT()
  return createPortal(
    <div className="egate-overlay" role="dialog" aria-modal="true" aria-label={t('emailGate.title')}>
      <div className="egate-card">
        <div className="egate-badge" aria-hidden="true">
          <Icon name="mail" size={30} />
        </div>
        <h2 className="egate-title">{t('emailGate.title')}</h2>
        <p className="egate-sub">{t('emailGate.sub')}</p>
        <div className="egate-email" title={email}>
          <span>{email}</span>
        </div>

        <EmailVerify onVerified={onVerified} tone="gate" />

        <button type="button" className="egate-logout" onClick={onLogout}>
          {t('auth.logout')}
        </button>
      </div>
    </div>,
    document.body,
  )
}
