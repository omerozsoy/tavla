import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { listContents, type Content } from '../api'

interface Q {
  title: string
  options: string[]
  answer: number
  explain: string
}

export default function QuizPlay({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  useEscape(onClose)
  const [items, setItems] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)

  useEffect(() => {
    listContents('quiz')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const questions: Q[] = useMemo(
    () =>
      items
        .map((c) => {
          let d: { options?: string[]; answer?: number; explain?: string } = {}
          try {
            d = JSON.parse(c.body || '{}')
          } catch {
            /* yoksay */
          }
          return {
            title: c.title,
            options: d.options ?? [],
            answer: d.answer ?? 0,
            explain: d.explain ?? '',
          }
        })
        .filter((q) => q.options.length >= 2),
    [items],
  )

  const q = questions[idx]
  const done = idx >= questions.length

  function pick(i: number) {
    if (picked !== null || !q) return
    setPicked(i)
    if (i === q.answer) setScore((s) => s + 1)
  }
  function next() {
    setPicked(null)
    setIdx((i) => i + 1)
  }
  function restart() {
    setIdx(0)
    setPicked(null)
    setScore(0)
  }

  return (
    <div className="register-overlay modal page" onClick={onClose}>
      <div className="register-card quiz-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </button>
        <h2>
          <Icon name="book" size={20} /> {t('quiz.title')}
        </h2>

        {loading ? (
          <div className="admin-empty">{t('admin.loading')}</div>
        ) : questions.length === 0 ? (
          <div className="admin-empty">{t('quiz.empty')}</div>
        ) : done ? (
          <div className="quiz-result">
            <div className="quiz-score">
              {score} / {questions.length}
            </div>
            <p className="register-sub">{t('quiz.done')}</p>
            <button className="galaxy-btn roll" onClick={restart}>
              <Icon name="refresh" /> {t('quiz.again')}
            </button>
          </div>
        ) : (
          <div className="quiz-q">
            <div className="quiz-progress">
              {idx + 1} / {questions.length}
            </div>
            <div className="quiz-question">{q.title}</div>
            <div className="quiz-options">
              {q.options.map((o, i) => {
                let cls = ''
                if (picked !== null) {
                  if (i === q.answer) cls = 'correct'
                  else if (i === picked) cls = 'wrong'
                }
                return (
                  <button
                    key={i}
                    className={`quiz-opt ${cls}`}
                    disabled={picked !== null}
                    onClick={() => pick(i)}
                  >
                    {o}
                  </button>
                )
              })}
            </div>
            {picked !== null && (
              <div className="quiz-feedback">
                <div className={picked === q.answer ? 'qf-ok' : 'qf-no'}>
                  {picked === q.answer ? t('quiz.correct') : t('quiz.wrong')}
                </div>
                {q.explain && <p>{q.explain}</p>}
                <button className="galaxy-btn roll" onClick={next}>
                  {t('quiz.next')} →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
