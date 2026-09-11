import { useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import { analyzeMat, reviewMat, type MatAnalysis, type MatPlayerSummary } from '../api'
import type { LogEntry } from './MatchReport'
import MatReview from './MatReview'

// Mat Analiz sayfasi: kullanici .mat maci yukler -> gnubg TAM analiz eder -> ozet gosterilir
// (HedgeHog "Analysis Complete" benzeri: rating + blunder/hata/kesinsizlik + oyuncu tablosu).
// Faz 1 = ozet; hamle-hamle gorüntüleyici sonraki faz.
export default function MatAnalyzer({ onClose }: { onClose: () => void }) {
  const { t } = useT()
  const notify = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [matText, setMatText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<MatAnalysis | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  // Faz 2: hamle-hamle inceleme (MatchReport görüntüleyici)
  const [reviewing, setReviewing] = useState(false)
  const [reviewLog, setReviewLog] = useState<LogEntry[] | null>(null)

  function readFile(f: File) {
    if (f.size > 500_000) {
      notify.error(t('ma.tooBig'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setMatText(String(reader.result || ''))
      setFileName(f.name)
      setResult(null)
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
    try {
      const r = await analyzeMat(matText, 2)
      if (!r || !r.ok) throw new Error('failed')
      setResult(r)
    } catch (e) {
      const m = e as { message?: string }
      notify.error(m?.message || t('ma.analyzeErr'))
    } finally {
      setBusy(false)
    }
  }

  async function review() {
    if (!matText.trim()) return
    setReviewing(true)
    try {
      const r = await reviewMat(matText, 2)
      if (!r || !r.ok || !Array.isArray(r.log) || r.log.length === 0) throw new Error('failed')
      setReviewLog(r.log)
    } catch (e) {
      const m = e as { message?: string }
      notify.error(m?.message || t('ma.reviewErr'))
    } finally {
      setReviewing(false)
    }
  }

  function reset() {
    setResult(null)
    setMatText('')
    setFileName('')
    setShowRaw(false)
    setReviewLog(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="ma-page">
      <div className="ma-head">
        <h1 className="ma-title">
          <Icon name="analyze" size={22} /> {t('ma.title')}
        </h1>
        <p className="ma-sub">{t('ma.sub')}</p>
      </div>

      {/* ---- Yukleme alani ---- */}
      {!result && (
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
      )}

      {/* ---- Sonuc ---- */}
      {result && (
        <div className="ma-result">
          <div className="ma-result-head">
            <span className="ma-badge-len">
              {result.matchLength ? t('ma.pointMatch', { n: result.matchLength }) : t('ma.moneyGame')}
            </span>
            <div className="ma-result-actions">
              <Button onClick={review} disabled={reviewing}>
                {reviewing ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="search" size={14} />}
                {reviewing ? t('ma.reviewing') : t('ma.review')}
              </Button>
              <Button variant="secondary" onClick={reset}>
                <Icon name="arrow-up" size={14} /> {t('ma.newFile')}
              </Button>
            </div>
          </div>

          <div className="ma-players">
            {(result.players || []).map((p, i) => (
              <PlayerCard key={i} p={p} />
            ))}
          </div>

          {/* Detayli gnubg istatistikleri (bolumlu tablo + ham metin) */}
          <button type="button" className="ma-raw-toggle" onClick={() => setShowRaw((s) => !s)}>
            <Icon name="chevron" size={14} className={showRaw ? 'ma-chev-up' : ''} /> {t('ma.details')}
          </button>
          {showRaw && (
            <div className="ma-raw">
              {(result.stats?.sections || []).map((sec, si) => (
                <div className="ma-stat-sec" key={si}>
                  {sec.title && <div className="ma-stat-title">{sec.title}</div>}
                  <table className="ma-stat-table">
                    <thead>
                      <tr>
                        <th />
                        <th>{result.names?.[0] || t('ma.player1')}</th>
                        <th>{result.names?.[1] || t('ma.player2')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.rows.map((r, ri) => (
                        <tr key={ri}>
                          <td className="ma-stat-label">{r.label}</td>
                          <td>{r.values?.[0] ?? ''}</td>
                          <td>{r.values?.[1] ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {result.statistics_match && (
                <details className="ma-rawtext">
                  <summary>{t('ma.rawText')}</summary>
                  <pre>{result.statistics_match}</pre>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      <div className="ma-footer">
        <Button variant="ghost" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>

      {/* Faz 2: hamle-hamle inceleme (HedgeHog benzeri tam-ekran üç panel) */}
      {reviewLog && (
        <MatReview
          log={reviewLog}
          names={result?.names ?? null}
          matchLength={result?.matchLength ?? null}
          onClose={() => setReviewLog(null)}
        />
      )}
    </div>
  )
}

// Bir oyuncunun ozet karti: rating + ER + blunder/hata/kesinsizlik + kaybedilen esitlik.
function PlayerCard({ p }: { p: MatPlayerSummary }) {
  const { t } = useT()
  const rating = p.overallRating || p.chequerRating || null
  const num = (v: number | null, d = 1) => (v === null || v === undefined ? '—' : Math.abs(v).toFixed(d))
  return (
    <div className="ma-pcard">
      <div className="ma-pcard-name">{p.name || t('ma.player')}</div>
      {rating && <div className="ma-pcard-rating">{rating}</div>}
      <div className="ma-er">
        <span className="ma-er-num">{p.erPerMove === null ? '—' : Math.abs(p.erPerMove).toFixed(1)}</span>
        <span className="ma-er-unit">{t('ma.erUnit')}</span>
      </div>
      <div className="ma-marks">
        <div className="ma-mark blunder">
          <span className="ma-mark-n">{p.blunders ?? '—'}</span>
          <span className="ma-mark-l">{t('ma.blunders')}</span>
        </div>
        <div className="ma-mark error">
          <span className="ma-mark-n">{p.errors ?? '—'}</span>
          <span className="ma-mark-l">{t('ma.errors')}</span>
        </div>
        <div className="ma-mark inacc">
          <span className="ma-mark-n">{p.inaccuracies ?? '—'}</span>
          <span className="ma-mark-l">{t('ma.inaccuracies')}</span>
        </div>
      </div>
      <div className="ma-rows">
        <div className="ma-row">
          <span>{t('ma.equityLost')}</span>
          <span>{num(p.equityLost, 3)}</span>
        </div>
        <div className="ma-row">
          <span>{t('ma.missedDoubles')}</span>
          <span>{p.missedDoubles ?? '—'}</span>
        </div>
      </div>
    </div>
  )
}
