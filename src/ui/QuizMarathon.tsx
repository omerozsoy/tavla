import { useEffect, useRef, useState, type ReactNode } from 'react'
import './quizMarathon.css'
import { LessonView } from './TrainingView'
import { MARATHON_POOL, questionId, questionPoints, type Question } from './trainingCurriculum'
import { quizLeaderboard, submitQuizScore, type QuizLeaderRow } from '../api'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'

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
export function QuizMarathon({
  onClose,
  nickname,
  tab = 'play',
  onTab,
}: {
  onClose: () => void
  nickname?: string | null
  tab?: Tab
  onTab?: (t: Tab) => void
}) {
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

  const tabs = <QmTabs tab={tab} onTab={(t) => onTab?.(t)} />

  return (
    <>
    {tab === 'records' && <RecordsPage tabs={tabs} onClose={onClose} />}
    {/* Oyun Rekorlar sayfasındayken de mount kalır (gizli) → "Oyna"ya dönünce aynı sorudan devam. */}
    <div className="qm-wrap" hidden={tab === 'records'}>
      {current && (
        <LessonView
          key={step}
          lessonId={`maraton-${step}`}
          fixed={{ title: 'Soru Maratonu', questions: [current] }}
          onBack={onClose}
          onAnswered={handleAnswered}
          sideTabs={tabs}
          chip={
            <span className="qm-chip" title={`${correctCount} doğru`}>
              Skor <b><CountUp value={score} /></b>
              {score > 0 && <span key={score} className="qm-chip-flash" aria-hidden="true" />}
            </span>
          }
          centerInfo={
            answered && (
              <div key={`${step}-${answered}`} className={`qm-pop ${answered}`} role="status">
                <span className="qm-pop-gain">{answered === 'correct' ? `+${gain}` : 'Yanlış'}</span>
                {answered === 'correct' && gain >= 75 && <span className="qm-pop-tag">{gain >= 100 ? 'MÜKEMMEL!' : 'SÜPER!'}</span>}
                <span className="qm-pop-total">Skor <CountUp value={score} from={score - gain} /></span>
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
    </>
  )
}

type Tab = 'play' | 'records'

/** Sayı önceki değerden yeniye ease-out ile sayar (skor animasyonu). Reduced-motion'da anında. */
function CountUp({ value, duration = 600, from: start = 0 }: { value: number; duration?: number; from?: number }) {
  const [shown, setShown] = useState(start)
  const fromRef = useRef(start)
  useEffect(() => {
    const from = fromRef.current
    fromRef.current = value
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || from === value) {
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / duration)
      const e = 1 - Math.pow(1 - k, 3)
      setShown(Math.round(from + (value - from) * e))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{shown}</>
}

function QmTabs({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div className="rank-tabs qm-tabs">
      <Button type="button" variant={tab === 'play' ? 'default' : 'ghost'} aria-pressed={tab === 'play'} onClick={() => onTab('play')}>
        Oyna
      </Button>
      <Button type="button" variant={tab === 'records' ? 'default' : 'ghost'} aria-pressed={tab === 'records'} onClick={() => onTab('records')}>
        <Icon name="trophy" size={15} /> Rekorlar
      </Button>
    </div>
  )
}

/** Rekorlar SAYFASI (/gunun-pozisyonu/rekorlar): tüm zamanların en yüksek maraton skorları. */
function RecordsPage({ tabs, onClose }: { tabs: ReactNode; onClose: () => void }) {
  const [board, setBoard] = useState<QuizLeaderRow[] | null>(null)
  useEffect(() => {
    quizLeaderboard(100)
      .then(setBoard)
      .catch(() => setBoard([]))
  }, [])
  const medal = (n: number) => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : n)
  return (
    <div className="register-card leaderboard-card qm-records-page">
      <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
        <Icon name="x" size={16} />
      </Button>
      <h2><Icon name="trophy" size={20} /> Soru Maratonu Rekorları</h2>
      {tabs}
      {board == null ? (
        <div className="qm-board-empty">Yükleniyor…</div>
      ) : board.length === 0 ? (
        <div className="qm-board-empty">Henüz rekor yok — ilk sen ol!</div>
      ) : (
        <div className="qm-rec-list">
          <div className="qm-rec-row qm-rec-head">
            <span>#</span>
            <span>Oyuncu</span>
            <span>Doğru</span>
            <span>Skor</span>
          </div>
          {board.map((r) => (
            <div
              key={r.rank}
              className={`qm-rec-row${r.rank <= 3 ? ` top top${r.rank}` : ''}`}
              style={{ animationDelay: `${Math.min(r.rank, 25) * 35}ms` }}
            >
              <span className="qm-rec-rank">{medal(r.rank)}</span>
              <span className="qm-rec-nick">{r.nickname}</span>
              <span className="qm-rec-cnt">{r.correct_count}</span>
              <span className="qm-rec-score"><CountUp value={r.score} /></span>
            </div>
          ))}
        </div>
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
  const [rank, setRank] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [board, setBoard] = useState<QuizLeaderRow[] | null>(null)

  useEffect(() => {
    quizLeaderboard(20)
      .then(setBoard)
      .catch(() => setBoard([]))
  }, [])

  // Oyun bitince skor SORMADAN otomatik tabelaya yazılır (giriş yapmışsa hesap adı, misafir "Oyuncu").
  // GameOver tur başına bir kez mount olur (Baştan Başla → phase playing → unmount) → tek gönderim.
  const sentRef = useRef(false)
  useEffect(() => {
    if (sentRef.current || score <= 0) return
    sentRef.current = true
    void submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (submitting || rank != null) return
    setSubmitting(true)
    try {
      const res = await submitQuizScore((accountNick || '').trim(), score, correctCount)
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
        <div className="qm-over-score"><CountUp value={score} duration={1200} /></div>
        <div className="qm-over-sub">
          {correctCount} doğru · en iyi çarpan ×{bestMult}
        </div>

        {rank != null ? (
          <div className="qm-rank">Rekor tabelasındaki sıran: <b>#{rank}</b></div>
        ) : submitting ? (
          <div className="qm-rank">Kaydediliyor…</div>
        ) : null}

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
