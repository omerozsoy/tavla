import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { leaderboard, type LeaderRow } from '../api'

interface Props {
  currentName?: string
  onClose: () => void
}

export default function Leaderboard({ currentName, onClose }: Props) {
  const { t } = useT()
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    leaderboard(100)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '')

  return (
    <div className="register-overlay modal" onClick={onClose}>
      <div className="register-card leaderboard-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>
        <h2>🏆 {t('lb.title')}</h2>

        {error && <div className="lb-empty">{t('lb.error')}</div>}
        {!error && rows === null && <div className="lb-empty">{t('an.loading')}</div>}
        {!error && rows !== null && rows.length === 0 && (
          <div className="lb-empty">{t('lb.empty')}</div>
        )}

        {rows !== null && rows.length > 0 && (
          <div className="lb-table">
            <div className="lb-head">
              <span className="lb-rank">#</span>
              <span className="lb-name">{t('lb.player')}</span>
              <span className="lb-games">{t('lb.games')}</span>
              <span className="lb-wr">{t('lb.winRate')}</span>
              <span className="lb-rating">{t('lb.rating')}</span>
            </div>
            <div className="lb-body">
              {rows.map((r) => {
                const wr = r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0
                const mine = currentName && r.name === currentName
                return (
                  <div key={r.rank} className={`lb-row ${mine ? 'mine' : ''} ${r.rank <= 3 ? 'top' : ''}`}>
                    <span className="lb-rank">{medal(r.rank) || r.rank}</span>
                    <span className="lb-name">
                      {r.avatar ? (
                        <img className="lb-avatar" src={r.avatar} alt="" />
                      ) : (
                        <span className="lb-avatar lb-avatar-ph">{r.name.charAt(0).toUpperCase()}</span>
                      )}
                      {r.name}
                    </span>
                    <span className="lb-games">{r.games}</span>
                    <span className="lb-wr">{r.games > 0 ? `%${wr}` : '–'}</span>
                    <span className="lb-rating">{r.rating}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
