import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import gsap from 'gsap'
import { DiceScene } from './DiceScene'
import type { DiePalette } from './createDie'
import type { FaceValue } from './faceLayout'

export interface HeroDiceHandle {
  /** Zarlari atar. Deger verilmezse rastgele. Ornek: rollDice(6) veya rollDice(6,3). */
  rollDice: (v1?: number, v2?: number) => [FaceValue, FaceValue] | void
}

/** CSS degiskeninden renk oku (tema-senkron); yoksa fallback dondur. */
function cssColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/**
 * Ana sayfa hero'sunda gercekci 3D fizik zar animasyonu.
 *
 * - Sayfa acilisinda bir kez dogal dusus (intro), sonra durur (sonsuz loop YOK).
 * - Kanvasa tiklayinca yeniden atilir; imperatif `rollDice(target)` ile de.
 * - prefers-reduced-motion: hareketsiz statik 3D zar.
 * - unmount'ta renderer/geometry/material/RO/listener temizlenir.
 */
const HeroDice3D = forwardRef<HeroDiceHandle, { className?: string }>(function HeroDice3D(
  { className },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<DiceScene | null>(null)
  const reducedRef = useRef(false)

  useImperativeHandle(ref, () => ({
    rollDice: (v1?: number, v2?: number) => {
      const s = sceneRef.current
      if (!s) return
      if (reducedRef.current) return s.showStatic(v1, v2)
      return s.roll(v1, v2)
    },
  }))

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    reducedRef.current = reduced

    const palette: DiePalette = {
      body: cssColor('--cream', '#f4efe6'),
      pip: cssColor('--tv-ink', '#1c1a17'),
    }

    let scene: DiceScene
    try {
      scene = new DiceScene(host, { palette })
    } catch (e) {
      // WebGL yoksa sessizce dus — hero yine calisir (kanvas bos kalir).
      console.warn('[HeroDice3D] WebGL kullanilamiyor:', e)
      return
    }
    sceneRef.current = scene

    // Yumusak giris (GSAP): kanvas belirir.
    gsap.fromTo(
      host,
      { autoAlpha: 0, scale: 0.92 },
      { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'power2.out' },
    )

    // Gorunur olunca bir kez dogal dusus (reduced-motion'da atlanir).
    let introDone = reduced
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting && !introDone) {
            introDone = true
            scene.intro()
          }
          scene.setPaused(!en.isIntersecting)
        }
      },
      { threshold: 0.25 },
    )
    io.observe(host)

    const onVisibility = () => scene.setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)

    // Tekrar atma (tiklama). Reduced-motion'da hareketsiz yenile.
    const onClick = () => {
      if (scene.isRolling) return
      if (reduced) scene.showStatic()
      else scene.roll()
    }
    host.addEventListener('click', onClick)
    host.style.cursor = 'pointer'

    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      host.removeEventListener('click', onClick)
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  return (
    <div
      ref={hostRef}
      className={className}
      role="img"
      aria-label="3D tavla zarlari"
      title="Zar at"
    />
  )
})

export default HeroDice3D