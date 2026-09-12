import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import Board from './Board'
import DiceRow from './Dice'
import { useBoardDir } from './boardDirection'
import { useSwapStones } from './pieceColors'
import { pipCount } from '../engine/evaluate'
import { divisionOfPR } from '../badges'
import type { LogEntry } from './MatchReport'
import type { GameState, Step } from '../engine/types'

// Mat Analiz FAZ 2: yüklenen .mat maçının HAMLE-HAMLE görüntüleyicisi (HedgeHog benzeri
// tam-ekran üç panel): sol = hamle listesi (oyuncu + hata filtreli), orta = tahta + oyuncu
// adları + pip + zar, sağ = kazanma olasılıkları + sıralı aday hamleler.
// Üstünde açılışta "Analiz Tamamlandı" özet popup'ı (kapatınca görüntüleyici kalır).

function band(loss: number): 'good' | 'ok' | 'bad' | 'blunder' {
  if (loss < 0.02) return 'good'
  if (loss < 0.04) return 'ok'
  if (loss < 0.08) return 'bad'
  return 'blunder'
}
const pct = (v: number) => (v * 100).toFixed(1)

// ---- Özet (popup): hamle-inceleme log'undan per-oyuncu hata istatistikleri ----
export interface MatSummaryPlayer {
  name: string
  blunders: number
  errors: number
  inaccuracies: number
  equityLost: number
  erMemg: number // (kayıp/karar)×1000
  xr: number // (kayıp/karar)×500 = XG PR
  missedDoubles: number
  decisions: number
}
export interface MatSummary {
  players: MatSummaryPlayer[] // [0]=beyaz (names[0]), [1]=siyah (names[1])
  durationMs: number
}
export function computeSummary(log: LogEntry[], names: string[] | null, durationMs: number): MatSummary {
  const colors: Array<'white' | 'black'> = ['white', 'black']
  const players = colors.map((c, i) => {
    const es = log.filter((e) => e.pos && e.player === c && !e.cube)
    const decisions = es.length
    const equityLost = es.reduce((s, e) => s + (e.loss || 0), 0)
    const blunders = es.filter((e) => e.loss >= 0.08).length
    const errors = es.filter((e) => e.loss >= 0.04 && e.loss < 0.08).length
    const inaccuracies = es.filter((e) => e.loss >= 0.02 && e.loss < 0.04).length
    const erMemg = decisions ? (equityLost / decisions) * 1000 : 0
    return {
      name: names?.[i] || (i === 0 ? 'White' : 'Black'),
      blunders,
      errors,
      inaccuracies,
      equityLost,
      erMemg,
      xr: erMemg / 2,
      missedDoubles: 0,
      decisions,
    }
  })
  return { players, durationMs }
}
// ER (mEMG) -> yaklaşık performans yüzdesi (düşük hata = yüksek %).
const perfPct = (erMemg: number) => Math.max(0, Math.min(100, 100 - erMemg * 1.2))

