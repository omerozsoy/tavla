import { Fragment, useMemo, useState } from 'react'
import { Icon } from './Icon'
import Board from './Board'
import DiceRow from './Dice'
import { useT } from '../i18n'
import { pipCount } from '../engine/evaluate'
import { MASTERY_TIERS, TOTAL_QUESTIONS, getQuestions } from './trainingCurriculum'

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
  correct?: number // ilk denemede dogru cozulen soru sayisi
  total?: number // dersin toplam soru sayisi (kayit anindaki)
  idx?: number // RESUME: kaldigi soru (yarim ders) — done ise yok sayilir
  results?: boolean[] // RESUME: o ana kadarki soru sonuclari (ilk-deneme dogru mu)
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
  // Birlesik ustalik yolu: tum tier dersleri tek listede (secili dersi bulmak icin).
  const allLessons: PathLesson[] = MASTERY_TIERS.flatMap((tr) => tr.lessons)
  const [sel, setSel] = useState<string>(allLessons[0]?.id ?? 'rg-open')
  const selLesson = allLessons.find((l) => l.id === sel) ?? allLessons[0]
  // Secili dersin pozisyonlari -> sagda mini-board on izleme. getQuestions onbellekli.
  // ponytail: on izleme ILK PREVIEW_MAX ile sinirli — 150+ soruluk derste her soru bir <Board>
  // (24 nokta + pul + zar DOM) demek, hepsini basmak tarayiciyi donduruyordu. Tumu tek tikla
  // ayni derse girdigi icin 24 pozisyon fikir vermeye yeter. Daha fazlasi gerekirse artir.
  const preview = useMemo(() => getQuestions(sel), [sel])
  const PREVIEW_MAX = 24
  const shownPreview = preview.slice(0, PREVIEW_MAX)
  const extraPreview = preview.length - shownPreview.length

  function starCount(l: PathLesson): number {
    return progress[l.id]?.stars ?? 0
  }

  const renderLesson = (l: PathLesson) => {
    const prog = progress[l.id]
    const done = prog?.done
    const resumeIdx = !done ? (prog?.idx ?? 0) : 0 // yarim ders: kaldigi soru (0 = hic baslanmamis)
    const sub = done
      ? `${prog?.correct ?? l.count} / ${prog?.total ?? l.count}` // tamamlandi: dogru / toplam
      : resumeIdx > 0
        ? `${resumeIdx} / ${l.count}` // yarim: kaldigi soru / toplam
        : t('tr.questions', { n: l.count }) // hic baslanmamis
    return (
      <button
        key={l.id}
        className={`tr-lesson ${l.id === sel ? 'active' : ''}`}
        onClick={() => setSel(l.id)}
        onDoubleClick={() => onPick(l.id)}
      >
        <span className={`tr-node ${done ? 'done' : l.id === sel ? 'active' : ''}`}>
          {done ? <Icon name="star" size={18} /> : resumeIdx > 0 ? <Icon name="arrow-right" size={16} /> : <Icon name="dice" size={16} />}
        </span>
        <span className="tr-lesson-body">
          <span className="tr-lesson-title">{l.title}</span>
          <span className="tr-lesson-sub">{sub}</span>
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

      {/* Sag: secili dersin TUM pozisyonlari, 3'lu mini-board on izleme. Tiklanan -> ders baslar. */}
      <div className="bgx-stage tr-previews">
        <div className="tr-prev-head">
          {selLesson?.title} · {t('tr.questions', { n: preview.length })}
        </div>
        <div className="tr-prev-grid">
          {shownPreview.map((q, i) => (
            <button key={i} className="tr-prev" onClick={() => onPick(sel)} title={q.title ?? ''}>
              <span className="tr-prev-no">{i + 1}</span>
              <Board
                state={q.state}
                selectableFroms={EMPTY_FROM}
                targets={EMPTY_TO}
                selectedFrom={null}
                onSelectFrom={NOOP}
                onSelectTarget={NOOP}
                onDragFrom={NOOP}
                pipTop={pipCount(q.state, 'black')}
                pipBottom={pipCount(q.state, 'white')}
                cube={{ value: 1, owner: null }}
                classic
                numberFrom="white"
                showPip={false}
                showLogo={false}
                centerRight={
                  q.state.dice.length ? (
                    <DiceRow faces={q.state.dice.slice(0, 2).map((v) => ({ value: v, used: false }))} owner="white" />
                  ) : undefined
                }
              />
            </button>
          ))}
          {extraPreview > 0 && (
            <button className="tr-prev tr-prev-more" onClick={() => onPick(sel)}>
              +{extraPreview}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const EMPTY_FROM: Set<number | 'bar'> = new Set()
const EMPTY_TO: Set<number | 'off'> = new Set()
const NOOP = () => {}
