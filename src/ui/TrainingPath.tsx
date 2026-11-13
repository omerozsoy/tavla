import { Fragment, useMemo, useState } from 'react'
import { Icon } from './Icon'
import Board from './Board'
import DiceRow from './Dice'
import { useT } from '../i18n'
import { initialState } from '../engine/board'
import { pipCount } from '../engine/evaluate'
import { MASTERY_TIERS, TOTAL_QUESTIONS } from './trainingCurriculum'

// Seviye + tier dersleri icin ortak minimal sekil.
interface PathLesson {
  id: string
  title: string
  count: number
}

// Ders ilerlemesi: localStorage'da { [id]: { done, stars } }. Ders bitince yazilir.
export interface LessonProgress {
  done?: boolean
  stars?: number
}
const STORE = 'tr-progress-v1'
export function loadProgress(): Record<string, LessonProgress> {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}')
  } catch {
    return {}
  }
}
export function saveLessonProgress(id: string, p: LessonProgress) {
  try {
    const all = loadProgress()
    all[id] = { ...all[id], ...p }
    localStorage.setItem(STORE, JSON.stringify(all))
  } catch {
    /* yoksay */
  }
}

interface Props {
  onPick: (lessonId: string) => void
  titleOverride?: string
}

export default function TrainingPath({ onPick, titleOverride }: Props) {
  const { t } = useT()
  const progress = useMemo(() => loadProgress(), [])
  const board = initialState()
  const dice = <DiceRow faces={[{ value: 4, used: false }, { value: 2, used: false }]} owner="white" />
  // Birlesik ustalik yolu: tum tier dersleri tek listede (secili dersi bulmak icin).
  const allLessons: PathLesson[] = MASTERY_TIERS.flatMap((tr) => tr.lessons)
  const [sel, setSel] = useState<string>(allLessons[0]?.id ?? 'rg-open')
  const selLesson = allLessons.find((l) => l.id === sel) ?? allLessons[0]

  function starCount(l: PathLesson): number {
    return progress[l.id]?.stars ?? 0
  }

  const renderLesson = (l: PathLesson) => {
    const done = progress[l.id]?.done
    return (
      <button
        key={l.id}
        className={`tr-lesson ${l.id === sel ? 'active' : ''}`}
        onClick={() => setSel(l.id)}
        onDoubleClick={() => onPick(l.id)}
      >
        <span className={`tr-node ${done ? 'done' : l.id === sel ? 'active' : ''}`}>
          {done ? <Icon name="star" size={18} /> : <Icon name="dice" size={16} />}
        </span>
        <span className="tr-lesson-body">
          <span className="tr-lesson-title">{l.title}</span>
          <span className="tr-lesson-sub">
            {done ? `${l.count} / ${l.count}` : t('tr.questions', { n: l.count })}
          </span>
        </span>
        {starCount(l) > 0 && (
          <span className="tr-lesson-stars">
            {Array.from({ length: starCount(l) }).map((_, i) => (
              <Icon key={i} name="star" size={13} />
            ))}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="tr-view bgx tr-path">
      <aside className="bgx-side tr-path-side">
        {titleOverride && (
          <div className="bgx-head">
            <span className="bgx-title">{titleOverride}</span>
          </div>
        )}
        <div className="tr-total">{t('tr.totalQuestions', { n: TOTAL_QUESTIONS })}</div>

        {/* Tum katmanlar TEK scroll icinde -> panel board boyunda kalir, board en ustte durur. */}
        <div className="tr-tiers-scroll">
          {MASTERY_TIERS.map((tier) => (
            <Fragment key={tier.label}>
              <div className="tr-sec-tier">{tier.label}</div>
              <div className="tr-path-list">
                {tier.lessons.map((l) => renderLesson({ id: l.id, title: l.title, count: l.count }))}
              </div>
            </Fragment>
          ))}
        </div>

        {selLesson && (
          <div className="tr-path-foot">
            <div className="tr-foot-title">{selLesson.title}</div>
            <div className="tr-foot-desc">{t('tr.lesson.desc')}</div>
            <button className="bgx-btn green" onClick={() => onPick(selLesson.id)}>
              {t('tr.continue')}
            </button>
          </div>
        )}
      </aside>

      <div className="bgx-stage">
        <div className="bgx-board">
          <Board
            state={board}
            selectableFroms={new Set()}
            targets={new Set()}
            selectedFrom={null}
            onSelectFrom={() => {}}
            onSelectTarget={() => {}}
            onDragFrom={() => {}}
            pipTop={pipCount(board, 'black')}
            pipBottom={pipCount(board, 'white')}
            cube={{ value: 1, owner: null }}
            numberFrom="white"
            centerRight={dice}
            showPip
          />
        </div>
      </div>
    </div>
  )
}
