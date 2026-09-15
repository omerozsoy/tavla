import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { useToast } from './Toast'
import { reportBug, ApiError } from '../api'
import './bugReport.css'

interface Props {
  // Kullanicinin bulundugu sayfanin okunur adi (App aktif menu etiketinden gecer).
  // Bos ise document.title'a duser. Kullanici yine de duzenleyebilir.
  currentPage?: string
  // Giris yapmis mi — misafirse ad/e-posta (opsiyonel geri donus) alanlari gosterilir.
  loggedIn?: boolean
}

// Dosyayi data-URL'e cevir. Buyuk gorselleri (>~1600px) canvas ile kucult ki
// istek boyutu makul kalsin (sunucu tavani 8 MB). Kucuk gorseller orijinal kalir.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read'))
    reader.onload = () => {
      const raw = String(reader.result || '')
      const img = new Image()
      img.onload = () => {
        const MAX = 1600
        const scale = Math.min(1, MAX / Math.max(img.width, img.height))
        // Yeterince kucukse (olcek 1) ve veri boyutu <1.5MB ise orijinali koru.
        if (scale >= 1 && raw.length < 1_500_000) {
          resolve(raw)
          return
        }
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(raw)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        // Ekran goruntusu genelde metin icerir -> PNG keskin ama buyuk; boyut icin JPEG 0.85.
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => resolve(raw) // decode edilemezse ham veriyi gonder
      img.src = raw
    }
    reader.readAsDataURL(file)
  })
}

export default function BugReport({ currentPage, loggedIn }: Props) {
  const { t } = useT()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [page, setPage] = useState('')
  const [email, setEmail] = useState('')
  const [shot, setShot] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEscape(open ? () => setOpen(false) : undefined)

  function openForm() {
    // Acilirken "sayfa" alanini otomatik doldur (App'ten gelen okunur ad, yoksa baslik).
    setPage(currentPage || document.title || '')
    setOpen(true)
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // ayni dosya tekrar secilebilsin
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error(t('bug.notImage'))
      return
    }
    try {
      const url = await fileToDataUrl(file)
      setShot(url)
    } catch {
      toast.error(t('bug.readFail'))
    }
  }

  async function submit() {
    if (busy) return
    if (message.trim().length < 3) {
      toast.error(t('bug.needMessage'))
      return
    }
    setBusy(true)
    try {
      await reportBug({
        message: message.trim(),
        page: page.trim() || null,
        url: typeof location !== 'undefined' ? location.href : null,
        email: !loggedIn && email.trim() ? email.trim() : null,
        screenshot: shot,
      })
      toast.success(t('bug.sent'))
      // Formu sifirla + kapat.
      setMessage('')
      setEmail('')
      setShot(null)
      setOpen(false)
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 429
          ? t('bug.tooMany')
          : t('bug.sendFail')
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      {/* Sağ kenar sabit sekme butonu — oyun ekranında render EDİLMEZ (App gizler). */}
      {!open && (
        <button className="bug-fab" onClick={openForm} aria-label={t('bug.button')} title={t('bug.button')}>
          <Icon name="flag" size={16} />
          <span className="bug-fab-txt">{t('bug.button')}</span>
        </button>
      )}

      {open && (
        <div
          className="register-overlay modal bug-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="register-card bug-card" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="modal-close"
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
            >
              <Icon name="x" size={16} />
            </Button>
            <h2>
              <Icon name="flag" size={18} /> {t('bug.title')}
            </h2>
            <p className="bug-sub">{t('bug.sub')}</p>

            <label className="bug-label">
              <span>{t('bug.pageLabel')}</span>
              <input
                value={page}
                onChange={(e) => setPage(e.target.value)}
                placeholder={t('bug.pagePlaceholder')}
              />
            </label>

            <label className="bug-label">
              <span>{t('bug.messageLabel')}</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder={t('bug.messagePlaceholder')}
              />
            </label>

            {!loggedIn && (
              <label className="bug-label">
                <span>{t('bug.emailLabel')}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('bug.emailPlaceholder')}
                />
              </label>
            )}

            {/* Ekran görüntüsü yükle */}
            <div className="bug-shot">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="bug-file-input"
                onChange={onPickFile}
              />
              {shot ? (
                <div className="bug-shot-preview">
                  <img src={shot} alt={t('bug.shotAlt')} />
                  <button
                    type="button"
                    className="bug-shot-remove"
                    onClick={() => setShot(null)}
                    aria-label={t('bug.shotRemove')}
                    title={t('bug.shotRemove')}
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ) : (
                <button type="button" className="bug-shot-btn" onClick={() => fileRef.current?.click()}>
                  <Icon name="camera" size={18} />
                  <span>{t('bug.shotUpload')}</span>
                </button>
              )}
            </div>

            <Button variant="default" className="bug-send" onClick={submit} disabled={busy}>
              <Icon name="paper-plane-right" size={16} />
              {busy ? t('bug.sending') : t('bug.send')}
            </Button>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
