import MiniBoard from './MiniBoard'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import type { EJEntry, EJSeverity } from '../api'
import type { Player } from '../engine/types'

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

  const sevLabel =
    entry.severity === 'inaccuracy'
      ? t('rep.minor')
      : entry.severity === 'mistake'
        ? t('rep.error')
        : t('rep.blunder')

  return (
    <div className="ej-detail-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <aside className="ej-detail" onClick={(e) => e.stopPropagation()}>
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
          {entry.position ? (
            <MiniBoard
              state={entry.position}
              steps={entry.bestSteps ?? []}
              player={(entry.player as Player) ?? 'white'}
              dice={entry.dice ?? undefined}
              flip={entry.player === 'black'}
            />
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

        {entry.tags && entry.tags.length > 0 && (
          <div className="ej-tags">
            {entry.tags.map((tag) => (
              <span key={tag} className="ej-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}
