import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import Board from './Board'
import DiceRow from './Dice'
import { useT } from '../i18n'
import { initialState } from '../engine/board'
import { pipCount } from '../engine/evaluate'
import { LESSONS, type Lesson } from './trainingCurriculum'

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
  onClose: () => void
  titleOverride?: string
}

export default function TrainingPath({ onPick, onClose, titleOverride }: Props) {
  const { t } = useT()
  const progress = useMemo(() => loadProgress(), [])
  const [sel, setSel] = useState<string>(LESSONS[0]?.id ?? 'easy')
  const board = initialState()
  const dice = <DiceRow faces={[{ value: 4, used: false }, { value: 2, used: false }]} owner="white" />
  const selLesson = LESSONS.find((l) => l.id === sel) ?? LESSONS[0]

  function starCount(l: Lesson): number {
    return progress[l.id]?.stars ?? 0
  }

  return (
    <div className="tr-view bgx tr-path">
      <aside className="bgx-side tr-path-side">
        <div className="bgx-head">
          <button className="bgx-back" onClick={onClose} aria-label={t('common.back')}>
            <Icon name="arrow-right" size={22} />
          </button>
          {titleOverride && <span className="bgx-title">{titleOverride}</span>}
        </div>

        <div className="tr-sec-head">{t('tr.levelsHead')}</div>
        <div className="tr-path-list">
          {LESSONS.map((l) => {
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
          })}
        </div>

        <div className="bgx-spacer" />

        {selLesson && (
          <div className="tr-path-foot">
            <div className="tr-foot-title">{selLesson.title}</div>
            <div className="tr-foot-desc">{t(selLesson.descKey)}</div>
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
