import { useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import { reviewMat, type MatReview as MatReviewResp } from '../api'
import type { LogEntry } from './MatchReport'
import MatReview, { computeSummary, type MatSummary } from './MatReview'

type MatLuck = MatReviewResp['luck']

// Son analiz sonucu localStorage'da tutulur -> sayfa REFRESH'te kaybolmaz (kullanıcı isteği).
// İnceleme kapatılınca (reset) temizlenir; yeni analiz üzerine yazar.
const STORE_KEY = 'matReview:last'
type Saved = { log: LogEntry[]; names: string[] | null; matchLength: number | null; summary: MatSummary | null; luck?: MatLuck }
const loadSaved = (): Saved | null => {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Saved
    return Array.isArray(s?.log) && s.log.length ? s : null
  } catch {
    return null
  }
}

// Mat Analiz sayfası: kullanıcı .mat maçı yükler -> TavlaTV motoru maçı hamle-hamle analiz eder
// -> tam-ekran görüntüleyici (MatReview) açılır ve ÜSTÜNDE "Analiz Tamamlandı" özet popup'ı
// gösterilir. Popup kapatılınca arkadaki görüntüleyici kalır (HedgeHog akışı).
export default function MatAnalyzer({ onClose, currentName }: { onClose: () => void; currentName?: string }) {
  const { t } = useT()
  const notify = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [matText, setMatText] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  // Refresh'te kaybolmasın: açılışta son kaydı geri yükle.
  const saved0 = loadSaved()
  const [reviewLog, setReviewLog] = useState<LogEntry[] | null>(saved0?.log ?? null)
  const [names, setNames] = useState<string[] | null>(saved0?.names ?? null)
  const [matchLength, setMatchLength] = useState<number | null>(saved0?.matchLength ?? null)
  const [summary, setSummary] = useState<MatSummary | null>(saved0?.summary ?? null)
  const [luck, setLuck] = useState<MatLuck | undefined>(saved0?.luck)

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
      const sm = computeSummary(r.log, r.names ?? null, Date.now() - t0)
      setNames(r.names ?? null)
      setMatchLength(r.matchLength ?? null)
      setSummary(sm)
      setLuck(r.luck)
      setReviewLog(r.log)
      // Refresh'te kaybolmasın diye kaydet (kota dolarsa sessizce atla — analiz yine çalışır).
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ log: r.log, names: r.names ?? null, matchLength: r.matchLength ?? null, summary: sm, luck: r.luck }))
      } catch {
        /* kota — persist yok */
      }
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
    setLuck(undefined)
    setNames(null)
    setMatchLength(null)
    setMatText('')
    setFileName('')
    if (fileRef.current) fileRef.current.value = ''
    try {
      localStorage.removeItem(STORE_KEY) // inceleme kapandı -> kaydı temizle
    } catch {
      /* yok say */
    }
  }

  // Analiz sonrası: tam-ekran görüntüleyici + açılış özet popup'ı.
  if (reviewLog) {
    return (
      <MatReview log={reviewLog} names={names} matchLength={matchLength} summary={summary} luck={luck} currentName={currentName} onClose={reset} />
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
            /* iOS: .mat uzantisini taniyan UTI yok -> dosya "public.data" olarak isaretlenir;
               yalniz .mat/text/plain verirsek iOS dosyayi SOLUK (secilemez) yapar. octet-stream
               (public.data) ekleyince iPhone'da secilebilir; masaustunde .mat filtresi korunur. */
            accept=".mat,text/plain,application/octet-stream"
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
