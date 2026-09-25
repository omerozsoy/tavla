// ============================================================================
// KIZ TAVLASI — GERÇEK tavla tahtası üzerinde oynanır (klasik Board bileşeni yeniden kullanılır).
// Kural motoru klasik tavladan AYRIDIR (src/kiz/engine). Kız state -> GameState eşlemesi:
//   beyaz 1..6 hanesi  -> tahta index 0..5   (sağ-alt ev; nokta no 1..6)  değer +count
//   siyah 1..6 hanesi  -> tahta index 18..23 (sağ-üst ev; nokta no 19..24) değer -count
// Böylece iki oyuncu da GERÇEK tahtada kendi ev bölgesine dizili görünür; toplanan pullar
// bear-off tepsisinde birikir. Tek tıkla topla (onSelectFrom -> playLane).
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

type Mode = 'local' | 'ai'

// Beyaz alttadır (flip=false). Beyaz evi sağ-alt (nokta 1..6 = index 0..5); siyah evi sağ-üst
// (nokta 19..24 = index 18..23). laneNo (1..6) <-> tahta index dönüşümü:
const laneToIndex = (p: KizPlayer, laneNo: number) => (p === 'white' ? laneNo - 1 : 17 + laneNo)
const indexToLane = (p: KizPlayer, idx: number) => (p === 'white' ? idx + 1 : idx - 17)

// Kız state -> klasik Board'ın beklediği GameState (yalnız GÖRÜNÜM; motor bu tipi kullanmaz).
function kizToBoard(s: KizState): GameState {
  const points = new Array(24).fill(0)
  for (let L = 1; L <= 6; L++) {
    points[laneToIndex('white', L)] = s.lanes.white[L - 1] // +beyaz
    points[laneToIndex('black', L)] = -s.lanes.black[L - 1] // -siyah
  }
  return {
    points,
    bar: { white: 0, black: 0 },
    off: { white: s.off.white, black: s.off.black },
    turn: s.turn,
    dice: s.dice,
    diceUsed: s.isDouble ? [s.diceUsed[0] ?? false] : (s.diceUsed.length ? s.diceUsed : []),
  }
}

