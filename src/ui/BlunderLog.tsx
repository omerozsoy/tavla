import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import MiniBoard from './MiniBoard'
import type { GameState, Player, Step } from '../engine/types'
import { listBlunders, type BlunderEntry } from '../api'

// Equity kaybina gore siddet bandi (MatchReport ile ayni esikler)
// cls: ok = kucuk hata, bad = hata, blunder = buyuk hata
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

  // Siddet dagilimi (ozet seridi icin) — tek geciste say
  const counts = useMemo(() => {
    const c = { blunder: 0, bad: 0, ok: 0 }
    for (const r of rows) c[band(r.loss).cls as keyof typeof c]++
    return c
  }, [rows])

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card blunder-card" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="modal-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <Icon name="x" size={16} />
        </Button>
        <h2>
          <Icon name="alert" size={20} /> {t('blunder.title')}
        </h2>
        <p className="register-sub">{t('blunder.sub')}</p>

        {loading ? (
          <div className="admin-empty">{t('admin.loading')}</div>
        ) : error ? (
          <div className="admin-empty">
            {t('common.loadError')}{' '}
            <Button variant="outline" onClick={load}>
              {t('common.retry')}
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="admin-empty">{t('blunder.empty')}</div>
        ) : (
          <>
            {/* Editorial ozet seridi: toplam + siddet dagilimi (renk-yalniz degil, sayili) */}
            <div className="blunder-summary">
              <span className="bl-sum-total">
                {rows.length}
                <em>{t('blunder.title')}</em>
              </span>
              <span className="bl-sum-chips">
                {counts.blunder > 0 && (
                  <span className="bl-sum-chip blunder">
                    <i aria-hidden="true" />
                    {t('rep.blunder')} · {counts.blunder}
                  </span>
                )}
                {counts.bad > 0 && (
                  <span className="bl-sum-chip bad">
                    <i aria-hidden="true" />
                    {t('rep.error')} · {counts.bad}
                  </span>
                )}
                {counts.ok > 0 && (
                  <span className="bl-sum-chip ok">
                    <i aria-hidden="true" />
                    {t('rep.minor')} · {counts.ok}
                  </span>
                )}
              </span>
            </div>

            {/* Kart grid: tum hatalar board onizlemesiyle gorunur.
                Ic scroll YOK — sayfanin kendi scroll'u ile asagi akar. */}
            <div className="blunder-grid">
              {rows.map((b, i) => {
                const bd = band(b.loss)
                const pos = safeParse<GameState>(b.pos)
                const steps = safeParse<Step[]>(b.steps)
                return (
                  <article
                    key={i}
                    className={`bl-card ${bd.cls}`}
                    style={{ '--i': Math.min(i, 12) } as CSSProperties}
                  >
                    <div className="bl-card-board">
                      {pos ? (
                        <MiniBoard
                          state={pos}
                          steps={steps ?? []}
                          player={(b.player as Player) ?? 'white'}
                          flip={b.player === 'black'}
                        />
                      ) : (
                        <div className="bl-card-noboard">
                          <Icon name="alert" size={22} />
                        </div>
                      )}
                      <span className={`bl-badge ${bd.cls}`}>{t(bd.key)}</span>
                    </div>
                    <div className="bl-card-body">
                      <div className="bl-moves">
                        <span className="bl-move played">{b.played}</span>
                        <span className="bl-move-sep" aria-hidden="true">
                          →
                        </span>
                        <span className="bl-move best">{b.best}</span>
                      </div>
                      <div className="bl-foot">
                        <span className="bl-best-tag">{t('blunder.bestWas')}</span>
                        <span className="bl-loss">−{b.loss.toFixed(3)}</span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
