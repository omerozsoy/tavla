// ============================================================================
// KIZ TAVLASI — oynanabilir oyun sayfası (yerel: iki kişi + YZ'ye karşı).
// Klasik tavladan AYRI kural motorunu (src/kiz/engine) kullanır. Tam-ekran overlay
// (createPortal -> body; transformlu ata altında position:fixed kırpılmasın diye, bkz Spectate).
// Kurallar: bkz docs/kiz-tavlasi-kurallari.md + aşağıdaki "Nasıl Oynanır?" (birebir aynı).
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { Die } from './Dice'
import { useEscape } from './useEscape'
import { Sound } from '../sound'
import {
  applyRoll,
  endTurn,
  initialState,
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

// Hane sırası: oyuncunun kendi perspektifinde 6 -> 1 (soldan sağa büyükten küçüğe; tahta gibi).
const LANE_ORDER = [6, 5, 4, 3, 2, 1]

export default function KizTavlasi({ onClose }: { onClose: () => void }) {
  useEscape(onClose)
  const [mode, setMode] = useState<Mode>('ai')
  const [state, setState] = useState<KizState>(() => initialState('white'))
  const [msg, setMsg] = useState<string>('Zar atmak için hazır.')
  const timerRef = useRef<number | null>(null)

  const isAiTurn = mode === 'ai' && state.turn === 'black'
  const humanTurn = !isAiTurn && !state.winner
  const activePlayable = state.rolled && !state.winner ? playableLanes(state) : []

  // Zar at (sıradaki oyuncu için). Ses: zar + çiftse ayrı ses.
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

  // Bir haneyi oyna (o haneye karşılık gelen ilk kullanılmamış zar-slot'unu). Ses: hamle.
  const playLane = useCallback((laneNo: number) => {
    setState((s) => {
      if (s.winner || !s.rolled) return s
      const slots = playableSlots(s)
      const slot = slots.find((i) => s.dice[i] === laneNo)
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
      setMsg(aiTurn ? 'Rakip düşünüyor…' : (state.turn === 'white' ? 'Sıra sende — zar at.' : '2. oyuncu — zar at.'))
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
          : `Topla: ${lanes.join(' veya ')} hanesi.`,
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, mode])

  // Kazanınca ses (kaybeden YZ ise insan için lose çalma — win zaten çaldı playLane'de).
  const endedRef = useRef(false)
  useEffect(() => {
    if (state.winner && !endedRef.current) {
      endedRef.current = true
      // playLane zaten Sound.win çaldı; YZ kazandıysa insana lose hissi.
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
  const changeMode = (m: Mode) => {
    setMode(m)
    reset()
  }

  const [howto, setHowto] = useState(false)

  const nameFor = (p: KizPlayer) =>
    p === 'white' ? 'Sen' : mode === 'ai' ? 'Bilgisayar' : '2. Oyuncu'

  // Bir oyuncunun tek satırı (6 hane). own=alttaki (beyaz) perspektif; clickable yalnız insan sırası.
  const renderRack = (p: KizPlayer) => {
    const lanes = state.lanes[p]
    const clickable = humanTurn && state.turn === p && state.rolled
    return (
      <div className={`kiz-rack ${state.turn === p && !state.winner ? 'active' : ''}`}>
        <div className="kiz-rack-head">
          <span className={`kiz-dot ${p}`} />
          <b>{nameFor(p)}</b>
          <span className="kiz-off">Toplanan {state.off[p]}/{TOTAL_CHECKERS}</span>
        </div>
        <div className="kiz-lanes">
          {LANE_ORDER.map((laneNo) => {
            const count = lanes[laneNo - 1]
            const hot = clickable && activePlayable.includes(laneNo) && count > 0
            return (
              <button
                key={laneNo}
                type="button"
                className={`kiz-lane ${hot ? 'hot' : ''} ${count === 0 ? 'empty' : ''}`}
                disabled={!hot}
                onClick={() => hot && playLane(laneNo)}
                aria-label={`${laneNo}. hane, ${count} pul`}
              >
                <span className="kiz-stack">
                  {Array.from({ length: count }).map((_, i) => (
                    <span key={i} className={`kiz-checker ${p}`} />
                  ))}
                </span>
                <span className="kiz-lane-no">{laneNo}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const dice = state.rolled ? state.dice : []

  return createPortal(
    <div className="app game-view kiz-view" style={{ position: 'fixed', inset: 0, zIndex: 5000 }}>
      <div className="kiz-topbar">
        <div className="kiz-title">
          <Icon name="dice" size={20} /> <b>Kız Tavlası</b>
        </div>
        <div className="kiz-modes">
          <button type="button" className={mode === 'ai' ? 'on' : ''} onClick={() => changeMode('ai')}>
            YZ'ye Karşı
          </button>
          <button type="button" className={mode === 'local' ? 'on' : ''} onClick={() => changeMode('local')}>
            İki Kişi
          </button>
        </div>
        <button type="button" className="kiz-howto-btn" onClick={() => setHowto((v) => !v)}>
          <Icon name="info" size={16} /> Nasıl Oynanır?
        </button>
        <Button variant="ghost" size="icon" className="kiz-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={18} />
        </Button>
      </div>

      <div className="kiz-board">
        {renderRack('black')}

        <div className="kiz-center">
          <div className="kiz-dice">
            {dice.length === 0 ? (
              <span className="kiz-dice-empty">🎲</span>
            ) : (
              dice.map((d, i) => (
                <Die
                  key={i}
                  value={d}
                  owner={state.turn}
                  used={!state.isDouble && state.diceUsed[i]}
                />
              ))
            )}
          </div>
          <div className="kiz-msg">{state.winner ? '' : msg}</div>
          {humanTurn && !state.rolled && (
            <Button className="kiz-roll" onClick={doRoll}>
              🎲 Zar At
            </Button>
          )}
        </div>

        {renderRack('white')}
      </div>

      {howto && (
        <div className="kiz-howto" role="dialog" aria-modal="true" onClick={() => setHowto(false)}>
          <div className="kiz-howto-card" onClick={(e) => e.stopPropagation()}>
            <h3>Kız Tavlası — Nasıl Oynanır?</h3>
            <ul>
              <li>Her oyuncunun kendi 6 hanesi vardır. Başlangıç: 6, 5 ve 4 hanelerinde <b>üçer</b>; 3, 2 ve 1 hanelerinde <b>ikişer</b> pul (toplam 15).</li>
              <li>İki oyuncunun pulları birbirine karışmaz: <b>kırma, bar, hane kapatma yoktur</b>. Pullar tahtayı dolaşmaz.</li>
              <li>Sıran gelince iki zar atarsın. Her zar bir haneyi gösterir: gelen zar hangi haneyse <b>o haneden bir pul toplarsın</b> (kaldırırsın).</li>
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
