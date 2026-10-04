import { useMemo, type CSSProperties } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import Loading from './Loading'
import MiniBoard from './MiniBoard'
import type { GameState, Player, Step } from '../engine/types'
import type { EJEntry, EJSeverity } from '../api'
import { matchGnubgMove } from '../engine/gnubgMove'
import { moveNotation } from '../engine/notation'

// gnubg siddet bandi -> kart sinifi + etiket (MatchReport ile ayni renkler)
// cls: ok = kucuk hata, bad = hata, blunder = buyuk hata
const BAND: Record<EJSeverity, { cls: 'ok' | 'bad' | 'blunder'; key: string }> = {
  inaccuracy: { cls: 'ok', key: 'rep.minor' },
  mistake: { cls: 'bad', key: 'rep.error' },
  blunder: { cls: 'blunder', key: 'rep.blunder' },
}

// Kartta gosterilecek hamle: gnubg en iyi hamlesi saklıysa onun adımları (notasyondan kurulur),
// yoksa oynanan hamle (en iyi hamle detayda gnubg'ye sorulur).
function cardMove(e: EJEntry, pos: GameState | null): { best: string | null; steps: Step[] } {
  const pl = (e.player as Player) ?? 'white'
  if (e.engine === 'gnubg-best' && e.bestMove) {
    if (e.bestSteps?.length) return { best: e.bestMove, steps: e.bestSteps }
    const m = pos ? matchGnubgMove(pos, pl, e.bestMove) : null
    if (m) return { best: moveNotation(m, pl), steps: m.steps }
    return { best: e.bestMove, steps: [] }
  }
  return { best: null, steps: e.playedSteps ?? [] }
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
  match: EJEntry['match']
  items: EJEntry[]
}

// "Tüm hatalar": gnubg ile ölçülmüş hatalar (Hata Günlüğü kayıtları), maça göre gruplu. Veri ebeveynden
// (ErrorJournal) gelir — eski istemci-tarafı (wildbg) /blunders kaydı KULLANILMAZ.
export default function BlunderLog({
  entries,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  entries: EJEntry[]
  loading: boolean
  error: boolean
  onRetry: () => void
  onOpen: (e: EJEntry) => void
}) {
  const { t, lang } = useT()
  const rows = entries

  // Siddet dagilimi (ozet seridi icin) — tek geciste say
  const counts = useMemo(() => {
    const c = { blunder: 0, bad: 0, ok: 0 }
    for (const r of rows) c[BAND[r.severity].cls]++
    return c
  }, [rows])

  // Maca gore grupla (matchId). En yeni mac ustte.
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const e of rows) {
      let g = map.get(e.matchId)
      if (!g) {
        g = { key: e.matchId, match: e.match ?? null, items: [] }
        map.set(e.matchId, g)
      }
      g.items.push(e)
    }
    const at = (g: Group) => g.match?.at ?? g.items[0]?.playedAt ?? ''
    return [...map.values()].sort((a, b) => at(b).localeCompare(at(a)))
  }, [rows])

  const renderCard = (b: EJEntry, i: number) => {
    const bd = BAND[b.severity]
    const pos = b.position
    const cm = cardMove(b, pos)
    const d = b.dice ?? []
    return (
      <article
        key={b.id}
        className={`bl-card ${bd.cls}`}
        style={{ '--i': Math.min(i, 12) } as CSSProperties}
        role="button"
        tabIndex={0}
        onClick={() => onOpen(b)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault()
            onOpen(b)
          }
        }}
      >
        <div className="bl-card-board">
          {pos ? (
            <MiniBoard
              state={pos}
              steps={cm.steps}
              player={(b.player as Player) ?? 'white'}
              dice={d.length === 2 && d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : d}
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
            <span className="bl-move played">{b.playedMove}</span>
            {cm.best && (
              <>
                <span className="bl-move-sep" aria-hidden="true">
                  →
                </span>
                <span className="bl-move best">{cm.best}</span>
              </>
            )}
          </div>
          <div className="bl-foot">
            <span className="bl-best-tag">{cm.best ? t('blunder.bestWas') : t('errorJournal.detail.openBest')}</span>
            <span className="bl-loss">−{b.equityLoss.toFixed(3)}</span>
          </div>
        </div>
      </article>
    )
  }

  return (
    <>
      {loading ? (
          <Loading />
        ) : error ? (
          <div className="admin-empty">
            {t('common.loadError')}{' '}
            <Button variant="outline" onClick={onRetry}>
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
                  {g.match ? (
                    <>
                      <span className="bl-opp">
                        {g.match.opponent ? (
                          g.match.opponent
                        ) : (
                          <>
                            <Icon name="robot" size={15} /> {t('blunder.ai')}
                          </>
                        )}
                      </span>
                      {g.match.score[0] != null && g.match.score[1] != null && (
                        <span className="bl-score">
                          {g.match.score[0]}
                          <span className="bl-score-sep">–</span>
                          {g.match.score[1]}
                        </span>
                      )}
                      <span className={`bl-result ${g.match.won ? 'won' : 'lost'}`}>
                        {t(g.match.won ? 'blunder.won' : 'blunder.lost')}
                      </span>
                      {g.match.at && <span className="bl-date">{relDate(g.match.at, lang)}</span>}
                    </>
                  ) : (
                    <span className="bl-opp muted">{t('blunder.noContext')}</span>
                  )}
                  {/* Bu maçtaki hata sayısı (okunur rozet: "4 hata") */}
                  <span className="bl-group-count">{t('blunder.groupCount', { n: g.items.length })}</span>
                </header>
                <div className="blunder-grid">{g.items.map((e, i) => renderCard(e, i))}</div>
              </section>
            ))}
          </>
        )}
    </>
  )
}
