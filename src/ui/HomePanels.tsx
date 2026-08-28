import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
import { liveMatches, leaderboard, type LiveMatch, type LeaderRow } from '../api'
import AvatarFrame from './AvatarFrame'

// ---- Ozellik vitrini (yalniz misafirlere): urunun ne sundugunu tanitir ----
const FEATURES: { icon: IconName; key: string }[] = [
  { icon: 'robot', key: 'ai' },
  { icon: 'users', key: 'online' },
  { icon: 'medal', key: 'tourn' },
  { icon: 'chart', key: 'rating' },
  { icon: 'star', key: 'themes' },
  { icon: 'graduation', key: 'learn' },
]

// ---- Uye panosu (giris yapmis kullaniciya): tek bakista durum + hizli erisim ----
export function HomeDashboard(p: {
  rating: number
  coins: number
  wins: number
  games: number
  onStats?: () => void
  onHistory?: () => void
  onBlunders?: () => void
  onShop?: () => void
}) {
  const { t } = useT()
  const winRate = p.games > 0 ? Math.round((p.wins / p.games) * 100) : null
  const stats: { icon: IconName; val: number; label: string; sub?: string }[] = [
    { icon: 'chart', val: p.rating, label: t('lb.rating') },
    { icon: 'coin', val: p.coins, label: t('home.dash.coins') },
    {
      icon: 'trophy',
      val: p.wins,
      label: t('home.dash.wins'),
      sub: winRate === null ? undefined : `%${winRate}`,
    },
    { icon: 'dice', val: p.games, label: t('home.dash.games') },
  ]
  const allActions: { icon: IconName; label: string; on?: () => void }[] = [
    { icon: 'chart', label: t('menu.myStats'), on: p.onStats },
    { icon: 'analyze', label: t('menu.matchHistory'), on: p.onHistory },
    { icon: 'alert', label: t('menu.blunders'), on: p.onBlunders },
    { icon: 'shop', label: t('shop.title'), on: p.onShop },
  ]
  const actions = allActions.filter((a) => a.on)

  return (
    <section className="home-dash" aria-label={t('menu.myStats')}>
      <div className="dash-stats">
        {stats.map((s) => (
          <div className="dstat" key={s.label}>
            <span className="dstat-icon" aria-hidden="true">
              <Icon name={s.icon} size={18} />
            </span>
            <span className="dstat-val">
              {s.val.toLocaleString()}
              {s.sub && <span className="dstat-sub">{s.sub}</span>}
            </span>
            <span className="dstat-label">{s.label}</span>
          </div>
        ))}
      </div>
      {actions.length > 0 && (
        <div className="dash-actions">
          <span className="dash-actions-label">{t('home.dash.quick')}</span>
          <div className="dash-actions-row">
            {actions.map((a) => (
              <button className="dash-action" key={a.label} onClick={a.on}>
                <Icon name={a.icon} size={16} /> {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function HomeFeatures({ onPlay }: { onPlay: () => void }) {
  const { t } = useT()
  return (
    <section className="home-features" aria-labelledby="home-features-title">
      <header className="home-features-head">
        <span className="hf-kicker">{t('home.feat.kicker')}</span>
        <h2 id="home-features-title" className="hf-title">
          {t('home.feat.title')}
        </h2>
      </header>
      <div className="hf-grid">
        {FEATURES.map((f) => (
          <div className="hf-card" key={f.key}>
            <span className="hf-icon" aria-hidden="true">
              <Icon name={f.icon} size={22} />
            </span>
            <h3 className="hf-card-title">{t(`home.feat.${f.key}.t`)}</h3>
            <p className="hf-card-desc">{t(`home.feat.${f.key}.d`)}</p>
          </div>
        ))}
      </div>
      <div className="home-finalcta">
        <h2 className="hfc-title">{t('home.finalCta.title')}</h2>
        <p className="hfc-sub">{t('home.finalCta.sub')}</p>
        <button className="galaxy-btn hfc-btn" onClick={onPlay}>
          <Icon name="dice" size={18} /> {t('home.finalCta.button')}
        </button>
      </div>
    </section>
  )
}

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
                <AvatarFrame src={r.avatar} frame={r.frame} size={30} name={r.name} animated={false} />
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
