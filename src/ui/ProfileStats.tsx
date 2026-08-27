import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { myStats, myMatches, myAnalytics, type MyStats, type MyMatch, type Analytics } from '../api'
import AvatarFrame from './AvatarFrame'
import { DivisionChip, BadgeList } from './Badges'
import { LineChart, BarChart } from './Charts'
import { Skeleton } from './Skeleton'

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
  const [an, setAn] = useState<Analytics | null>(null)

  useEffect(() => {
    let alive = true
    myStats()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true))
    myMatches()
      .then((m) => alive && setMatches(m))
      .catch(() => alive && setMatches([]))
    myAnalytics()
      .then((a) => alive && setAn(a))
      .catch(() => alive && setAn(null))
    return () => {
      alive = false
    }
  }, [])
  // Maç uzunlugu etiketi: 1 -> "Jeton", digerleri -> "NS"
  const lenLabel = (n: number) => (n === 1 ? t('an.jeton') : `${n}S`)

  const u = data?.user
  const games = u?.games_played ?? 0
  const wins = u?.wins ?? 0
  const losses = u?.losses ?? 0
  const wr = games > 0 ? Math.round((wins / games) * 100) : 0

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card stats-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2><Icon name="chart" size={20} /> {t('stats.title')}</h2>

        {error && <div className="lb-empty">{t('lb.error')}</div>}
        {!error && !data && (
          <div aria-busy="true" aria-live="polite">
            <div className="stats-head">
              <Skeleton w={54} h={54} r="50%" />
              <div className="stats-id">
                <Skeleton w={130} h={16} style={{ display: 'block' }} />
                <Skeleton w={90} h={12} style={{ display: 'block', marginTop: 6 }} />
              </div>
              <Skeleton w={56} h={30} r={8} />
            </div>
            <div className="stats-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="stats-box">
                  <Skeleton w={40} h={22} style={{ display: 'block', margin: '0 auto' }} />
                  <Skeleton w={54} h={11} style={{ display: 'block', margin: '8px auto 0' }} />
                </div>
              ))}
            </div>
            <div className="mh-head"><Skeleton w={120} h={13} /></div>
            <div className="mh-list">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="mh-row"><Skeleton w="100%" h={14} /></div>
              ))}
            </div>
          </div>
        )}

        {data && (
          <>
            <div className="stats-head">
              <AvatarFrame src={avatar} frame={frame} size={60} name={name} />
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

            {games === 0 && (
              <div className="empty-state sm stats-firstgame">
                <Icon name="dice" size={22} />
                <span>{t('stats.firstGame')}</span>
              </div>
            )}

            <BadgeList ids={u?.badges} />

            {/* Analiz grafikleri */}
            {an && (
              <div className="an-charts">
                {an.rating_history.length >= 2 && (
                  <div className="an-chart">
                    <div className="an-chart-head">
                      <Icon name="chart" size={14} /> {t('an.ratingGraph')}
                    </div>
                    <LineChart data={an.rating_history} />
                  </div>
                )}
                {an.coins_history.length >= 2 && (
                  <div className="an-chart">
                    <div className="an-chart-head">
                      <Icon name="coin" size={14} /> {t('an.balanceGraph')}
                    </div>
                    <LineChart data={an.coins_history} color="#e6b422" />
                  </div>
                )}
                <div className="an-wxp">
                  <span className="an-wxp-lbl">{t('an.wxp')}</span>
                  <span className="an-wxp-val">{an.wxp}</span>
                </div>
                {an.by_length.length > 0 && (
                  <div className="an-chart">
                    <div className="an-chart-head">
                      <Icon name="chart" size={14} /> {t('an.winByLen')}
                    </div>
                    <BarChart
                      items={an.by_length.map((b) => ({
                        label: lenLabel(b.length),
                        value: b.win_pct,
                        sub: `${b.wins}/${b.games}`,
                      }))}
                      suffix="%"
                      threshold={50}
                    />
                  </div>
                )}
                {an.by_length.some((b) => b.avg_pr != null) && (
                  <div className="an-chart">
                    <div className="an-chart-head">
                      <Icon name="alert" size={14} /> {t('an.prByLen')}
                    </div>
                    <BarChart
                      items={an.by_length.map((b) => ({
                        label: lenLabel(b.length),
                        value: b.avg_pr,
                      }))}
                      threshold={8}
                      invert
                    />
                  </div>
                )}
              </div>
            )}

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
