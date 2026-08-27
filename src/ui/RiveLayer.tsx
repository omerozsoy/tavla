import { useEffect, useRef, useState } from 'react'
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'

// Avatar cerceve Rive katmani. `.riv` dosyalari 5 adlandirilmis animasyon icerir:
//   idle · hover · selected · reduced (hepsi loop) · celebrate (oneShot).
// NEDEN state machine yerine kod-surumlu animasyon: riv_create'in urettigi SM'de bool=false
// (hover birak / selected kaldir) gecisleri guvenilir atesLENMIYOR (probe ile dogrulandi).
// Bu yuzden reaksiyonlar .riv icinde ayri animasyon olarak authored edilir, RiveLayer runtime'da
// (rive.play/stop) hangisinin oynayacagini prop'lara gore secer -> deterministik + gorunur tepki.
//
// Oncelik: reduced > selected > hover > idle. celebrate her durumda one-shot oynar, biter, taban
// state'e doner. intensity (0-100) canvas gorsel yogunlugunu (opacity) surer.
export type RiveLayerProps = {
  src: string
  /** Cok-artboard'li dosyada artboard adi (kontrat: rarity adi) */
  artboard?: string
  hover?: boolean
  selected?: boolean
  /** prefers-reduced-motion -> minimal hareket, particle yok */
  reduced?: boolean
  /** 0-100 global gorsel yogunluk (canvas opacity'sine haritalanir) */
  intensity?: number
  /** Bu sayi her degistiginde celebrate one-shot oynar */
  celebrateSignal?: number
  className?: string
}

const BASE = { idle: 'idle', hover: 'hover', selected: 'selected', reduced: 'reduced' } as const
const CELEBRATE_MS = 1450 // celebrate animasyonu 1.4s; tampon ile taban state'e don

export default function RiveLayer({
  src,
  artboard,
  hover = false,
  selected = false,
  reduced = false,
  intensity = 100,
  celebrateSignal = 0,
  className = 'avf-rive',
}: RiveLayerProps) {
  const { rive, RiveComponent } = useRive({
    src,
    artboard,
    animations: BASE.idle,
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
  })

  // Taban state onceligi: reduced > selected > hover > idle
  const base = reduced ? BASE.reduced : selected ? BASE.selected : hover ? BASE.hover : BASE.idle
  const baseRef = useRef(base)
  const celebratingRef = useRef(false)

  // Performans (brief §17): ekran disinda pause. Cok sayida frame (galeri) icin sart —
  // gorunmeyen kareler CPU yemesin. Onscreen olunca guncel taban animasyona devam.
  const hostRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = hostRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '150px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Taban state degisince (veya gorunurluk degisince) ilgili animasyona gec / pause et.
  useEffect(() => {
    baseRef.current = base
    if (!rive || celebratingRef.current) return
    if (!inView) {
      rive.pause()
      return
    }
    rive.stop()
    rive.play(base)
  }, [rive, base, inView])

  // celebrate one-shot: taban durur, celebrate oynar, sure sonunda guncel tabana doner.
  useEffect(() => {
    if (!rive || celebrateSignal <= 0 || !inView) return
    celebratingRef.current = true
    rive.stop()
    rive.play('celebrate')
    const t = setTimeout(() => {
      celebratingRef.current = false
      if (!rive) return
      rive.stop()
      rive.play(baseRef.current)
    }, CELEBRATE_MS)
    return () => clearTimeout(t)
    // base'i bilerek dependency'ye koymuyoruz: celebrate yalnizca sinyal artisinda tetiklenmeli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rive, celebrateSignal])

  // intensity -> gorsel yogunluk (canvas opacity). 0 => 0.45, 100 => 1.0
  const clamped = Math.max(0, Math.min(100, intensity))
  const layerOpacity = 0.45 + 0.55 * (clamped / 100)

  return (
    <div ref={hostRef} className={className} style={{ opacity: layerOpacity }}>
      <RiveComponent />
    </div>
  )
}
