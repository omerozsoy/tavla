import { useEffect, useRef, useState, type ReactNode } from 'react'
import './arena.css'
import Board from './Board'
import { LessonView } from './TrainingView'
import { streakMultiplier } from './QuizMarathon'
import { MARATHON_POOL, CUBE_POOL, questionId, questionPoints, type Question } from './trainingCurriculum'
import { buildJudgeMoveItems, type JudgeItem } from './judgePositions'
import { pipCount } from '../engine/evaluate'
import { submitQuizScore, quizLeaderboard, type QuizLeaderRow, type QuizMode } from '../api'
import type { DiffBand } from './difficultyPositions'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'

// 4 eğitim yarışması. Hepsi "Dersler ve Eğitim" altında ayrı sayfa + ayrı rekor tablosu.
export type ArenaKey = 'judge' | 'time' | 'cube3' | 'tekcan'
export interface ArenaConfig {
  key: ArenaKey
  title: string
  lives: number // 0 = can yok (yalnız süre)
  timeLimitSec: number // 0 = süre yok
  content: 'play' | 'cube' | 'judge'
  accent: string
  intro: string
}
export const ARENA_CONFIGS: Record<ArenaKey, ArenaConfig> = {
  judge: { key: 'judge', title: 'Doğru Hamle mi?', lives: 3, timeLimitSec: 0, content: 'judge', accent: '#a83a2b', intro: 'Pozisyonu ve oynanan hamleyi gör — en iyi hamle mi, yoksa hata mı? 3 canın var.' },
  time: { key: 'time', title: 'Zamana Karşı', lives: 0, timeLimitSec: 180, content: 'play', accent: '#2b6ca8', intro: '3 dakikada en çok soruyu doğru çöz. Yanlışta sonraki soruya geçersin.' },
  cube3: { key: 'cube3', title: 'Küp Kararı', lives: 3, timeLimitSec: 0, content: 'cube', accent: '#8a5a2b', intro: 'Yalnız küp kararları: Katla mı, Katlama mı? 3 canın var.' },
  tekcan: { key: 'tekcan', title: 'Tek Can', lives: 1, timeLimitSec: 0, content: 'judge', accent: '#7a1f1f', intro: 'En zoru: tek canın var. Bir hata ve oyun biter.' },
}

const BAND_POINTS: Record<DiffBand, number> = { cok_kolay: 10, kolay: 20, orta: 25, zor: 50, cok_zor: 100 }
const EMPTY_FROM = new Set<number | 'bar'>()
const EMPTY_TARGET = new Set<number | 'off'>()

type Tab = 'play' | 'records'

// Küp 'offer' sorularını JudgeItem'a çevir (Katla/Katlama). 'respond' (al/bırak) judge modda yok.
function cubeJudgeItems(): JudgeItem[] {
  return CUBE_POOL.filter((q) => q.cube === 'offer' && (q.cubeAnswer === 'double' || q.cubeAnswer === 'nodouble')).map((q) => ({
    id: questionId(q),
    state: q.state,
    kind: 'cube' as const,
    cubeAnswer: q.cubeAnswer as 'double' | 'nodouble',
  }))
}

/**
 * ArenaGame: config-sürücülü eğitim yarışması motoru. Kalp (can), süre, içerik (play/cube/judge)
 * config'ten gelir. 'play'/'cube' -> LessonView; 'judge' -> JudgeCard. Her mod ayrı rekor (config.key).
 */
