import { useT } from '../i18n'

export interface LogEntry {
  notation: string
  best: string
  loss: number
}

interface Props {
  mode: 'stats' | 'analysis'
  log: LogEntry[]
  pr: number | null
  onClose: () => void
}

// Equity kaybina gore sinif (renk + etiket anahtari)
function band(loss: number): { cls: string; key: string } {
  if (loss < 0.02) return { cls: 'good', key: 'rep.perfect' }
  if (loss < 0.04) return { cls: 'ok', key: 'rep.minor' }
  if (loss < 0.08) return { cls: 'bad', key: 'rep.error' }
  return { cls: 'blunder', key: 'rep.blunder' }
}

export default function MatchReport({ mode, log, pr, onClose }: Props) {
  const { t } = useT()

  // Istatistik: bant sayilari + en kotu hamle
  const counts = { good: 0, ok: 0, bad: 0, blunder: 0 }
  let worst: LogEntry | null = null
  for (const e of log) {
    counts[band(e.loss).cls as keyof typeof counts]++
    if (!worst || e.loss > worst.loss) worst = e
  }

  return (
    <div className="register-overlay modal report-overlay" onClick={onClose}>
      <div className="report-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>
        <h2>
          {mode === 'stats' ? '📊' : '🔍'} {mode === 'stats' ? t('rep.statsTitle') : t('rep.analysisTitle')}
        </h2>

        {log.length === 0 ? (
          <p className="register-sub">{t('rep.empty')}</p>
        ) : mode === 'stats' ? (
          <div className="report-stats">
            {pr != null && (
              <div className="rep-pr">
                PR <b>{pr.toFixed(2)}</b>
              </div>
            )}
            <div className="rep-line">
              <span>{t('rep.decisions')}</span>
              <b>{log.length}</b>
            </div>
            <div className="rep-line good">
              <span>{t('rep.perfect')}</span>
              <b>{counts.good}</b>
            </div>
            <div className="rep-line ok">
              <span>{t('rep.minor')}</span>
              <b>{counts.ok}</b>
            </div>
            <div className="rep-line bad">
              <span>{t('rep.error')}</span>
              <b>{counts.bad}</b>
            </div>
            <div className="rep-line blunder">
              <span>{t('rep.blunder')}</span>
              <b>{counts.blunder}</b>
            </div>
            {worst && worst.loss > 0.001 && (
              <div className="rep-worst">
                {t('rep.worst')}: <code>{worst.notation}</code> → <code>{worst.best}</code> (
                {worst.loss.toFixed(3)})
              </div>
            )}
          </div>
        ) : (
          <div className="report-list">
            {log.map((e, i) => {
              const b = band(e.loss)
              return (
                <div key={i} className={`rep-row ${b.cls}`}>
                  <span className="rep-no">{i + 1}.</span>
                  <span className="rep-move">{e.notation}</span>
                  {e.loss >= 0.02 ? (
                    <>
                      <span className="rep-best">→ {e.best}</span>
                      <span className="rep-loss">-{e.loss.toFixed(3)}</span>
                    </>
                  ) : (
                    <span className="rep-tag">{t('rep.perfect')}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
