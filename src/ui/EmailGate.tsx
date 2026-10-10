import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
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
export default function EmailGate({ email, onVerified, onLogout }: Props) {
  const { t } = useT()
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('emailGate.title')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483600, // her seyin ustunde (install/update banner dahil)
        background: 'rgba(0,0,0,0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        font: '500 14px/1.45 system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: 'min(460px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 32px)',
          overflow: 'auto',
          padding: 24,
          borderRadius: 16,
          background: '#1C1A17',
          color: '#F4EFE6',
          boxShadow: '0 16px 50px rgba(0,0,0,0.6)',
          textAlign: 'center',
        }}
      >
        <div style={{ color: '#C9563F', marginBottom: 10 }}>
          <Icon name="alert" size={40} />
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 700 }}>{t('emailGate.title')}</h2>
        <p style={{ margin: '0 0 6px', opacity: 0.8, fontSize: 13 }}>{t('emailGate.sub')}</p>
        <p style={{ margin: '0 0 16px', opacity: 0.95, fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{email}</p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <EmailVerify onVerified={onVerified} />
        </div>

        <Button type="button" variant="ghost" onClick={onLogout} style={{ marginTop: 16, opacity: 0.8 }}>
          {t('auth.logout')}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
