// ============================================================================
// KIZ TAVLASI — İKİ FAZLI, YALNIZ YZ'ye karşı. GERÇEK tavla tahtası (klasik Board) üzerinde.
// Kural motoru klasik tavladan AYRIDIR (src/kiz/engine, iki fazlı: açma/indirme -> toplama).
//
// Board eşlemesi (beyaz alttadır, flip=false):
//   beyaz KAPALI 1..6 -> tahta index 0..5   (sağ-alt EV; nokta 1..6)     değer +
//   beyaz AÇIK  1..6 -> tahta index 6..11   (sol-alt alan; "indirilmiş")  değer +
//   siyah KAPALI 1..6 -> tahta index 18..23 (sağ-üst EV; nokta 19..24)    değer -
//   siyah AÇIK  1..6 -> tahta index 12..17  (sol-üst alan; "indirilmiş")   değer -
//   toplanan (off) -> bear-off tepsisi.
// Açma fazında pullar EV(sağ)'dan ALAN(sol)'a "iner"; toplama fazında ALAN'dan tepsiye toplanır.
// Kurallar: bkz docs/kiz-tavlasi-kurallari.md + "Nasıl Oynanır?" (birebir aynı).
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import Board from './Board'
import DiceRow from './Dice'
import { useEscape } from './useEscape'
import { Sound } from '../sound'
import type { GameState, Player } from '../engine/types'
import {
  applyRoll,
  endTurn,
  initialState,
  lanesTotal,
  phaseOf,
  playableLanes,
  playableSlots,
  playSlot,
  rollDice,
  TOTAL_CHECKERS,
  type KizPlayer,
  type KizState,
} from '../kiz/engine'
import { aiNextSlot } from '../kiz/ai'
import './KizTavlasi.css'

// laneNo (1..6) -> tahta index (kapalı/açık, oyuncu).
const idx = {
  wClosed: (d: number) => d - 1, // 0..5
  wOpen: (d: number) => d + 5, // 6..11
  bClosed: (d: number) => d + 17, // 18..23
  bOpen: (d: number) => d + 11, // 12..17
}

function kizToBoard(s: KizState): GameState {
  const points = new Array(24).fill(0)
  for (let d = 1; d <= 6; d++) {
    points[idx.wClosed(d)] += s.closed.white[d - 1]
    points[idx.wOpen(d)] += s.open.white[d - 1]
    points[idx.bClosed(d)] -= s.closed.black[d - 1]
    points[idx.bOpen(d)] -= s.open.black[d - 1]
  }
  return {
    points,
    bar: { white: 0, black: 0 },
    off: { white: s.off.white, black: s.off.black },
    turn: s.turn,
    dice: s.dice,
    diceUsed: s.isDouble ? [s.diceUsed[0] ?? false] : s.diceUsed.length ? s.diceUsed : [],
  }
}

