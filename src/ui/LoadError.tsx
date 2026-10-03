import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'

// Veri yuklenemediginde gosterilen ortak durum: mesaj + "Tekrar dene". Bos liste ("… yok")
// ile KARISTIRILMAMALI: ag hatasi bos durum gibi gosterilirse kullanici yanlis bilgilenir
// (orn. cevrimdisiyken "Su an aktif turnuva yok").
export function LoadError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  const { t } = useT()
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  return (
    <div className="load-error" role="alert">
      <Icon name={offline ? 'wifi-off' : 'warning-circle'} size={22} />
      <p>{message ?? t('net.loadError')}</p>
      {offline && <p className="load-error-sub">{t('net.offlineHint')}</p>}
      <Button variant="secondary" onClick={onRetry}>
        <Icon name="refresh" size={16} /> {t('net.retry')}
      </Button>
    </div>
  )
}

// Uygulama geneli cevrimdisi seridi (main.tsx'te kok seviyede). Baglanti kopunca ustte ince bir
// serit; geri gelince kisa sure "Baglanti geri geldi" gosterip kaybolur.
export default function OfflineBanner() {
  const { t } = useT()
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  const [justBack, setJustBack] = useState(false)
  useEffect(() => {
    let tid = 0
    const off = () => {
      window.clearTimeout(tid)
      setJustBack(false)
      setOnline(false)
    }
    const on = () => {
      setOnline(true)
      setJustBack(true)
      tid = window.setTimeout(() => setJustBack(false), 2500)
    }
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => {
      window.clearTimeout(tid)
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
    }
  }, [])
  if (online && !justBack) return null
  return (
    <div className={`offline-banner ${online ? 'back' : ''}`} role="status" aria-live="polite">
      <Icon name={online ? 'wifi' : 'wifi-off'} size={16} />
      <span>{online ? t('net.back') : t('net.offline')}</span>
    </div>
  )
}
