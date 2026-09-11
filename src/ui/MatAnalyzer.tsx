import { useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import { reviewMat } from '../api'
import type { LogEntry } from './MatchReport'
import MatReview, { computeSummary, type MatSummary } from './MatReview'

// Mat Analiz sayfası: kullanıcı .mat maçı yükler -> TavlaTV motoru maçı hamle-hamle analiz eder
// -> tam-ekran görüntüleyici (MatReview) açılır ve ÜSTÜNDE "Analiz Tamamlandı" özet popup'ı
// gösterilir. Popup kapatılınca arkadaki görüntüleyici kalır (HedgeHog akışı).
export default function MatAnalyzer({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const notify = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [matText, setMatText] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [reviewLog, setReviewLog] = useState<LogEntry[] | null>(null)
  const [names, setNames] = useState<string[] | null>(null)
  const [matchLength, setMatchLength] = useState<number | null>(null)
  const [summary, setSummary] = useState<MatSummary | null>(null)

  function readFile(f: File) {
    if (f.size > 500_000) {
      notify.error(t('ma.tooBig'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setMatText(String(reader.result || ''))
      setFileName(f.name)
    }
    reader.onerror = () => notify.error(t('ma.readErr'))
    reader.readAsText(f)
  }

  async function analyze() {
    if (!matText.trim()) {
      notify.error(t('ma.noFile'))
      return
    }
    setBusy(true)
    const t0 = Date.now()
    try {
      const r = await reviewMat(matText, 2)
      if (!r || !r.ok || !Array.isArray(r.log) || r.log.length === 0) throw new Error('failed')
      setNames(r.names ?? null)
      setMatchLength(r.matchLength ?? null)
      setSummary(computeSummary(r.log, r.names ?? null, Date.now() - t0))
      setReviewLog(r.log)
    } catch (e) {
      const m = e as { message?: string }
      notify.error(m?.message || t('ma.analyzeErr'))
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setReviewLog(null)
    setSummary(null)
    setNames(null)
    setMatchLength(null)
    setMatText('')
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // Analiz sonrası: tam-ekran görüntüleyici + açılış özet popup'ı.
  if (reviewLog) {
    return (
      <MatReview log={reviewLog} names={names} matchLength={matchLength} summary={summary} onClose={reset} />
    )
  }

  // Yükleme ekranı.
  return (
    <div className="ma-page">
      <div className="ma-head">
        <h1 className="ma-title">
          <Icon name="analyze" size={22} /> {t('ma.title')}
        </h1>
        <p className="ma-sub">{t('ma.sub')}</p>
      </div>

      <div className="ma-upload-wrap">
        <div
          className={`ma-drop ${dragOver ? 'over' : ''} ${fileName ? 'has-file' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) readFile(f)
          }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".mat,text/plain"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) readFile(f)
            }}
          />
          <Icon name={fileName ? 'analyze' : 'arrow-up'} size={34} />
          <div className="ma-drop-title">{fileName || t('ma.dropTitle')}</div>
          <div className="ma-drop-hint">{fileName ? t('ma.dropReady') : t('ma.dropHint')}</div>
        </div>

        <Button className="ma-analyze-btn" onClick={analyze} disabled={busy || !matText.trim()}>
          {busy ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="analyze" size={16} />}
          {busy ? t('ma.analyzing') : t('ma.analyze')}
        </Button>
      </div>

      <div className="ma-footer">
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </div>
  )
}
