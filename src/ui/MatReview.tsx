import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import Board from './Board'
import DiceRow, { Die } from './Dice'
import { useBoardDir } from './boardDirection'
import { useSwapStones } from './pieceColors'
import { pipCount } from '../engine/evaluate'
import { applyStep } from '../engine/moves'
import { divisionOfPR } from '../badges'
import MatchSummary from './MatchSummary'
import type { LogEntry } from './MatchReport'
import type { GameState, Step, Player } from '../engine/types'

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
    // "(no move)" artık pos taşır (tahta gösterimi için) ama ZORUNLU non-karardır -> sayma;
    // yoksa payda şişip erMemg/XR (PR) yanlış düşerdi.
    const es = log.filter((e) => e.pos && e.player === c && !e.cube && e.notation !== '(no move)')
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
  luck,
  onClose,
}: {
  log: LogEntry[]
  names: string[] | null
  matchLength: number | null
  summary?: MatSummary | null
  luck?: import('../api').MatReview['luck'] // gnubg şansı (p0=beyaz, p1=siyah); yoksa '—'
  currentName?: string
  onClose: () => void
}) {
  const { t } = useT()
  useEscape(onClose)
  const [showSum, setShowSum] = useState(!!summary)
  const [summaryOpen, setSummaryOpen] = useState(false)
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

  // Küp kararı (double/take/drop) ve "(no move)" girdileri backend'de tahta konumu OLMADAN
  // üretilir -> tahta kaybolurdu. O anki tahtayı yine de göster: küp/no-move tahtayı DEĞİŞTİRMEZ,
  // yani aynı oyundaki BİR SONRAKİ hamlenin "önce" pozisyonu = bu kararın anındaki tahtadır.
  // Sonraki hamle yoksa (oyun-sonu drop) ÖNCEKİ hamlenin adımlarını uygulayıp SONRA konumunu türet.
  const boardPos = (() => {
    if (cur?.pos) return cur.pos
    if (!cur) return null
    for (let j = sel + 1; j < log.length; j++) {
      const n = log[j]
      if (n.game !== cur.game) break
      if (n.pos) return n.pos
    }
    for (let k = sel - 1; k >= 0; k--) {
      const p = log[k]
      if (p.game !== cur.game) break
      if (p.pos && p.playedSteps && p.player) {
        const st: GameState = {
          points: [...p.pos.points], bar: { ...p.pos.bar }, off: { ...p.pos.off },
          turn: p.player as GameState['turn'], dice: [], diceUsed: [],
        }
        for (const s of p.playedSteps) applyStep(st, s, p.player as Player)
        return { points: st.points, bar: st.bar, off: st.off } as GameState
      }
    }
    return null
  })()

  // Gerçek Board için: GameState + seçili hamlenin kaynak/hedef vurgusu + zar satırı.
  const boardState: GameState | null = boardPos
    ? { points: boardPos.points, bar: boardPos.bar, off: boardPos.off,
        turn: (cur?.player ?? boardPos.turn ?? 'white') as GameState['turn'], dice: cur?.dice ?? [], diceUsed: [] }
    : null

  // Tahtadaki küp: backend pos'a küp iliştirirse onu kullan; yoksa bu oyunun küp geçmişini
  // tekrar oynat (kabul edilen her "take" -> ×2, sahip=alıcı). Böylece küp kararında + double
  // sonrası hamlelerde tahtada doğru küp görünür.
  const cubeForBoard: { value: number; owner: Player | null } = (() => {
    const pc = (boardPos as unknown as { cube?: { value?: number; owner?: Player | null } } | null)?.cube
    if (pc && pc.value) return { value: pc.value, owner: pc.owner ?? null }
    let value = 1
    let owner: Player | null = null
    for (let j = 0; j < sel; j++) {
      const e = log[j]
      if (e.game !== cur?.game) continue
      if (e.cube?.chosen === 'take' && e.player) {
        value *= 2
        owner = e.player as Player
      }
    }
    return { value, owner }
  })()
  const froms = new Set<number | 'bar'>()
  const tos = new Set<number | 'off'>()
  for (const s of viewSteps) {
    froms.add(s.from)
    tos.add(s.to)
  }
  const diceFaces = (cur?.dice ?? []).slice(0, 4).map((v) => ({ value: v, used: false }))
  const diceRow =
    boardState && cur?.player && diceFaces.length ? <DiceRow faces={diceFaces} owner={cur.player} /> : null
  const whiteBottom = cur?.player === 'white' // beyaz altta (tahta DÖNMEZ; yalnız numaralar perspektifli)

  // Küp ÇEKME (double) girdisinde: küpü çeken oyuncudan rakibine (küpün önerildiği kişi)
  // doğru kibar bir ok. Tahta hep beyaz altta / siyah üstte (flip yok); alıcı = çekenin
  // rakibi -> beyaz çekince alıcı siyah (üst) = ok YUKARI, siyah çekince alıcı beyaz (alt) = AŞAĞI.
  const cubeArrowDir: 'up' | 'down' | null =
    cur?.cube?.chosen === 'double' && cur?.player ? (cur.player === 'white' ? 'up' : 'down') : null

  // Tam-ekran: transform'lu ata (register-overlay.page) position:fixed'i kırpıyor ->
  // XG-tarzı MAÇ ÖZETİ (üst bar): oyuncular SATIR, metrikler SÜTUN -> geniş, alçak (3 kısa satır).
  const xgSum = summary ?? computeSummary(log, names, 0)
  const xgP = xgSum.players
  const xgErr = (p: MatSummaryPlayer) => `${p.blunders + p.errors + p.inaccuracies} (${p.blunders})`
  const xgLuck = (x?: { mwc: number | null; jokers: number | null } | null) =>
    x && x.mwc != null
      ? `${x.mwc >= 0 ? '+' : ''}${x.mwc.toFixed(2)}${x.jokers != null ? ` (${x.jokers})` : ''}`
      : '—'
  const xgRow = (p: MatSummaryPlayer, x?: { mwc: number | null; jokers: number | null } | null, name?: string) => (
    <>
      <span className="mrv-xgb-name">{name}</span>
      <span>{xgErr(p)}</span>
      <span>−{p.equityLost.toFixed(3)}</span>
      <span>{xgLuck(x)}</span>
      <span>{p.xr.toFixed(2)}</span>
      <span className="mrv-xgb-cls">{t(divisionOfPR(p.xr).key)}</span>
    </>
  )

  // body'ye portal ile taşı (bkz fixed-portal-transform-tuzagi). Hesap barını da kaplar.
  return createPortal(
    <div className="mrv-overlay">
      {summaryOpen && (
        <MatchSummary
          log={log}
          names={names}
          matchLength={matchLength}
          luck={luck ? { white: luck.p0, black: luck.p1 } : undefined}
          onClose={() => setSummaryOpen(false)}
        />
      )}

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
                  <button
                    className={`mrv-row ${sel === i ? 'sel' : ''}`}
                    onClick={() => select(i)}
                    /* Küp kararı + "(no move)" (zar var, hamle yok) da tıklanabilir: tahta + zar/küp
                       gösterilir (pos yoksa komşu hamleden ölçülür). Yalnız tamamen boş satır pasif. */
                    disabled={!e.pos && !e.cube && !(e.dice && e.dice.length)}
                  >
                    <span className={`mrv-dot ${b}`} />
                    <span className="mrv-no">{i + 1}.</span>
                    {e.dice && e.dice.length >= 2 && e.player ? (
                      // Oyuncuya göre RENKLİ zar (beyaz oyuncu=açık, siyah oyuncu=koyu) ->
                      // benim hamlelerim ile rakibinki AYNI renk olmaz. Board'daki Die ile aynı.
                      <span className="mrv-dice">
                        <Die value={e.dice[0]} owner={e.player} used={false} />
                        <Die value={e.dice[1]} owner={e.player} used={false} />
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
          {/* Üst bar ORTA sütunda: XG özeti + Maç Özeti + kapat. Sol/sağ listeler en tepeden başlar. */}
          <div className="mrv-top">
            {xgP && xgP.length >= 2 ? (
              <div className="mrv-xgbar" title={t('mrv.title') + (matchLength ? ` · ${t('ma.pointMatch', { n: matchLength })}` : '')}>
                <span className="mrv-xgb-h" />
                <span className="mrv-xgb-h">{t('mrv.miniErr')}</span>
                <span className="mrv-xgb-h">{t('mrv.miniEq')}</span>
                <span className="mrv-xgb-h">{t('mrv.miniLuck')}</span>
                <span className="mrv-xgb-h">{t('mrv.xr')}</span>
                <span className="mrv-xgb-h">{t('mrv.miniClass')}</span>
                {xgRow(xgP[0], luck?.p0, nameW)}
                {xgRow(xgP[1], luck?.p1, nameB)}
              </div>
            ) : (
              <span className="mrv-title">
                <Icon name="analyze" size={18} /> {t('mrv.title')}
                {matchLength ? ` · ${t('ma.pointMatch', { n: matchLength })}` : ''}
              </span>
            )}
            <div className="mrv-top-actions">
              <Button variant="outline" className="mrv-summary-btn" onClick={() => setSummaryOpen(true)}>
                <Icon name="chart" size={15} /> {t('ms.btn')}
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('common.close')}>
                <Icon name="x" size={18} />
              </Button>
            </div>
          </div>
          <div className="mrv-player mrv-player-top">
            <span className="mrv-score">{matchLength ? `0/${matchLength}` : ''}</span>
            <span className={`mrv-pname ${cur?.player === 'black' ? 'turn' : ''}`}>
              {cur?.player === 'black' && <span className="mrv-turn">▶</span>}
              {nameB}
            </span>
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
                cube={cubeForBoard}
                flip={false}
                numberFrom={cur?.player ?? 'white'}
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
              {/* Küp çekildiyse: küpten alıcıya (rakibe) doğru kibar ok. */}
              {cubeArrowDir && <CubeArrow dir={cubeArrowDir} dep={`${sel}:${boardDir}:${cubeArrowDir}`} />}
            </div>
          ) : (
            <div className="mrv-noboard">{t('mrv.selectMove')}</div>
          )}

          <div className="mrv-player mrv-player-bot">
            <span className="mrv-score">{matchLength ? `0/${matchLength}` : ''}</span>
            <span className={`mrv-pname ${cur?.player === 'white' ? 'turn' : ''}`}>
              {cur?.player === 'white' && <span className="mrv-turn">▶</span>}
              {nameW}
            </span>
          </div>
        </main>

        {/* ---- SAĞ: analiz (küp kararında küp analizi, aksi halde hamle analizi) ---- */}
        <aside className="mrv-analysis">
          <div className="mrv-ply">{t('mrv.ply', { n: 2 })}</div>
          {cur?.cube ? (
            <CubeAnalysis cube={cur.cube} />
          ) : (
          <>
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
            <span className="mrv-ch-loss">{t('mrv.loss')}</span>
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
                  <span className="mrv-c-move">
                    {/* Oynanan hamle rozeti notasyonun ÜSTÜNDE (çakışmasın); ikisi de "Oynanan Hamle". */}
                    {isPlayed && <span className="mrv-c-you">{t('mrv.playedMove')}</span>}
                    {c.notation}
                  </span>
                  {/* İki sütun: MUTLAK equity (her satır) + KAYIP (en iyiye göre; #1 = —) */}
                  <span className="mrv-c-eq">{`${c.equity >= 0 ? '+' : ''}${c.equity.toFixed(3)}`}</span>
                  <span className="mrv-c-loss">{ci === 0 ? '—' : `−${(-diff).toFixed(3)}`}</span>
                </button>
              )
            })}
            {/* OYNANAN HAMLE top-8'de değilse (blunder), listenin ALTINA ayrı satır olarak ekle ki
                sağ panelde de "ne oynandı + ne kadar kaybettirdi" görünsün. Tıklayınca board'da o
                hamlenin okları (candIdx=-1 -> playedSteps). */}
            {playedIdx < 0 && cur?.notation && !cur?.cube && (cur?.cands?.length ?? 0) > 0 && (
              <button
                className={`mrv-cand played mrv-cand-extra ${candIdx < 0 ? 'sel' : ''}`}
                onClick={() => setCandIdx(-1)}
              >
                <span className="mrv-c-no">–</span>
                <span className="mrv-c-move">
                  <span className="mrv-c-you">{t('mrv.playedMove')}</span>
                  {cur.notation}
                </span>
                <span className="mrv-c-eq">
                  {(() => { const eq = (cur.cands?.[0]?.equity ?? 0) - (cur.loss ?? 0); return `${eq >= 0 ? '+' : ''}${eq.toFixed(3)}` })()}
                </span>
                <span className="mrv-c-loss">−{(cur.loss ?? 0).toFixed(3)}</span>
              </button>
            )}
            {(!cur?.cands || cur.cands.length === 0) && cur?.pos && (
              <div className="mrv-empty">{t('mrv.noCands')}</div>
            )}
          </div>
          </>
          )}
        </aside>
      </div>

      {/* ---- Açılış özet popup'ı ("Analiz Tamamlandı") ---- */}
      {summary && showSum && <SummaryPopup summary={summary} names={names} onClose={() => setShowSum(false)} />}
    </div>,
    document.body,
  )
}

