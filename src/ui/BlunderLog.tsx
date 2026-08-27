import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import MiniBoard from './MiniBoard'
import type { GameState, Player, Step } from '../engine/types'
import { listBlunders, type BlunderEntry } from '../api'

// Equity kaybina gore siddet bandi (MatchReport ile ayni esikler)
function band(loss: number): { cls: string; key: string } {
  if (loss < 0.04) return { cls: 'ok', key: 'rep.minor' }
  if (loss < 0.08) return { cls: 'bad', key: 'rep.error' }
  return { cls: 'blunder', key: 'rep.blunder' }
}

function safeParse<T>(s?: string | null): T | null {
  if (!s) return null
  try {
    return JSON.parse(s) as T
  } catch {
    return null
  }
}

export default function BlunderLog({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  useEscape(onClose)
  const [rows, setRows] = useState<BlunderEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    setError(false)
    listBlunders()
      .then(setRows)
      .catch(() => setError(true)) // sessizce yutma: ag hatasi "bos liste" gibi gorunmesin
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [])

  return (
    <div className="register-overlay modal page">
      <div className="register-card blunder-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name="alert" size={20} /> {t('blunder.title')}
        </h2>
        <p className="register-sub">{t('blunder.sub')}</p>

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
          <div className="admin-empty">{t('blunder.empty')}</div>
        ) : (
          <div className="blunder-list">
            {rows.map((b, i) => {
              const bd = band(b.loss)
              const open = openIdx === i
              const pos = open ? safeParse<GameState>(b.pos) : null
              const steps = open ? safeParse<Step[]>(b.steps) : null
              const hasBoard = !!b.pos
              return (
                <div key={i} className={`blunder-item ${bd.cls} ${open ? 'open' : ''}`}>
                  <button
                    className="blunder-row"
                    onClick={() => hasBoard && setOpenIdx(open ? null : i)}
                    style={hasBoard ? undefined : { cursor: 'default' }}
                  >
                    <span className={`blunder-band ${bd.cls}`}>{t(bd.key)}</span>
                    <span className="blunder-moves">
                      <b>{b.played}</b> <span className="bl-arrow">→</span> {b.best}
                    </span>
                    <span className="blunder-loss">-{b.loss.toFixed(3)}</span>
                    {hasBoard && (
                      <Icon name="chevron" size={16} className={open ? 'chev-open' : ''} />
                    )}
                  </button>
                  {open && pos && (
                    <div className="blunder-board">
                      <MiniBoard state={pos} steps={steps ?? []} player={(b.player as Player) ?? 'white'} flip={b.player === 'black'} />
                      <div className="blunder-hint">
                        {t('blunder.bestWas')}: <b>{b.best}</b>
                      </div>
                    </div>
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
