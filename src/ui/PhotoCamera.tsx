import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { toGray, measureAlign, frameDiff, type Gray } from './boardAlign'

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
 *
 * OTOMATIK CEKIM (varsayilan acik, tercihi hatirlanir): 200ms'de bir kucuk gri ornek ->
 * boardAlign.measureAlign (cerceve kenarlarinda tahta kenari + bar + ucgen dizisi) + frameDiff
 * (telefon sabit mi). ~1sn kesintisiz hizali+sabit -> cek. Deklansor her zaman yedek.
 */
const BOARD_ASPECT = 1.3 // acik tavla tahtasi ~ genislik/yukseklik (olcum: 1080x850 ~ 1.27)
const SAMPLE_MS = 200
const STREAK_N = 5 // ~1sn hizali + sabit
const STABLE_DIFF = 7 // ardisik ornek ortalama mutlak fark (0..255); el titremesi ~2-5
const SAMPLE_LONG = 160 // ornek goruntunun uzun kenari (px)
const AUTO_KEY = 'photoAutoShot'

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
  const [auto, setAuto] = useState(() => {
    try {
      return localStorage.getItem(AUTO_KEY) !== '0'
    } catch {
      return true
    }
  })
  const [aligned, setAligned] = useState(false)
  const [progress, setProgress] = useState(0)
  const shotRef = useRef(false)
  const geomRef = useRef({ fx: 0, fy: 0, fw: 0, fh: 0, bw: 0, bh: 0, portrait: true })

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
  geomRef.current = { fx, fy, fw, fh, bw: box.w, bh: box.h, portrait }

  // Otomatik cekim dongusu
  useEffect(() => {
    if (!ready || !auto) {
      setAligned(false)
      setProgress(0)
      return
    }
    const cv = document.createElement('canvas')
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    let prev: Gray | null = null
    let streak = 0
    const id = window.setInterval(() => {
      const v = videoRef.current
      const gm = geomRef.current
      if (!v || !v.videoWidth || !gm.bw || shotRef.current) return
      const vw = v.videoWidth
      const vh = v.videoHeight
      // ekran (object-fit: cover) -> video pikseli
      const sc = Math.max(gm.bw / vw, gm.bh / vh)
      const ox = (gm.bw - vw * sc) / 2
      const oy = (gm.bh - vh * sc) / 2
      const k = SAMPLE_LONG / Math.max(vw, vh)
      const w = Math.round(vw * k)
      const h = Math.round(vh * k)
      if (cv.width !== w || cv.height !== h) {
        cv.width = w
        cv.height = h
      }
      ctx.drawImage(v, 0, 0, w, h)
      const g = toGray(ctx.getImageData(0, 0, w, h))
      const r = {
        x: ((gm.fx - ox) / sc) * k,
        y: ((gm.fy - oy) / sc) * k,
        w: (gm.fw / sc) * k,
        h: (gm.fh / sc) * k,
      }
      const a = measureAlign(g, r, !gm.portrait) // dik ekranda bar cizgisi yatay
      const stable = prev ? frameDiff(prev, g) < STABLE_DIFF : false
      prev = g
      if (!a.ok) streak = 0
      else if (stable) streak++
      setAligned(a.ok)
      setProgress(Math.min(1, streak / STREAK_N))
      if (streak >= STREAK_N) {
        streak = 0
        navigator.vibrate?.(40)
        shoot()
      }
    }, SAMPLE_MS)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, auto])

  function toggleAuto() {
    const next = !auto
    setAuto(next)
    try {
      localStorage.setItem(AUTO_KEY, next ? '1' : '0')
    } catch {
      /* gizli mod vb. */
    }
  }

  function shoot() {
    const v = videoRef.current
    if (!v || !v.videoWidth || shotRef.current) return
    shotRef.current = true
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
        else shotRef.current = false
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
          <rect
            x={fx}
            y={fy}
            width={fw}
            height={fh}
            rx={6}
            fill="none"
            stroke={aligned ? '#3ddc84' : 'rgba(255,255,255,.55)'}
            strokeWidth={aligned ? 3 : 1.5}
          />
          {/* otomatik cekim ilerlemesi: cerceve boyunca dolan yesil cizgi */}
          {progress > 0 && (
            <rect
              x={fx}
              y={fy}
              width={fw}
              height={fh}
              rx={6}
              fill="none"
              stroke="#3ddc84"
              strokeWidth={6}
              pathLength={100}
              strokeDasharray={`${progress * 100} 100`}
            />
          )}
          {/* kose braketleri */}
          <path
            d={[
              `M${fx},${fy + c}V${fy}H${fx + c}`,
              `M${fx + fw - c},${fy}H${fx + fw}V${fy + c}`,
              `M${fx + fw},${fy + fh - c}V${fy + fh}H${fx + fw - c}`,
              `M${fx + c},${fy + fh}H${fx}V${fy + fh - c}`,
            ].join('')}
            fill="none"
            stroke={aligned ? '#3ddc84' : '#fff'}
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

      <button className={`photo-cam-auto${auto ? ' on' : ''}`} onClick={toggleAuto} type="button" aria-pressed={auto}>
        {auto ? t('photo.camAutoOn') : t('photo.camAutoOff')}
      </button>

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
            {aligned && auto ? t('photo.camHold') : t('photo.camGuide')}
          </div>
        </>
      ) : (
        <div className="photo-cam-tip photo-cam-tip-top">{aligned && auto ? t('photo.camHold') : t('photo.camGuide')}</div>
      )}

      <button className="photo-cam-shutter" onClick={shoot} disabled={!ready} type="button" aria-label={t('photo.camShoot')} />
    </div>
  )
}
