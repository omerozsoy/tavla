import { useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import { uploadPhotoAnalysis, getPhotoAnalysis, type PhotoAnalysisResult } from '../api'
import './PhotoAnalysis.css'

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
