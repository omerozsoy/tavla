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
import type { GameState, Player } from '../engine/types'

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
  // hayalet pullar). En iyi hamlenin adımları gösterilir (bestSteps).
  const pl: Player = (entry.player as Player) ?? 'white'
  const steps = entry.bestSteps ?? []
  const boardState: GameState | null = entry.position
    ? {
        points: entry.position.points,
        bar: entry.position.bar,
        off: entry.position.off,
        turn: pl,
        dice: entry.dice ?? [],
        diceUsed: [],
      }
    : null
  const froms = new Set<number | 'bar'>()
  const tos = new Set<number | 'off'>()
  for (const s of steps) {
    froms.add(s.from)
    tos.add(s.to)
  }
  const diceFaces = (entry.dice ?? []).slice(0, 4).map((v) => ({ value: v, used: false }))
  const diceRow = boardState && diceFaces.length ? <DiceRow faces={diceFaces} owner={pl} /> : null
  const whiteBottom = pl === 'white'

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
                flip={false}
                mirror={boardDir === 'left'}
                swapStones={swapStones}
                centerLeft={whiteBottom ? null : diceRow}
                centerRight={whiteBottom ? diceRow : null}
              />
              <MoveArrows
                steps={steps}
                dep={`${entry.id}:${boardDir}:${swapStones}:${steps.map((s) => `${s.from}>${s.to}`).join(',')}`}
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
            <dd>{entry.dice ? entry.dice.join('-') : '—'}</dd>
          </div>
          <div className="ej-drow">
            <dt>{t('errorJournal.detail.yourMove')}</dt>
            <dd>
              <code className="bl-move played">{entry.playedMove ?? '—'}</code>
            </dd>
          </div>
          <div className="ej-drow">
            <dt>{t('errorJournal.detail.bestMove')}</dt>
            <dd>
              <code className="bl-move best">{entry.bestMove ?? '—'}</code>
            </dd>
          </div>
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
