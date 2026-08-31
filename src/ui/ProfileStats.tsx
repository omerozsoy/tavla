import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import {
  myStats, myMatches, myAnalytics, performanceStats, diceStats,
  type MyStats, type MyMatch, type Analytics, type PerformanceStats, type MedianFilter,
  type DiceStats, type DicePhase,
} from '../api'
import PlayerIdentity from './PlayerIdentity'
import { BadgeList } from './Badges'
import { LineChart, BarChart } from './Charts'
import { Skeleton } from './Skeleton'
import { Button } from '@/components/ui/button'

interface Props {
  avatar?: string
  frame?: string | null
  name: string
  onClose: () => void
  embed?: boolean // Profilim sekmesine gomulu render (overlay/kapat/baslik yok)
}

// Medyan kartinin kategori sirasi (backend ile ayni): Jeton, 1S, 3S, 5S, 7S
const MED_ORDER = ['coin', '1', '3', '5', '7'] as const
const MED_FILTERS: MedianFilter[] = ['all', '7d', '30d', '90d', '1y']
// Zar Ortalamalari faz sekmeleri: Tumu / Acilis / Temas / Temas Yok
const DICE_PHASES: DicePhase[] = ['all', 'opening', 'contact', 'race']

export default function ProfileStats({ avatar, frame, name, onClose, embed }: Props) {
  const { t, lang } = useT()
  useEscape(embed ? () => {} : onClose)
  const [data, setData] = useState<MyStats | null>(null)
  const [error, setError] = useState(false)
  const [matches, setMatches] = useState<MyMatch[] | null>(null)
  const [an, setAn] = useState<Analytics | null>(null)
  // Performans istatistikleri (Medyan Hata Orani + WXP). Filtre degisince median yeniden ceker.
  const [perf, setPerf] = useState<PerformanceStats | null>(null)
  const [perfErr, setPerfErr] = useState(false)
  const [medFilter, setMedFilter] = useState<MedianFilter>('all')
  // Zar Ortalamalari: faz (Tumu/Acilis/Temas/Temas Yok) + taraf (Sen/Rakip)
  const [dice, setDice] = useState<DiceStats | null>(null)
  const [diceErr, setDiceErr] = useState(false)
  const [dicePhase, setDicePhase] = useState<DicePhase>('all')
  const [diceSide, setDiceSide] = useState<'self' | 'opponent'>('self')

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

  // Medyan Hata Orani + WXP: filtre degistikce median yeniden hesaplanir (cache'li endpoint).
  useEffect(() => {
    let alive = true
    performanceStats(medFilter)
      .then((p) => {
        if (alive) {
          setPerf(p)
          setPerfErr(false)
        }
      })
      .catch(() => alive && setPerfErr(true))
    return () => {
      alive = false
    }
  }, [medFilter])

  // Zar Ortalamalari: faz degisince yeniden ceker (cache'li endpoint).
  useEffect(() => {
    let alive = true
    diceStats(dicePhase)
      .then((d) => {
        if (alive) {
          setDice(d)
          setDiceErr(false)
        }
      })
      .catch(() => alive && setDiceErr(true))
    return () => {
      alive = false
    }
  }, [dicePhase])

  // Maç uzunlugu etiketi: 1 -> "Jeton", digerleri -> "NS"
  const lenLabel = (n: number) => (n === 1 ? t('an.jeton') : `${n}S`)
  // Kategori etiketi (i18n): coin -> "Jeton", digerleri -> "NS"
  const catLabel = (k: string) => (k === 'coin' ? t('an.jeton') : `${k}S`)
  const fmtNum = (n: number) => n.toLocaleString(lang)

  const u = data?.user
  const games = u?.games_played ?? 0
  const wins = u?.wins ?? 0
  const losses = u?.losses ?? 0
  const wr = games > 0 ? Math.round((wins / games) * 100) : 0
  // Zar panelinde secili taraf (Sen/Rakip)
  const dSide = dice ? (diceSide === 'self' ? dice.self : dice.opponent) : null

  return (
    <div
      className={embed ? 'stats-embed' : 'register-overlay modal page'}
      role={embed ? undefined : 'dialog'}
      aria-modal={embed ? undefined : true}
    >
      <div
        className={`register-card stats-card ${embed ? 'is-embed' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {!embed && (
          <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </Button>
        )}
        {!embed && <h2><Icon name="chart" size={20} /> {t('stats.title')}</h2>}

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
            {/* Embed'de (Profilim sekmesi) üst kimlik başlığı GİZLİ — profil zaten gösteriyor */}
            {!embed && (
              <>
                <div className="stats-head">
                  <PlayerIdentity lg name={name} rating={u?.rating ?? 1500} avatar={avatar} frame={frame} size={60} />
                  <div className="stats-rating">
                    {u?.rating ?? 1500}
                    <div className="stats-coins"><Icon name="coin" size={14} /> {u?.coins ?? 0}</div>
                  </div>
                </div>
                <div className="stats-rank">{t('stats.rank', { r: data.rank, n: data.total })}</div>
              </>
            )}

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

            {/* ===== Üst satır: 3 grafik (Bakiye · Puan · Medyan) ===== */}
            <div className="stats-dash stats-dash-3">
              {/* Bakiye — coin geçmişi */}
              <div className="sd-card">
                <div className="sd-head">
                  <span className="sd-ic gold"><Icon name="coin" size={18} /></span>
                  <div className="sd-head-txt">
                    <div className="sd-title">{t('an.balanceGraph')}</div>
                    <div className="sd-val gold">{fmtNum(u?.coins ?? 0)} GC</div>
                  </div>
                </div>
                {an && an.coins_history.length >= 2 ? (
                  <LineChart data={an.coins_history} color="#e6b422" />
                ) : !an ? (
                  <Skeleton w="100%" h={80} r={8} />
                ) : (
                  <div className="sd-empty">–</div>
                )}
              </div>

              {/* Puan — rating geçmişi */}
              <div className="sd-card">
                <div className="sd-head">
                  <span className="sd-ic"><Icon name="chart" size={18} /></span>
                  <div className="sd-head-txt">
                    <div className="sd-title">{t('lb.rating')}</div>
                    <div className="sd-val">{u?.rating ?? 1500} GR</div>
                  </div>
                </div>
                {an && an.rating_history.length >= 2 ? (
                  <LineChart data={an.rating_history} />
                ) : !an ? (
                  <Skeleton w="100%" h={80} r={8} />
                ) : (
                  <div className="sd-empty">–</div>
                )}
              </div>

              {/* Medyan Hata Oranı — bar chart */}
              <div className="sd-card">
                <div className="sd-head">
                  <span className="sd-ic"><Icon name="alert" size={18} /></span>
                  <div className="sd-head-txt">
                    <div className="sd-title">{t('med.title')}</div>
                    <div className="sd-sub">{t('med.lowGood')}</div>
                  </div>
                </div>
                <div className="perf-filters" role="tablist" aria-label={t('med.title')}>
                  {MED_FILTERS.map((f) => (
                    <Button
                      key={f}
                      variant={medFilter === f ? 'secondary' : 'ghost'}
                      type="button"
                      role="tab"
                      aria-selected={medFilter === f}
                      onClick={() => setMedFilter(f)}
                    >
                      {t(`med.filter.${f}`)}
                    </Button>
                  ))}
                </div>
                {perfErr ? (
                  <div className="lb-empty small">{t('lb.error')}</div>
                ) : !perf ? (
                  <div aria-busy="true">
                    <Skeleton w="100%" h={90} r={8} />
                  </div>
                ) : (
                  <BarChart
                    invert
                    threshold={8}
                    items={MED_ORDER.map((k) => {
                      const c = perf.median_error_rate.categories[k]
                      const n = c?.sample_count ?? 0
                      return {
                        label: catLabel(k),
                        value: c?.median_pr ?? null,
                        sub: n > 0 ? t('med.decisions', { n }) : undefined,
                      }
                    })}
                  />
                )}
              </div>
            </div>

            {/* ===== Alt satır: WXP + Toplam Kaz.% + Zar Ortalamaları ===== */}
            <div className="stats-dash">

              {/* WXP — Kazanma Deneyim Puanlari */}
              <div className="sd-card wxp-card">
                <div className="sd-head">
                  <span className="sd-ic"><Icon name="star" size={18} /></span>
                  <div className="sd-head-txt">
                    <div className="sd-title">{t('wxp.title')}</div>
                  </div>
                </div>
                {perfErr ? (
                  <div className="lb-empty small">{t('lb.error')}</div>
                ) : !perf ? (
                  <div aria-busy="true">
                    <Skeleton w={120} h={40} r={8} style={{ display: 'block', margin: '4px auto' }} />
                    <Skeleton w="100%" h={54} r={8} style={{ display: 'block', marginTop: 12 }} />
                  </div>
                ) : (
                  <>
                    <div className="wxp-total">{fmtNum(perf.wxp.total)}</div>
                    <div className="wxp-boxes">
                      <div className="wxp-box">
                        <strong className="good">{fmtNum(perf.wxp.wins)}</strong>
                        <span>{t('wxp.g')}</span>
                      </div>
                      <div className="wxp-box">
                        <strong className="bad">{fmtNum(perf.wxp.losses)}</strong>
                        <span>{t('wxp.m')}</span>
                      </div>
                      <div className="wxp-box">
                        <strong>{perf.wxp.total_matches > 0 ? `%${Math.round(perf.wxp.win_rate)}` : '–'}</strong>
                        <span>{t('wxp.winRate')}</span>
                      </div>
                    </div>
                    <div className="wxp-legend">{t('wxp.legend')}</div>
                  </>
                )}
              </div>

              {/* Toplam Kazanma % — maç uzunluğuna göre */}
              {an && an.by_length.length > 0 && (
                <div className="sd-card">
                  <div className="sd-head">
                    <span className="sd-ic"><Icon name="trophy" size={18} /></span>
                    <div className="sd-head-txt">
                      <div className="sd-title">{t('an.winByLen')}</div>
                    </div>
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

              {/* Zar Ortalamaları — zar-başına Sen/Rakip kırılımı */}
              <div className="sd-card sd-card-wide dice-card">
                <div className="sd-head">
                  <span className="sd-ic"><Icon name="dice" size={18} /></span>
                  <div className="sd-head-txt">
                    <div className="sd-title">{t('dice.title')}</div>
                    <div className="sd-sub">{t('dice.sub')}</div>
                  </div>
                  {dSide?.openingWinRate != null && (
                    <span className="dice-opening">
                      {t('dice.openingWin')} <strong>%{dSide.openingWinRate}</strong>
                    </span>
                  )}
                </div>

                <div className="dice-controls">
                  <div className="perf-filters" role="tablist" aria-label={t('dice.title')}>
                    {DICE_PHASES.map((p) => (
                      <Button
                        key={p}
                        variant={dicePhase === p ? 'secondary' : 'ghost'}
                        type="button"
                        role="tab"
                        aria-selected={dicePhase === p}
                        onClick={() => setDicePhase(p)}
                      >
                        {t(`dice.phase.${p}`)}
                      </Button>
                    ))}
                  </div>
                  <div className="dice-side" role="tablist" aria-label={t('dice.side')}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={diceSide === 'self'}
                      className={diceSide === 'self' ? 'active' : ''}
                      onClick={() => setDiceSide('self')}
                    >
                      {t('dice.self')}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={diceSide === 'opponent'}
                      className={diceSide === 'opponent' ? 'active' : ''}
                      onClick={() => setDiceSide('opponent')}
                    >
                      {t('dice.opponent')}
                    </button>
                  </div>
                </div>

                {diceErr ? (
                  <div className="lb-empty small">{t('lb.error')}</div>
                ) : !dice || !dSide ? (
                  <Skeleton w="100%" h={110} r={8} />
                ) : dSide.rolls.length === 0 ? (
                  <div className="lb-empty small">{t('dice.empty')}</div>
                ) : (
                  <div className="dice-grid">
                    {dSide.rolls.map((r) => (
                      <div key={r.dice} className="dice-roll">
                        <span className="dice-roll-face">{r.dice.replace('-', ' · ')}</span>
                        <span className="dice-roll-win">%{r.winRate}</span>
                        <span className="dice-roll-meta">
                          {t('dice.plays', { n: r.n })}
                          {r.avgError > 0 ? ` · ${t('dice.err')} ${r.avgError.toFixed(3)}` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
