import type { Player } from '../engine/types'
import type { RankedMove } from '../engine/neuralBot'
import { equityFrom } from '../engine/encoding'
import { moveNotation } from '../engine/notation'
import { useT } from '../i18n'

export interface MoveError {
  loss: number
  label: string
  cls: string
  best: string
  played: string
}

interface Props {
  loading: boolean
  currentProbs: number[] | null
  ranked: RankedMove[] | null
  player: Player
  lastError: MoveError | null
}

export default function AnalysisPanel({ loading, currentProbs, ranked, player, lastError }: Props) {
  const { t } = useT()
  const bestEq = ranked && ranked.length > 0 ? ranked[0].equity : 0

  return (
    <div className="analysis">
      <h3>{t('an.title')}</h3>

      {lastError && (
        <div className={`move-error ${lastError.cls}`}>
          <strong>{lastError.label}</strong>
          {lastError.loss > 0.0005 && (
            <>
              {' '}
              — {lastError.loss.toFixed(3)} {t('an.equityLoss')}
            </>
          )}
          <div className="err-detail">
            {t('an.played')}: <code>{lastError.played}</code> · {t('an.best')}:{' '}
            <code>{lastError.best}</code>
          </div>
        </div>
      )}

      {loading && <div className="analysis-loading">{t('an.loading')}</div>}

      {!loading && currentProbs && (
        <div className="pos-eval">
          <div className="prob-row">
            <span>{t('an.win')}</span>
            <b>{((currentProbs[0] + currentProbs[1] + currentProbs[2]) * 100).toFixed(1)}%</b>
          </div>
          <div className="prob-sub">
            {t('an.gammon')} {((currentProbs[1] + currentProbs[2]) * 100).toFixed(1)}% ·{' '}
            {t('an.bg')} {(currentProbs[2] * 100).toFixed(1)}%
          </div>
          <div className="prob-sub">
            {t('an.equity')}: {equityFrom(currentProbs).toFixed(3)}
          </div>
        </div>
      )}

      {!loading && ranked && ranked.length > 0 && (
        <div className="move-list">
          <div className="move-list-head">{t('an.bestMoves')}</div>
          {ranked.slice(0, 6).map((r, i) => (
            <div key={r.move.resultKey} className={`move-row ${i === 0 ? 'best' : ''}`}>
              <span className="rank">{i + 1}.</span>
              <span className="notation">{moveNotation(r.move, player)}</span>
              <span className="eq">{r.equity.toFixed(3)}</span>
              <span className="diff">{i === 0 ? '' : (r.equity - bestEq).toFixed(3)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
