import { useEffect, useRef, useState, type ReactNode } from 'react'
import './PinchZoom.css'

// Element-seviyesi iki-parmak pinch-zoom + yakinken tek-parmak kaydirma. Capacitor WebView native
// zoom'u kapattigi icin (zoomEnabled=false) viewport pinch APP'te calismaz -> kendi transform'umuz.
// iOS WKWebView'de Pointer Events pinch icin GUVENILMEZ -> TOUCH EVENTS (e.touches) + non-passive
// listener'da preventDefault (native zoom/scroll'u kes). Seffaf "surface" ustte dokunuslari alir;
// altindaki pinch-inner'a (children = Board + MoveArrows) scale/translate uygulanir (birlikte olcek,
// oklar hizali). z==1'de surface touch-action:pan-y (sayfa kaydirma serbest); yakinken none (parmak pan).
export function PinchZoom({ children, max = 3, className = '' }: { children: ReactNode; max?: number; className?: string }) {
  const [t, setT] = useState({ z: 1, x: 0, y: 0 })
  const host = useRef<HTMLDivElement>(null)
  const surf = useRef<HTMLDivElement>(null)
  // Jest durumu (ref -> re-render tetiklemez): dist/baslangic-zoom, mod, pan baslangici.
  const g = useRef({ dist: 0, z: 1, mode: null as 'pinch' | 'pan' | null, sx: 0, sy: 0, px: 0, py: 0 })
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    const el = surf.current
    if (!el) return
    const clamp = (z: number, x: number, y: number) => {
      const zz = Math.max(1, Math.min(max, z))
      const r = host.current?.getBoundingClientRect()
      if (!r || zz <= 1) return { z: zz, x: 0, y: 0 }
      const mx = (r.width * (zz - 1)) / 2
      const my = (r.height * (zz - 1)) / 2
      return { z: zz, x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) }
    }
    const dist = (ts: TouchList) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY)

    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        g.current = { ...g.current, dist: dist(e.touches), z: tRef.current.z, mode: 'pinch' }
        e.preventDefault()
      } else if (e.touches.length === 1 && tRef.current.z > 1) {
        g.current = { ...g.current, mode: 'pan', sx: e.touches[0].clientX, sy: e.touches[0].clientY, px: tRef.current.x, py: tRef.current.y }
      } else {
        g.current.mode = null
      }
    }
    const move = (e: TouchEvent) => {
      if (g.current.mode === 'pinch' && e.touches.length >= 2) {
        e.preventDefault()
        const z = (g.current.z * dist(e.touches)) / (g.current.dist || 1)
        setT((p) => clamp(z, p.x, p.y))
      } else if (g.current.mode === 'pan' && e.touches.length === 1 && tRef.current.z > 1) {
        e.preventDefault()
        const nx = g.current.px + (e.touches[0].clientX - g.current.sx)
        const ny = g.current.py + (e.touches[0].clientY - g.current.sy)
        setT((p) => clamp(p.z, nx, ny))
      }
    }
    const end = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        g.current.mode = null
        setT((p) => (p.z <= 1.03 ? { z: 1, x: 0, y: 0 } : p)) // neredeyse-1 -> snap sifir
      } else if (e.touches.length === 1 && tRef.current.z > 1) {
        // pinch -> tek parmak: kalan parmakla pan'a gec (zipla degil)
        g.current = { ...g.current, mode: 'pan', sx: e.touches[0].clientX, sy: e.touches[0].clientY, px: tRef.current.x, py: tRef.current.y }
      }
    }

    el.addEventListener('touchstart', start, { passive: false })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [max])

  return (
    <div ref={host} className={`pinch-zoom ${className}`}>
      <div className="pinch-inner" style={{ transform: `translate(${t.x}px,${t.y}px) scale(${t.z})` }}>
        {children}
      </div>
      <div
        ref={surf}
        className={`pinch-surface${t.z > 1 ? ' zoomed' : ''}`}
        style={{ touchAction: t.z > 1 ? 'none' : 'pan-y' }}
        onDoubleClick={() => setT({ z: 1, x: 0, y: 0 })}
        aria-hidden="true"
      />
    </div>
  )
}
