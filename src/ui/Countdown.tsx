import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useT } from '../i18n'

/**
 * Hedef ISO zamana canlı geri sayım (1sn tick). Biçim:
 *   d>0 → "2g 04:12" · h>0 → "4:12:33" · aksi → "12:33". Süre dolunca "Başlıyor…".
 * className ile bağlam-özel stil (turnuva kartı: tcard-cd · ana sayfa: tr-cd).
 */
export function Countdown({
  target,
  onExpire,
  className = 'tcard-cd',
}: {
  target: string
  onExpire?: () => void
  className?: string
}) {
  const { t } = useT()
  const [now, setNow] = useState(() => Date.now())
  const fired = useRef(false)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const ms = new Date(target).getTime() - now
  useEffect(() => {
    if (ms <= 0 && !fired.current) {
      fired.current = true
      onExpire?.()
    }
  }, [ms, onExpire])
  if (ms <= 0) {
    return (
      <span className={`${className} starting`}>
        <Icon name="clock" size={12} /> {t('tourn.starting')}
      </span>
    )
  }
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const p2 = (n: number) => String(n).padStart(2, '0')
  // Gün varsa "4 Gün 13:45:20"; gün 0 ise sadece "13:45:20" (saat:dakika:saniye)
  const hms = `${p2(h)}:${p2(m)}:${p2(sec)}`
  const txt = d > 0 ? `${d} ${t('time.dayUnit')} ${hms}` : hms
  return (
    <span className={className}>
      <Icon name="clock" size={12} /> {txt}
    </span>
  )
}

export default Countdown
