import { useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import { uploadPhotoAnalysis, getPhotoAnalysis, type PhotoAnalysisResult } from '../api'
import './PhotoAnalysis.css'

// Taninan konumu (points[24], beyaz +, siyah -) hafif SVG tahtaya cizer — kullanici tanimanin
// dogrulugunu GORSEL dogrulasin (oyunun Board bileseni oyun-durumuna bagli; burada gerekmez).
// Standart numaralama: ust 13-18|19-24 (sol->sag), alt 12-7|6-1 (sol->sag), orta bar.
function PositionBoard({ points }: { points: number[] }) {
  const W = 360, H = 240, m = 6, barW = 20
  const fieldW = (W - 2 * m - barW) / 2
  const pw = fieldW / 6
  const r = Math.min(pw / 2 - 1.5, 12)
  const colX = (c: number) => (c < 6 ? m + (c + 0.5) * pw : m + fieldW + barW + (c - 6 + 0.5) * pw)
  const topPoint = (c: number) => (c < 6 ? 13 + c : 19 + (c - 6))
  const botPoint = (c: number) => (c < 6 ? 12 - c : 6 - (c - 6))

  const tri = (c: number, top: boolean, dark: boolean) => {
    const x = colX(c), hw = pw / 2 - 1
    const baseY = top ? m : H - m
    const apexY = top ? H / 2 - 14 : H / 2 + 14
    return <polygon key={`t${top ? 'T' : 'B'}${c}`} points={`${x - hw},${baseY} ${x + hw},${baseY} ${x},${apexY}`} fill={dark ? '#2f4150' : '#d8cfc0'} opacity={0.55} />
  }
  const stack = (c: number, top: boolean, n: number) => {
    if (!n) return null
    const x = colX(c), count = Math.abs(n), white = n > 0, vis = Math.min(count, 5)
    const dy = 2 * r - 2
    const cy = (i: number) => (top ? m + r + i * dy : H - m - r - i * dy)
    return (
      <g key={`s${top ? 'T' : 'B'}${c}`}>
        {Array.from({ length: vis }, (_, i) => (
          <circle key={i} cx={x} cy={cy(i)} r={r} fill={white ? '#f3eee1' : '#b5423a'} stroke="rgba(0,0,0,.35)" strokeWidth={1} />
        ))}
        {count > 5 && (
          <text x={x} y={cy(4) + 3.5} fontSize={10} textAnchor="middle" fontWeight="700" fill={white ? '#333' : '#fff'}>{count}</text>
        )}
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="photo-board" role="img" aria-label="board">
      <rect x={0} y={0} width={W} height={H} rx={8} fill="#1b2730" />
      <rect x={W / 2 - barW / 2} y={0} width={barW} height={H} fill="#0f1720" />
      {Array.from({ length: 12 }, (_, c) => tri(c, true, c % 2 === 0))}
      {Array.from({ length: 12 }, (_, c) => tri(c, false, c % 2 === 1))}
      {Array.from({ length: 12 }, (_, c) => stack(c, true, points[topPoint(c) - 1] || 0))}
      {Array.from({ length: 12 }, (_, c) => stack(c, false, points[botPoint(c) - 1] || 0))}
    </svg>
  )
}

/**
 * Fotograftan Pozisyon Analizi: kullanici tahta fotografi ceker/secer -> sunucu tanima (foto->
 * yapisal konum) + gnubg -> en iyi hamle. Tanima tahtayi OTOMATIK bulup duzeltir (manuel kose YOK).
 * Web+mobil tek kod: <input capture="environment"> webview'de kamerayi, masaustunde dosya secici acar.
 */
export default function PhotoAnalysis({ onClose, titleOverride }: { onClose: () => void; titleOverride?: string }) {
  const { t } = useT()
  const notify = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PhotoAnalysisResult | null>(null)

  function pick(f: File) {
    setFile(f)
    setResult(null)
    setPreview(URL.createObjectURL(f))
  }

  // Telefon fotograflari buyuk (10MB+) + EXIF donuk olabilir -> upload once kucult + EXIF duzelt.
  async function downscale(f: File, max = 1600, quality = 0.85): Promise<Blob> {
    const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' })
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
    return await new Promise((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', quality),
    )
  }

  async function analyze() {
    if (!file || busy) return
    setBusy(true)
    setResult(null)
    try {
      const blob = await downscale(file)
      const { id } = await uploadPhotoAnalysis(blob)
      // poll: pending -> done/invalid/failed (~1.5sn aralik, <=60sn)
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1500))
        const r = await getPhotoAnalysis(id)
        if (r.status !== 'pending') {
          setResult(r)
          break
        }
      }
    } catch (e) {
      notify.error((e as { message?: string })?.message || t('photo.err'))
    } finally {
      setBusy(false)
    }
  }

  const cands = result?.hint?.result?.hint?.slice(0, 3) ?? []
  const done = result?.status === 'done' && result.valid && cands.length > 0

  return (
    <div className="photo-page">
      <button className="photo-x" onClick={onClose} type="button" aria-label={t('common.close')}>
        <Icon name="x" size={20} />
      </button>
      <div className="photo-head">
        <h1 className="photo-title">
          <Icon name="camera" size={22} /> {titleOverride || t('photo.title')}
        </h1>
        <p className="photo-sub">{t('photo.sub')}</p>
      </div>

      <div className="photo-capture">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) pick(f)
          }}
        />
        {preview ? (
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <img src={preview} className="photo-preview" alt="" onClick={() => fileRef.current?.click()} />
        ) : (
          <button className="photo-drop" onClick={() => fileRef.current?.click()} type="button">
            <Icon name="camera" size={40} />
            <div className="photo-drop-title">{t('photo.pick')}</div>
            <div className="photo-drop-hint">{t('photo.pickHint')}</div>
          </button>
        )}

        <Button className="photo-analyze-btn" onClick={analyze} disabled={busy || !file}>
          {busy ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="search" size={16} />}
          {busy ? t('photo.analyzing') : t('photo.analyze')}
        </Button>
      </div>

      {result && (
        <div className="photo-result">
          {done ? (
            <>
              {result!.position?.points && <PositionBoard points={result!.position.points} />}
              <div className="photo-dice">
                {t('photo.dice')}: <b>{result!.position?.dice?.join('-') || '—'}</b>
              </div>
              <div className="photo-best">
                {t('photo.best')}: <b>{cands[0].move}</b>
              </div>
              {cands.length > 1 && (
                <ul className="photo-cands">
                  {cands.map((c, i) => (
                    <li key={i}>
                      <span className="photo-cand-move">{c.move}</span>
                      {typeof c.equity === 'number' && (
                        <span className="photo-cand-eq">{c.equity.toFixed(3)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="photo-invalid">{t(result!.status === 'invalid' ? 'photo.invalid' : 'photo.failed')}</div>
          )}
        </div>
      )}
    </div>
  )
}
