import { useEffect, useState } from 'react'
import { onUpdateAvailable, applyUpdate, unsafeToPrompt } from '../autoUpdate'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'

// Yeni deploy algılanınca (autoUpdate) güvenli bir anda görünen güncelleme istemi.
// Kendiliğinden reload YOK; kullanıcı "Güncelle"ye dokununca taze bundle yüklenir. Kök seviyede
// (main.tsx) mount edilir, normalde hiç görünmez.
// - Banner bir kez gösterildikten sonra da güvenli olmayan anda (maç / ödeme / okuma) GİZLENİR;
//   aksi halde maça girince tahtanın üstünde kalıyordu (yatay telefonda alt haneleri örtüyordu).
// - "Sonra" ile kapatılabilir; kapatılınca bu oturumda tekrar çıkmaz.
export default function UpdateBanner() {
  const { t } = useT()
  const [available, setAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [unsafe, setUnsafe] = useState(false)

  useEffect(() => {
    onUpdateAvailable(() => setAvailable(true))
  }, [])

  // Görünürken güvenli anı izle (maça girildi mi?). Olay tabanlı sinyal yok -> kısa aralıkla yokla.
  useEffect(() => {
    if (!available || dismissed) return
    const tick = () => setUnsafe(unsafeToPrompt())
    tick()
    const id = window.setInterval(tick, 1000)
    window.addEventListener('popstate', tick)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('popstate', tick)
    }
  }, [available, dismissed])

  if (!available || dismissed || unsafe) return null

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
        gap: 10,
        width: 'max-content',
        maxWidth: 'calc(100vw - 24px)',
        padding: '8px 8px 8px 14px',
        borderRadius: 12,
        background: 'rgba(17,17,20,0.96)',
        color: '#fff',
        boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        font: '500 14px/1.35 system-ui, sans-serif',
      }}
    >
      <Icon name="bell" size={18} />
      <span style={{ flex: 1, minWidth: 0 }}>{t('update.available')}</span>
      <Button type="button" onClick={applyUpdate} className="shrink-0">
        {t('update.action')}
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={t('update.later')}
        title={t('update.later')}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          opacity: 0.75,
          cursor: 'pointer',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name="x" size={18} />
      </button>
    </div>
  )
}
