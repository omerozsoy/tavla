import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'

/**
 * Fotograftan analiz icin KILAVUZ CERCEVELI uygulama-ici kamera (getUserMedia).
 * Amac: tahta HEP YATAY, tam kadrajda ve etrafinda biraz bosluk olacak sekilde cekilsin
 * (tanima: kenara dayanan tahtada kose yanlis bulunur; donuk cekimde yon tahmini gerekir).
 *
 * Yon: native app oyun disinda DIKEY kilitli (orientation.ts) -> kullanici telefonu yana yatirsa da
 * arayuz donmez, video dik kalir. Bu yuzden:
 *  - Dik ekran: cerceve dik cizilir (uzun kenar dikey, bar cizgisi yatay) + "telefonu SOLA yatir".
 *    Kullanici yatirinca cerceveyi yatay gorur. Cekilen kare 90 derece SAAT YONU TERSINE dondurulur
 *    -> yuklenen fotoda tahta yatay, kullanicinin tarafi altta (yon sunucuya birakilmaz).
 *  - Yatay ekran (tarayici donmus / masaustu): normal yatay cerceve, dondurme yok.
 * Tarayici/izin yoksa onError -> cagiran dosya seciciye duser.
 */
const BOARD_ASPECT = 1.3 // acik tavla tahtasi ~ genislik/yukseklik (olcum: 1080x850 ~ 1.27)

export default function PhotoCamera({
  onCapture,
  onClose,
  onError,
}: {
  onCapture: (f: File) => void
  onClose: () => void
  onError: () => void
}) {
  const { t } = useT()
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    const md = navigator.mediaDevices
    if (!md?.getUserMedia) {
      onError()
      return
    }
    md.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((tr) => tr.stop())
          return
        }
        stream = s
        const v = videoRef.current
        if (v) {
          v.srcObject = s
          v.play().catch(() => {})
        }
      })
      .catch(() => {
        if (!cancelled) onError()
      })
    return () => {
      cancelled = true
      stream?.getTracks().forEach((tr) => tr.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Kapsayici boyutu -> cerceve geometrisi (dik/yatay)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const portrait = box.h > box.w
  // Cerceve: dik ekranda tahta 90 derece donuk (uzun kenar dikey). Kenarlarda bosluk birak.
  let fw: number, fh: number
  if (portrait) {
    fw = box.w * 0.8
    fh = fw * BOARD_ASPECT
    if (fh > box.h * 0.72) {
      fh = box.h * 0.72
      fw = fh / BOARD_ASPECT
    }
  } else {
    fh = box.h * 0.72
    fw = fh * BOARD_ASPECT
    if (fw > box.w * 0.8) {
      fw = box.w * 0.8
      fh = fw / BOARD_ASPECT
    }
  }
  const fx = (box.w - fw) / 2
  const fy = (box.h - fh) / 2
  const c = Math.min(fw, fh) * 0.12 // kose braketi boyu

  function shoot() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const vw = v.videoWidth
    const vh = v.videoHeight
    const rotate = vh > vw // dik kare -> tahta yan duruyor -> CCW dondur (telefon SOLA yatirildi)
    const canvas = document.createElement('canvas')
    canvas.width = rotate ? vh : vw
    canvas.height = rotate ? vw : vh
    const ctx = canvas.getContext('2d')!
    if (rotate) {
      // saat yonu tersine 90: kaynagin ust kenari -> sol kenar
      ctx.translate(0, vw)
      ctx.rotate(-Math.PI / 2)
    }
    ctx.drawImage(v, 0, 0, vw, vh)
    canvas.toBlob(
      (b) => {
        if (b) onCapture(new File([b], 'board.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <div className="photo-cam" ref={boxRef}>
      <video
        ref={videoRef}
        className="photo-cam-video"
        playsInline
        muted
        autoPlay
        onLoadedMetadata={() => setReady(true)}
      />
      {box.w > 0 && (
        <svg className="photo-cam-guide" width={box.w} height={box.h} aria-hidden="true">
          <defs>
            <mask id="photo-cam-hole">
              <rect width={box.w} height={box.h} fill="#fff" />
              <rect x={fx} y={fy} width={fw} height={fh} rx={6} fill="#000" />
            </mask>
          </defs>
          <rect width={box.w} height={box.h} fill="rgba(0,0,0,.45)" mask="url(#photo-cam-hole)" />
          <rect x={fx} y={fy} width={fw} height={fh} rx={6} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={1.5} />
          {/* kose braketleri */}
          <path
            d={[
              `M${fx},${fy + c}V${fy}H${fx + c}`,
              `M${fx + fw - c},${fy}H${fx + fw}V${fy + c}`,
              `M${fx + fw},${fy + fh - c}V${fy + fh}H${fx + fw - c}`,
              `M${fx + c},${fy + fh}H${fx}V${fy + fh - c}`,
            ].join('')}
            fill="none"
            stroke="#fff"
            strokeWidth={4}
            strokeLinecap="round"
          />
          {/* bar cizgisi: tahtanin orta mentesesi buraya */}
          {portrait ? (
            <line x1={fx} x2={fx + fw} y1={fy + fh / 2} y2={fy + fh / 2} stroke="#ffd34d" strokeWidth={2} strokeDasharray="8 6" />
          ) : (
            <line x1={fx + fw / 2} x2={fx + fw / 2} y1={fy} y2={fy + fh} stroke="#ffd34d" strokeWidth={2} strokeDasharray="8 6" />
          )}
        </svg>
      )}

      <button className="photo-cam-x" onClick={onClose} type="button" aria-label={t('common.close')}>
        <Icon name="x" size={22} />
      </button>

      {portrait ? (
        <>
          <div className="photo-cam-tip photo-cam-tip-top">
            <Icon name="refresh" size={16} /> {t('photo.camRotate')}
          </div>
          {/* telefon yatirilinca okunacak yonde (90 derece saat yonu) ipucu */}
          <div className="photo-cam-tip photo-cam-tip-side" style={{ left: fx + fw + fx / 2 }}>
            {t('photo.camGuide')}
          </div>
        </>
      ) : (
        <div className="photo-cam-tip photo-cam-tip-top">{t('photo.camGuide')}</div>
      )}

      <button className="photo-cam-shutter" onClick={shoot} disabled={!ready} type="button" aria-label={t('photo.camShoot')} />
    </div>
  )
}
