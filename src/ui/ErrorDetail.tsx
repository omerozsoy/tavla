import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Board from './Board'
import DiceRow from './Dice'
import { MoveArrows } from './MatReview'
import { useBoardDir } from './boardDirection'
import { useSwapStones } from './pieceColors'
import { pipCount } from '../engine/evaluate'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import type { EJEntry, EJSeverity } from '../api'
import type { GameState, Player, Step } from '../engine/types'
import { moveNotation } from '../engine/notation'

// Kaydi olmayan "en iyi hamle" icin istemci-tarafi sinir agi (lazy; tek ornek, ilk ihtiyacta yuklenir).
let bestBot: Promise<import('../engine/neuralBot').NeuralBot> | null = null
function getBestBot() {
  bestBot ??= import('../engine/neuralBot').then(async (m) => {
    const b = new m.NeuralBot()
    await b.ready()
    return b
  })
  return bestBot
}

// Zar ikonu (Zar satiri): 3x3 pip izgarasi.
const PIP_POS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}
function DieIcon({ value }: { value: number }) {
  return (
    <svg className="ej-die" viewBox="0 0 24 24" width="26" height="26" role="img" aria-label={String(value)}>
      <rect x="1" y="1" width="22" height="22" rx="5" />
      {(PIP_POS[value] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={6 + cx * 6} cy={6 + cy * 6} r="2.1" />
      ))}
    </svg>
  )
}

const SEV_CLS: Record<EJSeverity, string> = { inaccuracy: 'ok', mistake: 'bad', blunder: 'blunder' }