export default function KizTavlasi({ onClose }: { onClose: () => void }) {
  useEscape(onClose)
  const [mode, setMode] = useState<Mode>('ai')
  const [state, setState] = useState<KizState>(() => initialState('white'))
  const [msg, setMsg] = useState<string>('Zar atmak için hazır.')
  const [howto, setHowto] = useState(false)
  const timerRef = useRef<number | null>(null)

  const isAiTurn = mode === 'ai' && state.turn === 'black'
  const humanTurn = !isAiTurn && !state.winner
  const activePlayable = state.rolled && !state.winner ? playableLanes(state) : []

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

  // Otomatik ilerleme: hamlesiz turu geçir + YZ turunu adım adım oynat.
  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (state.winner) return
    const aiTurn = mode === 'ai' && state.turn === 'black'
    if (!state.rolled) {
      setMsg(aiTurn ? 'Rakip düşünüyor…' : state.turn === 'white' ? 'Sıra sende — zar at.' : '2. oyuncu — zar at.')
      if (aiTurn) timerRef.current = window.setTimeout(doRoll, 850)
      return
    }
    const slots = playableSlots(state)
    if (slots.length === 0) {
      setMsg('Oynanacak hane yok — sıra geçiyor…')
      timerRef.current = window.setTimeout(() => setState((s) => endTurn(s)), 1150)
      return
    }
    if (aiTurn) {
      setMsg('Rakip oynuyor…')
      timerRef.current = window.setTimeout(() => {
        const slot = aiNextSlot(state)
        if (slot !== null) playLane(state.dice[slot])
      }, 650)
    } else {
      const lanes = playableLanes(state)
      setMsg(
        state.isDouble
          ? `Çift ${state.dice[0]}! ${state.dice[0]} hanesindeki tüm pulları topla.`
          : `Topla: ${lanes.join(' veya ')} hanesindeki pul.`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode])

  const endedRef = useRef(false)
  useEffect(() => {
    if (state.winner && !endedRef.current) {
      endedRef.current = true
      if (mode === 'ai' && state.winner === 'black') Sound.lose()
    }
    if (!state.winner) endedRef.current = false
  }, [state.winner, mode])

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current) }, [])

  const reset = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    endedRef.current = false
    setState(initialState('white'))
    setMsg('Zar atmak için hazır.')
  }
  const changeMode = (m: Mode) => { setMode(m); reset() }

  const nameFor = (p: KizPlayer) => (p === 'white' ? 'Sen' : mode === 'ai' ? 'Bilgisayar' : '2. Oyuncu')

  // Board etkileşimi: tıklanan nokta -> hane -> topla. Yalnız insan sırasında + oynanabilir hane.
  const selectableFroms = new Set<number>()
  if (humanTurn && state.rolled) {
    for (const L of activePlayable) selectableFroms.add(laneToIndex(state.turn, L))
  }
  const onSelectFrom = (from: number | 'bar') => {
    if (typeof from !== 'number' || !humanTurn || !state.rolled) return
    const laneNo = indexToLane(state.turn, from)
    if (laneNo >= 1 && laneNo <= 6) playLane(laneNo)
  }

  // Zar yüzleri (klasik oyundaki gibi kullanılınca solar). Çiftte iki yüz birlikte solar.
  const faces = state.rolled
    ? state.dice.map((v, i) => ({ value: v, used: state.isDouble ? state.diceUsed[0] : state.diceUsed[i] }))
    : []
  const board = kizToBoard(state)
  const activeBottom = state.turn === 'white' // beyaz alttadır
  const diceRow = faces.length > 0 ? <DiceRow faces={faces} owner={state.turn as Player} /> : null

  return createPortal(
    <div className="app game-view kiz-view" style={{ position: 'fixed', inset: 0, zIndex: 5000 }}>
      <div className="kiz-topbar">
        <div className="kiz-title">
          <Icon name="dice" size={20} /> <b>Kız Tavlası</b>
        </div>
        <div className="kiz-modes">
          <button type="button" className={mode === 'ai' ? 'on' : ''} onClick={() => changeMode('ai')}>YZ'ye Karşı</button>
          <button type="button" className={mode === 'local' ? 'on' : ''} onClick={() => changeMode('local')}>İki Kişi</button>
        </div>
        <button type="button" className="kiz-howto-btn" onClick={() => setHowto((v) => !v)}>
          <Icon name="info" size={16} /> Nasıl Oynanır?
        </button>
        <Button variant="ghost" size="icon" className="kiz-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={18} />
        </Button>
      </div>

      {/* Skor şeridi: iki oyuncunun topladığı + sıra/mesaj */}
      <div className="kiz-scorebar">
        <span className={`kiz-side ${state.turn === 'black' && !state.winner ? 'active' : ''}`}>
          <span className="kiz-dot black" /> {nameFor('black')}
          <b>{state.off.black}/{TOTAL_CHECKERS}</b>
        </span>
        <span className="kiz-turnmsg">{state.winner ? '' : msg}</span>
        <span className={`kiz-side ${state.turn === 'white' && !state.winner ? 'active' : ''}`}>
          <span className="kiz-dot white" /> {nameFor('white')}
          <b>{state.off.white}/{TOTAL_CHECKERS}</b>
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
            pipTop={lanesTotal(state.lanes.black)}
            pipBottom={lanesTotal(state.lanes.white)}
            cube={{ value: 1, owner: null }}
            flip={false}
            showPip={false}
            centerLeft={activeBottom ? null : diceRow}
            centerRight={activeBottom ? diceRow : null}
          />
        </div>
      </main>

      {humanTurn && !state.rolled && (
        <div className="kiz-rollbar">
          <Button className="kiz-roll" onClick={doRoll}>🎲 Zar At</Button>
        </div>
      )}

      {howto && (
        <div className="kiz-howto" role="dialog" aria-modal="true" onClick={() => setHowto(false)}>
          <div className="kiz-howto-card" onClick={(e) => e.stopPropagation()}>
            <h3>Kız Tavlası — Nasıl Oynanır?</h3>
            <ul>
              <li>Her oyuncunun kendi 6 hanesi vardır. Başlangıç: 6, 5 ve 4 hanelerinde <b>üçer</b>; 3, 2 ve 1 hanelerinde <b>ikişer</b> pul (toplam 15).</li>
              <li>İki oyuncunun pulları birbirine karışmaz: <b>kırma, bar, hane kapatma yoktur</b>. Pullar tahtayı dolaşmaz.</li>
              <li>Sıran gelince iki zar atarsın. Her zar bir haneyi gösterir: gelen zar hangi haneyse <b>o haneden bir pul toplarsın</b>.</li>
              <li><b>Çift</b> atarsan (örn. 5-5), o hanedeki <b>tüm pullar</b> birden toplanır.</li>
              <li>Zarın gösterdiği hane <b>boşsa o zar oynanmaz</b>. İki zar da boşsa sıra rakibe geçer.</li>
              <li>Pullarını <b>önce bitiren kazanır</b>. Rakip henüz hiç pul toplamadıysa <b>mars</b> (iki kat) olur.</li>
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
              Sen {state.off.white}/{TOTAL_CHECKERS} · {nameFor('black')} {state.off.black}/{TOTAL_CHECKERS}
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
