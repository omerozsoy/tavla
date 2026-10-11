import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { useT } from '../i18n'
import EmailVerify from './EmailVerify'
import BugReport from './BugReport'
import { TavlaTvLogo } from './TavlaTvLogo'
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
        <TavlaTvLogo size={26} tone="dark" className="egate-logo" />
        <div className="egate-badge" aria-hidden="true">
          <Icon name="mail" size={30} />
        </div>
        <h2 className="egate-title">{t('emailGate.title')}</h2>
        <p className="egate-sub">{t('emailGate.sub')}</p>
        <div className="egate-email" title={email}>
          <span>{email}</span>
        </div>

        <EmailVerify onVerified={onVerified} tone="gate" />

        {/* Yardim bolgesi: e-posta hic gelmiyorsa Hata Bildir formunu ac (halka acik /bug-report). */}
        <div className="egate-help">
          <span className="egate-help-cap">{t('emailGate.helpCap')}</span>
          <button
            type="button"
            className="egate-report"
            onClick={() => window.dispatchEvent(new CustomEvent('tavla:open-bug-report'))}
          >
            <Icon name="flag" size={15} />
            {t('emailGate.report')}
          </button>
        </div>

        <button type="button" className="egate-logout" onClick={onLogout}>
          {t('auth.logout')}
        </button>
      </div>

      {/* Duvarin ustunde (z-index) acilan sorun-bildir formu; FAB gizli, yalniz butonla acilir. */}
      <BugReport currentPage={t('emailGate.reportPage')} loggedIn hideFab />
    </div>,
    document.body,
  )
}
