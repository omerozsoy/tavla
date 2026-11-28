import { useRef, useState, type ReactNode } from 'react'
import './PinchZoom.css'

// Element-seviyesi iki-parmak pinch-zoom + yakinken tek-parmak kaydirma. Capacitor WebView native
// zoom'u kapattigi icin (zoomEnabled=false) viewport pinch APP'te calismaz -> kendi transform'umuz.
// Seffaf bir "surface" ustte tum pointer'lari yakalar (board etkilesimsiz; event-sira derdi yok);
// altindaki pinch-inner'a (children = Board + MoveArrows) scale/translate uygulanir -> birlikte olcek,
// oklar hizali kalir. Cift-dokunus/cift-tik sifirlar.
export function PinchZoom({ children, max = 3, className = '' }: { children: ReactNode; max?: number; className?: string }) {
  const [t, setT] = useState({ z: 1, x: 0, y: 0 })
  const host = useRef<HTMLDivElement>(null)
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; z: number } | null>(null)
  const pan = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)

  // Yakinken board stage disina tasmasin: pan'i ±(yarim-tasma) ile sinirla. z<=1 -> ortala (0,0).
  const clamp = (z: number, x: number, y: number) => {
    const zz = Math.max(1, Math.min(max, z))
    const r = host.current?.getBoundingClientRect()
    if (!r || zz <= 1) return { z: zz, x: 0, y: 0 }
    const mx = (r.width * (zz - 1)) / 2
    const my = (r.height * (zz - 1)) / 2
    return { z: zz, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) }
  }
  const dist = () => {
    const v = [...pts.current.values()]
    return Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y)
  }

  function down(e: React.PointerEvent) {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    if (pts.current.size === 2) {
      pinch.current = { dist: dist(), z: t.z }
      pan.current = null
    } else if (pts.current.size === 1 && t.z > 1) {
      pan.current = { sx: e.clientX, sy: e.clientY, px: t.x, py: t.y }
    }
  }
  function move(e: React.PointerEvent) {
    if (!pts.current.has(e.pointerId)) return
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size >= 2 && pinch.current) {
      const z = (pinch.current.z * dist()) / pinch.current.dist
      setT((p) => clamp(z, p.x, p.y))
    } else if (pts.current.size === 1 && pan.current && t.z > 1) {
      setT((p) => clamp(p.z, pan.current!.px + (e.clientX - pan.current!.sx), pan.current!.py + (e.clientY - pan.current!.sy)))
    }
  }
  function up(e: React.PointerEvent) {
    pts.current.delete(e.pointerId)
    if (pts.current.size < 2) pinch.current = null
    if (pts.current.size === 0) {
      pan.current = null
      setT((p) => (p.z <= 1.03 ? { z: 1, x: 0, y: 0 } : p)) // neredeyse-1 -> sifirla (snap)
    }
  }

  return (
    <div ref={host} className={`pinch-zoom ${className}`}>
      <div className="pinch-inner" style={{ transform: `translate(${t.x}px,${t.y}px) scale(${t.z})` }}>
        {children}
      </div>
      <div
        className={`pinch-surface${t.z > 1 ? ' zoomed' : ''}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => setT({ z: 1, x: 0, y: 0 })}
        aria-hidden="true"
      />
    </div>
  )
}
