import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import Loading from './Loading'
import { useEscape } from './useEscape'
import Board from './Board'
import DiceRow, { type DieFace } from './Dice'
import { MoveArrows } from './MatReview'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import type { GameState, Step } from '../engine/types'
import { cloneState, initialState } from '../engine/board'
import { applyStep, boardKey, generateMoves, hasNoMove } from '../engine/moves'
import { applyMove, legalNextSteps, newTurn, reachableFromChecker, rollDice } from '../engine/game'
import { HeuristicBot } from '../engine/engine'
import { moveNotation } from '../engine/notation'
import { pipCount } from '../engine/evaluate'
import { NeuralBot, type RankedMove } from '../engine/neuralBot'
import { Sound } from '../sound'

interface Props {
  onClose: () => void
  titleOverride?: string
}

// Oyuncunun bir hamleyi "doğru oynadı" sayılması için en iyi hamleye göre izin verilen
// equity kaybı (money equity ~[-3,3]). 0.02 = pratikte en iyiyle eşdeğer (çoklu en-iyi berabere geçer).
const EPS = 0.02

// Rakip (siyah) hamlesini sezgisel botla oyna + sırayı çevir -> gerçekçi ara-oyun pozisyonu üret.
const heur = new HeuristicBot()
function advance(state: GameState): GameState {
  const s = newTurn(state, rollDice())
  const moves = generateMoves(s)
  const move = moves.length ? (heur.chooseMove(s) ?? moves[0]) : { steps: [], resultKey: '' }
  return applyMove(s, move)
}

// Beyazın (oyuncu) karar vereceği bir pozisyon + zar üret: birkaç rastgele yarım-hamle oyna,
// sıra beyaza gelince zar at. Gerçek seçim olması için >=2 farklı legal tam-hamle ister.
export function makePuzzle(): GameState {
  for (let attempt = 0; attempt < 40; attempt++) {
    let s = initialState() // beyaz başlar
    const plies = 2 + Math.floor(Math.random() * 12)
    for (let i = 0; i < plies; i++) s = advance(s)
    if (s.turn !== 'white') s = advance(s)
    const st = newTurn(s, rollDice())
    const moves = generateMoves(st)
    if (hasNoMove(moves)) continue // hamlesiz pozisyon = karar yok, atla
    const distinct = new Set(moves.map((m) => m.resultKey)).size
    if (distinct >= 2) return st
  }
  // Nadir: hep tek-hamle çıktı -> standart açılış 3-1 (6-nokta yapımı klasik dersi)
  return newTurn(initialState(), [3, 1])
}

function applyPlayed(base: GameState, played: Step[]): GameState {
  const s = cloneState(base)
  for (const st of played) applyStep(s, st, base.turn)
  return s
}

type Phase = 'playing' | 'correct' | 'wrong' | 'nomove' | 'error'

