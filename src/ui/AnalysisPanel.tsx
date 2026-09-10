import { useEffect, useState } from 'react'
import type { GameState, Player } from '../engine/types'
import type { RankedMove } from '../engine/neuralBot'
import type { GnuMove } from '../api'
import { equityFrom } from '../engine/encoding'
import { moveNotation } from '../engine/notation'
import { useT } from '../i18n'
import MiniBoard from './MiniBoard'

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
  gnubgMoves?: GnuMove[] | null // HAKEM=gnubg: doluysa hamle listesi gnubg'den (notasyon+equity)
  player: Player
  lastError: MoveError | null
  boardState: GameState | null // hamlelerin uygulandigi konum (mini board icin)
}

export default function AnalysisPanel({
  loading,
  currentProbs,
  ranked,
  gnubgMoves,
  player,
  lastError,
  boardState,
}: Props) {
  const { t } = useT()
  const [selected, setSelected] = useState(0)
  // Yeni pozisyon analiz edildiginde en iyi hamleye don
  useEffect(() => setSelected(0), [boardState])
  // gnubg listesi varsa onu kullan (notasyon string; Move nesnesi yok -> tikla-onizleme wildbg'de).
  const useGnubg = !!(gnubgMoves && gnubgMoves.length > 0)
  const bestEq = useGnubg ? gnubgMoves![0].equity : ranked && ranked.length > 0 ? ranked[0].equity : 0
  const sel = ranked && ranked.length > 0 ? ranked[Math.min(selected, ranked.length - 1)] : null

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

      {/* Secili hamleyi mini board uzerinde ok ile goster */}
      {!loading && boardState && sel && (
        <MiniBoard state={boardState} steps={sel.move.steps} player={player} />
      )}

      {/* HAKEM=gnubg: gnubg hamle listesi (notasyon+equity). Move nesnesi olmadığından satırlar
          tıkla-önizleme yapmaz; MiniBoard yukarıda wildbg en iyi hamlesini gösterir (kozmetik). */}
      {!loading && useGnubg && (
        <div className="move-list">
          <div className="move-list-head">{t('an.bestMoves')}</div>
          {gnubgMoves!.slice(0, 6).map((m, i) => (
            <div key={`${m.notation}-${i}`} className={`move-row ${i === 0 ? 'best' : ''}`}>
              <span className="rank">{i + 1}.</span>
              <span className="notation">{m.notation}</span>
              <span className="eq">{m.equity.toFixed(3)}</span>
              <span className="diff">{i === 0 ? '' : (m.equity - bestEq).toFixed(3)}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && !useGnubg && ranked && ranked.length > 0 && (
        <div className="move-list">
          <div className="move-list-head">{t('an.bestMoves')}</div>
          {ranked.slice(0, 6).map((r, i) => (
            <div
              key={r.move.resultKey}
              className={`move-row ${i === 0 ? 'best' : ''} ${i === selected ? 'sel' : ''}`}
              onClick={() => setSelected(i)}
            >
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
