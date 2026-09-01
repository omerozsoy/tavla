import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import type { AppNotification } from '../api'
import { Button } from '@/components/ui/button'

interface Props {
  items: AppNotification[]
  unread: number
  onOpen: () => void // panel acilinca hepsini okundu isaretle
}

const ICONS: Record<string, IconName> = {
  bell: 'bell',
  crown: 'crown',
  medal: 'medal',
  star: 'star',
  trophy: 'trophy',
  coin: 'coin',
}

function timeAgo(iso: string | null | undefined, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000))
  if (s < 60) return t('notif.now')
  const m = Math.floor(s / 60)
  if (m < 60) return t('notif.minAgo', { m })
  const h = Math.floor(m / 60)
  if (h < 24) return t('notif.hourAgo', { h })
  return t('notif.dayAgo', { d: Math.floor(h / 24) })
}

// Ust bardaki bildirim cani + kirmizi rozet + acilir liste
export default function NotificationBell({ items, unread, onOpen }: Props) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
  // Acilinca listenin anlik goruntusu: okununca (App listeyi bosaltir) panel yine
  // bu oturumda gorunur; kapatip acinca yeni (bos) liste gelir -> "okununca gider".
  const [shown, setShown] = useState<AppNotification[]>([])
  // Panel position:fixed -> ust bar overflow (nowrap/scroll) paneli KIRPMAZ; sayfanin
  // altinda kalmaz. Konum, can butonunun ekran koordinatindan hesaplanir.
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const ref = useRef<HTMLDivElement>(null)

  // Disari tiklayinca kapat
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open])

  function toggle() {
    const next = !open
    if (next) {
      setShown(items) // acilis aninda mevcut listeyi dondur
      if (ref.current) {
        const r = ref.current.getBoundingClientRect()
        setPos({ top: Math.round(r.bottom + 8), right: Math.round(Math.max(8, window.innerWidth - r.right)) })
      }
      if (unread > 0) onOpen() // acinca okundu say (App: rozet 0 + listeyi bosalt + sunucuda sil)
    }
    setOpen(next)
  }

  return (
    <div className="notif" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative [&_svg]:size-[24px]!"
        onClick={toggle}
        title={t('notif.title')}
        aria-label={t('notif.title')}
      >
        <Icon name="bell" size={24} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </Button>
      {open && (
        <div className="notif-panel" style={{ position: 'fixed', top: pos.top, right: pos.right }}>
          <div className="notif-head">{t('notif.title')}</div>
          {shown.length === 0 ? (
            <div className="notif-empty">{t('notif.empty')}</div>
          ) : (
            <ul className="notif-list">
              {shown.map((n) => (
                <li key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                  <span className="notif-ic">
                    <Icon name={ICONS[n.icon ?? 'bell'] ?? 'bell'} size={16} />
                  </span>
                  <span className="notif-txt">
                    <span className="notif-t">{n.title}</span>
                    {n.body && <span className="notif-b">{n.body}</span>}
                  </span>
                  <span className="notif-time">{timeAgo(n.created_at, t)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
