import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import {
  adminListUsers,
  adminUpdateUser,
  adminUserMatches,
  type AdminUser,
  type AdminMatch,
} from '../api'

interface Props {
  onClose: () => void
  onCreateTournament?: () => void
}

// Yonetim paneli: uye listesi (arama+sayfalama) + coin/yasak/yonetici duzenleme + turnuva kurma.
export default function AdminPanel({ onClose, onCreateTournament }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<number | null>(null)
  const [coinDraft, setCoinDraft] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [matches, setMatches] = useState<AdminMatch[]>([])
  const [matchesLoading, setMatchesLoading] = useState(false)

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

  async function patch(id: number, body: { coins?: number; is_admin?: boolean; banned?: boolean }) {
    setBusyId(id)
    try {
      const updated = await adminUpdateUser(id, body)
      setUsers((list) => list.map((x) => (x.id === id ? updated : x)))
    } catch {
      /* yoksay */
    } finally {
      setBusyId(null)
    }
  }

  function openEdit(u: AdminUser) {
    if (editId === u.id) {
      setEditId(null)
      return
    }
    setEditId(u.id)
    setCoinDraft(String(u.coins))
    setMatches([])
    setMatchesLoading(true)
    adminUserMatches(u.id)
      .then(setMatches)
      .catch(() => {})
      .finally(() => setMatchesLoading(false))
  }

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
              <div key={u.id} className={`admin-row ${u.banned ? 'banned' : ''}`}>
                <div className="admin-row-top">
                  <div className="admin-row-main">
                    <span className="admin-name">
                      {u.name}
                      {u.is_admin && <span className="admin-badge">admin</span>}
                      {u.banned && <span className="admin-badge ban">{t('admin.banned')}</span>}
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
                    <button
                      className="admin-edit-btn"
                      onClick={() => openEdit(u)}
                      aria-label={t('admin.edit')}
                      title={t('admin.edit')}
                    >
                      <Icon name="pencil" size={15} />
                    </button>
                  </div>
                </div>

                {editId === u.id && (
                  <div className="admin-edit">
                    <label className="admin-edit-coins">
                      <Icon name="coin" size={14} />
                      <input
                        type="number"
                        min={0}
                        value={coinDraft}
                        onChange={(e) => setCoinDraft(e.target.value)}
                      />
                      <button
                        className="menu-btn"
                        disabled={busyId === u.id}
                        onClick={() => patch(u.id, { coins: Math.max(0, Number(coinDraft) || 0) })}
                      >
                        {t('admin.save')}
                      </button>
                    </label>
                    <div className="admin-coin-quick">
                      {[100, 1000, -100, -1000].map((d) => (
                        <button
                          key={d}
                          type="button"
                          className="coin-chip"
                          onClick={() =>
                            setCoinDraft((c) => String(Math.max(0, (Number(c) || 0) + d)))
                          }
                        >
                          {d > 0 ? `+${d}` : d}
                        </button>
                      ))}
                    </div>
                    <div className="admin-edit-actions">
                      <button
                        className={`menu-btn ${u.banned ? '' : 'admin-danger'}`}
                        disabled={busyId === u.id}
                        onClick={() => patch(u.id, { banned: !u.banned })}
                      >
                        <Icon name={u.banned ? 'check' : 'x'} size={14} />{' '}
                        {u.banned ? t('admin.unban') : t('admin.ban')}
                      </button>
                      <button
                        className="menu-btn"
                        disabled={busyId === u.id}
                        onClick={() => patch(u.id, { is_admin: !u.is_admin })}
                      >
                        <Icon name="crown" size={14} />{' '}
                        {u.is_admin ? t('admin.revokeAdmin') : t('admin.makeAdmin')}
                      </button>
                    </div>
                    <div className="admin-matches">
                      <div className="admin-matches-head">{t('admin.matchHistory')}</div>
                      {matchesLoading ? (
                        <div className="admin-empty small">{t('admin.loading')}</div>
                      ) : matches.length === 0 ? (
                        <div className="admin-empty small">{t('admin.noMatches')}</div>
                      ) : (
                        matches.map((m, i) => (
                          <div key={i} className={`admin-match ${m.won ? 'win' : 'loss'}`}>
                            <span className="am-res">{m.won ? t('admin.won') : t('admin.lost')}</span>
                            <span className="am-opp">vs {m.opponent_rating}</span>
                            <span className="am-delta">
                              {m.delta >= 0 ? `+${m.delta}` : m.delta}
                            </span>
                            <span className="am-date">
                              {new Date(m.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
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
