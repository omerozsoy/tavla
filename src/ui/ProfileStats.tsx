import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { myStats, myMatches, type MyStats, type MyMatch } from '../api'
import { frameStyle } from '../cosmetics'
import { DivisionChip, BadgeList } from './Badges'

interface Props {
  avatar?: string
  frame?: string | null
  name: string
  onClose: () => void
}

export default function ProfileStats({ avatar, frame, name, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [data, setData] = useState<MyStats | null>(null)
  const [error, setError] = useState(false)
  const [matches, setMatches] = useState<MyMatch[] | null>(null)

  useEffect(() => {
    let alive = true
    myStats()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true))
    myMatches()
      .then((m) => alive && setMatches(m))
      .catch(() => alive && setMatches([]))
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
    <div className="register-overlay modal page" onClick={onClose}>
      <div className="register-card stats-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <h2><Icon name="chart" size={20} /> {t('stats.title')}</h2>

        {error && <div className="lb-empty">{t('lb.error')}</div>}
        {!error && !data && <div className="lb-empty">{t('an.loading')}</div>}

        {data && (
          <>
            <div className="stats-head">
              <span className="av-frame" style={frameStyle(frame)}>
                {avatar ? (
                  <img className="stats-avatar" src={avatar} alt="" />
                ) : (
                  <span className="stats-avatar lb-avatar-ph">{name.charAt(0).toUpperCase()}</span>
                )}
              </span>
              <div className="stats-id">
                <div className="stats-name">{name}</div>
                <div className="stats-rank">
                  {t('stats.rank', { r: data.rank, n: data.total })}
                </div>
              </div>
              <div className="stats-rating">
                {u?.rating ?? 1500}
                <div className="stats-coins"><Icon name="coin" size={14} /> {u?.coins ?? 0}</div>
              </div>
            </div>

            <DivisionChip rating={u?.rating ?? 1500} />

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

            <BadgeList ids={u?.badges} />

            {/* Rating grafigi (son maclarin rating_after degerleri) */}
            {matches && matches.length >= 2 && <RatingSpark matches={matches} />}

            {/* Son maclar (mac gecmisi) */}
            <div className="mh-head">{t('stats.recent')}</div>
            {matches === null ? (
              <div className="lb-empty small">{t('an.loading')}</div>
            ) : matches.length === 0 ? (
              <div className="lb-empty small">{t('stats.noMatches')}</div>
            ) : (
              <div className="mh-list">
                {matches.map((m, i) => (
                  <div key={i} className="mh-row">
                    <span className={`mh-res ${m.won ? 'win' : 'loss'}`}>
                      {m.won ? t('stats.win') : t('stats.loss')}
                    </span>
                    <span className="mh-opp">vs {m.opponent_rating}</span>
                    <span className={`mh-delta ${m.delta >= 0 ? 'up' : 'down'}`}>
                      {m.delta >= 0 ? '+' : ''}
                      {m.delta}
                    </span>
                    <span className="mh-date">{fmtDate(m.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
}

// Basit rating grafigi (SVG polyline). matches en yeni once -> ters cevir.
function RatingSpark({ matches }: { matches: MyMatch[] }) {
  const pts = matches
    .slice()
    .reverse()
    .map((m) => m.rating_after)
  const w = 260
  const h = 54
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = Math.max(1, max - min)
  const step = pts.length > 1 ? w / (pts.length - 1) : w
  const coords = pts.map((v, i) => {
    const x = i * step
    const y = h - 4 - ((v - min) / span) * (h - 8)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <div className="mh-spark">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h}>
        <polyline
          points={coords.join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
