import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { myMatches, matchLogById, type MyMatch } from '../api'
import MatchReport from './MatchReport'
import type { MoveLogEntry } from '../storage'
import type { Player } from '../engine/types'

// PR bandi (dusuk = iyi). MatchReport ile ayni ruh: kaba renk sinifi.
function prCls(pr: number | null | undefined): string {
  if (pr == null) return ''
  if (pr < 5) return 'good'
  if (pr < 10) return 'ok'
  return 'bad'
}

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MatchAnalytics({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  useEscape(onClose)
  const [rows, setRows] = useState<MyMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [report, setReport] = useState<{ log: MoveLogEntry[]; hc: Player; pr: number | null } | null>(null)
  const [reportBusy, setReportBusy] = useState(false)

  // Bir macin tam analizini (log) cek -> MatchReport ac
  async function openReport(m: MyMatch) {
    setReportBusy(true)
    try {
      const raw = await matchLogById(m.id)
      if (!raw) return
      const parsed = JSON.parse(raw) as { hc?: Player; log?: MoveLogEntry[] }
      setReport({ log: parsed.log ?? [], hc: parsed.hc ?? 'white', pr: m.pr ?? null })
    } catch {
      /* yoksay */
    } finally {
      setReportBusy(false)
    }
  }

  const load = () => {
    setLoading(true)
    setError(false)
    myMatches()
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card mh-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name="analyze" size={20} /> {t('mh.title')}
        </h2>
        <p className="register-sub">{t('mh.sub')}</p>

        {loading ? (
          <div className="admin-empty">{t('admin.loading')}</div>
        ) : error ? (
          <div className="admin-empty">
            {t('common.loadError')}{' '}
            <button className="menu-btn" onClick={load}>
              {t('common.retry')}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="admin-empty">{t('mh.empty')}</div>
        ) : (
          <div className="mh-list">
            {rows.map((m, i) => {
              const open = openIdx === i
              const hasScore = m.score_self != null && m.score_opp != null
              return (
                <div key={i} className={`mh-item ${m.won ? 'win' : 'loss'} ${open ? 'open' : ''}`}>
                  <button className="mh-row" onClick={() => setOpenIdx(open ? null : i)}>
                    <span className={`mh-badge ${m.won ? 'win' : 'loss'}`}>
                      {m.won ? t('mh.win') : t('mh.loss')}
                    </span>
                    <div className="mh-main">
                      <div className="mh-line1">
                        <span className="mh-len">
                          {hasScore && <b>{m.score_self}–{m.score_opp} · </b>}
                          {m.match_length && m.match_length > 0
                            ? t('mh.ptMatch', { n: m.match_length })
                            : t('mh.moneyGame')}
                        </span>
                        <span className="mh-date">{fmtDate(m.created_at)}</span>
                      </div>
                      <div className="mh-line2">
                        <span className="mh-rating">
                          <Icon name="star" size={13} /> {m.rating_before} → {m.rating_after}
                          <b className={m.delta >= 0 ? 'good' : 'bad'}>
                            {' '}
                            {m.delta >= 0 ? '+' : ''}
                            {m.delta}
                          </b>
                        </span>
                        <span className="mh-vs">
                          vs <b>{m.opponent_name || `#${m.opponent_rating}`}</b> ({m.opponent_rating})
                        </span>
                        {m.pr != null && (
                          <span className={`mh-pr ${prCls(m.pr)}`}>
                            PR {m.pr.toFixed(1)}
                            {m.opponent_pr != null && <> / {m.opponent_pr.toFixed(1)}</>}
                          </span>
                        )}
                      </div>
                    </div>
                    <Icon name="chevron" size={16} className={open ? 'chev-open' : ''} />
                  </button>
                  {open && (
                    <div className="mh-detail">
                      <div className="mh-stat">
                        <span className="mh-stat-k">{t('mh.dScore')}</span>
                        <span className="mh-stat-v">{hasScore ? `${m.score_self}–${m.score_opp}` : '—'}</span>
                      </div>
                      <div className="mh-stat">
                        <span className="mh-stat-k">{t('mh.dPr')}</span>
                        <span className={`mh-stat-v ${m.pr != null ? prCls(m.pr) : ''}`}>
                          {m.pr != null ? m.pr.toFixed(1) : '—'}
                        </span>
                      </div>
                      <div className="mh-stat">
                        <span className="mh-stat-k">{t('mh.dLuck')}</span>
                        <span className={`mh-stat-v ${m.luck != null ? (m.luck >= 0 ? 'good' : 'bad') : ''}`}>
                          {m.luck != null ? `${m.luck >= 0 ? '+' : ''}${Math.round(m.luck * 100)}` : '—'}
                        </span>
                      </div>
                      <div className="mh-stat">
                        <span className="mh-stat-k">{t('mh.dRating')}</span>
                        <span className="mh-stat-v">
                          {m.rating_before} → {m.rating_after}{' '}
                          <b className={m.delta >= 0 ? 'good' : 'bad'}>
                            ({m.delta >= 0 ? '+' : ''}{m.delta})
                          </b>
                        </span>
                      </div>
                      <div className="mh-stat">
                        <span className="mh-stat-k">{t('mh.dVs')}</span>
                        <span className="mh-stat-v">
                          {m.opponent_name || '—'}
                          {m.opponent_rating ? <span className="mh-stat-sub"> ({m.opponent_rating})</span> : null}
                        </span>
                      </div>
                      <div className="mh-stat">
                        <span className="mh-stat-k">{t('mh.dOppPr')}</span>
                        <span className={`mh-stat-v ${m.opponent_pr != null ? prCls(m.opponent_pr) : ''}`}>
                          {m.opponent_pr != null ? m.opponent_pr.toFixed(1) : '—'}
                        </span>
                      </div>
                      {m.coins_after != null && (
                        <div className="mh-stat">
                          <span className="mh-stat-k">{t('mr.coins')}</span>
                          <span className="mh-stat-v">{m.coins_after}</span>
                        </div>
                      )}
                      {m.has_log && (
                        <button
                          className="menu-btn mh-analyze"
                          disabled={reportBusy}
                          onClick={() => openReport(m)}
                        >
                          <Icon name="search" size={15} /> {t('mh.analyze')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {report && (
        <MatchReport
          mode="analysis"
          log={report.log}
          pr={report.pr}
          humanColor={report.hc}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  )
}
