import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { liveMatches, leaderboard, type LiveMatch, type LeaderRow } from '../api'
import { frameStyle } from '../cosmetics'

function Avatar({ url, name }: { url?: string | null; name: string }) {
  return url ? (
    <img className="lm-avatar" src={url} alt="" />
  ) : (
    <span className="lm-avatar lm-avatar-ph">{name.charAt(0).toUpperCase()}</span>
  )
}

// ---- Canli maclar (izlenebilir) ----
export function LiveMatchesPanel({
  onSpectate,
}: {
  onSpectate: (code: string, p1: string, p2: string) => void
}) {
  const { t } = useT()
  const [matches, setMatches] = useState<LiveMatch[] | null>(null)

  useEffect(() => {
    let alive = true
    const load = () =>
      liveMatches()
        .then((m) => alive && setMatches(m))
        .catch(() => alive && setMatches([]))
    load()
    const id = window.setInterval(load, 10000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  return (
    <div className="home-panel live-panel">
      <div className="home-panel-head">
        <span className="live-dot" />
        <Icon name="live" size={17} /> {t('live.title')}
      </div>
      {matches === null ? (
        <div className="home-panel-empty">{t('common.loading')}</div>
      ) : matches.length === 0 ? (
        <div className="home-panel-empty">{t('live.empty')}</div>
      ) : (
        <div className="live-list">
          {matches.map((m) => (
            <button
              key={m.code}
              className="live-row"
              onClick={() => onSpectate(m.code, m.p1_name, m.p2_name)}
            >
              <span className="lm-side lm-p1">
                <Avatar url={m.p1_avatar} name={m.p1_name} />
                <span className="lm-name">{m.p1_name}</span>
              </span>
              <span className="lm-vs">vs</span>
              <span className="lm-side lm-p2">
                <span className="lm-name">{m.p2_name}</span>
                <Avatar url={m.p2_avatar} name={m.p2_name} />
              </span>
              <Icon name="eye" size={14} className="lm-watch" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- Siralama (rating / coin) ----
export function RankingPanel({
  currentName,
  onProfile,
}: {
  currentName?: string
  onProfile: (id: number) => void
}) {
  const { t } = useT()
  const [by, setBy] = useState<'rating' | 'coins'>('rating')
  const [rows, setRows] = useState<LeaderRow[] | null>(null)

  useEffect(() => {
    let alive = true
    setRows(null)
    leaderboard(15, by)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [by])

  return (
    <div className="home-panel rank-panel">
      <div className="home-panel-head">
        <Icon name="trophy" size={17} /> {t('lb.title')}
      </div>
      <div className="rank-tabs">
        <button className={by === 'rating' ? 'active' : ''} onClick={() => setBy('rating')}>
          {t('lb.rating')}
        </button>
        <button className={by === 'coins' ? 'active' : ''} onClick={() => setBy('coins')}>
          {t('lb.byCoins')}
        </button>
      </div>
      {rows === null ? (
        <div className="home-panel-empty">{t('common.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="home-panel-empty">{t('lb.empty')}</div>
      ) : (
        <div className="rank-list">
          {rows.map((r) => (
            <button
              key={r.rank}
              className={`rank-row ${currentName && r.name === currentName ? 'mine' : ''}`}
              onClick={() => r.id && onProfile(r.id)}
            >
              <span className={`rank-no${r.rank <= 3 ? ' rank-medal rank-medal-' + r.rank : ''}`}>
                {r.rank}
              </span>
              <span className="rank-name">
                <span className="av-frame" style={frameStyle(r.frame)}>
                  <Avatar url={r.avatar} name={r.name} />
                </span>
                {r.name}
              </span>
              <span className="rank-val">
                {by === 'coins' ? (
                  <>
                    <Icon name="coin" size={12} /> {r.coins ?? 0}
                  </>
                ) : (
                  r.rating
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
