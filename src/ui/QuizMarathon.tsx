import { useEffect, useRef, useState } from 'react'
import './quizMarathon.css'
import { LessonView } from './TrainingView'
import { MARATHON_POOL, questionId, questionPoints, type Question } from './trainingCurriculum'
import { quizLeaderboard, submitQuizScore, type QuizLeaderRow } from '../api'

// Havuzdan seen'de OLMAYAN rastgele soru. Tur içi tekrar yok; havuz tükenince null (tur tamam).
export function pickNext(pool: Question[], seen: Set<string>): Question | null {
  const avail = pool.filter((q) => !seen.has(questionId(q)))
  if (!avail.length) return null
  return avail[Math.floor(Math.random() * avail.length)]
}

/**
 * Soru Maratonu: sınırsız streak-quiz. Her doğru cevap zorluğa göre puan (25/50/75/100), üstte
 * anlık skor, İLK YANLIŞTA biter. Game-over: takma-ad + anonim tabelaya yaz + baştan başla.
 * LessonView'i (fixed tek-soru + onAnswered) per-soru remount (key=step) ile sürer.
 */
export function QuizMarathon({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'playing' | 'over'>('playing')
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [bestMult, setBestMult] = useState(1)
  const [step, setStep] = useState(0)
  const seenRef = useRef<Set<string>>(new Set())
  const [current, setCurrent] = useState<Question | null>(() => pickNext(MARATHON_POOL, new Set()))
  const [answered, setAnswered] = useState<null | 'correct' | 'wrong'>(null)

  const reset = () => {
    seenRef.current = new Set()
    setScore(0)
    setCorrectCount(0)
    setBestMult(1)
    setStep(0)
    setCurrent(pickNext(MARATHON_POOL, new Set()))
    setAnswered(null)
    setPhase('playing')
  }

  const handleAnswered = (correct: boolean, q: Question) => {
    if (correct) {
      const pts = questionPoints(q)
      setScore((s) => s + pts)
      setCorrectCount((c) => c + 1)
      setBestMult((m) => Math.max(m, pts / 25))
      setAnswered('correct')
    } else {
      setAnswered('wrong')
      setPhase('over') // ilk yanlış = yarışma biter
    }
  }

  const next = () => {
    if (!current) return
    seenRef.current.add(questionId(current))
    const n = pickNext(MARATHON_POOL, seenRef.current)
    if (!n) {
      setPhase('over') // havuz bitti: tur tamamlandı
      return
    }
    setCurrent(n)
    setStep((s) => s + 1)
    setAnswered(null)
  }

  if (phase === 'over') {
    return <GameOver score={score} correctCount={correctCount} bestMult={bestMult} onRestart={reset} onClose={onClose} />
  }

  return (
    <div className="qm-wrap">
      <div className="qm-scorebar">
        <button className="qm-exit" onClick={onClose} aria-label="Çıkış">✕</button>
        <span className="qm-score">Skor <b>{score}</b></span>
        <span className="qm-correct">{correctCount} doğru</span>
      </div>
      {current && (
        <LessonView
          key={step}
          lessonId={`maraton-${step}`}
          fixed={{ title: 'Soru Maratonu', questions: [current] }}
          onBack={onClose}
          onAnswered={handleAnswered}
        />
      )}
      {answered === 'correct' && (
        <div className="qm-next">
          <button className="bgx-btn green" onClick={next}>Sonraki Soru →</button>
        </div>
      )}
    </div>
  )
}

function GameOver({
  score,
  correctCount,
  bestMult,
  onRestart,
  onClose,
}: {
  score: number
  correctCount: number
  bestMult: number
  onRestart: () => void
  onClose: () => void
}) {
  const [nick, setNick] = useState('')
  const [rank, setRank] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [board, setBoard] = useState<QuizLeaderRow[] | null>(null)

  useEffect(() => {
    quizLeaderboard(20)
      .then(setBoard)
      .catch(() => setBoard([]))
  }, [])

  const submit = async () => {
    if (submitting || rank != null) return
    setSubmitting(true)
    try {
      const res = await submitQuizScore(nick.trim(), score, correctCount)
      setRank(res.rank)
      quizLeaderboard(20)
        .then(setBoard)
        .catch(() => {})
    } catch {
      /* best-effort: tabela yazılamadı */
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="qm-over">
      <button className="qm-exit" onClick={onClose} aria-label="Çıkış">✕</button>
      <div className="qm-over-card">
        <div className="qm-over-score">{score}</div>
        <div className="qm-over-sub">
          {correctCount} doğru · en iyi çarpan ×{bestMult}
        </div>

        {rank == null ? (
          <div className="qm-submit">
            <input
              className="qm-nick"
              maxLength={20}
              placeholder="Takma adın"
              value={nick}
              onChange={(e) => setNick(e.target.value)}
            />
            <button className="bgx-btn green" disabled={submitting} onClick={submit}>
              {submitting ? '…' : 'Tabelaya Yaz'}
            </button>
          </div>
        ) : (
          <div className="qm-rank">Tabeladaki sıran: <b>#{rank}</b></div>
        )}

        <div className="qm-board">
          <div className="qm-board-title">🏆 Skor Tabelası</div>
          {board == null ? (
            <div className="qm-board-empty">Yükleniyor…</div>
          ) : board.length === 0 ? (
            <div className="qm-board-empty">Henüz skor yok — ilk sen ol!</div>
          ) : (
            <ol className="qm-board-list">
              {board.map((r) => (
                <li key={r.rank} className={rank === r.rank ? 'qm-me' : ''}>
                  <span className="qm-br-rank">{r.rank}</span>
                  <span className="qm-br-nick">{r.nickname}</span>
                  <span className="qm-br-score">{r.score}</span>
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
