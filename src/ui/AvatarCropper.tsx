import { useCallback, useEffect, useRef, useState } from 'react'
import './AvatarCropper.css'
import { Icon } from './Icon'
import { useT } from '../i18n'
import { useEscape } from './useEscape'

interface Props {
  /** tam cozunurluklu kaynak resim (data URL) */
  src: string
  /** cikti kare boyutu (px) */
  size?: number
  onApply: (dataUrl: string) => void
  onCancel: () => void
}

const VIEW = 260 // ekrandaki kare onizleme (px)

// Fotografi cembere yerlestirme: zoom (kaydirici/tekerlek) + surukle (pan), sonra kare kirp.
// Cikti kare JPEG; dairesel cerceve zaten maskeliyor.
export default function AvatarCropper({ src, size = 256, onApply, onCancel }: Props) {
  const { t } = useT()
  useEscape(onCancel)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const im = new Image()
    im.onload = () => {
      imgRef.current = im
      setNat({ w: im.width, h: im.height })
    }
    im.src = src
  }, [src])

  const cover = nat ? Math.max(VIEW / nat.w, VIEW / nat.h) : 1
  const s = cover * zoom
  const dispW = nat ? nat.w * s : VIEW
  const dispH = nat ? nat.h * s : VIEW

  const clamp = useCallback(
    (o: { x: number; y: number }) => {
      const minX = VIEW - dispW
      const minY = VIEW - dispH
      return { x: Math.min(0, Math.max(minX, o.x)), y: Math.min(0, Math.max(minY, o.y)) }
    },
    [dispW, dispH],
  )

  // resim yuklendiginde ortala
  useEffect(() => {
    if (nat) setOff({ x: (VIEW - nat.w * cover) / 2, y: (VIEW - nat.h * cover) / 2 })
  }, [nat, cover])

  // zoom degisince tasmayi engelle (merkez etrafinda)
  useEffect(() => {
    setOff((o) => {
      // merkezi koru: viewport ortasi ayni natural noktada kalsin
      return clamp(o)
    })
  }, [zoom, clamp])

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    setOff(clamp({ x: drag.current.ox + dx, y: drag.current.oy + dy }))
  }
  function onPointerUp() {
    drag.current = null
  }
  function onWheel(e: React.WheelEvent) {
    setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.0015)))
  }

  function apply() {
    if (!imgRef.current || !nat) return
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // viewport pikseli (px,py) -> natural: ((px - off.x)/s, (py - off.y)/s)
    const srcX = -off.x / s
    const srcY = -off.y / s
    const srcSize = VIEW / s
    ctx.drawImage(imgRef.current, srcX, srcY, srcSize, srcSize, 0, 0, size, size)
    onApply(canvas.toDataURL('image/jpeg', 0.85))
  }

  return (
    <div className="avc-overlay" role="dialog" aria-modal="true" onPointerUp={onPointerUp}>
      <div className="avc-panel">
        <h3 className="avc-title">{t('crop.title')}</h3>
        <div
          className="avc-view"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        >
          {nat && (
            <img
              className="avc-img"
              src={src}
              alt=""
              draggable={false}
              style={{
                width: dispW,
                height: dispH,
                transform: `translate(${off.x}px, ${off.y}px)`,
              }}
            />
          )}
          <div className="avc-mask" />
        </div>
        <div className="avc-zoom">
          <Icon name="camera" size={16} />
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label={t('crop.zoom')}
          />
        </div>
        <p className="avc-hint">{t('crop.hint')}</p>
        <div className="avc-actions">
          <button type="button" className="menu-btn" onClick={onCancel}>
            {t('crop.cancel')}
          </button>
          <button type="button" className="galaxy-btn avc-apply" onClick={apply}>
            {t('crop.apply')}
          </button>
        </div>
      </div>
    </div>
  )
}