// Hamle okları: seçili hamlenin her adımını (kaynak -> hedef) tahtanın üstüne çizer.
// "Hamle Analizi" (MiniBoard) ile AYNI ok stili: parlak altın çekirdek + koyu casing +
// zarif chevron uç + sıra numarası rozeti. Renkler MiniBoard ile birebir (tema-bağımsız;
// casing her boardda seçtirir). Nokta/bar/off GERÇEK ekran konumları ÖLÇÜLÜR (flip/mirror/
// tema/pul-rengi fark etmez); Board'a dokunmadan salt-okuma overlay. Boyutlar noktanın
// ölçülen genişliğinden (R = COL_W*0.43) MiniBoard oranlarıyla türetilir.
const ARROW = '#d8a878' // HedgeHog şeftali: ok gövdesi/uç dolgusu
const ARROW_EDGE = '#a9743f' // hafif koyu şeftali kenar (tanım için ince kontur)
const GHOST_FILL = 'rgba(216,168,120,0.26)' // hedef hanedeki hayalet pul dolgusu
const GHOST_RING = 'rgba(216,168,120,0.82)' // hayalet pul halkası
type ArrowSeg = { x1: number; y1: number; x2: number; y2: number; lane: number }

// HedgeHog tarzı EĞRİ + UCA DOĞRU İNCELEN dolu ok: kaynak (geniş taban) -> hedef (sivri uç).
// Nokta merkezleri ölçülür; buradan quadratic-bezier orta çizgi + perpendiküler genişlikle
// dolu bir "şerit" gövde + üçgen uç üretilir. lane: aynı kaynak-hedef çiftinde (çift zar)
// okları yelpaze gibi ayırmak için (üst üste binmesin).
function arrowPath(s: ArrowSeg, r: number): string {
  const { x1, y1, x2, y2, lane } = s
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const px = -uy // perpendiküler birim
  const py = ux
  const bend = len * 0.12 + lane * r * 2.4 // orta çizgi yayı (+ yelpaze ofseti)
  const cx = (x1 + x2) / 2 + px * bend
  const cy = (y1 + y2) / 2 + py * bend
  const sx = x1 + ux * r * 0.1 // kaynağın hemen dışından başla
  const sy = y1 + uy * r * 0.1
  let ex = x2 - cx // uçtaki teğet (kontrol -> hedef)
  let ey = y2 - cy
  const el = Math.hypot(ex, ey) || 1
  ex /= el
  ey /= el
  const epx = -ey // uçta perpendiküler
  const epy = ex
  // İNCE + KİBAR ok (renk/opaklık aynı): gövde ve ok-başı yarı-genişlikleri kısıldı; uca doğru
  // daha zarif incelen bir siluet. (Eski: headW 0.95 / wB 0.48 / wN 0.16 -> kalın/iri dururdu.)
  const headLen = r * 1.3
  const headW = r * 0.55 // ok-başı yarı-genişliği (daha zarif, iri değil)
  const tipx = x2 - ex * r * 0.55 // uç, hayalet pulun kenarına değsin (ortasını kapatmasın)
  const tipy = y2 - ey * r * 0.55
  const nx = tipx - ex * headLen // boyun (üçgen ucun tabanı)
  const ny = tipy - ey * headLen
  const wB = r * 0.28 // taban yarı-genişliği (ince gövde)
  const wN = r * 0.075 // boyun yarı-genişliği (uca doğru inceden incelir)
  const aL = `${sx + px * wB},${sy + py * wB}`
  const aR = `${sx - px * wB},${sy - py * wB}`
  const cL = `${cx + px * wB * 0.55},${cy + py * wB * 0.55}`
  const cR = `${cx - px * wB * 0.55},${cy - py * wB * 0.55}`
  const nL = `${nx + epx * wN},${ny + epy * wN}`
  const nR = `${nx - epx * wN},${ny - epy * wN}`
  const hL = `${nx + epx * headW},${ny + epy * headW}`
  const hR = `${nx - epx * headW},${ny - epy * headW}`
  return `M${aL} Q${cL} ${nL} L${hL} L${tipx},${tipy} L${hR} L${nR} Q${cR} ${aR} Z`
}

