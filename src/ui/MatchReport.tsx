import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import MiniBoard from './MiniBoard'
import { Die } from './Dice'
import type { GameState, Player, Step } from '../engine/types'

export interface LogEntry {
  notation: string
  best: string
  loss: number
  pos?: GameState
  steps?: Step[] // en iyi hamle adimlari
  player?: Player
  dice?: number[]
  playedSteps?: Step[]
  cands?: { notation: string; equity: number; steps: Step[] }[]
  probs?: number[]
  seq?: number
}

interface Props {
  mode: 'stats' | 'analysis'
  log: LogEntry[]
  pr: number | null
  humanColor?: Player // istatistik yalnizca insanin hamlelerini saysin (bot haric)
  onClose: () => void
}

// Equity kaybina gore sinif (renk + etiket anahtari)
function band(loss: number): { cls: string; key: string } {
  if (loss < 0.02) return { cls: 'good', key: 'rep.perfect' }
  if (loss < 0.04) return { cls: 'ok', key: 'rep.minor' }
  if (loss < 0.08) return { cls: 'bad', key: 'rep.error' }
  return { cls: 'blunder', key: 'rep.blunder' }
}

// Oynanan konumun mover-perspektifli kazanma yuzdesi (probs[0..2] = kazanma)
function winPct(probs?: number[]): number | null {
  if (!probs || probs.length < 3) return null
  return Math.round((probs[0] + probs[1] + probs[2]) * 100)
}

export default function MatchReport({ mode, log, pr, humanColor, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [worstFirst, setWorstFirst] = useState(false)
  // Ilk analiz edilebilir (pos'lu) hamleyi sec
  const firstAnalyzable = log.findIndex((e) => e.pos)
  const [sel, setSel] = useState(firstAnalyzable >= 0 ? firstAnalyzable : 0)
  const [candIdx, setCandIdx] = useState(0) // tahtada gosterilen aday (0 = oynanan/en iyi)

  // Istatistik yalnizca insanin hamleleri; analiz listesi iki tarafi da gosterir
  const statLog = humanColor ? log.filter((e) => e.player === humanColor) : log
  const counts = { good: 0, ok: 0, bad: 0, blunder: 0 }
  let worst: LogEntry | null = null
  for (const e of statLog) {
    counts[band(e.loss).cls as keyof typeof counts]++
    if (!worst || e.loss > worst.loss) worst = e
  }

  const mistakes = log.map((e, i) => ({ e, i })).filter(({ e }) => e.loss >= 0.02)
  // Sira: seq'e gore (async bot kayitlari dogru yere otursun); yoksa dizideki sira
  const ordered = log
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.seq ?? a.i) - (b.e.seq ?? b.i))
  const rows = worstFirst ? mistakes.slice().sort((a, b) => b.e.loss - a.e.loss) : ordered

  const cur = log[sel]
  // Tahtada hangi hamle: secili aday varsa o, yoksa oynanan
  const viewSteps = useMemo<Step[]>(() => {
    if (!cur) return []
    if (cur.cands && cur.cands[candIdx]) return cur.cands[candIdx].steps
    return cur.playedSteps ?? cur.steps ?? []
  }, [cur, candIdx])

  function selectMove(i: number) {
    setSel(i)
    setCandIdx(0)
  }

  return (
    <div className="register-overlay modal report-overlay" onClick={onClose}>
      <div className="report-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <h2>
          {mode === 'stats' ? <Icon name="chart" size={20} /> : <Icon name="search" size={20} />}{' '}
          {mode === 'stats' ? t('rep.statsTitle') : t('rep.analysisTitle')}
        </h2>

        {log.length === 0 ? (
          <p className="register-sub">{t('rep.empty')}</p>
        ) : mode === 'stats' ? (
          <div className="report-stats">
            {pr != null && (
              <div className="rep-pr">
                PR <b>{pr.toFixed(2)}</b>
              </div>
            )}
            <div className="rep-line">
              <span>{t('rep.decisions')}</span>
              <b>{statLog.length}</b>
            </div>
            <div className="rep-line good">
              <span>{t('rep.perfect')}</span>
              <b>{counts.good}</b>
            </div>
            <div className="rep-line ok">
              <span>{t('rep.minor')}</span>
              <b>{counts.ok}</b>
            </div>
            <div className="rep-line bad">
              <span>{t('rep.error')}</span>
              <b>{counts.bad}</b>
            </div>
            <div className="rep-line blunder">
              <span>{t('rep.blunder')}</span>
              <b>{counts.blunder}</b>
            </div>
            {worst && worst.loss > 0.001 && (
              <div className="rep-worst">
                {t('rep.worst')}: <code>{worst.notation}</code> → <code>{worst.best}</code> (
                {worst.loss.toFixed(3)})
              </div>
            )}
          </div>
        ) : (
          <div className="analysis-layout">
            {/* Sol: hamle listesi */}
            <div className="analysis-list">
              <div className="rep-filter">
                <button
                  className={worstFirst ? 'menu-btn' : 'menu-btn active'}
                  onClick={() => setWorstFirst(false)}
                >
                  {t('rep.byOrder')}
                </button>
                <button
                  className={worstFirst ? 'menu-btn active' : 'menu-btn'}
                  onClick={() => setWorstFirst(true)}
                >
                  {t('rep.byWorst', { n: mistakes.length })}
                </button>
              </div>
              <div className="analysis-rows">
                {rows.map(({ e, i }, idx) => {
                  const b = band(e.loss)
                  return (
                    <button
                      key={i}
                      className={`analysis-row ${sel === i ? 'sel' : ''}`}
                      onClick={() => selectMove(i)}
                    >
                      <span className={`aq-dot ${b.cls}`} />
                      <span className="ar-no">{idx + 1}.</span>
                      {e.dice && e.dice.length >= 2 && e.player && (
                        <span className="ar-dice">
                          <Die value={e.dice[0]} owner={e.player} used={false} />
                          <Die value={e.dice[1]} owner={e.player} used={false} />
                        </span>
                      )}
                      <span className="ar-move">{e.notation}</span>
                      {e.loss >= 0.005 && <span className="ar-loss">-{e.loss.toFixed(3)}</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sag: secili hamlenin tahtasi + siralı adaylar */}
            <div className="analysis-detail">
              {cur?.pos && cur.player ? (
                <>
                  <MiniBoard state={cur.pos} steps={viewSteps} player={cur.player} />
                  {winPct(cur.probs) != null && (
                    <div className="an-winbar" title={t('rep.winChance')}>
                      <div className="an-winfill" style={{ width: `${winPct(cur.probs)}%` }} />
                      <span className="an-winlabel">
                        {t('rep.winChance')}: {winPct(cur.probs)}%
                      </span>
                    </div>
                  )}
                  <div className="an-cands">
                    {(cur.cands ?? []).map((c, ci) => {
                      const diff = c.equity - (cur.cands![0]?.equity ?? c.equity)
                      const isPlayed = c.notation === cur.notation
                      return (
                        <button
                          key={ci}
                          className={`an-cand ${candIdx === ci ? 'view' : ''} ${isPlayed ? 'played' : ''}`}
                          onClick={() => setCandIdx(ci)}
                        >
                          <span className="an-rank">{ci + 1}</span>
                          <span className="an-cmove">{c.notation}</span>
                          <span className={`an-eq ${diff < -0.001 ? 'neg' : 'pos'}`}>
                            {ci === 0 ? `+${c.equity.toFixed(3)}` : diff.toFixed(3)}
                          </span>
                          {isPlayed && <Icon name="check" size={13} />}
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <p className="register-sub small">{t('rep.selectMove')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