export default function KizTavlasi({ onClose }: { onClose: () => void }) {
  useEscape(onClose)
  const [state, setState] = useState<KizState>(() => initialState('white'))
  const [msg, setMsg] = useState<string>('Zar atmak için hazır.')
  const [howto, setHowto] = useState(false)
  const timerRef = useRef<number | null>(null)

  // İNSAN = beyaz (altta), YZ = siyah (üstte). Yalnız YZ'ye karşı.
  const humanTurn = state.turn === 'white' && !state.winner

  const doRoll = useCallback(() => {
    setState((s) => {
      if (s.rolled || s.winner) return s
      const { dice, isDouble } = rollDice()
      const next = applyRoll(s, dice, isDouble)
      Sound.dice()
      if (isDouble) Sound.double()
      return next
    })
  }, [])

  const playLane = useCallback((laneNo: number) => {
    setState((s) => {
      if (s.winner || !s.rolled) return s
      const slot = playableSlots(s).find((i) => s.dice[i] === laneNo)
      if (slot === undefined) return s
      const next = playSlot(s, slot)
      if (next.winner) Sound.win()
      else Sound.move()
      return next
    })
  }, [])

  useEffect(() => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null }
    if (state.winner) return
    if (!state.rolled) {
      // Zar OTOMATİK atılır (hem insan hem YZ) — "Zar At" butonu yok.
      setMsg(state.turn === 'black' ? 'Rakip düşünüyor…' : 'Sıra sende — zar atılıyor…')
      timerRef.current = window.setTimeout(doRoll, state.turn === 'black' ? 850 : 500)
      return
    }
    const slots = playableSlots(state)
    if (slots.length === 0) {
      setMsg('Oynanacak hane yok — sıra geçiyor…')
      timerRef.current = window.setTimeout(() => setState((s) => endTurn(s)), 1150)
      return
    }
    if (state.turn === 'black') {
      setMsg('Rakip oynuyor…')
      timerRef.current = window.setTimeout(() => {
        const slot = aiNextSlot(state)
        if (slot !== null) playLane(state.dice[slot])
      }, 650)
    } else {
      const ph = phaseOf(state, 'white')
      const lanes = playableLanes(state)
      const verb = ph === 'acma' ? 'indir' : 'topla'
      const Verb = ph === 'acma' ? 'İndir' : 'Topla'
      setMsg(
        state.isDouble
          ? `Çift ${state.dice[0]}! ${state.dice[0]} hanesindeki tüm pulları ${verb}.`
          : `${Verb}: ${lanes.join(' veya ')} hanesindeki pul.`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const endedRef = useRef(false)
  useEffect(() => {
    if (state.winner && !endedRef.current) {
      endedRef.current = true
      if (state.winner === 'black') Sound.lose()
    }
    if (!state.winner) endedRef.current = false
  }, [state.winner])

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current) }, [])

  const reset = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    endedRef.current = false
    setState(initialState('white'))
    setMsg('Zar atmak için hazır.')
  }

  const nameFor = (p: KizPlayer) => (p === 'white' ? 'Sen' : 'Bilgisayar')

  // Board tıklama: insan (beyaz) sırasında, aktif faza göre kapalı(ev) veya açık(alan) hanesini oyna.
  const selectableFroms = new Set<number>()
  if (humanTurn && state.rolled) {
    const ph = phaseOf(state, 'white')
    for (const d of playableLanes(state)) selectableFroms.add(ph === 'acma' ? idx.wClosed(d) : idx.wOpen(d))
  }
  const onSelectFrom = (from: number | 'bar') => {
    if (typeof from !== 'number' || !humanTurn || !state.rolled) return
    const ph = phaseOf(state, 'white')
    let d = -1
    if (ph === 'acma' && from >= 0 && from <= 5) d = from + 1
    else if (ph === 'toplama' && from >= 6 && from <= 11) d = from - 5
    if (d >= 1 && d <= 6) playLane(d)
  }

  const faces = state.rolled
    ? state.dice.map((v, i) => ({ value: v, used: state.isDouble ? state.diceUsed[0] : state.diceUsed[i] }))
    : []
  const board = kizToBoard(state)
  const activeBottom = state.turn === 'white'
  const diceRow = faces.length > 0 ? <DiceRow faces={faces} owner={state.turn as Player} /> : null

  // Skor şeridi: her oyuncunun fazı + ilerlemesi.
  const sideInfo = (p: KizPlayer) => {
    const ph = phaseOf(state, p)
    return ph === 'acma'
      ? { tag: 'Açma', prog: `indirilen ${lanesTotal(state.open[p])}/${TOTAL_CHECKERS}` }
      : { tag: 'Toplama', prog: `toplanan ${state.off[p]}/${TOTAL_CHECKERS}` }
  }
  const black = sideInfo('black')
  const white = sideInfo('white')

  return createPortal(
    <div className="app game-view kiz-view" style={{ position: 'fixed', inset: 0, zIndex: 5000 }}>
      <div className="kiz-topbar">
        <div className="kiz-title">
          <Icon name="heart" size={20} weight="fill" /> <b>Kız Tavlası</b>
          <span className="kiz-vs">Bilgisayara Karşı</span>
        </div>
        <button type="button" className="kiz-howto-btn" onClick={() => setHowto((v) => !v)}>
          <Icon name="info" size={16} /> Nasıl Oynanır?
        </button>
        <Button variant="ghost" size="icon" className="kiz-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={18} />
        </Button>
      </div>

      <div className="kiz-scorebar">
        <span className={`kiz-side ${state.turn === 'black' && !state.winner ? 'active' : ''}`}>
          <span className="kiz-dot black" /> {nameFor('black')}
          <em className="kiz-phase">{black.tag}</em>
          <b>{black.prog}</b>
        </span>
        <span className="kiz-turnmsg">{state.winner ? '' : msg}</span>
        <span className={`kiz-side ${state.turn === 'white' && !state.winner ? 'active' : ''}`}>
          <span className="kiz-dot white" /> {nameFor('white')}
          <em className="kiz-phase">{white.tag}</em>
          <b>{white.prog}</b>
        </span>
      </div>

      <main className="main game-scene">
        <div className="game-area">
          <Board
            state={board}
            selectableFroms={selectableFroms}
            targets={new Set()}
            selectedFrom={null}
            onSelectFrom={onSelectFrom}
            onSelectTarget={() => {}}
            onDragFrom={() => {}}
            pipTop={lanesTotal(state.closed.black) + lanesTotal(state.open.black)}
            pipBottom={lanesTotal(state.closed.white) + lanesTotal(state.open.white)}
            cube={{ value: 1, owner: null }}
            flip={false}
            showPip={false}
            centerLeft={activeBottom ? null : diceRow}
            centerRight={activeBottom ? diceRow : null}
          />
        </div>
      </main>

      {howto && (
        <div className="kiz-howto" role="dialog" aria-modal="true" onClick={() => setHowto(false)}>
          <div className="kiz-howto-card" onClick={(e) => e.stopPropagation()}>
            <h3>Kız Tavlası — Nasıl Oynanır?</h3>
            <ul>
              <li>Her oyuncunun kendi 6 hanesi vardır. Başlangıç: 6, 5, 4 hanelerinde <b>üçer</b>; 3, 2, 1 hanelerinde <b>ikişer</b> pul (toplam 15). Pullar başta <b>kapalı</b> (kendi evinde, sağda).</li>
              <li>İki oyuncunun pulları karışmaz: <b>kırma, bar, hane kapatma yoktur</b>. Pullar tahtayı dolaşmaz.</li>
              <li><b>1. Aşama — İndirme (Açma):</b> Zar atarsın; gelen zar hangi haneyse o haneden <b>bir pul indirirsin</b> (kapalıdan açığa, sola geçer). <b>Çift</b> gelirse o hanenin <b>tüm pulları</b> iner. Zarın hanesinde kapalı pul yoksa o zar oynanmaz.</li>
              <li><b>2. Aşama — Toplama:</b> <b>Tüm pulların indikten sonra</b> toplama aşamasına geçilir. Aynı zar kuralıyla, gelen zarın hanesindeki <b>açık pulu toplarsın</b> (tahtadan kalkar). Çift o hanenin tüm açıklarını toplar.</li>
              <li>İki zar da oynanamıyorsa sıra rakibe geçer.</li>
              <li>Pullarını (15) <b>önce toplayan kazanır</b>. Rakip henüz hiç pul toplamadıysa <b>mars</b> (iki kat).</li>
            </ul>
            <Button onClick={() => setHowto(false)}>Anladım</Button>
          </div>
        </div>
      )}

      {state.winner && (
        <div className="kiz-result" role="dialog" aria-modal="true">
          <div className="kiz-result-card">
            <Icon name="trophy" size={34} />
            <h3>{nameFor(state.winner)} kazandı!</h3>
            {state.mars && <div className="kiz-mars">MARS! (iki kat)</div>}
            <div className="kiz-score">
              Sen {state.off.white}/{TOTAL_CHECKERS} · Bilgisayar {state.off.black}/{TOTAL_CHECKERS}
            </div>
            <div className="kiz-result-actions">
              <Button onClick={reset}>Yeniden Oyna</Button>
              <Button variant="ghost" onClick={onClose}>Kapat</Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
