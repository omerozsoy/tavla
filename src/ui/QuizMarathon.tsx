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
export function QuizMarathon({ onClose, nickname }: { onClose: () => void; nickname?: string | null }) {
  const [phase, setPhase] = useState<'playing' | 'over'>('playing')
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [bestMult, setBestMult] = useState(1)
  const [step, setStep] = useState(0)
  const seenRef = useRef<Set<string>>(new Set())
  const [current, setCurrent] = useState<Question | null>(() => pickNext(MARATHON_POOL, new Set()))
  const [answered, setAnswered] = useState<null | 'correct' | 'wrong'>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [gain, setGain] = useState(0) // son cevabın puanı (her cevaptan sonra skor pop-up'ında)

  const reset = () => {
    seenRef.current = new Set()
    setScore(0)
    setCorrectCount(0)
    setBestMult(1)
    setStep(0)
    setCurrent(pickNext(MARATHON_POOL, new Set()))
    setAnswered(null)
    setModalOpen(false)
    setPhase('playing')
  }

  const handleAnswered = (correct: boolean, q: Question) => {
    if (correct) {
      const pts = questionPoints(q)
      setScore((s) => s + pts)
      setCorrectCount((c) => c + 1)
      setBestMult((m) => Math.max(m, pts / 25))
      setGain(pts)
      setAnswered('correct')
    } else {
      setGain(0)
      setAnswered('wrong')
      setPhase('over') // ilk yanlış = yarışma biter; tahtada doğru hamle görünür, skor "Skorunu Gör" ile modalda
    }
  }

  const next = () => {
    if (!current) return
    seenRef.current.add(questionId(current))
    const n = pickNext(MARATHON_POOL, seenRef.current)
    if (!n) {
      setPhase('over') // havuz bitti: tur tamamlandı
      setModalOpen(true)
      return
    }
    setCurrent(n)
    setStep((s) => s + 1)
    setAnswered(null)
  }

  return (
    <div className="qm-wrap">
      {current && (
        <LessonView
          key={step}
          lessonId={`maraton-${step}`}
          fixed={{ title: 'Soru Maratonu', questions: [current] }}
          onBack={onClose}
          onAnswered={handleAnswered}
          chip={
            <span className="qm-chip" title={`${correctCount} doğru`}>
              Skor <b>{score}</b>
            </span>
          }
          centerInfo={
            answered && (
              <div key={`${step}-${answered}`} className={`qm-pop ${answered}`} role="status">
                <span className="qm-pop-gain">{answered === 'correct' ? `+${gain}` : 'Yanlış'}</span>
                <span className="qm-pop-total">Skor {score}</span>
              </div>
            )
          }
          centerAction={
            phase === 'over'
              ? { label: 'Skorunu Gör', onClick: () => setModalOpen(true) }
              : answered === 'correct'
                ? { label: 'Sonraki Soru →', onClick: next }
                : null
          }
        />
      )}
      {/* Modal kapansa da GameOver mount kalır (gönderilen sıra/durum kaybolmaz → çift gönderim yok). */}
      {phase === 'over' && (
        <GameOver
          open={modalOpen}
          score={score}
          correctCount={correctCount}
          bestMult={bestMult}
          accountNick={nickname}
          onRestart={reset}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  )
}

function GameOver({
  open,
  score,
  correctCount,
  bestMult,
  accountNick,
  onRestart,
  onClose,
}: {
  open: boolean
  score: number
  correctCount: number
  bestMult: number
  accountNick?: string | null // giriş yapmışsa hesabın takma adı: sorulmaz (sunucu da hesaptakini yazar)
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
      const res = await submitQuizScore((accountNick || nick).trim(), score, correctCount)
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
    <div className="qm-over" role="dialog" aria-modal="true" hidden={!open} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="qm-over-card">
        <button className="qm-exit" onClick={onClose} aria-label="Kapat" title="Tahtaya dön">✕</button>
        <div className="qm-over-score">{score}</div>
        <div className="qm-over-sub">
          {correctCount} doğru · en iyi çarpan ×{bestMult}
        </div>

        {rank == null ? (
          <div className="qm-submit">
            {accountNick ? (
              <span className="qm-nick qm-nick-account">{accountNick}</span>
            ) : (
              <input
                className="qm-nick"
                maxLength={20}
                placeholder="Takma adın"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
              />
            )}
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
