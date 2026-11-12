import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import Loading from './Loading'
import { useEscape } from './useEscape'
import Board from './Board'
import DiceRow, { type DieFace } from './Dice'
import { MoveArrows } from './MatReview'
import { useT } from '../i18n'
import type { GameState, Step } from '../engine/types'
import { cloneState, initialState } from '../engine/board'
import { applyStep, boardKey, generateMoves, hasNoMove } from '../engine/moves'
import { applyMove, legalNextSteps, newTurn, reachableFromChecker, rollDice } from '../engine/game'
import { HeuristicBot } from '../engine/engine'
import { moveNotation } from '../engine/notation'
import { pipCount } from '../engine/evaluate'
import { NeuralBot, type RankedMove } from '../engine/neuralBot'
import { Sound } from '../sound'
import TrainingPath, { saveLessonProgress } from './TrainingPath'
import { lessonById } from './trainingCurriculum'

interface Props {
  onClose: () => void
  titleOverride?: string
}

// "Doğru" sayılma eşiği: en iyi hamleye göre izin verilen equity kaybı (money ~[-3,3]).
const EPS = 0.02

const heur = new HeuristicBot()
function advance(state: GameState): GameState {
  const s = newTurn(state, rollDice())
  const moves = generateMoves(s)
  const move = moves.length ? (heur.chooseMove(s) ?? moves[0]) : { steps: [], resultKey: '' }
  return applyMove(s, move)
}

// Beyazın (oyuncu) karar vereceği, en az 2 farklı legal hamlesi olan bir pozisyon + zar üret.
export function makePuzzle(): GameState {
  for (let attempt = 0; attempt < 40; attempt++) {
    let s = initialState()
    const plies = 2 + Math.floor(Math.random() * 12)
    for (let i = 0; i < plies; i++) s = advance(s)
    if (s.turn !== 'white') s = advance(s)
    const st = newTurn(s, rollDice())
    const moves = generateMoves(st)
    if (hasNoMove(moves)) continue
    if (new Set(moves.map((m) => m.resultKey)).size >= 2) return st
  }
  return newTurn(initialState(), [3, 1])
}

function applyPlayed(base: GameState, played: Step[]): GameState {
  const s = cloneState(base)
  for (const st of played) applyStep(s, st, base.turn)
  return s
}

type Phase = 'playing' | 'correct' | 'wrong' | 'nomove' | 'error'

