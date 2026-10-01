import { useEffect, useState } from 'react'
import { onUpdateAvailable, applyUpdate } from '../autoUpdate'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'

// Yeni deploy algılanınca (autoUpdate) güvenli bir anda görünen kalıcı güncelleme istemi.
// Kendiliğinden reload YOK; kullanıcı "Güncelle"ye dokununca taze bundle yüklenir. Kök seviyede
// (main.tsx) mount edilir, normalde hiç görünmez.
export default function UpdateBanner() {
  const { t } = useT()
  const [show, setShow] = useState(false)

  useEffect(() => {
    onUpdateAvailable(() => setShow(true))
  }, [])

  if (!show) return null

  return (
    <div
      className="update-banner"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        insetInlineStart: '50%',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        transform: 'translateX(-50%)',
        zIndex: 2147483000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'calc(100vw - 24px)',
        padding: '10px 12px 10px 16px',
        borderRadius: 12,
        background: 'rgba(17,17,20,0.96)',
        color: '#fff',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        font: '500 14px/1.35 system-ui, sans-serif',
      }}
    >
      <Icon name="bell" size={18} />
      <span style={{ flex: 1 }}>{t('update.available')}</span>
      <Button type="button" onClick={applyUpdate} className="shrink-0">
        {t('update.action')}
      </Button>
    </div>
  )
}
