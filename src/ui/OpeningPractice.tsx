import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import Loading from './Loading'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { LessonView } from './TrainingView'
import { openingToQuestion, type Question } from './trainingCurriculum'
import { DIFF_BANDS, DIFF_BAND_TR, type DiffBand } from './difficultyPositions'
import { getOpeningCounts, getOpeningPage } from '../api'

// AÇILIŞ PRATİĞİ — tek yer. ~84k motor-doğrulanmış açılış pozisyonu DB'den LAZY çekilir (bundle'a
// gömülü DEĞİL). Band seç -> ders (20'lik sayfa) seç -> o sayfa API'den gelir -> LessonView fixed
// modda oynatır (Günün Pozisyonu ile aynı tahta/cevap-kontrol mantığı). Çift dizilim yok (DB garantisi).
const PER = 20

export default function OpeningPractice({ onClose, titleOverride }: { onClose: () => void; titleOverride?: string }) {
  useEscape(onClose)
  const { t } = useT()
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [band, setBand] = useState<DiffBand | null>(null)
  const [page, setPage] = useState<number | null>(null) // 0-tabanlı ders
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    getOpeningCounts().then(setCounts).catch(() => setErr(t('op.loadErr')))
  }, [t])

  useEffect(() => {
    if (band == null || page == null) return
    let alive = true
    setQuestions(null)
    setErr('')
    getOpeningPage(band, page + 1, PER)
      .then((r) => {
        if (!alive) return
        setQuestions(r.items.map(openingToQuestion).filter((q): q is Question => q !== null))
      })
      .catch(() => {
        if (alive) setErr(t('op.loadErr'))
      })
    return () => {
      alive = false
    }
  }, [band, page, t])

  // --- oynatma: seçili ders ---
  if (band != null && page != null) {
    if (err) return <div className="tr-view bgx op-practice"><div className="bgx-loading">{err}</div></div>
    if (!questions) {
      return (
        <div className="tr-view bgx op-practice">
          <div className="bgx-loading" role="status"><Loading size={44} /><span>{t('tr.preparing')}</span></div>
        </div>
      )
    }
    return (
      <LessonView
        lessonId={`op-${band}-${page}`}
        fixed={{ title: `${DIFF_BAND_TR[band]} ${page + 1}`, questions }}
        onBack={() => setPage(null)}
      />
    )
  }

  // --- band içi ders listesi ---
  if (band != null) {
    const n = counts?.[band] ?? 0
    const lessons = Math.ceil(n / PER)
    return (
      <div className="tr-view bgx tr-path op-practice">
        <aside className="bgx-side tr-path-side">
          <div className="bgx-head">
            <button className="op-back" onClick={() => setBand(null)}>
              <Icon name="chevron" size={16} /> {t('op.back')}
            </button>
          </div>
          <div className="tr-sec-tier"><span>{DIFF_BAND_TR[band]}</span><span className="tr-tier-count">{n}</span></div>
          <div className="tr-tiers-scroll">
            <div className="tr-path-list">
              {Array.from({ length: lessons }, (_, i) => (
                <button key={i} className="tr-lesson" onClick={() => setPage(i)}>
                  <span className="tr-lesson-body"><span className="tr-lesson-title">{DIFF_BAND_TR[band]} {i + 1}</span></span>
                  <Icon name="chevron" size={16} />
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    )
  }

  // --- giriş: band listesi ---
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0
  return (
    <div className="tr-view bgx tr-path op-practice">
      <aside className="bgx-side tr-path-side">
        <div className="bgx-head"><span className="bgx-title">{titleOverride || t('op.title')}</span></div>
        <div className="tr-total">{t('op.total', { n: total })}</div>
        {err && <div className="bgx-loading">{err}</div>}
        {!counts ? (
          <div className="bgx-loading" role="status"><Loading size={44} /><span>{t('tr.preparing')}</span></div>
        ) : (
          <div className="tr-tiers-scroll">
            <div className="tr-path-list">
              {DIFF_BANDS.map((b) => (
                <button key={b} className="tr-lesson" onClick={() => setBand(b)}>
                  <span className="tr-lesson-body">
                    <span className="tr-lesson-title">{DIFF_BAND_TR[b]}</span>
                    <span className="tr-lesson-sub">{counts[b] ?? 0}</span>
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
