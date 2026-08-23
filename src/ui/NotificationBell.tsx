import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import type { AppNotification } from '../api'

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

function timeAgo(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso).getTime()
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000))
  if (s < 60) return 'şimdi'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}dk`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}sa`
  return `${Math.floor(h / 24)}g`
}

// Ust bardaki bildirim cani + kirmizi rozet + acilir liste
export default function NotificationBell({ items, unread, onOpen }: Props) {
  const { t } = useT()
  const [open, setOpen] = useState(false)
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
    setOpen(next)
    if (next && unread > 0) onOpen() // acinca okundu say
  }

  return (
    <div className="notif" ref={ref}>
      <button
        className="account-btn icon notif-btn"
        onClick={toggle}
        title={t('notif.title')}
        aria-label={t('notif.title')}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">{t('notif.title')}</div>
          {items.length === 0 ? (
            <div className="notif-empty">{t('notif.empty')}</div>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                  <span className="notif-ic">
                    <Icon name={ICONS[n.icon ?? 'bell'] ?? 'bell'} size={16} />
                  </span>
                  <span className="notif-txt">
                    <span className="notif-t">{n.title}</span>
                    {n.body && <span className="notif-b">{n.body}</span>}
                  </span>
                  <span className="notif-time">{timeAgo(n.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