export function MoveArrows({ steps, dep }: { steps: Step[]; dep: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [segs, setSegs] = useState<ArrowSeg[]>([])
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [r, setRad] = useState(10) // taş yarıçapı ~ (MiniBoard R eşdeğeri)

  useLayoutEffect(() => {
    const host = hostRef.current
    const stage = host?.parentElement
    const board = stage?.querySelector('.board') as HTMLElement | null
    if (!host || !stage || !board) {
      setSegs([])
      return
    }
    const measure = () => {
      const sr = stage.getBoundingClientRect()
      // Taş yarıçapı (MiniBoard oranı: kolon genişliği * 0.43) — ok kalınlığı + hayalet pul.
      const p0 = board.querySelector('[data-point="0"]') as HTMLElement | null
      const colW = p0 ? p0.getBoundingClientRect().width : 24
      const rad = Math.max(5, colW * 0.43)
      // Hamleyi yapan oyuncunun rengi: bardaki KIRIK TASI ve yigin yonunu dogru secmek icin.
      // Nokta-kaynakli bir adimin ust tasindan (mover'in tasi) rengi oku (tahta hamleden ONCEKI
      // konumu gosterir; kaynak hanenin tepesindeki tas = oynatilacak tas).
      let moverColor: 'white' | 'black' | null = null
      for (const s of steps) {
        if (typeof s.from === 'number') {
          const pe = board.querySelector(`[data-point="${s.from}"]`)
          const ck = pe?.querySelector('.checker.white, .checker.black') as HTMLElement | null
          if (ck) {
            moverColor = ck.classList.contains('white') ? 'white' : 'black'
            break
          }
        }
      }
      const rectXY = (rc: DOMRect) => ({ x: rc.left + rc.width / 2 - sr.left, y: rc.top + rc.height / 2 - sr.top })
      // Bir hanenin (nokta) GERCEK ok konumu: pullar DIS kenardan ice dogru dizilir.
      //  - Dolu hane -> yigin TEPESINDEKI (son cocuk) pulun merkezi. Kaynakta bu, oynatilan
      //    tasin ta kendisi; hedefte ise tasin konacagi ust nokta ("doluysa en uste isaret et").
      //  - Bos hane (yalniz hedef) -> DIS kenar/taban ("bossa en alta"): ust hanede ust-kenar+r,
      //    alt hanede alt-kenar-r (ilk pulun oturacagi yer). Boylece ok havadan cikmaz.
      const anchorPoint = (el: Element): { x: number; y: number } => {
        const checkers = el.querySelectorAll('.checker')
        if (checkers.length) {
          const inner = checkers[checkers.length - 1] as HTMLElement // yigin tepesi = son cocuk
          return rectXY(inner.getBoundingClientRect())
        }
        const rc = el.getBoundingClientRect()
        const x = rc.left + rc.width / 2 - sr.left
        const isTop = (el as HTMLElement).classList.contains('top')
        const y = isTop ? rc.top - sr.top + rad : rc.bottom - sr.top - rad
        return { x, y }
      }
      // Bardaki KIRIK TAS: bar-slotu ORTASI degil, hamleyi yapan rengin gercek bar tasinin merkezi.
      const barAnchor = (): { x: number; y: number } | null => {
        let ck: HTMLElement | null = moverColor
          ? (board.querySelector(`.bar-checkers .checker.${moverColor}`) as HTMLElement | null)
          : null
        if (!ck) ck = board.querySelector('.bar-checkers .checker') as HTMLElement | null
        if (ck) return rectXY(ck.getBoundingClientRect())
        const bar = board.querySelector('[data-slot="bar"]')
        return bar ? rectXY(bar.getBoundingClientRect()) : null
      }
      const offAnchor = (fromY: number | null): { x: number; y: number } | null => {
        const trays = Array.from(board.querySelectorAll('.bearoff'))
        let tray: Element | null = trays[0] ?? null
        if (trays.length > 1 && fromY != null) {
          // Bearing off -> kaynaga en yakin tepsi (ev tahtasi tarafi).
          let bd = Infinity
          for (const tr of trays) {
            const rc = tr.getBoundingClientRect()
            const cy = rc.top + rc.height / 2 - sr.top
            const d = Math.abs(cy - fromY)
            if (d < bd) {
              bd = d
              tray = tr
            }
          }
        }
        return tray ? rectXY(tray.getBoundingClientRect()) : null
      }
      const anchorFor = (p: number | 'bar' | 'off', fromY: number | null): { x: number; y: number } | null => {
        if (p === 'bar') return barAnchor()
        if (p === 'off') return offAnchor(fromY)
        const el = board.querySelector(`[data-point="${p}"]`)
        return el ? anchorPoint(el) : null
      }
      // "Hamle Analizi" gibi: adımları SIRAYLA numaralandır (birleştirme yok; çift hamlede
      // aynı yere iki numaralı ok — MiniBoard ile aynı davranış).
      const out: ArrowSeg[] = []
      steps.forEach((s) => {
        const a = anchorFor(s.from, null)
        if (!a) return
        const b = anchorFor(s.to, a.y)
        if (!b) return
        out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, lane: 0 })
      })
      // Aynı kaynak-hedef çiftini paylaşan oklar (çift zar: 8/4*(2) gibi) BİREBİR üst üste
      // biner -> tek ok görünür. Grup üyelerini yelpaze gibi ayır (lane ofseti eğriyi kaydırır).
      const groups = new Map<string, number[]>()
      out.forEach((s, idx) => {
        const k = `${Math.round(s.x1)},${Math.round(s.y1)}>${Math.round(s.x2)},${Math.round(s.y2)}`
        const arr = groups.get(k)
        if (arr) arr.push(idx)
        else groups.set(k, [idx])
      })
      for (const idxs of groups.values()) {
        if (idxs.length < 2) continue
        idxs.forEach((idx, j) => {
          out[idx].lane = j - (idxs.length - 1) / 2
        })
      }
      setRad(rad)
      setSize({ w: sr.width, h: sr.height })
      setSegs(out)
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
      {segs.length > 0 && size.w > 0 && (
        <svg className="mrv-arrows" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
          {/* 1) HAYALET PUL: taşın gideceği hedef haneyi yarı-saydam disk ile göster (HedgeHog). */}
          {segs.map((s, i) => (
            <circle
              key={'g' + i}
              cx={s.x2}
              cy={s.y2}
              r={r * 0.96}
              fill={GHOST_FILL}
              stroke={GHOST_RING}
              strokeWidth={Math.max(1, r * 0.12)}
            />
          ))}
          {/* 2) EĞRİ + UCA DOĞRU İNCELEN ŞEFTALİ OK: kaynak -> hayalet pul. */}
          {segs.map((s, i) => (
            <path
              key={i}
              d={arrowPath(s, r)}
              fill={ARROW}
              fillOpacity={0.9}
              stroke={ARROW_EDGE}
              strokeWidth={Math.max(0.5, r * 0.035)}
              strokeLinejoin="round"
            />
          ))}
        </svg>
      )}
    </div>
  )
}

// Küp oku: küp ÇEKİLDİĞİNDE (double) tahtadaki küpten alıcıya (rakibe) doğru kibar bir ok.
// Küpün GERÇEK ekran konumu (.cube) ölçülür; ok, küpün alıcıya bakan kenarından çıkıp o yöne
// (yukarı=siyah/üst oyuncu, aşağı=beyaz/alt oyuncu) uzanır. "64" sayısı görünür kalsın diye
// küpün ortasından değil kenarından başlar. Stil MoveArrows ile aynı (altın çekirdek + koyu casing).
function CubeArrow({ dir, dep }: { dir: 'up' | 'down'; dep: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [seg, setSeg] = useState<{ x: number; y1: number; y2: number } | null>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [r, setRad] = useState(12)

  useLayoutEffect(() => {
    const host = hostRef.current
    const stage = host?.parentElement
    const board = stage?.querySelector('.board') as HTMLElement | null
    const cube = board?.querySelector('.cube') as HTMLElement | null
    if (!host || !stage || !board || !cube) {
      setSeg(null)
      return
    }
    const measure = () => {
      const sr = stage.getBoundingClientRect()
      const cr = cube.getBoundingClientRect()
      const cx = cr.left + cr.width / 2 - sr.left
      const topY = cr.top - sr.top
      const botY = cr.bottom - sr.top
      const h = cr.height
      const rad = Math.max(7, h * 0.44)
      const gap = h * 0.22
      const len = h * 1.7
      const y1 = dir === 'up' ? topY - gap : botY + gap // küpün alıcıya bakan kenarı
      const y2 = dir === 'up' ? y1 - len : y1 + len
      setRad(rad)
      setSize({ w: sr.width, h: sr.height })
      setSeg({ x: cx, y1, y2 })
    }
    measure()
    const raf = requestAnimationFrame(measure)
    const ro = new ResizeObserver(measure)
    ro.observe(board)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])

  const ah = r * 0.9 // daha ince/kibar ok-başı (MoveArrows ile uyumlu)
  return (
    <div ref={hostRef} className="mrv-arrows-host" aria-hidden="true">
      {seg && size.w > 0 && (
        <svg className="mrv-arrows" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}>
          <defs>
            <marker
              id="mrv-cah"
              viewBox="0 0 11 11"
              markerUnits="userSpaceOnUse"
              markerWidth={ah}
              markerHeight={ah}
              refX="8.4"
              refY="5.5"
              orient="auto"
            >
              <path d="M1.6,1.4 L9,5.5 L1.6,9.6 L3.9,5.5 Z" fill={ARROW} stroke={ARROW_EDGE} strokeWidth="0.9" strokeLinejoin="round" />
            </marker>
          </defs>
          {/* koyu casing (ince) */}
          <line x1={seg.x} y1={seg.y1} x2={seg.x} y2={seg.y2} stroke={ARROW_EDGE} strokeWidth={r * 0.30} strokeLinecap="round" opacity={0.7} />
          {/* parlak çekirdek + zarif uç (ince) */}
          <line x1={seg.x} y1={seg.y1} x2={seg.x} y2={seg.y2} stroke={ARROW} strokeWidth={r * 0.13} strokeLinecap="round" markerEnd="url(#mrv-cah)" />
        </svg>
      )}
    </div>
  )
}

// Küp analizi paneli (sağ sütun): küp kararında XG-benzeri aksiyon equity tablosu
// (Katlama yok / Katla,Pas / Katla,Kabul) + doğru aksiyon vurgusu + kazanma% + oynananın kaybı.
function CubeAnalysis({ cube }: { cube: NonNullable<LogEntry['cube']> }) {
  const { t } = useT()
  const eqs = cube.equities || {}
  const rows: Array<{ k: 'noDouble' | 'doublePass' | 'doubleTake'; lbl: string }> = [
    { k: 'noDouble', lbl: t('mrv.cActNoDouble') },
    { k: 'doublePass', lbl: t('mrv.cActDoublePass') },
    { k: 'doubleTake', lbl: t('mrv.cActDoubleTake') },
  ]
  const fmt = (v: number | undefined) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(3)}`)
  return (
    <div className="mrv-cube">
      <div className="mrv-cube-title">{cube.isResponse ? t('mrv.cResponse') : t('mrv.cOffer')}</div>
      <div className="mrv-cube-win">
        <span>{t('mrv.win')}</span>
        <b>{cube.win != null ? `${cube.win.toFixed(1)}%` : '—'}</b>
      </div>
      <div className="mrv-cube-eqs">
        {rows.map(({ k, lbl }) => {
          const best = cube.highlight === k
          return (
            <div key={k} className={`mrv-cube-eq ${best ? 'best' : ''}`}>
              <span className="mrv-ce-lbl">{lbl}</span>
              <span className="mrv-ce-val">{fmt(eqs[k])}</span>
              {best ? <Icon name="check" size={13} /> : <span className="mrv-ce-sp" />}
            </div>
          )
        })}
      </div>
      <div className={`mrv-cube-verdict ${cube.correct ? 'ok' : 'bad'}`}>
        <span className="mrv-cv-played">
          {t('mrv.cPlayed')}: {t(`cube.chose.${cube.chosen}`)}
        </span>
        <span className="mrv-cv-tag">
          {cube.correct ? (
            <>
              <Icon name="check" size={13} /> {t('cube.correct')}
            </>
          ) : (
            <>
              {t('cube.wrong')} · −{(cube.loss ?? 0).toFixed(3)}
            </>
          )}
        </span>
      </div>
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