export function ArenaGame({ arenaKey, nickname, onClose, tab = 'play', onTab }: {
  arenaKey: ArenaKey
  nickname?: string | null
  onClose: () => void
  tab?: Tab
  onTab?: (t: Tab) => void
}) {
  const config = ARENA_CONFIGS[arenaKey]
  const [phase, setPhase] = useState<'intro' | 'playing' | 'over'>('intro')
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [bestMult, setBestMult] = useState(1)
  const [lives, setLives] = useState(config.lives)
  const [timeLeft, setTimeLeft] = useState(config.timeLimitSec)
  const [step, setStep] = useState(0)
  const [round, setRound] = useState(0)
  const seenRef = useRef<Set<string>>(new Set())
  const [cur, setCur] = useState<Question | JudgeItem | null>(null)
  const [answered, setAnswered] = useState<null | 'correct' | 'wrong'>(null)
  const [gain, setGain] = useState(0)
  const [lastMult, setLastMult] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const judgePoolRef = useRef<JudgeItem[] | null>(null)

  const isJudge = config.content === 'judge'
  const pool = (): (Question | JudgeItem)[] => {
    if (isJudge) {
      if (!judgePoolRef.current) judgePoolRef.current = [...buildJudgeMoveItems(), ...cubeJudgeItems()]
      return judgePoolRef.current
    }
    return config.content === 'cube' ? CUBE_POOL : MARATHON_POOL
  }
  const idOf = (x: Question | JudgeItem): string => ('kind' in x ? (x as JudgeItem).id : questionId(x as Question))
  const pick = (seen: Set<string>): Question | JudgeItem | null => {
    const avail = pool().filter((x) => !seen.has(idOf(x)))
    if (!avail.length) return null
    return avail[Math.floor(Math.random() * avail.length)]
  }

  const start = () => {
    seenRef.current = new Set()
    setScore(0); setCorrectCount(0); setBestMult(1); setLastMult(1)
    setLives(config.lives); setTimeLeft(config.timeLimitSec)
    setStep(0); setRound((r) => r + 1); setAnswered(null); setModalOpen(false)
    setCur(pick(new Set()))
    setPhase('playing')
  }

  // Süre sayacı (yalnız süreli modlar). 0'da oyun biter.
  useEffect(() => {
    if (phase !== 'playing' || config.timeLimitSec <= 0) return
    const iv = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(iv); endGame(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round])

  const endGame = () => { setPhase('over'); setModalOpen(true) }

  const pointsFor = (x: Question | JudgeItem): number => {
    if ('kind' in x) return (x as JudgeItem).band ? BAND_POINTS[(x as JudgeItem).band!] : 25
    return config.content === 'cube' ? 25 : questionPoints(x as Question)
  }

  // Ortak cevap işleyici (play/cube: LessonView onAnswered; judge: JudgeCard onAnswer).
  const onResult = (correct: boolean, scoreable: boolean) => {
    if (correct) {
      const nc = correctCount + 1
      const mult = scoreable ? streakMultiplier(nc) : 1
      const pts = scoreable && cur ? pointsFor(cur) * mult : 0
      setScore((s) => s + pts); setCorrectCount(nc); setBestMult((m) => Math.max(m, mult))
      setGain(pts); setLastMult(mult); setAnswered('correct')
    } else {
      setGain(0); setAnswered('wrong')
      if (config.lives > 0) {
        const left = lives - 1
        setLives(left)
        if (left <= 0) endGame()
      }
      // süreli mod (lives=0): can kaybı yok, süre dolunca biter.
    }
  }

  const next = () => {
    if (!cur || phase === 'over') return
    seenRef.current.add(idOf(cur))
    const n = pick(seenRef.current)
    if (!n) { endGame(); return } // havuz bitti
    setCur(n); setStep((s) => s + 1); setAnswered(null)
  }

  const hud = <Hud config={config} lives={lives} timeLeft={timeLeft} score={score} />

  const tabs = <ArenaTabs tab={tab} onTab={(t) => onTab?.(t)} accent={config.accent} />

  if (tab === 'records') return <ArenaRecords config={config} tabs={tabs} onClose={onClose} />

  return (
    <div className="arena-wrap" style={{ ['--arena-accent' as string]: config.accent }}>
      {phase === 'intro' && (
        <div className="register-card arena-intro">
          <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat"><Icon name="x" size={16} /></Button>
          <h2>{config.title}</h2>
          {tabs}
          <p className="arena-intro-txt">{config.intro}</p>
          <div className="arena-intro-meta">
            {config.lives > 0 && <span>{'❤️'.repeat(config.lives)} {config.lives} can</span>}
            {config.timeLimitSec > 0 && <span>⏱ {Math.round(config.timeLimitSec / 60)} dakika</span>}
          </div>
          <button className="bgx-btn green arena-start" onClick={start}>Başla</button>
        </div>
      )}

      {phase !== 'intro' && cur && !isJudge && (
        <LessonView
          key={`${round}-${step}`}
          lessonId={`arena-${config.key}-${round}-${step}`}
          fixed={{ title: config.title, questions: [cur as Question] }}
          onBack={onClose}
          onAnswered={(correct, _q, scoreable) => onResult(correct, scoreable)}
          sideTabs={tabs}
          chip={hud}
          centerInfo={answered && <AnswerPop answered={answered} gain={gain} lastMult={lastMult} key={`${round}-${step}-${answered}`} />}
          centerAction={
            phase === 'over'
              ? { label: 'Skorunu Gör', onClick: () => setModalOpen(true) }
              : answered
                ? { label: 'Sonraki Soru →', onClick: next }
                : null
          }
        />
      )}

      {phase !== 'intro' && cur && isJudge && (
        <JudgeCard
          item={cur as JudgeItem}
          answered={answered}
          over={phase === 'over'}
          hud={hud}
          tabs={tabs}
          onClose={onClose}
          gain={gain}
          lastMult={lastMult}
          onAnswer={(correct) => onResult(correct, true)}
          onNext={next}
          onShowScore={() => setModalOpen(true)}
        />
      )}

      {phase === 'over' && (
        <ArenaOver open={modalOpen} config={config} score={score} correctCount={correctCount} bestMult={bestMult} accountNick={nickname} onRestart={start} onClose={() => setModalOpen(false)} />
      )}
    </div>
  )
}

// Üst durum çubuğu: kalpler + skor + (varsa) süre.
function Hud({ config, lives, timeLeft, score }: { config: ArenaConfig; lives: number; timeLeft: number; score: number }) {
  return (
    <span className="arena-hud">
      {config.lives > 0 && (
        <span className="arena-hearts" title={`${lives} can`}>
          {Array.from({ length: config.lives }, (_, i) => (
            <span key={i} className={`arena-heart${i < lives ? '' : ' gone'}`}>{i < lives ? '❤️' : '🤍'}</span>
          ))}
        </span>
      )}
      {config.timeLimitSec > 0 && <span className={`arena-timer${timeLeft <= 15 ? ' low' : ''}`}>⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>}
      <span className="arena-score">Skor <b>{score}</b></span>
    </span>
  )
}

function AnswerPop({ answered, gain, lastMult }: { answered: 'correct' | 'wrong'; gain: number; lastMult: number }) {
  return (
    <div className={`arena-pop ${answered}`} role="status">
      <span className="arena-pop-gain">{answered === 'correct' ? (gain > 0 ? `+${gain}` : 'Doğru') : 'Yanlış'}</span>
      {answered === 'correct' && lastMult === 2 && <span className="arena-pop-tag">🔥 2 KAT!</span>}
    </div>
  )
}

// Yargı kartı: pozisyon (display board) + oynanan hamle / küp sorusu + iki buton.
function JudgeCard({ item, answered, over, hud, tabs, onClose, gain, lastMult, onAnswer, onNext, onShowScore }: {
  item: JudgeItem
  answered: null | 'correct' | 'wrong'
  over: boolean
  hud: ReactNode
  tabs: ReactNode
  onClose: () => void
  gain: number
  lastMult: number
  onAnswer: (correct: boolean) => void
  onNext: () => void
  onShowScore: () => void
}) {
  const s = item.state
  const answer = (choice: 'best' | 'blunder' | 'double' | 'nodouble') => {
    const correct = item.kind === 'cube'
      ? (choice === 'double') === (item.cubeAnswer === 'double')
      : (choice === 'best') === (item.isBlunder === false)
    onAnswer(correct)
  }
  const prompt = item.kind === 'cube'
    ? 'Sıra BEYAZDA. Beyaz küpü katlamalı mı?'
    : <>Beyaz şunu oynadı: <b>{item.move}</b> — en iyi hamle mi, hata mı?</>

  return (
    <div className="register-card arena-judge">
      <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat"><Icon name="x" size={16} /></Button>
      <div className="arena-judge-top">{tabs}{hud}</div>
      <div className="arena-judge-board">
        <Board
          state={s}
          selectableFroms={EMPTY_FROM}
          targets={EMPTY_TARGET}
          selectedFrom={null}
          onSelectFrom={() => {}}
          onSelectTarget={() => {}}
          onDragFrom={() => {}}
          pipTop={pipCount(s, 'black')}
          pipBottom={pipCount(s, 'white')}
          cube={{ value: 1, owner: null }}
          numberFrom="white"
          showPip
        />
      </div>
      <div className="arena-judge-q">{prompt}</div>
      {answered ? (
        <div className="arena-judge-after">
          <div className={`arena-pop ${answered}`}>
            <span className="arena-pop-gain">{answered === 'correct' ? (gain > 0 ? `+${gain}` : 'Doğru') : 'Yanlış'}</span>
            {answered === 'correct' && lastMult === 2 && <span className="arena-pop-tag">🔥 2 KAT!</span>}
          </div>
          {over ? (
            <button className="bgx-btn arena-next" onClick={onShowScore}>Skorunu Gör</button>
          ) : (
            <button className="bgx-btn green arena-next" onClick={onNext}>Sonraki →</button>
          )}
        </div>
      ) : item.kind === 'cube' ? (
        <div className="arena-judge-btns">
          <button className="arena-choice yes" onClick={() => answer('double')}>Katla</button>
          <button className="arena-choice no" onClick={() => answer('nodouble')}>Katlama</button>
        </div>
      ) : (
        <div className="arena-judge-btns">
          <button className="arena-choice yes" onClick={() => answer('best')}><Icon name="check" size={16} /> En İyi Hamle</button>
          <button className="arena-choice no" onClick={() => answer('blunder')}><Icon name="x" size={16} /> Hatalı Hamle</button>
        </div>
      )}
    </div>
  )
}

function ArenaTabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void; accent: string }) {
  const items: { id: Tab; label: string; icon?: 'target' | 'trophy' }[] = [
    { id: 'play', label: 'Oyna', icon: 'target' },
    { id: 'records', label: 'Rekorlar', icon: 'trophy' },
  ]
  return (
    <div className="arena-tabs" role="tablist">
      {items.map((it) => (
        <button key={it.id} type="button" role="tab" aria-selected={tab === it.id} className={`arena-tab${tab === it.id ? ' on' : ''}`} onClick={() => onTab(it.id)}>
          {it.icon && <Icon name={it.icon} size={15} />} {it.label}
        </button>
      ))}
    </div>
  )
}

