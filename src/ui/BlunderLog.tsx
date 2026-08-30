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

// Gorece tarih ("2 gun once") — dile duyarli, ekstra i18n anahtari gerektirmez.
function relDate(iso: string | undefined, lang: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.round((then - Date.now()) / 1000) // negatif = gecmis
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  if (abs < 60) return rtf.format(Math.round(diff), 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(diff / 86400), 'day')
  if (abs < 31536000) return rtf.format(Math.round(diff / 2592000), 'month')
  return rtf.format(Math.round(diff / 31536000), 'year')
}

type Group = {
  key: string
  hasCtx: boolean
  opp: string | null
  aiLevel: number | null
  scoreMe: number | null
  scoreOpp: number | null
  won: boolean | null
  createdAt?: string
  items: (BlunderEntry & { _idx: number })[]
}

export default function BlunderLog({
  onClose,
  embedded = false,
}: {
  onClose: () => void
  embedded?: boolean // true: overlay/baslik yok — Hata Gunlugu "Tum hatalar" sekmesinin govdesi
}) {
  const { t, lang } = useT()
  // Embedded modda Escape'i ebeveyn (ErrorJournal) yonetir.
  useEscape(() => {
    if (!embedded) onClose()
  })
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

  // Maca gore grupla: ayni mac = ayni rakip/skor + ayni kayit ani (dakika kovasi).
  // Baglami olmayan (eski) kayitlar tek "noContext" grubunda toplanir.
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    rows.forEach((b, idx) => {
      const hasCtx = b.opp != null || b.ai_level != null || b.score_me != null
      const key = hasCtx
        ? `${b.opp ?? 'ai' + b.ai_level}|${b.score_me}-${b.score_opp}|${(b.created_at ?? '').slice(0, 16)}`
        : 'none'
      let g = map.get(key)
      if (!g) {
        g = {
          key,
          hasCtx,
          opp: b.opp ?? null,
          aiLevel: b.ai_level ?? null,
          scoreMe: b.score_me ?? null,
          scoreOpp: b.score_opp ?? null,
          won: b.won ?? null,
          createdAt: b.created_at,
          items: [],
        }
        map.set(key, g)
      }
      g.items.push({ ...b, _idx: idx })
    })
    // En yeni mac ustte; baglamsiz (eski) grup en sona
    return [...map.values()].sort((a, b) => {
      if (a.key === 'none') return 1
      if (b.key === 'none') return -1
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    })
  }, [rows])

  const renderCard = (b: BlunderEntry & { _idx: number }) => {
    const bd = band(b.loss)
    const pos = safeParse<GameState>(b.pos)
    const steps = safeParse<Step[]>(b.steps)
    return (
      <article
        key={b._idx}
        className={`bl-card ${bd.cls}`}
        style={{ '--i': Math.min(b._idx, 12) } as CSSProperties}
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
  }

  const content = (
    <>
      {!embedded && (
        <>
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
        </>
      )}

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

            {/* Maca gore gruplu liste. Ic scroll YOK — sayfa kendi akar. */}
            {groups.map((g) => (
              <section className="bl-group" key={g.key}>
                <header className="bl-group-head">
                  {g.hasCtx ? (
                    <>
                      <span className="bl-opp">
                        {g.opp != null ? (
                          g.opp
                        ) : (
                          <>
                            <Icon name="robot" size={15} /> {t('blunder.ai')} · Sv.{g.aiLevel}
                          </>
                        )}
                      </span>
                      {g.scoreMe != null && (
                        <span className="bl-score">
                          {g.scoreMe}
                          <span className="bl-score-sep">–</span>
                          {g.scoreOpp}
                        </span>
                      )}
                      {g.won != null && (
                        <span className={`bl-result ${g.won ? 'won' : 'lost'}`}>
                          {t(g.won ? 'blunder.won' : 'blunder.lost')}
                        </span>
                      )}
                      {g.createdAt && <span className="bl-date">{relDate(g.createdAt, lang)}</span>}
                    </>
                  ) : (
                    <span className="bl-opp muted">{t('blunder.noContext')}</span>
                  )}
                  <span className="bl-group-count">{g.items.length}</span>
                </header>
                <div className="blunder-grid">{g.items.map(renderCard)}</div>
              </section>
            ))}
          </>
        )}
    </>
  )

  if (embedded) return <div className="bl-embedded">{content}</div>
  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card blunder-card" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  )
}
