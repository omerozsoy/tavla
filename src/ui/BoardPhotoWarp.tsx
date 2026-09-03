import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { BOARD_NORMALIZED_WIDTH, BOARD_NORMALIZED_HEIGHT } from './boardGeometry'

// Fotograftan diz — HIBRIT adim: kullanici tahtanin 4 kosesini isaretler, goruntu
// perspektif-duzeltme (homografi) ile TEPEDEN-DUZ hale getirilir, sonra Opus'a gider.
// Acili foto -> duz goruntu = LLM'in en cok takildigi sorunu (aci) tarayicida cozer.

import type { BoardCorners } from '../api'

type Pt = { x: number; y: number } // normalize [0..1] (goruntuye gore)

// Sonuc: orijinal foto + koseler (CV servisi kendi warp'ini yapar) + tarayici-warp
// (Opus fallback icin). PositionAnalyzer once CV'yi dener, olmazsa warped'i Opus'a yollar.
export interface WarpResult {
  file: File
  corners: BoardCorners
  warped: File
}

interface Props {
  file: File
  onResult: (r: WarpResult) => void
  onCancel: () => void
}

// 4-nokta homografi: from[4] -> to[4] esleyen 3x3 (a,b,c,d,e,f,g,h,1). Gauss elemesi.
function solveHomography(from: Pt[], to: Pt[]): number[] {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x: fx, y: fy } = from[i]
    const { x: tx, y: ty } = to[i]
    A.push([fx, fy, 1, 0, 0, 0, -tx * fx, -tx * fy]); b.push(tx)
    A.push([0, 0, 0, fx, fy, 1, -ty * fx, -ty * fy]); b.push(ty)
  }
  // Gauss (kismi pivot)
  for (let c = 0; c < 8; c++) {
    let p = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]
    const piv = A[c][c] || 1e-9
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c] / piv
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]
      b[r] -= f * b[c]
    }
  }
  const h = new Array(8)
  for (let i = 0; i < 8; i++) h[i] = b[i] / (A[i][i] || 1e-9)
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1]
}

// Auto kose tahmini (Phase 5'te OpenCV/kenar ile gercek olacak). Simdilik hafif ic
// dikdortgen dondurur; kullanici gerekirse duzeltir (manuel her zaman fallback).
function estimateInitialCorners(): Pt[] {
  return [
    { x: 0.12, y: 0.14 }, { x: 0.88, y: 0.14 }, { x: 0.88, y: 0.86 }, { x: 0.12, y: 0.86 },
  ]
}

// Kose gecerliligi: sinir icinde, cok yakin degil, dogru alan, kendini kesmeyen quad.
function cornersValid(p: Pt[]): boolean {
  if (p.length !== 4) return false
  for (const q of p) if (q.x < -0.02 || q.x > 1.02 || q.y < -0.02 || q.y > 1.02) return false
  // min ikili mesafe
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    if (Math.hypot(p[i].x - p[j].x, p[i].y - p[j].y) < 0.08) return false
  }
  // ayakkabi-baglama alani (>= ~%15) + tum donusler ayni isaret (konveks, kesismez)
  let area = 0
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = p[i], b = p[(i + 1) % 4], c = p[(i + 2) % 4]
    area += a.x * b.y - b.x * a.y
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    const s = Math.sign(cross)
    if (s !== 0) { if (sign === 0) sign = s; else if (s !== sign) return false }
  }
  return Math.abs(area) / 2 >= 0.15
}

