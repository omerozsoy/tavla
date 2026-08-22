import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { adminListUsers, type AdminUser } from '../api'

interface Props {
  onClose: () => void
  onCreateTournament?: () => void
}

// Yonetim paneli: uye listesi (arama + sayfalama) + turnuva kurma kisayolu.
export default function AdminPanel({ onClose, onCreateTournament }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const tmr = setTimeout(() => {
      adminListUsers(q, page)
        .then((r) => {
          if (cancelled) return
          setUsers(r.users)
          setTotal(r.total)
          setLastPage(r.last_page)
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(tmr)
    }
  }, [q, page])

  const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : '—')

  return (
    <div className="register-overlay modal" onClick={onClose}>
      <div className="register-card admin-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name="users" size={20} /> {t('admin.title')}
        </h2>

        <div className="admin-toolbar">
          <div className="admin-search">
            <Icon name="search" size={16} />
            <input
              value={q}
              onChange={(e) => {
                setPage(1)
                setQ(e.target.value)
              }}
              placeholder={t('admin.search')}
            />
          </div>
          {onCreateTournament && (
            <button className="menu-btn admin-new-tourn" onClick={onCreateTournament}>
              <Icon name="medal" size={16} /> {t('admin.newTournament')}
            </button>
          )}
        </div>

        <div className="admin-count">{t('admin.total', { n: total })}</div>

        {loading ? (
          <div className="admin-empty">{t('admin.loading')}</div>
        ) : users.length === 0 ? (
          <div className="admin-empty">{t('admin.noResults')}</div>
        ) : (
          <div className="admin-list">
            {users.map((u) => (
              <div key={u.id} className="admin-row">
                <div className="admin-row-main">
                  <span className="admin-name">
                    {u.name}
                    {u.is_admin && <span className="admin-badge">admin</span>}
                  </span>
                  <span className="admin-email">{u.email || '—'}</span>
                </div>
                <div className="admin-row-stats">
                  <span title={t('lb.rating')}>
                    <Icon name="star" size={12} /> {u.rating}
                  </span>
                  <span title={t('shop.title')}>
                    <Icon name="coin" size={12} /> {u.coins}
                  </span>
                  <span title="G / M">
                    {u.wins}/{u.losses}
                  </span>
                  <span className="admin-seen">{fmtDate(u.last_seen)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {lastPage > 1 && (
          <div className="admin-pager">
            <button
              className="menu-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Önceki"
            >
              ‹
            </button>
            <span>
              {page} / {lastPage}
            </span>
            <button
              className="menu-btn"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              aria-label="Sonraki"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
