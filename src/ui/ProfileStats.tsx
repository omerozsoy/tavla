import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { myStats, type MyStats } from '../api'

interface Props {
  avatar?: string
  name: string
  onClose: () => void
}

export default function ProfileStats({ avatar, name, onClose }: Props) {
  const { t } = useT()
  const [data, setData] = useState<MyStats | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let alive = true
    myStats()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [])

  const u = data?.user
  const games = u?.games_played ?? 0
  const wins = u?.wins ?? 0
  const losses = u?.losses ?? 0
  const wr = games > 0 ? Math.round((wins / games) * 100) : 0

  return (
    <div className="register-overlay modal" onClick={onClose}>
      <div className="register-card stats-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>
        <h2>📊 {t('stats.title')}</h2>

        {error && <div className="lb-empty">{t('lb.error')}</div>}
        {!error && !data && <div className="lb-empty">{t('an.loading')}</div>}

        {data && (
          <>
            <div className="stats-head">
              {avatar ? (
                <img className="stats-avatar" src={avatar} alt="" />
              ) : (
                <span className="stats-avatar lb-avatar-ph">{name.charAt(0).toUpperCase()}</span>
              )}
              <div className="stats-id">
                <div className="stats-name">{name}</div>
                <div className="stats-rank">
                  {t('stats.rank', { r: data.rank, n: data.total })}
                </div>
              </div>
              <div className="stats-rating">{u?.rating ?? 1500}</div>
            </div>

            <div className="stats-grid">
              <div className="stats-box">
                <div className="stats-val">{games}</div>
                <div className="stats-lbl">{t('stats.games')}</div>
              </div>
              <div className="stats-box">
                <div className="stats-val good">{wins}</div>
                <div className="stats-lbl">{t('stats.wins')}</div>
              </div>
              <div className="stats-box">
                <div className="stats-val bad">{losses}</div>
                <div className="stats-lbl">{t('stats.losses')}</div>
              </div>
              <div className="stats-box">
                <div className="stats-val">{games > 0 ? `%${wr}` : '–'}</div>
                <div className="stats-lbl">{t('stats.winRate')}</div>
              </div>
            </div>

            {games > 0 && (
              <div className="stats-bar">
                <div className="stats-bar-win" style={{ width: `${wr}%` }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