// Tek bir hatanin detayi (brief §31): pozisyon + zar + oynanan/en iyi + equity + severity + tip.
export default function ErrorDetail({
  entry,
  catLabel,
  onClose,
}: {
  entry: EJEntry
  catLabel: (id: string) => string
  onClose: () => void
}) {
  const { t } = useT()
  useEscape(onClose)
  const [boardDir] = useBoardDir()
  const [swapStones] = useSwapStones()

  // Tam-tahta gösterimi (MatReview/MatchReport ile aynı sistem: Board + kaynak→hedef okları +
  // hayalet pullar). Varsayılan: OYNANAN hamle; "En İyi Hamle" satırına tıklayınca en iyi hamle.
  const pl: Player = (entry.player as Player) ?? 'white'
  const d = entry.dice ?? []
  const fullDice = d.length === 2 && d[0] === d[1] ? [d[0], d[0], d[0], d[0]] : [...d]
  const boardState: GameState | null = entry.position
    ? {
        points: entry.position.points,
        bar: entry.position.bar,
        off: entry.position.off,
        turn: pl,
        dice: fullDice,
        diceUsed: fullDice.map(() => false),
      }
    : null
  const [view, setView] = useState<'played' | 'best'>('played')
  // Bazı kayıtlarda (gnubg hakemli / yeniden kurulan hamle) en iyi hamle saklanmamış -> burada hesapla.
  const stored = entry.bestMove ? { notation: entry.bestMove, steps: entry.bestSteps ?? [] } : null
  const [computed, setComputed] = useState<{ notation: string; steps: Step[] } | null | 'loading' | 'fail'>(null)
  const best = stored ?? (computed && typeof computed === 'object' ? computed : null)
  useEffect(() => {
    if (stored || !boardState || fullDice.length === 0) return
    let alive = true
    setComputed('loading')
    getBestBot()
      .then((b) => b.analyzeMoves(boardState))
      .then((ranks) => {
        if (!alive) return
        const top = ranks[0]
        setComputed(top ? { notation: moveNotation(top.move, pl), steps: top.move.steps } : 'fail')
      })
      .catch(() => alive && setComputed('fail'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id])
  // Eski/yeniden kurulan kayıtlarda playedSteps boş olabilir; en iyi hamle yoksa 'steps' oynananı tutar.
  const playedSteps = entry.playedSteps?.length ? entry.playedSteps : !entry.bestMove ? (entry.bestSteps ?? []) : []
  const steps = view === 'best' ? (best?.steps ?? []) : playedSteps
  const sameAsBest = !!best && best.notation === entry.playedMove
  const froms = new Set<number | 'bar'>()
  const tos = new Set<number | 'off'>()
  for (const s of steps) {
    froms.add(s.from)
    tos.add(s.to)
  }
  const diceFaces = (entry.dice ?? []).slice(0, 4).map((v) => ({ value: v, used: false }))
  const diceRow = boardState && diceFaces.length ? <DiceRow faces={diceFaces} owner={pl} /> : null

  const sevLabel =
    entry.severity === 'inaccuracy'
      ? t('rep.minor')
      : entry.severity === 'mistake'
        ? t('rep.error')
        : t('rep.blunder')

  return createPortal(
    <div className="ej-detail-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="ej-detail" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="modal-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <Icon name="x" size={16} />
        </Button>
        <div className="ej-detail-head">
          <span className={`ej-sev ${SEV_CLS[entry.severity]}`}>{sevLabel}</span>
          <h3>{catLabel(entry.category)}</h3>
        </div>

        <div className="ej-detail-board">
          {boardState ? (
            <div className="mrv-board-stage an-board-stage">
              <Board
                state={boardState}
                selectableFroms={froms}
                targets={tos}
                selectedFrom={null}
                onSelectFrom={() => {}}
                onSelectTarget={() => {}}
                onDragFrom={() => {}}
                pipTop={pipCount(boardState, 'black')}
                pipBottom={pipCount(boardState, 'white')}
                cube={{ value: 1, owner: null }}
                flip={pl === 'black'}
                numberFrom={pl}
                mirror={boardDir === 'left'}
                swapStones={swapStones}
                centerLeft={null}
                centerRight={diceRow}
              />
              <MoveArrows
                steps={steps}
                dep={`${entry.id}:${view}:${pl}:${boardDir}:${swapStones}:${steps.map((s) => `${s.from}>${s.to}`).join(',')}`}
              />
            </div>
          ) : (
            <div className="bl-card-noboard">
              <Icon name="alert" size={22} />
            </div>
          )}
        </div>

        <dl className="ej-detail-rows">
          <div className="ej-drow">
            <dt>{t('errorJournal.detail.dice')}</dt>
            <dd className="ej-dice">{d.length ? d.map((v, i) => <DieIcon key={i} value={v} />) : '—'}</dd>
          </div>
          {/* Satıra tıkla -> o hamle tahtada oklarla gösterilir (seçili satır vurgulu). */}
          <button
            type="button"
            className={`ej-drow ej-drow-btn ${view === 'played' ? 'active' : ''}`}
            onClick={() => setView('played')}
            aria-pressed={view === 'played'}
          >
            <span className="ej-dt">
              <Icon name="eye" size={14} /> {t('errorJournal.detail.yourMove')}
            </span>
            <code className={`bl-move ${sameAsBest ? 'best' : 'played'}`}>{entry.playedMove || '—'}</code>
          </button>
          <button
            type="button"
            className={`ej-drow ej-drow-btn ${view === 'best' ? 'active' : ''}`}
            onClick={() => best && setView('best')}
            disabled={!best}
            aria-pressed={view === 'best'}
          >
            <span className="ej-dt">
              <Icon name="eye" size={14} /> {t('errorJournal.detail.bestMove')}
            </span>
            <code className="bl-move best">
              {best ? best.notation : computed === 'loading' ? '…' : '—'}
            </code>
          </button>
          <div className="ej-drow">
            <dt>{t('errorJournal.detail.equityLoss')}</dt>
            <dd className="ej-loss">−{entry.equityLoss.toFixed(3)}</dd>
          </div>
          <div className="ej-drow">
            <dt>{t('errorJournal.detail.posType')}</dt>
            <dd>{catLabel(entry.category)}</dd>
          </div>
        </dl>

        {entry.alternatives && entry.alternatives.length > 0 && (
          <div className="ej-alts">
            <div className="ej-alts-title">{t('errorJournal.detail.alternatives')}</div>
            {entry.alternatives.slice(0, 3).map((a, i) => (
              <div key={i} className="ej-alt">
                <span className="ej-alt-rank">{i + 1}</span>
                <code>{a.notation}</code>
                <span className="ej-alt-eq">{a.equity.toFixed(3)}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>,
    document.body,
  )
}