export default function MatReview({
  log,
  names,
  matchLength,
  summary,
  onClose,
}: {
  log: LogEntry[]
  names: string[] | null
  matchLength: number | null
  summary?: MatSummary | null
  onClose: () => void
}) {
  const { t } = useT()
  useEscape(onClose)
  const [showSum, setShowSum] = useState(!!summary)
  const nameW = names?.[0] || t('mrv.white') // white = gnubg player0
  const nameB = names?.[1] || t('mrv.black')

  const [filter, setFilter] = useState<'all' | 'errors' | 'blunders'>('all')
  const [who, setWho] = useState<'both' | 'white' | 'black'>('both')
  // Kullanıcının board yönü + taş rengi tercihleri (gerçek Board ile birebir aynı görünüm)
  const [boardDir] = useBoardDir()
  const [swapStones] = useSwapStones()

  // İlk analiz edilebilir (pos'lu) hamle seçili gelsin.
  const firstIdx = useMemo(() => log.findIndex((e) => e.pos && !e.cube), [log])
  const [sel, setSel] = useState(firstIdx >= 0 ? firstIdx : 0)
  const [candIdx, setCandIdx] = useState(0)

  // Listelenecek satırlar: küp/no-move dahil TÜMÜ (HedgeHog gibi), filtre uygulanır.
  const rows = useMemo(() => {
    return log
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => {
        if (who !== 'both' && e.player && e.player !== who) return false
        if (filter === 'errors') return !e.cube && e.loss >= 0.02
        if (filter === 'blunders') return !e.cube && e.loss >= 0.08
        return true
      })
  }, [log, who, filter])

  const cur = log[sel]
  const viewSteps: Step[] = (() => {
    if (!cur) return []
    if (candIdx >= 0 && cur.cands && cur.cands[candIdx]) return cur.cands[candIdx].steps
    return cur.playedSteps ?? cur.steps ?? []
  })()
  const playedIdx = cur?.cands?.findIndex((c) => c.notation === cur.notation) ?? -1

  function select(i: number) {
    setSel(i)
    const e = log[i]
    const pi = e?.cands?.findIndex((c) => c.notation === e.notation) ?? -1
    setCandIdx(pi >= 0 ? pi : 0)
  }

  // Sağ panel olasılıkları: seçili adayın (yoksa oynanan) 6'lı [wn,wg,wb,ln,lg,lb].
  const probs = (candIdx >= 0 && cur?.cands?.[candIdx]?.probs) || cur?.probs || null
  const win = probs ? probs[0] + probs[1] + probs[2] : null

  // Gerçek Board için: GameState + seçili hamlenin kaynak/hedef vurgusu + zar satırı.
  const boardState: GameState | null = cur?.pos
    ? { points: cur.pos.points, bar: cur.pos.bar, off: cur.pos.off,
        turn: (cur.player ?? cur.pos.turn) as GameState['turn'], dice: cur.dice ?? [], diceUsed: [] }
    : null
  const froms = new Set<number | 'bar'>()
  const tos = new Set<number | 'off'>()
  for (const s of viewSteps) {
    froms.add(s.from)
    tos.add(s.to)
  }
  const diceFaces = (cur?.dice ?? []).slice(0, 4).map((v) => ({ value: v, used: false }))
  const diceRow =
    boardState && cur?.player && diceFaces.length ? <DiceRow faces={diceFaces} owner={cur.player} /> : null
  const whiteBottom = cur?.player === 'white' // beyaz altta (flip yok)

  // Tam-ekran: transform'lu ata (register-overlay.page) position:fixed'i kırpıyor ->
  // body'ye portal ile taşı (bkz fixed-portal-transform-tuzagi). Hesap barını da kaplar.
  return createPortal(
    <div className="mrv-overlay">
      <div className="mrv-top">
        <span className="mrv-title">
          <Icon name="analyze" size={18} /> {t('mrv.title')}
          {matchLength ? ` · ${t('ma.pointMatch', { n: matchLength })}` : ''}
        </span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={18} />
        </Button>
      </div>

      <div className="mrv-grid">
        {/* ---- SOL: hamle listesi ---- */}
        <aside className="mrv-list">
          <div className="mrv-list-head">
            <span className="mrv-list-lbl">{t('mrv.moves')}</span>
            <div className="mrv-seg">
              <button className={who === 'white' ? 'on' : ''} onClick={() => setWho('white')} title={nameW}>
                {nameW}
              </button>
              <button className={who === 'both' ? 'on' : ''} onClick={() => setWho('both')}>
                {t('mrv.both')}
              </button>
              <button className={who === 'black' ? 'on' : ''} onClick={() => setWho('black')} title={nameB}>
                {nameB}
              </button>
            </div>
          </div>
          <div className="mrv-seg mrv-seg-filter">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
              {t('mrv.all')}
            </button>
            <button className={filter === 'errors' ? 'on' : ''} onClick={() => setFilter('errors')}>
              {t('mrv.errors')}
            </button>
            <button className={filter === 'blunders' ? 'on' : ''} onClick={() => setFilter('blunders')}>
              {t('mrv.blunders')}
            </button>
          </div>
          <div className="mrv-rows">
            {rows.map(({ e, i }, ri) => {
              const prevGame = ri > 0 ? rows[ri - 1].e.game : undefined
              const showGame = e.game != null && e.game !== prevGame
              const b = e.cube ? 'good' : band(e.loss)
              return (
                <div key={i}>
                  {showGame && <div className="mrv-game-sep">{t('mrv.game', { n: (e.game ?? 0) + 1 })}</div>}
                  <button className={`mrv-row ${sel === i ? 'sel' : ''}`} onClick={() => select(i)} disabled={!e.pos && !e.cube}>
                    <span className={`mrv-dot ${b}`} />
                    <span className="mrv-no">{i + 1}.</span>
                    {e.dice && e.dice.length >= 2 ? (
                      <span className="mrv-dice">
                        {e.dice[0]}
                        {e.dice[1]}
                      </span>
                    ) : (
                      <span className="mrv-dice mrv-dice-empty" />
                    )}
                    <span className="mrv-move">{e.notation}</span>
                    {!e.cube && e.loss >= 0.08 ? (
                      <span className="mrv-mark blunder">⁉</span>
                    ) : !e.cube && e.loss >= 0.02 ? (
                      <span className="mrv-mark err">?</span>
                    ) : null}
                  </button>
                </div>
              )
            })}
            {rows.length === 0 && <div className="mrv-empty">{t('mrv.none')}</div>}
          </div>
        </aside>

        {/* ---- ORTA: GERÇEK site tahtası (tema + gerçek zarlar) ---- */}
        <main className="mrv-board">
          <div className="mrv-player mrv-player-top">
            <span className="mrv-score">{matchLength ? `0/${matchLength}` : ''}</span>
            <span className="mrv-pname">
              {cur?.player === 'black' && <span className="mrv-turn">▶</span>} {nameB}
            </span>
            {boardState && <span className="mrv-pip">{pipCount(boardState, 'black')}</span>}
          </div>

          {boardState ? (
            <div className="mrv-board-stage">
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
              {/* Hamleyi kibar oklarla göster (kaynak -> hedef). Gerçek nokta konumları
                  ÖLÇÜLÜR (flip/mirror/tema fark etmez). */}
              <MoveArrows
                steps={viewSteps}
                dep={`${sel}:${candIdx}:${boardDir}:${swapStones}:${viewSteps.map((s) => `${s.from}>${s.to}`).join(',')}`}
              />
            </div>
          ) : (
            <div className="mrv-noboard">{t('mrv.selectMove')}</div>
          )}

          <div className="mrv-player mrv-player-bot">
            <span className="mrv-score">{matchLength ? `0/${matchLength}` : ''}</span>
            <span className="mrv-pname">
              {cur?.player === 'white' && <span className="mrv-turn">▶</span>} {nameW}
            </span>
            {boardState && <span className="mrv-pip">{pipCount(boardState, 'white')}</span>}
          </div>
        </main>

        {/* ---- SAĞ: analiz ---- */}
        <aside className="mrv-analysis">
          <div className="mrv-ply">{t('mrv.ply', { n: 2 })}</div>
          <div className="mrv-prob-head">
            <div className="mrv-prob-cell">
              <span className="mrv-prob-lbl">{t('mrv.win')}</span>
              <span className="mrv-prob-val">{win != null ? pct(win) : '—'}</span>
            </div>
            <div className="mrv-prob-cell">
              <span className="mrv-prob-lbl">{t('mrv.wg')}</span>
              <span className="mrv-prob-val">{probs ? pct(probs[1] + probs[2]) : '—'}</span>
            </div>
            <div className="mrv-prob-cell">
              <span className="mrv-prob-lbl">{t('mrv.wbg')}</span>
              <span className="mrv-prob-val">{probs ? pct(probs[2]) : '—'}</span>
            </div>
            <div className="mrv-prob-cell">
              <span className="mrv-prob-lbl">{t('mrv.lg')}</span>
              <span className="mrv-prob-val">{probs ? pct(probs[4] + probs[5]) : '—'}</span>
            </div>
            <div className="mrv-prob-cell">
              <span className="mrv-prob-lbl">{t('mrv.lbg')}</span>
              <span className="mrv-prob-val">{probs ? pct(probs[5]) : '—'}</span>
            </div>
          </div>

          <div className="mrv-cands-head">
            <span className="mrv-ch-no">#</span>
            <span className="mrv-ch-move">{t('mrv.move')}</span>
            <span className="mrv-ch-eq">{t('mrv.equity')}</span>
          </div>
          <div className="mrv-cands">
            {(cur?.cands ?? []).map((c, ci) => {
              const diff = c.equity - (cur!.cands![0]?.equity ?? c.equity)
              const isPlayed = ci === playedIdx
              return (
                <button
                  key={ci}
                  className={`mrv-cand ${candIdx === ci ? 'sel' : ''} ${isPlayed ? 'played' : ''}`}
                  onClick={() => setCandIdx(ci)}
                >
                  <span className="mrv-c-no">{ci + 1}</span>
                  <span className="mrv-c-move">{c.notation}</span>
                  <span className="mrv-c-eq">
                    {ci === 0 ? `${c.equity >= 0 ? '+' : ''}${c.equity.toFixed(3)}` : `(${diff.toFixed(3)})`}
                  </span>
                </button>
              )
            })}
            {(!cur?.cands || cur.cands.length === 0) && cur?.pos && (
              <div className="mrv-empty">{t('mrv.noCands')}</div>
            )}
          </div>
        </aside>
      </div>

      {/* ---- Açılış özet popup'ı ("Analiz Tamamlandı") ---- */}
      {summary && showSum && <SummaryPopup summary={summary} names={names} onClose={() => setShowSum(false)} />}
    </div>,
    document.body,
  )
}

