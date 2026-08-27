import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { myMatches, type MyMatch } from '../api'

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
    <div className="register-overlay modal page">
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
            {rows.map((m, i) => (
              <div key={i} className={`mh-item ${m.won ? 'win' : 'loss'}`}>
                <span className={`mh-badge ${m.won ? 'win' : 'loss'}`}>
                  {m.won ? t('mh.win') : t('mh.loss')}
                </span>
                <div className="mh-main">
                  <div className="mh-line1">
                    <span className="mh-len">
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
                    <span className="mh-vs">{t('mh.vs', { r: m.opponent_rating })}</span>
                    {m.pr != null && (
                      <span className={`mh-pr ${prCls(m.pr)}`}>PR {m.pr.toFixed(1)}</span>
                    )}
                    {m.coins_after != null && (
                      <span className="mh-coins">
                        <Icon name="coin" size={13} /> {m.coins_after}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
