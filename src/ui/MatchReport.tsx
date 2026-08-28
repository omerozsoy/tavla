import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import MiniBoard from './MiniBoard'
import { Die } from './Dice'
import { divisionOfPR } from '../badges'
import { buildMat } from '../matExport'
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
  cube?: {
    win: number
    equity: number
    recommended: string
    chosen: string
    correct: boolean
  }
}

interface Props {
  mode: 'stats' | 'analysis'
  log: LogEntry[]
  pr: number | null
  humanColor?: Player // istatistik yalnizca insanin hamlelerini saysin (bot haric)
  matchLength?: number // .mat basligi icin mac hedefi ( or. "3 point match")
  whiteName?: string // .mat oyuncu adlari
  blackName?: string
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

export default function MatchReport({
  mode,
  log,
  pr,
  humanColor,
  matchLength = 1,
  whiteName = 'White',
  blackName = 'Black',
  onClose,
}: Props) {
  const { t } = useT()
  useEscape(onClose)
  // Analiz kapsami: varsayilan yalnizca kullanicinin hamleleri, istege gore iki taraf.
  // humanColor yoksa (bot-vs-bot/izleyici) kapsam ayrimi anlamsiz -> hep 'all'.
  const [scope, setScope] = useState<'mine' | 'all'>(humanColor ? 'mine' : 'all')
  const inScope = (e: LogEntry) => scope === 'all' || !humanColor || e.player === humanColor
  // Hatali hamleler (equity kaybi >= 0.02; kup haric) — analiz varsayilani bunlar
  const mistakes = log
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !e.cube && e.loss >= 0.02 && inScope(e))
  const firstAnalyzable = log.findIndex((e) => e.pos && !e.cube)
  const firstMistake = mistakes.find(({ e }) => e.pos)?.i ?? (firstAnalyzable >= 0 ? firstAnalyzable : 0)
  const [worstFirst, setWorstFirst] = useState(mistakes.length > 0) // varsayilan: sadece hatalar
  const [sel, setSel] = useState(firstMistake)
  // Aday listesinde OYNANAN adayin indexi; -1 = oynanan hamle top listede yok (blunder)
  // -1 durumunda tahtada gercek oynanan adimlar (playedSteps) gosterilir.
  const playedCandIdx = (e?: LogEntry) => e?.cands?.findIndex((c) => c.notation === e.notation) ?? -1
  // Tahtada gosterilen aday: acilis + secimde OYNANAN hamle (senin oynadigin). Adaylardan
  // (1-5) tiklayarak diger olasiliklarin oklarini gorursun.
  const [candIdx, setCandIdx] = useState(() => playedCandIdx(log[firstMistake]))

  // Kup kararlari ayri gosterilir; tas oyunu istatistigi/listesi kup satirlarini haric tutar
  const cubeLog = humanColor
    ? log.filter((e) => e.cube && e.player === humanColor)
    : log.filter((e) => e.cube)
  // Istatistik yalnizca insanin hamleleri; analiz listesi iki tarafi da gosterir
  const statLog = (humanColor ? log.filter((e) => e.player === humanColor) : log).filter(
    (e) => !e.cube,
  )
  const counts = { good: 0, ok: 0, bad: 0, blunder: 0 }
  let worst: LogEntry | null = null
  for (const e of statLog) {
    counts[band(e.loss).cls as keyof typeof counts]++
    if (!worst || e.loss > worst.loss) worst = e
  }