// Mavi zar-bot maskotu (BackgammonGalaxy'deki gibi sevimli yüz).
function BotFace({ mood }: { mood: 'idle' | 'ok' | 'bad' }) {
  return (
    <svg className="bgx-face" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="2" y="2" width="44" height="44" rx="11" fill="#2f6bff" />
      <circle cx="12" cy="10" r="2.4" fill="#cfe0ff" />
      <circle cx="17.5" cy="8" r="1.5" fill="#cfe0ff" />
      {mood === 'bad' ? (
        <>
          <circle cx="18" cy="24" r="2.6" fill="#0b1b45" />
          <circle cx="30" cy="24" r="2.6" fill="#0b1b45" />
          <path d="M17 34 Q24 29 31 34" stroke="#0b1b45" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      ) : mood === 'ok' ? (
        <>
          <path d="M14 24 Q18 20 22 24" stroke="#0b1b45" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M26 24 Q30 20 34 24" stroke="#0b1b45" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M16 30 Q24 38 32 30" stroke="#0b1b45" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="18" cy="23" r="2.6" fill="#0b1b45" />
          <circle cx="30" cy="23" r="2.6" fill="#0b1b45" />
          <path d="M17 31 Q24 35 31 31" stroke="#0b1b45" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

// Tek ders ekranı: zar at, oyna, otomatik değerlendir; yanlışsa doğru hamle oklarla gösterilir.
function LessonView({ lessonId, onBack }: { lessonId: string; onBack: () => void }) {
  const { t } = useT()
  const lesson = lessonById(lessonId)
  const TOTAL = lesson?.questions ?? 10

  const botRef = useRef<NeuralBot | null>(null)
  if (!botRef.current) botRef.current = new NeuralBot()

  const [idx, setIdx] = useState(0)
  const [turnStart, setTurnStart] = useState<GameState>(() => makePuzzle())
  const [played, setPlayed] = useState<Step[]>([])
  const [selectedFrom, setSelectedFrom] = useState<number | 'bar' | null>(null)
  const [phase, setPhase] = useState<Phase>('playing')
  const [best, setBest] = useState<RankedMove | null>(null)
  const [checking, setChecking] = useState(false)
  const [hinted, setHinted] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [streak, setStreak] = useState(0)
  const [complete, setComplete] = useState(false)

  const interactive = phase === 'playing'
  const gradedRef = useRef(-1)

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
    () =>
      interactive && selectedFrom !== null
        ? reachableFromChecker(turnStart, played, selectedFrom)
        : new Map<number | 'off', Step[]>(),
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

  const turnComplete = interactive && played.length > 0 && legalNextSteps(turnStart, played).length === 0

  const showArrows = reveal && !!best
  const displayState = useMemo(
    () => (showArrows ? turnStart : applyPlayed(turnStart, played)),
    [showArrows, turnStart, played],
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

  function handleSelectFrom(from: number | 'bar') {
    if (!interactive) return
    const stepsFrom = nextSteps.filter((s) => s.from === from)
    if (!stepsFrom.length) return
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

  function resetQuestion(nextState: GameState) {
    setTurnStart(nextState)
    setPlayed([])
    setSelectedFrom(null)
    setBest(null)
    setHinted(false)
    setReveal(false)
    setPhase('playing')
  }

  const correctCount = results.filter(Boolean).length
  const accuracy = Math.round((correctCount / TOTAL) * 100)

  const nextQuestion = useCallback(() => {
    if (idx + 1 >= TOTAL) {
      const acc = Math.round((results.filter(Boolean).length / TOTAL) * 100)
      saveLessonProgress(lessonId, { done: true, stars: acc === 100 ? 3 : acc >= 80 ? 2 : acc >= 50 ? 1 : 0 })
      setComplete(true)
      return
    }
    setIdx((i) => i + 1)
    resetQuestion(makePuzzle())
  }, [idx, TOTAL, results, lessonId])

  async function ensureBest(): Promise<RankedMove[] | null> {
    try {
      const ranked = await botRef.current!.analyzeMoves(turnStart)
      return ranked.length ? ranked : null
    } catch {
      return null
    }
  }

  const grade = useCallback(async () => {
    if (checking || gradedRef.current === idx) return
    gradedRef.current = idx
    setChecking(true)
    try {
      const ranked = await ensureBest()
      if (!ranked) {
        setPhase('error')
        gradedRef.current = -1
        return
      }
      const top = ranked[0]
      const userKey = boardKey(applyPlayed(turnStart, played))
      const mine = ranked.find((r) => r.move.resultKey === userKey)
      const ok = mine ? top.equity - mine.equity <= EPS : false
      setBest(top)
      const firstTryOk = ok && !hinted
      setResults((r) => (r.length > idx ? r : [...r, firstTryOk]))
      setStreak((s) => (firstTryOk ? s + 1 : 0))
      if (ok) {
        setReveal(false)
        setPhase('correct')
        Sound.win()
      } else {
        setReveal(true)
        setPhase('wrong')
        Sound.lose()
      }
    } finally {
      setChecking(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, turnStart, played, hinted, checking])

  useEffect(() => {
    if (phase !== 'playing') return
    if (hasNoMove(generateMoves(turnStart))) {
      setPhase('nomove')
      if (gradedRef.current !== idx) {
        gradedRef.current = idx
        setResults((r) => (r.length > idx ? r : [...r, false]))
        setStreak(0)
      }
      return
    }
    if (turnComplete) void grade()
  }, [phase, turnComplete, turnStart, idx, grade])

  async function hint() {
    if (!interactive || checking) return
    setChecking(true)
    try {
      const ranked = await ensureBest()
      if (!ranked) return
      setBest(ranked[0])
      setHinted(true)
      setPlayed([])
      setSelectedFrom(null)
      setReveal(true)
    } finally {
      setChecking(false)
    }
  }

  const bestText = best ? moveNotation(best.move, 'white') : ''
  const stars = accuracy === 100 ? 3 : accuracy >= 80 ? 2 : accuracy >= 50 ? 1 : 0
  const progressShown = complete ? TOTAL : idx + 1
  const mood: 'idle' | 'ok' | 'bad' = phase === 'wrong' ? 'bad' : phase === 'correct' || complete ? 'ok' : 'idle'

  const bubble = complete ? (
    <>
      <h4>{t('tr.complete')}</h4>
      <p>{t('tr.completeSub', { n: correctCount, total: TOTAL })}</p>
    </>
  ) : phase === 'correct' ? (
    <>
      <h4>{bestText} {t('tr.correctSuffix')}</h4>
      <p>{t('tr.correctExplain')}</p>
    </>
  ) : phase === 'wrong' ? (
    <>
      <h4>{t('tr.betterExists')}</h4>
      <p>{t('tr.wrongExplain', { move: bestText })}</p>
    </>
  ) : phase === 'nomove' ? (
    <p>{t('tr.noMove')}</p>
  ) : phase === 'error' ? (
    <p>{t('tr.engineErr')}</p>
  ) : (
    <p>{t('tr.findBest')}</p>
  )

  const showNext = !complete && (phase === 'correct' || phase === 'wrong' || phase === 'nomove')

  return (
    <div className="tr-view bgx">
      <aside className="bgx-side">
        <div className="bgx-head">
          <button className="bgx-back" onClick={onBack} aria-label={t('common.back')}>
            <Icon name="arrow-right" size={22} />
          </button>
          <span className="bgx-title">{lesson?.title || t('tr.lessonTitle')}</span>
          {streak > 1 && (
            <span className="bgx-streak" title={t('tr.streak')}>
              <Icon name="flame" size={16} /> {streak}
            </span>
          )}
        </div>

        <div className="bgx-talk">
          <div className="bgx-avatar"><BotFace mood={mood} /></div>
          <div className={`bgx-bubble${phase === 'correct' || complete ? ' ok' : ''}${phase === 'wrong' ? ' bad' : ''}`}>
            {bubble}
          </div>
        </div>

        {complete && (
          <div className="bgx-result">
            <div className="bgx-stars">
              {[0, 1, 2].map((i) => (
                <Icon key={i} name="star" size={30} className={i < stars ? 'on' : 'off'} />
              ))}
            </div>
            <div className="bgx-acc">{t('tr.accuracy', { n: accuracy })}</div>
            <div className="bgx-badge">{t('tr.intermediate')}</div>
          </div>
        )}

        <div className="bgx-spacer" />

        {complete ? (
          <div className="bgx-done-btns">
            <button
              className="bgx-btn ghost"
              onClick={() => {
                setIdx(0)
                setResults([])
                setStreak(0)
                setComplete(false)
                gradedRef.current = -1
                resetQuestion(makePuzzle())
              }}
            >
              {t('tr.replay')}
            </button>
            <button className="bgx-btn green" onClick={onBack}>{t('tr.nextLesson')}</button>
          </div>
        ) : (
          <button className="bgx-hint" onClick={hint} disabled={!interactive || checking}>
            {checking && interactive ? <Loading inline size={16} /> : t('tr.hintBtn')}
          </button>
        )}
      </aside>

      <div className="bgx-stage">
        <div className="bgx-scores">
          <div className="bgx-score-box">0</div>
          <div className="bgx-score-box">0</div>
        </div>

        <div className="bgx-board">
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
            centerRight={<DiceRow faces={faces} owner="white" />}
            showPip
          />
          {showArrows && best && <MoveArrows steps={best.move.steps} dep={`best:${idx}:${best.move.resultKey}`} />}
          {showNext && (
            <button className="bgx-next" onClick={nextQuestion}>{t('tr.next')}</button>
          )}
        </div>

        <div className="bgx-progress">
          <div className={`bgx-meter${!complete ? ' active' : ''}`}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <span key={i} className={`bgx-seg${i < progressShown ? ' on' : ''}`} />
            ))}
          </div>
          <div className="bgx-count">{progressShown}/{TOTAL}</div>
        </div>
      </div>
    </div>
  )
}

// Konteyner: varsayılan "Ustalık Yolu" listesi; bir ders seçilince o dersin ekranı açılır.
export default function TrainingView({ onClose, titleOverride }: Props) {
  useEscape(onClose)
  const [lessonId, setLessonId] = useState<string | null>(null)

  if (!lessonId) {
    return <TrainingPath onPick={setLessonId} onClose={onClose} titleOverride={titleOverride} />
  }
  return <LessonView lessonId={lessonId} onBack={() => setLessonId(null)} />
}
