import { Fragment, useMemo, useState } from 'react'
import { Icon } from './Icon'
import Board from './Board'
import DiceRow from './Dice'
import { useT } from '../i18n'
import { pipCount } from '../engine/evaluate'
import {
  CURRICULUM,
  CURRICULUM_TOTAL,
  SOURCES,
  sourceQuestions,
  questionId,
  type CurriLesson,
  type Question,
} from './trainingCurriculum'

// --- ESKI ders-bazli ilerleme (uretilmis/rutke dersleri + LessonView resume hala kullanir) ---
export interface LessonProgress {
  done?: boolean
  stars?: number
  correct?: number
  total?: number
  idx?: number // RESUME: kaldigi soru
  results?: boolean[] // RESUME: o ana kadarki sonuclar
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

// --- YENI POZISYON-BAZLI ilerleme: her cozulen pozisyon id -> ilk denemede dogru mu. Konu
//     bolumlerinin ilerlemesi bu kayitlardan hesaplanir (eski koleksiyon-tamamlanma KOPYALANMAZ). ---
const POS_STORE = 'tr-pos-v1'
export function loadPosProgress(): Record<string, { correct: boolean }> {
  try {
    return JSON.parse(localStorage.getItem(POS_STORE) || '{}')
  } catch {
    return {}
  }
}
export function savePosResult(posId: string, correct: boolean) {
  try {
    const all = loadPosProgress()
    all[posId] = { correct: all[posId]?.correct || correct } // bir kez dogru -> dogru kalir
    localStorage.setItem(POS_STORE, JSON.stringify(all))
  } catch {
    /* yoksay */
  }
}
export interface SecProgress {
  solved: number
  correct: number
  total: number
}

interface Props {
  onPick: (id: string) => void
  titleOverride?: string
}

export default function TrainingPath({ onPick, titleOverride }: Props) {
  const { t } = useT()
  const posProg = useMemo(() => loadPosProgress(), [])
  const [sel, setSel] = useState<string>(CURRICULUM[0]?.lessons[0]?.id ?? '')
  const [srcKey, setSrcKey] = useState<string | null>(null) // kaynak filtresi (ana yolu bolmez)

  // Bir bolumun pozisyon-bazli ilerlemesi.
  const prog = (qs: Question[]): SecProgress => {
    let solved = 0
    let correct = 0
    for (const q of qs) {
      const r = posProg[questionId(q)]
      if (r) {
        solved++
        if (r.correct) correct++
      }
    }
    return { solved, correct, total: qs.length }
  }

  const allLessons = CURRICULUM.flatMap((tr) => tr.lessons)
  const selLesson = allLessons.find((l) => l.id === sel) ?? allLessons[0]
  const previewQs = srcKey ? sourceQuestions(srcKey) : selLesson?.questions ?? []
  const PREVIEW_MAX = 24
  const shown = previewQs.slice(0, PREVIEW_MAX)
  const extra = previewQs.length - shown.length
  const pickTarget = srcKey ? `src:${srcKey}` : sel
  const selProg = selLesson ? prog(selLesson.questions) : null

  const renderLesson = (l: CurriLesson) => {
    const p = prog(l.questions)
    const done = p.total > 0 && p.solved >= p.total
    const inProg = !done && p.solved > 0
    const ratio = p.total ? p.correct / p.total : 0
    const stars = done ? (ratio === 1 ? 3 : ratio >= 0.8 ? 2 : ratio >= 0.5 ? 1 : 0) : 0
    const active = !srcKey && l.id === sel
    return (
      <button
        key={l.id}
        className={`tr-lesson ${active ? 'active' : ''} ${done ? 'is-done' : inProg ? 'is-prog' : ''}`}
        onClick={() => {
          setSrcKey(null)
          setSel(l.id)
        }}
        onDoubleClick={() => onPick(l.id)}
      >
        <span className={`tr-node ${done ? 'done' : active ? 'active' : inProg ? 'inprog' : ''}`}>
          {done ? (
            <Icon name="check" size={16} />
          ) : l.isTest ? (
            <Icon name="flag" size={14} />
          ) : inProg ? (
            <Icon name="arrow-right" size={14} />
          ) : (
            <span className="tr-dot" />
          )}
        </span>
        <span className="tr-lesson-body">
          <span className="tr-lesson-title">{l.title}</span>
          <span className="tr-lesson-sub">
            {p.solved} / {p.total} {t('tr.posWord')}
          </span>
        </span>
        {stars > 0 && (
          <span className="tr-lesson-stars">
            {Array.from({ length: stars }).map((_, i) => (
              <Icon key={i} name="star" size={12} />
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
        <div className="tr-total">{t('tr.totalQuestions', { n: CURRICULUM_TOTAL })}</div>

        {/* Dikey egitim yolu: tier basliklari + "X/Y", dikey cizgiyle bagli dairesel dugumler. */}
        <div className="tr-tiers-scroll">
          {CURRICULUM.map((tier) => {
            const doneN = tier.lessons.filter((l) => {
              const p = prog(l.questions)
              return p.total > 0 && p.solved >= p.total
            }).length
            return (
              <Fragment key={tier.key}>
                <div className="tr-sec-tier">
                  <span>{tier.label}</span>
                  <span className="tr-tier-count">
                    {doneN}/{tier.lessons.length}
                  </span>
                </div>
                <div className="tr-path-list tr-path-track">{tier.lessons.map(renderLesson)}</div>
              </Fragment>
            )
          })}
        </div>

        {/* KAYNAK FILTRESI — ana egitim yolunu bolmez, ayri filtre (Euler/Bray/Mochy...). */}
        <div className="tr-sources">
          <div className="tr-sources-lbl">{t('tr.sources')}</div>
          <div className="tr-sources-row">
            <button className={`tr-src ${!srcKey ? 'on' : ''}`} onClick={() => setSrcKey(null)}>
              {t('tr.allSources')}
            </button>
            {SOURCES.map((s) => (
              <button key={s.key} className={`tr-src ${srcKey === s.key ? 'on' : ''}`} onClick={() => setSrcKey(s.key)}>
                {s.label} <span className="tr-src-n">{s.count}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Sag: secili bolumun (veya kaynagin) pozisyonlari — baslik, sayi, basla/devam, onizleme. */}
      <div className="bgx-stage tr-previews">
        <div className="tr-prev-head">
          <span className="tr-prev-title">{srcKey ? SOURCES.find((s) => s.key === srcKey)?.label : selLesson?.title}</span>
          <span className="tr-prev-sub">· {t('tr.questions', { n: previewQs.length })}</span>
          {previewQs.length > 0 && (
            <button className="bgx-btn green tr-prev-start" onClick={() => onPick(pickTarget)}>
              {!srcKey && selProg && selProg.solved > 0 ? t('tr.resumeSection') : t('tr.start')}
            </button>
          )}
        </div>
        <div className="tr-prev-grid">
          {shown.map((q, i) => (
            <button key={i} className="tr-prev" onClick={() => onPick(pickTarget)} title={q.title ?? ''}>
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
          {extra > 0 && (
            <button className="tr-prev tr-prev-more" onClick={() => onPick(pickTarget)}>
              +{extra}
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