  // Sira: seq'e gore (async bot kayitlari dogru yere otursun); yoksa dizideki sira
  const ordered = log
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => !e.cube && inScope(e))
    .sort((a, b) => (a.e.seq ?? a.i) - (b.e.seq ?? b.i))
  const rows = worstFirst ? mistakes.slice().sort((a, b) => b.e.loss - a.e.loss) : ordered

  // Kup tavsiyesi etiketi (take/drop veya double-* icin dogru anahtar)
  const recLabel = (rec: string) =>
    rec === 'take' ? t('cube.advTake') : rec === 'drop' ? t('cube.advDrop') : t(`cube.adv.${rec}`)

  const cur = log[sel]
  // Tahtada hangi hamle: secili aday varsa o, yoksa oynanan
  const viewSteps = useMemo<Step[]>(() => {
    if (!cur) return []
    if (candIdx >= 0 && cur.cands && cur.cands[candIdx]) return cur.cands[candIdx].steps
    return cur.playedSteps ?? cur.steps ?? []
  }, [cur, candIdx])
  // Oynanan hamlenin aday listesindeki yeri (-1: top listede yok -> ayri "Senin hamlen" satiri)
  const playedIdx = cur?.cands?.findIndex((c) => c.notation === cur.notation) ?? -1

  function selectMove(i: number) {
    setSel(i)
    setCandIdx(playedCandIdx(log[i])) // acilista senin oynadigin hamle gosterilir
  }

  // Maci standart .mat (Jellyfish / GNU Backgammon) formatinda disa aktar.
  // Uretim mantigi src/matExport.ts'te (UI + testler ayni fonksiyonu kullanir).
  function exportMat() {
    const text = buildMat(log, { matchLength, whiteName, blackName })
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tavlatv-mac.mat'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="register-overlay modal report-overlay">
      <div className="report-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
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
                <span className="rep-pr-num">
                  PR <b>{pr.toFixed(2)}</b>
                </span>
                <span
                  className="rep-pr-title"
                  style={{ color: divisionOfPR(pr).color, borderColor: divisionOfPR(pr).color }}
                >
                  <Icon name={divisionOfPR(pr).icon} size={14} /> {t(divisionOfPR(pr).key)}
                </span>
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
            {cubeLog.length > 0 && (
              <div className="rep-cube">
                <div className="rep-cube-head">
                  <Icon name="target" size={14} /> {t('cube.decisions')}
                </div>
                {cubeLog.map((e, i) => (
                  <div
                    key={i}
                    className={`rep-cube-row ${e.cube!.correct ? 'ok' : 'wrong'}`}
                  >
                    <span className="rcc-chose">{t(`cube.chose.${e.cube!.chosen}`)}</span>
                    <span className="rcc-win">{t('cube.win')} {e.cube!.win.toFixed(0)}%</span>
                    <span className="rcc-verdict">
                      {e.cube!.correct ? (
                        <>
                          <Icon name="check" size={12} /> {t('cube.correct')}
                        </>
                      ) : (
                        recLabel(e.cube!.recommended)
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="analysis-layout">
            {/* Sol: hamle listesi */}
            <div className="analysis-list">
              {humanColor && (
                <div className="rep-filter">
                  <button
                    className={scope === 'mine' ? 'menu-btn active' : 'menu-btn'}
                    onClick={() => setScope('mine')}
                  >
                    {t('rep.scopeMine')}
                  </button>
                  <button
                    className={scope === 'all' ? 'menu-btn active' : 'menu-btn'}
                    onClick={() => setScope('all')}
                  >
                    {t('rep.scopeAll')}
                  </button>
                </div>
              )}
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
                  <MiniBoard state={cur.pos} steps={viewSteps} player={cur.player} dice={cur.dice} flip={humanColor === 'black'} />
                  {/* Tahtada su an hangi hamle gosteriliyor: senin hamlen mi, bir aday mi */}
                  <div className={`an-view-label ${candIdx < 0 || candIdx === playedIdx ? 'you' : ''}`}>
                    {candIdx < 0 || candIdx === playedIdx
                      ? t('rep.yourMove')
                      : `#${candIdx + 1} · ${cur.cands?.[candIdx]?.notation ?? ''}`}
                  </div>
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
                      const isPlayed = ci === playedIdx
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
                          <span className="an-tags">
                            {ci === 0 && (
                              <span className="an-star" title={t('rep.best')}>
                                <Icon name="star" size={13} />
                              </span>
                            )}
                            {isPlayed && <Icon name="check" size={13} />}
                          </span>
                        </button>
                      )
                    })}
                    {/* Oynadigin hamle top listede yoksa (blunder) ayrica goster + isaretle */}
                    {playedIdx < 0 && cur.notation && (
                      <button
                        className={`an-cand played you ${candIdx < 0 ? 'view' : ''}`}
                        onClick={() => setCandIdx(-1)}
                      >
                        <span className="an-rank">·</span>
                        <span className="an-cmove">{cur.notation}</span>
                        <span className="an-eq neg">
                          {cur.loss >= 0.005 ? `-${cur.loss.toFixed(3)}` : ''}
                        </span>
                        <span className="an-tags">
                          <span className="an-you-tag">{t('rep.yourMove')}</span>
                        </span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="register-sub small">{t('rep.selectMove')}</p>
              )}
            </div>
          </div>
        )}
        {log.length > 0 && (
          <Button variant="outline" className="rep-export rep-export-bottom" onClick={exportMat}>
            <Icon name="install" size={14} /> {t('rep.export')}
          </Button>
        )}
      </div>
    </div>
  )
}