export default function TrainingView({ onClose, titleOverride }: Props) {
  const { t } = useT()
  useEscape(onClose)

  const botRef = useRef<NeuralBot | null>(null)
  if (!botRef.current) botRef.current = new NeuralBot()

  const [turnStart, setTurnStart] = useState<GameState>(() => makePuzzle())
  const [played, setPlayed] = useState<Step[]>([])
  const [selectedFrom, setSelectedFrom] = useState<number | 'bar' | null>(null)
  const [phase, setPhase] = useState<Phase>('playing')
  const [best, setBest] = useState<RankedMove | null>(null)
  const [loss, setLoss] = useState(0)
  const [checking, setChecking] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  const interactive = phase === 'playing'

  // Hamlesiz pozisyon (barda kapalı vb.) -> otomatik "Hamle yok" durumuna geç.
  useEffect(() => {
    if (phase === 'playing' && hasNoMove(generateMoves(turnStart))) setPhase('nomove')
  }, [turnStart, phase])

  const nextSteps = useMemo(
    () => (interactive ? legalNextSteps(turnStart, played) : []),
    [turnStart, played, interactive],
  )
  const selectableFroms = useMemo(() => {
    const set = new Set<number | 'bar'>()
    for (const st of nextSteps) set.add(st.from)
    return set
  }, [nextSteps])

  const dragTargets = useMemo(
    () => (interactive && selectedFrom !== null ? reachableFromChecker(turnStart, played, selectedFrom) : new Map<number | 'off', Step[]>()),
    [interactive, selectedFrom, turnStart, played],
  )
  const targets = useMemo(() => new Set(dragTargets.keys()), [dragTargets])

  const remainingDice = useMemo(() => {
    const dice = turnStart.dice.slice()
    for (const st of played) {
      const i = dice.indexOf(st.die)
      if (i >= 0) dice.splice(i, 1)
    }
    return dice
  }, [turnStart, played])

  const turnComplete = useMemo(() => {
    // Tur bitti mi: played'den sonra oynanacak legal adım kalmadı mı.
    if (!interactive) return false
    return legalNextSteps(turnStart, played).length === 0 && played.length > 0
  }, [turnStart, played, interactive])

  // Gösterilen tahta: yanlış cevapta ORİJİNAL pozisyona dön (doğru hamleyi oklarla göster);
  // aksi halde oyuncunun oynadığı adımlar uygulanmış hali.
  const displayState = useMemo(
    () => (phase === 'wrong' ? turnStart : applyPlayed(turnStart, played)),
    [phase, turnStart, played],
  )

  const faces: DieFace[] = useMemo(() => {
    const rem = remainingDice.slice()
    return turnStart.dice.map((v) => {
      const i = rem.indexOf(v)
      if (i >= 0) {
        rem.splice(i, 1)
        return { value: v, used: false }
      }
      return { value: v, used: true }
    })
  }, [turnStart.dice, remainingDice])

  const canSwap = interactive && played.length === 0 && turnStart.dice.length === 2 && turnStart.dice[0] !== turnStart.dice[1]

  function handleSelectFrom(from: number | 'bar') {
    if (!interactive) return
    const stepsFrom = nextSteps.filter((s) => s.from === from)
    if (!stepsFrom.length) return
    // Sıradaki (soldaki) zarla oyna; o puldan o zar oynanamıyorsa en büyük adımı al. (Oyun ekranıyla aynı.)
    const ordered = remainingDice.map((die) => stepsFrom.find((st) => st.die === die)).find(Boolean)
    const step = ordered ?? stepsFrom.reduce((a, b) => (b.die > a.die ? b : a))
    Sound.move()
    setPlayed((p) => [...p, step])
    setSelectedFrom(null)
  }

  function handleSelectTarget(to: number | 'off') {
    if (!interactive || selectedFrom === null) return
    const seq = dragTargets.get(to)
    if (!seq || !seq.length) return
    Sound.move()
    setPlayed((p) => [...p, ...seq])
    setSelectedFrom(null)
  }

  function handleUndo() {
    if (!interactive || !played.length) return
    Sound.move()
    setPlayed((p) => p.slice(0, -1))
    setSelectedFrom(null)
  }

  function handleSwap() {
    if (!canSwap) return
    setTurnStart((s) => ({ ...cloneState(s), dice: [s.dice[1], s.dice[0]] }))
    setSelectedFrom(null)
  }

  const nextPuzzle = useCallback(() => {
    setTurnStart(makePuzzle())
    setPlayed([])
    setSelectedFrom(null)
    setBest(null)
    setLoss(0)
    setPhase('playing')
  }, [])

  function retry() {
    setPlayed([])
    setSelectedFrom(null)
    setBest(null)
    setLoss(0)
    setPhase('playing')
  }

  async function check() {
    if (checking) return
    setChecking(true)
    try {
      const ranked = await botRef.current!.analyzeMoves(turnStart)
      if (!ranked.length) {
        setPhase('error')
        return
      }
      const top = ranked[0]
      const userKey = boardKey(applyPlayed(turnStart, played))
      const mine = ranked.find((r) => r.move.resultKey === userKey)
      const eqLoss = mine ? top.equity - mine.equity : Infinity
      const ok = eqLoss <= EPS
      setBest(top)
      setLoss(Number.isFinite(eqLoss) ? eqLoss : top.equity)
      setScore((s) => ({ correct: s.correct + (ok ? 1 : 0), total: s.total + 1 }))
      setPhase(ok ? 'correct' : 'wrong')
      if (ok) Sound.win()
      else Sound.lose()
    } catch {
      setPhase('error')
    } finally {
      setChecking(false)
    }
  }

  const bestText = best ? moveNotation(best.move, 'white') : ''

  return (
    <div className="analyzer tr-view">
      <div className="analyzer-head">
        <div className="analyzer-title">
          <h2><Icon name="graduation" size={20} /> {titleOverride || t('tr.title')}</h2>
          <p className="analyzer-sub">{t('tr.hint')}</p>
        </div>
        {score.total > 0 && (
          <div className="tr-score" aria-live="polite">
            <Icon name="check" size={15} /> {score.correct} / {score.total}
          </div>
        )}
      </div>

      <div className="analyzer-body">
        <div className="analyzer-board">
          <Board
            state={displayState}
            selectableFroms={selectableFroms}
            targets={targets}
            selectedFrom={selectedFrom}
            onSelectFrom={handleSelectFrom}
            onSelectTarget={handleSelectTarget}
            onDragFrom={(f) => interactive && setSelectedFrom(f)}
            pipTop={pipCount(displayState, 'black')}
            pipBottom={pipCount(displayState, 'white')}
            cube={{ value: 1, owner: null }}
            numberFrom="white"
            centerMain={<DiceRow faces={faces} owner="white" swappable={canSwap} onSwap={handleSwap} />}
            showPip
          />
          {phase === 'wrong' && best && (
            <MoveArrows steps={best.move.steps} dep={`best:${best.move.resultKey}`} />
          )}
        </div>

        <div className="analyzer-controls tr-controls">
          {phase === 'playing' && (
            <>
              <p className="tr-prompt">{t('tr.yourMove')}</p>
              <div className="tr-btns">
                <Button variant="outline" onClick={handleUndo} disabled={!played.length}>
                  <Icon name="refresh" size={16} /> {t('tr.undo')}
                </Button>
                <Button onClick={check} disabled={!turnComplete || checking}>
                  {checking ? <Loading inline size={16} /> : <Icon name="check" size={16} />} {t('tr.check')}
                </Button>
              </div>
              <button className="tr-skip" onClick={nextPuzzle}>{t('tr.skip')}</button>
            </>
          )}

          {phase === 'correct' && (
            <div className="tr-result tr-ok">
              <div className="tr-badge"><Icon name="check" size={28} /></div>
              <h3>{t('tr.correct')}</h3>
              <p className="tr-eq">{t('tr.bestMove')}: <strong>{bestText || '—'}</strong></p>
              <Button onClick={nextPuzzle}><Icon name="arrow-right" size={16} /> {t('tr.next')}</Button>
            </div>
          )}

          {phase === 'wrong' && (
            <div className="tr-result tr-bad">
              <div className="tr-badge"><Icon name="x" size={28} /></div>
              <h3>{t('tr.wrong')}</h3>
              <p className="tr-eq">
                {t('tr.bestMove')}: <strong>{bestText || '—'}</strong>
                {loss > 0 && <span className="tr-loss"> (−{loss.toFixed(3)})</span>}
              </p>
              <div className="tr-btns">
                <Button variant="outline" onClick={retry}><Icon name="refresh" size={16} /> {t('tr.retry')}</Button>
                <Button onClick={nextPuzzle}><Icon name="arrow-right" size={16} /> {t('tr.next')}</Button>
              </div>
            </div>
          )}

          {phase === 'nomove' && (
            <div className="tr-result">
              <h3>{t('tr.noMove')}</h3>
              <Button onClick={nextPuzzle}><Icon name="arrow-right" size={16} /> {t('tr.next')}</Button>
            </div>
          )}

          {phase === 'error' && (
            <div className="tr-result tr-bad">
              <h3>{t('tr.engineErr')}</h3>
              <div className="tr-btns">
                <Button variant="outline" onClick={() => { setPhase('playing'); void check() }}>{t('tr.retry')}</Button>
                <Button onClick={nextPuzzle}>{t('tr.next')}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