export default function BoardPhotoWarp({ file, onResult, onCancel }: Props) {
  const { t } = useT()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const imgRef = useRef<HTMLImageElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  // Baslangic koseleri (auto tahmin) — kullanici tahta koselerine tasir. Sira TL,TR,BR,BL.
  const [pts, setPts] = useState<Pt[]>(() => estimateInitialCorners())
  const dragRef = useRef<number | null>(null)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  function clientToNorm(clientX: number, clientY: number): Pt {
    const el = imgRef.current
    if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
    }
  }
  function onDown(i: number, e: RPointerEvent) {
    e.preventDefault()
    dragRef.current = i
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onMove(e: RPointerEvent) {
    const i = dragRef.current
    if (i == null) return
    const p = clientToNorm(e.clientX, e.clientY)
    setPts((prev) => prev.map((q, k) => (k === i ? p : q)))
  }
  function onUp() { dragRef.current = null }

  async function confirm() {
    const img = imgRef.current
    if (!img || busy) return
    if (!cornersValid(pts)) { setMsg(t('warp.invalid')); return }
    setMsg('')
    setBusy(true)
    try {
      const natW = img.naturalWidth, natH = img.naturalHeight
      const src = document.createElement('canvas')
      src.width = natW; src.height = natH
      const sctx = src.getContext('2d')!
      sctx.drawImage(img, 0, 0)
      const sdata = sctx.getImageData(0, 0, natW, natH).data

      // Cikti boyutu merkezi geometriden (magic number YOK)
      const OW = BOARD_NORMALIZED_WIDTH, OH = BOARD_NORMALIZED_HEIGHT
      const out = document.createElement('canvas')
      out.width = OW; out.height = OH
      const octx = out.getContext('2d')!
      const odata = octx.createImageData(OW, OH)
      const od = odata.data

      const srcCorners = pts.map((p) => ({ x: p.x * natW, y: p.y * natH }))
      const dstRect = [{ x: 0, y: 0 }, { x: OW, y: 0 }, { x: OW, y: OH }, { x: 0, y: OH }]
      // cikti -> kaynak esleme
      const H = solveHomography(dstRect, srcCorners)

      for (let y = 0; y < OH; y++) {
        for (let x = 0; x < OW; x++) {
          const w = H[6] * x + H[7] * y + H[8]
          const sx = (H[0] * x + H[1] * y + H[2]) / w
          const sy = (H[3] * x + H[4] * y + H[5]) / w
          const oi = (y * OW + x) * 4
          if (sx < 0 || sy < 0 || sx >= natW - 1 || sy >= natH - 1) {
            od[oi] = od[oi + 1] = od[oi + 2] = 20; od[oi + 3] = 255; continue
          }
          // bilinear
          const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0
          const i00 = (y0 * natW + x0) * 4, i10 = i00 + 4, i01 = i00 + natW * 4, i11 = i01 + 4
          for (let c = 0; c < 3; c++) {
            const top = sdata[i00 + c] * (1 - fx) + sdata[i10 + c] * fx
            const bot = sdata[i01 + c] * (1 - fx) + sdata[i11 + c] * fx
            od[oi + c] = (top * (1 - fy) + bot * fy) | 0
          }
          od[oi + 3] = 255
        }
      }
      octx.putImageData(odata, 0, 0)
      const blob: Blob = await new Promise((res) =>
        out.toBlob((b) => res(b!), 'image/jpeg', 0.92),
      )
      const [tl, tr, br, bl] = pts
      onResult({
        file,
        corners: { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl },
        warped: new File([blob], 'board-warped.jpg', { type: 'image/jpeg' }),
      })
    } finally {
      setBusy(false)
    }
  }

  const poly = pts.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')

  return (
    <div className="register-overlay modal" role="dialog" aria-modal="true">
      <div className="register-card warp-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onCancel} aria-label={t('pa.close')}>
          <Icon name="x" size={16} />
        </button>
        <h2><Icon name="maximize" size={20} /> {t('warp.title')}</h2>
        <p className="register-sub">{t('warp.hint')}</p>

        <div className="warp-stage" ref={wrapRef} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
          {url && <img ref={imgRef} src={url} alt="" className="warp-img" draggable={false} />}
          <svg className="warp-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
            <polygon points={poly} className="warp-poly" />
          </svg>
          {pts.map((p, i) => (
            <span
              key={i}
              className="warp-handle"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              onPointerDown={(e) => onDown(i, e)}
            >
              <span className="warp-dot" />
            </span>
          ))}
        </div>

        {msg && <div className="warp-msg">{msg}</div>}
        <div className="warp-actions">
          <Button variant="outline" onClick={onCancel} disabled={busy}>{t('setup.cancel')}</Button>
          <Button variant="default" onClick={confirm} disabled={busy}>
            {busy ? t('warp.processing') : (<><Icon name="check" size={16} /> {t('warp.apply')}</>)}
          </Button>
        </div>
      </div>
    </div>
  )
}
