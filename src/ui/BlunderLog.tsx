import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { listBlunders, type BlunderEntry } from '../api'

// Equity kaybina gore siddet bandi (MatchReport ile ayni esikler)
function band(loss: number): { cls: string; key: string } {
  if (loss < 0.04) return { cls: 'ok', key: 'rep.minor' }
  if (loss < 0.08) return { cls: 'bad', key: 'rep.error' }
  return { cls: 'blunder', key: 'rep.blunder' }
}

export default function BlunderLog({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  useEscape(onClose)
  const [rows, setRows] = useState<BlunderEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listBlunders()
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="register-overlay modal page" onClick={onClose}>
      <div className="register-card blunder-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name="alert" size={20} /> {t('blunder.title')}
        </h2>
        <p className="register-sub">{t('blunder.sub')}</p>

        {loading ? (
          <div className="admin-empty">{t('admin.loading')}</div>
        ) : rows.length === 0 ? (
          <div className="admin-empty">{t('blunder.empty')}</div>
        ) : (
          <div className="blunder-list">
            {rows.map((b, i) => {
              const bd = band(b.loss)
              return (
                <div key={i} className={`blunder-row ${bd.cls}`}>
                  <span className={`blunder-band ${bd.cls}`}>{t(bd.key)}</span>
                  <span className="blunder-moves">
                    <b>{b.played}</b> <span className="bl-arrow">→</span> {b.best}
                  </span>
                  <span className="blunder-loss">-{b.loss.toFixed(3)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
