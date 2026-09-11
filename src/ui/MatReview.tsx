import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import MiniBoard from './MiniBoard'
import { pipCount } from '../engine/evaluate'
import type { LogEntry } from './MatchReport'
import type { Step } from '../engine/types'

// Mat Analiz FAZ 2: yüklenen .mat maçının HAMLE-HAMLE görüntüleyicisi (HedgeHog benzeri
// tam-ekran üç panel): sol = hamle listesi (oyuncu + hata filtreli), orta = tahta + oyuncu
// adları + pip + zar, sağ = kazanma olasılıkları + sıralı aday hamleler.

function band(loss: number): 'good' | 'ok' | 'bad' | 'blunder' {
  if (loss < 0.02) return 'good'
  if (loss < 0.04) return 'ok'
  if (loss < 0.08) return 'bad'
  return 'blunder'
}
const pct = (v: number) => (v * 100).toFixed(1)

export default function MatReview({
  log,
  names,
  matchLength,
  onClose,
}: {
  log: LogEntry[]
  names: string[] | null
  matchLength: number | null
  onClose: () => void
}) {
  const { t } = useT()
  useEscape(onClose)
  const nameW = names?.[0] || t('mrv.white') // white = gnubg player0
  const nameB = names?.[1] || t('mrv.black')

  const [filter, setFilter] = useState<'all' | 'errors' | 'blunders'>('all')
  const [who, setWho] = useState<'both' | 'white' | 'black'>('both')

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

  return (
    <div className="mr-overlay">
      <div className="mr-top">
        <span className="mr-title">
          <Icon name="analyze" size={18} /> {t('mrv.title')}
          {matchLength ? ` · ${t('ma.pointMatch', { n: matchLength })}` : ''}
        </span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={18} />
        </Button>
      </div>

      <div className="mr-grid">
        {/* ---- SOL: hamle listesi ---- */}
        <aside className="mr-list">
          <div className="mr-list-head">
            <span className="mr-list-lbl">{t('mrv.moves')}</span>
            <div className="mr-seg">
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
          <div className="mr-seg mr-seg-filter">
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
          <div className="mr-rows">
            {rows.map(({ e, i }, ri) => {
              const prevGame = ri > 0 ? rows[ri - 1].e.game : undefined
              const showGame = e.game != null && e.game !== prevGame
              const b = e.cube ? 'good' : band(e.loss)
              return (
                <div key={i}>
                  {showGame && <div className="mr-game-sep">{t('mrv.game', { n: (e.game ?? 0) + 1 })}</div>}
                  <button className={`mr-row ${sel === i ? 'sel' : ''}`} onClick={() => select(i)} disabled={!e.pos && !e.cube}>
                    <span className={`mr-dot ${b}`} />
                    <span className="mr-no">{i + 1}.</span>
                    {e.dice && e.dice.length >= 2 ? (
                      <span className="mr-dice">
                        {e.dice[0]}
                        {e.dice[1]}
                      </span>
                    ) : (
                      <span className="mr-dice mr-dice-empty" />
                    )}
                    <span className="mr-move">{e.notation}</span>
                    {!e.cube && e.loss >= 0.08 ? (
                      <span className="mr-mark blunder">⁉</span>
                    ) : !e.cube && e.loss >= 0.02 ? (
                      <span className="mr-mark err">?</span>
                    ) : null}
                  </button>
                </div>
              )
            })}
            {rows.length === 0 && <div className="mr-empty">{t('mrv.none')}</div>}
          </div>
        </aside>

        {/* ---- ORTA: tahta ---- */}
        <main className="mr-board">
          <div className="mr-player mr-player-top">
            <span className="mr-score">
              {log[sel]?.pos ? '' : ''}
              {matchLength ? `0/${matchLength}` : ''}
            </span>
            <span className="mr-pname">
              {cur?.player === 'black' && <span className="mr-turn">▶</span>} {nameB}
            </span>
            {cur?.pos && <span className="mr-pip">{pipCount(cur.pos, 'black')}</span>}
          </div>

          {cur?.pos && cur.player ? (
            <MiniBoard state={cur.pos} steps={viewSteps} player={cur.player} dice={cur.dice} />
          ) : (
            <div className="mr-noboard">{t('mrv.selectMove')}</div>
          )}

          <div className="mr-player mr-player-bot">
            <span className="mr-score">{matchLength ? `0/${matchLength}` : ''}</span>
            <span className="mr-pname">
              {cur?.player === 'white' && <span className="mr-turn">▶</span>} {nameW}
            </span>
            {cur?.pos && <span className="mr-pip">{pipCount(cur.pos, 'white')}</span>}
          </div>
        </main>

        {/* ---- SAĞ: analiz ---- */}
        <aside className="mr-analysis">
          <div className="mr-ply">{t('mrv.ply', { n: 2 })}</div>
          <div className="mr-prob-head">
            <div className="mr-prob-cell">
              <span className="mr-prob-lbl">{t('mrv.win')}</span>
              <span className="mr-prob-val">{win != null ? pct(win) : '—'}</span>
            </div>
            <div className="mr-prob-cell">
              <span className="mr-prob-lbl">{t('mrv.wg')}</span>
              <span className="mr-prob-val">{probs ? pct(probs[1] + probs[2]) : '—'}</span>
            </div>
            <div className="mr-prob-cell">
              <span className="mr-prob-lbl">{t('mrv.wbg')}</span>
              <span className="mr-prob-val">{probs ? pct(probs[2]) : '—'}</span>
            </div>
            <div className="mr-prob-cell">
              <span className="mr-prob-lbl">{t('mrv.lg')}</span>
              <span className="mr-prob-val">{probs ? pct(probs[4] + probs[5]) : '—'}</span>
            </div>
            <div className="mr-prob-cell">
              <span className="mr-prob-lbl">{t('mrv.lbg')}</span>
              <span className="mr-prob-val">{probs ? pct(probs[5]) : '—'}</span>
            </div>
          </div>

          <div className="mr-cands-head">
            <span className="mr-ch-no">#</span>
            <span className="mr-ch-move">{t('mrv.move')}</span>
            <span className="mr-ch-eq">{t('mrv.equity')}</span>
          </div>
          <div className="mr-cands">
            {(cur?.cands ?? []).map((c, ci) => {
              const diff = c.equity - (cur!.cands![0]?.equity ?? c.equity)
              const isPlayed = ci === playedIdx
              return (
                <button
                  key={ci}
                  className={`mr-cand ${candIdx === ci ? 'sel' : ''} ${isPlayed ? 'played' : ''}`}
                  onClick={() => setCandIdx(ci)}
                >
                  <span className="mr-c-no">{ci + 1}</span>
                  <span className="mr-c-move">{c.notation}</span>
                  <span className="mr-c-eq">
                    {ci === 0 ? `${c.equity >= 0 ? '+' : ''}${c.equity.toFixed(3)}` : `(${diff.toFixed(3)})`}
                  </span>
                </button>
              )
            })}
            {(!cur?.cands || cur.cands.length === 0) && cur?.pos && (
              <div className="mr-empty">{t('mrv.noCands')}</div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
