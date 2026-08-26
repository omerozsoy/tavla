import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import './AvatarFrame.css'
import { frameFx, FRAME_BY_ID, FRAME_MIN_RICH } from './avatarFrames'
import { useFrameFx } from './useFrameFx'

// Agir katmanlar yalnizca gerektiginde yuklenir (ilk paket sismesin, listeler hafif kalsin)
const ParticleLayer = lazy(() => import('./ParticleLayer'))
const RiveLayer = lazy(() => import('./RiveLayer'))
const LottieLayer = lazy(() => import('./LottieLayer'))

// Katmanli, adaptif avatar cercevesi.
//  - CSS her zaman temel cerceveyi cizer (100 avatarda bile ucuz, GPU-composited).
//  - Boyut + animated + ekran-ici + reduced-motion'a gore ust katmanlar acilir:
//      micro (<40px)   : yalnizca halka + foto (listeler)
//      lite            : + dekor rozet/amblemler (statik)
//      rich            : + GSAP orkestrasyon (isik gecisi, yildirim, kanat...)
//      showcase        : + tsParticles / Rive / Lottie (buyuk tekil baglam)
//  - Ekran disina cikinca GSAP + partikuller durur (IntersectionObserver).
interface Props {
  src?: string | null
  frame?: string | null
  size?: number
  name?: string
  alt?: string
  className?: string
  /** false: tum hareket durur, gorunum korunur (yogun listeler icin). Varsayilan true. */
  animated?: boolean
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

export default function AvatarFrame({
  src,
  frame,
  size = 64,
  name,
  alt = '',
  className = '',
  animated = true,
}: Props) {
  const root = useRef<HTMLSpanElement>(null)
  const reduced = usePrefersReducedMotion()
  const [onScreen, setOnScreen] = useState(true)

  const def = frame ? FRAME_BY_ID[frame] : undefined
  const fx = frameFx(frame)

  const showDeco = !!frame && size >= 40
  const rich = !!frame && animated && !reduced && size >= (fx?.minRich ?? FRAME_MIN_RICH)
  const gsapActive = rich && onScreen && !!fx?.motion?.length
  const particlesOn = rich && onScreen && !!fx?.particle && size >= (fx?.minParticle ?? 76)
  const riveOn = rich && onScreen && !!fx?.rive
  const lottieOn = rich && onScreen && !!fx?.lottie

  // Ekran-ici takibi (yalnizca zengin katman gerekiyorsa gozlemle)
  useEffect(() => {
    if (!rich) return
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '80px' })
    io.observe(el)
    return () => io.disconnect()
  }, [rich])

  useFrameFx(root, fx?.motion, gsapActive)

  // Partikul yogunlugu: kucuk avatar/mobilde azalt
  const density =
    (size >= 110 ? 1 : size >= 88 ? 0.75 : 0.5) *
    (typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches ? 0.55 : 1)

  const initial = (name || '').trim().charAt(0).toUpperCase()

  return (
    <span
      ref={root}
      className={`avf ${rich ? 'avf-anim' : ''} ${className}`.trim()}
      data-frame={frame || undefined}
      data-rarity={def?.rarity || undefined}
      style={{ '--avf-size': `${size}px` } as CSSProperties}
    >
      {showDeco && <span className="avf-halo" aria-hidden="true" />}

      <span className="avf-ph">
        {src ? <img src={src} alt={alt} draggable={false} /> : <span className="avf-ini">{initial}</span>}
      </span>

      {showDeco && (
        <span className="avf-deco" aria-hidden="true">
          <i className="avf-d1" />
          <i className="avf-d2" />
          <i className="avf-d3" />
        </span>
      )}

      {rich && (
        <span className="avf-fx" aria-hidden="true">
          <i className="avf-ring2" />
          <i className="avf-sweep" />
          <i className="avf-strike" />
          <i className="avf-rays" />
        </span>
      )}

      {particlesOn && (
        <span className="avf-particles" aria-hidden="true">
          <Suspense fallback={null}>
            <ParticleLayer particle={fx!.particle!} density={density} />
          </Suspense>
        </span>
      )}

      {riveOn && (
        <span className="avf-rivehost" aria-hidden="true">
          <Suspense fallback={null}>
            <RiveLayer src={fx!.rive!} />
          </Suspense>
        </span>
      )}

      {lottieOn && (
        <span className="avf-lottiehost" aria-hidden="true">
          <Suspense fallback={null}>
            <LottieLayer src={fx!.lottie!} />
          </Suspense>
        </span>
      )}
    </span>
  )
}
