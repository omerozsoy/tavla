import { useMemo } from 'react'
import { Icon } from './Icon'
import Board from './Board'
import DiceRow from './Dice'
import { useT } from '../i18n'
import { initialState } from '../engine/board'
import { pipCount } from '../engine/evaluate'
import { CURRICULUM, type Lesson } from './trainingCurriculum'

// Ders ilerlemesi: localStorage'da { [id]: { done, stars } }. Trainer bitince yazar (ileride).
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
  const board = initialState()
  const dice = <DiceRow faces={[{ value: 4, used: false }, { value: 2, used: false }]} owner="white" />

  // İlk "hazır ama tamamlanmamış" ders = aktif (mavi). Öncesi done, sonrası kilitli görünür.
  const firstActive = CURRICULUM.flatMap((s) => s.lessons).find((l) => l.ready && !progress[l.id]?.done)?.id

  function nodeState(l: Lesson): 'done' | 'active' | 'locked' {
    if (progress[l.id]?.done) return 'done'
    if (l.id === firstActive) return 'active'
    return 'locked'
  }

  const activeLesson = CURRICULUM.flatMap((s) => s.lessons).find((l) => l.id === firstActive)

  return (
    <div className="tr-view bgx tr-path">
      <aside className="bgx-side tr-path-side">
        <div className="bgx-head">
          <button className="bgx-back" onClick={onClose} aria-label={t('common.back')}>
            <Icon name="arrow-right" size={22} />
          </button>
          <span className="bgx-title">{titleOverride || t('tr.masteryPath')}</span>
        </div>

        <div className="tr-path-list">
          {CURRICULUM.map((section) => {
            const done = section.lessons.filter((l) => progress[l.id]?.done).length
            return (
              <div key={section.level} className="tr-sec">
                <div className="tr-sec-head">
                  {t(section.titleKey)}: {done} / {section.lessons.length}
                </div>
                {section.lessons.map((l) => {
                  const st = nodeState(l)
                  const clickable = l.ready
                  return (
                    <button
                      key={l.id}
                      className={`tr-lesson ${st}${clickable ? '' : ' disabled'}`}
                      onClick={() => clickable && onPick(l.id)}
                      disabled={!clickable}
                    >
                      <span className={`tr-node ${st}`}>
                        {st === 'done' ? (
                          <Icon name="star" size={18} />
                        ) : st === 'locked' && !l.ready ? (
                          <Icon name="lock" size={14} />
                        ) : null}
                      </span>
                      <span className="tr-lesson-body">
                        <span className="tr-lesson-title">{l.title}</span>
                        <span className="tr-lesson-sub">
                          {progress[l.id]?.done
                            ? `${l.questions} / ${l.questions}`
                            : t('tr.questions', { n: l.questions })}
                        </span>
                      </span>
                      {st === 'active' && <span className="tr-lesson-dot" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="bgx-spacer" />

        {activeLesson && (
          <div className="tr-path-foot">
            <div className="tr-foot-title">{activeLesson.title}</div>
            <div className="tr-foot-desc">{t('tr.lessonDesc')}</div>
            <button className="bgx-btn green" onClick={() => onPick(activeLesson.id)}>
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