function ArenaRecords({ config, tabs, onClose }: { config: ArenaConfig; tabs: ReactNode; onClose: () => void }) {
  const [board, setBoard] = useState<QuizLeaderRow[] | null>(null)
  useEffect(() => { quizLeaderboard(100, config.key as QuizMode).then(setBoard).catch(() => setBoard([])) }, [config.key])
  const medal = (n: number) => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : n)
  return (
    <div className="arena-wrap" style={{ ['--arena-accent' as string]: config.accent }}>
      <div className="register-card arena-intro">
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat"><Icon name="x" size={16} /></Button>
        <h2>{config.title}</h2>
        {tabs}
        {board == null ? (
          <div className="arena-empty">Yükleniyor…</div>
        ) : board.length === 0 ? (
          <div className="arena-empty">Henüz rekor yok — ilk sen ol!</div>
        ) : (
          <div className="arena-rec-list">
            <div className="arena-rec-row arena-rec-head"><span>#</span><span>Oyuncu</span><span>Doğru</span><span>Skor</span></div>
            {board.map((r) => (
              <div key={r.rank} className={`arena-rec-row${r.rank <= 3 ? ` top top${r.rank}` : ''}`}>
                <span>{medal(r.rank)}</span><span className="arena-rec-nick">{r.nickname}</span><span>{r.correct_count}</span><span className="arena-rec-score">{r.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ArenaOver({ open, config, score, correctCount, bestMult, accountNick, onRestart, onClose }: {
  open: boolean
  config: ArenaConfig
  score: number
  correctCount: number
  bestMult: number
  accountNick?: string | null
  onRestart: () => void
  onClose: () => void
}) {
  const [rank, setRank] = useState<number | null>(null)
  const [board, setBoard] = useState<QuizLeaderRow[] | null>(null)
  const sentRef = useRef(false)
  useEffect(() => {
    quizLeaderboard(20, config.key as QuizMode).then(setBoard).catch(() => setBoard([]))
    if (sentRef.current || score <= 0) return
    sentRef.current = true
    submitQuizScore((accountNick || '').trim(), score, correctCount, config.key as QuizMode)
      .then((res) => { setRank(res.rank); quizLeaderboard(20, config.key as QuizMode).then(setBoard).catch(() => {}) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="qm-over arena-over" role="dialog" aria-modal="true" hidden={!open} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="qm-over-card">
        <button className="qm-exit" onClick={onClose} aria-label="Kapat" title="Tahtaya dön">✕</button>
        <div className="qm-over-score">{score}</div>
        <div className="qm-over-sub">{correctCount} doğru · en iyi çarpan ×{bestMult}</div>
        {rank != null && <div className="qm-rank">Sıran: <b>#{rank}</b></div>}
        <div className="qm-board">
          <div className="qm-board-title">🏆 {config.title} — Rekorlar</div>
          {board == null ? <div className="qm-board-empty">Yükleniyor…</div> : board.length === 0 ? <div className="qm-board-empty">Henüz skor yok — ilk sen ol!</div> : (
            <ol className="qm-board-list">
              {board.map((r) => (
                <li key={r.rank} className={rank === r.rank ? 'qm-me' : ''}>
                  <span className="qm-br-rank">{r.rank}</span><span className="qm-br-nick">{r.nickname}</span><span className="qm-br-score">{r.score}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <button className="bgx-btn green qm-restart" onClick={onRestart}>Baştan Başla</button>
      </div>
    </div>
  )
}