// Hamle okları: seçili hamlenin her adımını (kaynak -> hedef) tahtanın üstüne KİBAR bir ok
// olarak çizer. Nokta/bar/off elemanlarının GERÇEK ekran konumlarını ölçer (flip/mirror/tema
// fark etmez); Board'a dokunmadan salt-okuma overlay. Çift hamle (ör. 8/4(2)) tek ok + "×2".
type ArrowLine = { x1: number; y1: number; x2: number; y2: number; n: number }

function MoveArrows({ steps, dep }: { steps: Step[]; dep: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [arrows, setArrows] = useState<ArrowLine[]>([])
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const host = hostRef.current
    const stage = host?.parentElement
    const board = stage?.querySelector('.board') as HTMLElement | null
    if (!host || !stage || !board) {
      setArrows([])
      return
    }
    const measure = () => {
      const sr = stage.getBoundingClientRect()
      const centerOf = (el: Element | null): { x: number; y: number } | null => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: r.left + r.width / 2 - sr.left, y: r.top + r.height / 2 - sr.top }
      }
      const elFor = (p: number | 'bar' | 'off', fromY: number | null): Element | null => {
        if (p === 'bar') return board.querySelector('[data-slot="bar"]')
        if (p === 'off') {
          const trays = Array.from(board.querySelectorAll('.bearoff'))
          if (trays.length <= 1) return trays[0] ?? null
          if (fromY == null) return trays[0]
          // Bearing off -> kaynağa en yakın tepsi (ev tahtası tarafı).
          let best = trays[0]
          let bd = Infinity
          for (const tray of trays) {
            const r = tray.getBoundingClientRect()
            const cy = r.top + r.height / 2 - sr.top
            const d = Math.abs(cy - fromY)
            if (d < bd) {
              bd = d
              best = tray
            }
          }
          return best
        }
        return board.querySelector(`[data-point="${p}"]`)
      }
      // Aynı kaynak->hedef adımlarını birleştir (ör. 8/4(2) -> tek ok, n=2).
      const dedup = new Map<string, { from: Step['from']; to: Step['to']; n: number }>()
      for (const s of steps) {
        const k = `${s.from}>${s.to}`
        const e = dedup.get(k)
        if (e) e.n++
        else dedup.set(k, { from: s.from, to: s.to, n: 1 })
      }
      const out: ArrowLine[] = []
      for (const { from, to, n } of dedup.values()) {
        const a = centerOf(elFor(from, null))
        if (!a) continue
        const b = centerOf(elFor(to, a.y))
        if (!b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        const pad = Math.min(16, len / 2 - 2) // uçları kısalt -> ok taş altına gömülmesin
        out.push({ x1: a.x + ux * pad, y1: a.y + uy * pad, x2: b.x - ux * pad, y2: b.y - uy * pad, n })
      }
      setSize({ w: sr.width, h: sr.height })
      setArrows(out)
    }
    measure()
    const raf = requestAnimationFrame(measure) // yerleşim otursun (font/tema) diye bir kez daha
    const ro = new ResizeObserver(measure)
    ro.observe(board)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])

  return (
    <div ref={hostRef} className="mrv-arrows-host" aria-hidden="true">
      {arrows.length > 0 && size.w > 0 && (
        <svg className="mrv-arrows" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
          <defs>
            <marker id="mrv-ah" markerWidth="8" markerHeight="8" refX="5.6" refY="3" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L6.5,3 L0,6 Z" fill="currentColor" />
            </marker>
          </defs>
          {arrows.map((a, i) => (
            <g key={i}>
              <line
                className="mrv-arrow-line"
                x1={a.x1}
                y1={a.y1}
                x2={a.x2}
                y2={a.y2}
                markerEnd="url(#mrv-ah)"
              />
              {a.n > 1 && (
                <text className="mrv-arrow-badge" x={(a.x1 + a.x2) / 2} y={(a.y1 + a.y2) / 2 - 5} textAnchor="middle">
                  ×{a.n}
                </text>
              )}
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}

// "Analiz Tamamlandı" popup: birincil oyuncu rating% + Blunder/Hata/Kesinsizlik + oyuncu
// karşılaştırma tablosu + Derinlik/Motor/Süre + "Hataları İncele" (kapat).
function SummaryPopup({ summary, names, onClose }: { summary: MatSummary; names: string[] | null; onClose: () => void }) {
  const { t } = useT()
  const p0 = summary.players[0]
  const p1 = summary.players[1]
  const pctVal = perfPct(p0.erMemg)
  const div = divisionOfPR(p0.xr)
  const n = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—')
  return (
    <div className="mrv-sum-backdrop" onClick={onClose}>
      <div className="mrv-sum" onClick={(e) => e.stopPropagation()}>
        <button className="mrv-sum-x" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2 className="mrv-sum-title">{t('mrv.sumTitle')}</h2>
        <div className="mrv-sum-name">{p0.name}</div>
        <div className="mrv-sum-pct">{pctVal.toFixed(1)}%</div>
        <div className="mrv-sum-rating" style={{ color: div.color }}>
          {t(div.key)}
        </div>
        <div className="mrv-sum-boxes">
          <div className="mrv-sum-box">
            <b className="blunder">{p0.blunders}</b>
            <span>{t('ma.blunders')}</span>
          </div>
          <div className="mrv-sum-box">
            <b className="error">{p0.errors}</b>
            <span>{t('ma.errors')}</span>
          </div>
          <div className="mrv-sum-box">
            <b className="inacc">{p0.inaccuracies}</b>
            <span>{t('ma.inaccuracies')}</span>
          </div>
        </div>
        <table className="mrv-sum-table">
          <thead>
            <tr>
              <th />
              <th>{names?.[0] || p0.name}</th>
              <th>{names?.[1] || p1.name}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t('ma.missedDoubles')}</td>
              <td>{p0.missedDoubles}</td>
              <td>{p1.missedDoubles}</td>
            </tr>
            <tr>
              <td>{t('ma.equityLost')}</td>
              <td>{n(p0.equityLost, 3)}</td>
              <td>{n(p1.equityLost, 3)}</td>
            </tr>
            <tr>
              <td>{t('mrv.erMemg')}</td>
              <td>{n(p0.erMemg, 1)}</td>
              <td>{n(p1.erMemg, 1)}</td>
            </tr>
            <tr>
              <td>{t('mrv.xr')}</td>
              <td>{n(p0.xr, 2)}</td>
              <td>{n(p1.xr, 2)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mrv-sum-meta">
          <div>
            <span>{t('mrv.depth')}</span>
            <span>{t('mrv.ply', { n: 2 })}</span>
          </div>
          <div>
            <span>{t('mrv.engine')}</span>
            <span>TavlaTV</span>
          </div>
          <div>
            <span>{t('mrv.duration')}</span>
            <span>{(summary.durationMs / 1000).toFixed(1)}s</span>
          </div>
        </div>
        <Button className="mrv-sum-btn" onClick={onClose}>
          {t('mrv.reviewMistakes')}
        </Button>
      </div>
    </div>
  )
}
