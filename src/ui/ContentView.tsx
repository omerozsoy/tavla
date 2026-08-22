import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import { useEscape } from './useEscape'
import { listContents, type Content, type ContentType } from '../api'

const HEAD: Record<ContentType, { icon: IconName; titleKey: string }> = {
  service: { icon: 'star', titleKey: 'menu.services' },
  blog: { icon: 'book', titleKey: 'menu.blog' },
  news: { icon: 'chat', titleKey: 'menu.news' },
  event: { icon: 'calendar', titleKey: 'menu.calendar' },
  club: { icon: 'pin', titleKey: 'menu.clubs' },
}

const paras = (body?: string | null) =>
  (body ?? '')
    .split(/\n{1,}/)
    .map((s) => s.trim())
    .filter(Boolean)

function fmtDate(s?: string | null, withTime = false): string {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}
const monthKey = (s?: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}

export default function ContentView({ type, onClose }: { type: ContentType; onClose: () => void }) {
  const { t } = useT()
  useEscape(onClose)
  const [items, setItems] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<number | null>(null)

  useEffect(() => {
    listContents(type)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [type])

  const head = HEAD[type]

  // Etkinlik: yaklasan / gecmis ayrimi + aya gore grupla
  const eventGroups = useMemo(() => {
    if (type !== 'event') return null
    const now = Date.now()
    const upcoming = items.filter((i) => new Date(i.event_at ?? 0).getTime() >= now)
    const past = items
      .filter((i) => new Date(i.event_at ?? 0).getTime() < now)
      .sort((a, b) => new Date(b.event_at ?? 0).getTime() - new Date(a.event_at ?? 0).getTime())
    const byMonth: { month: string; list: Content[] }[] = []
    for (const ev of upcoming) {
      const m = monthKey(ev.event_at)
      const g = byMonth.find((x) => x.month === m)
      if (g) g.list.push(ev)
      else byMonth.push({ month: m, list: [ev] })
    }
    return { byMonth, past }
  }, [items, type])

  // Kulup: ile gore grupla
  const clubGroups = useMemo(() => {
    if (type !== 'club') return null
    const map: Record<string, Content[]> = {}
    for (const c of items) {
      const p = (c.province || '—').trim()
      ;(map[p] ||= []).push(c)
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [items, type])

  return (
    <div className="register-overlay modal page" onClick={onClose}>
      <div className="register-card content-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name={head.icon} size={20} /> {t(head.titleKey)}
        </h2>

        {loading ? (
          <div className="admin-empty">{t('admin.loading')}</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">{t('content.empty')}</div>
        ) : type === 'service' ? (
          <div className="content-services">
            {items.map((s) => (
              <section key={s.id} className="content-service">
                <h3>{s.title}</h3>
                {paras(s.body).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </section>
            ))}
          </div>
        ) : type === 'blog' || type === 'news' ? (
          <div className="content-posts">
            {items.map((p) => {
              const open = openId === p.id
              return (
                <article key={p.id} className={`content-post ${open ? 'open' : ''}`}>
                  <button className="content-post-head" onClick={() => setOpenId(open ? null : p.id)}>
                    <span className="cp-title">{p.title}</span>
                    <span className="cp-date">{fmtDate(p.event_at ?? null)}</span>
                  </button>
                  {open && (
                    <div className="content-post-body">
                      {paras(p.body).map((x, i) => (
                        <p key={i}>{x}</p>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : type === 'event' && eventGroups ? (
          <div className="content-events">
            {eventGroups.byMonth.length === 0 && (
              <div className="admin-empty small">{t('content.noUpcoming')}</div>
            )}
            {eventGroups.byMonth.map((g) => (
              <div key={g.month} className="event-month">
                <div className="event-month-title">{g.month}</div>
                {g.list.map((ev) => (
                  <EventRow key={ev.id} ev={ev} upcoming />
                ))}
              </div>
            ))}
            {eventGroups.past.length > 0 && (
              <div className="event-past">
                <div className="event-month-title past">{t('content.past')}</div>
                {eventGroups.past.map((ev) => (
                  <EventRow key={ev.id} ev={ev} upcoming={false} />
                ))}
              </div>
            )}
          </div>
        ) : type === 'club' && clubGroups ? (
          <div className="content-clubs">
            {clubGroups.map(([prov, list]) => (
              <div key={prov} className="club-province">
                <div className="club-province-title">
                  <Icon name="pin" size={14} /> {prov}
                </div>
                {list.map((c) => (
                  <div key={c.id} className="club-row">
                    <span className="club-name">{c.title}</span>
                    {c.place && <span className="club-addr">{c.place}</span>}
                    {c.contact && (
                      <span className="club-contact">
                        <Icon name="phone" size={12} /> {c.contact}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function EventRow({ ev, upcoming }: { ev: Content; upcoming: boolean }) {
  return (
    <div className={`event-row ${upcoming ? '' : 'past'}`}>
      <div className="event-date">
        <Icon name="calendar" size={13} /> {fmtDate(ev.event_at ?? null, true)}
      </div>
      <div className="event-title">{ev.title}</div>
      <div className="event-meta">
        {ev.organizer && (
          <span>
            <Icon name="star" size={12} /> {ev.organizer}
          </span>
        )}
        {ev.place && (
          <span>
            <Icon name="pin" size={12} /> {ev.place}
          </span>
        )}
        {ev.contact && (
          <span>
            <Icon name="phone" size={12} /> {ev.contact}
          </span>
        )}
      </div>
      {ev.body && <p className="event-body">{ev.body}</p>}
    </div>
  )
}
