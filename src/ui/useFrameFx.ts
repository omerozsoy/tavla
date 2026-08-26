import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { FrameMotion } from './avatarFrames'

// GSAP orkestrasyon motoru. Her `motion` kendine ozgu bir zaman cizelgesi kurar
// (ayni animasyonun renk kopyasi DEGIL). gsap dinamik import edilir → ilk paket
// sismez, yalnizca zengin bir avatar mount olunca yuklenir (bir kez, paylasilir).
//
// Temizlik: tum tween/timeline gsap.context icinde olusturulur; unmount veya
// pasiflesme (ekran disi) olunca ctx.revert() hepsini oldurur (sizinti yok).
// Ekran disi avatarlar `active=false` ile durur (IntersectionObserver, AvatarFrame).

export function useFrameFx(
  root: RefObject<HTMLElement | null>,
  motion: FrameMotion[] | undefined,
  active: boolean,
) {
  // motion listesini stabil anahtara cevir (referans degisiminden etkilenme)
  const key = motion ? motion.join(',') : ''
  useEffect(() => {
    const el = root.current
    if (!el || !active || !key) return
    let cancelled = false
    let ctx: { revert: () => void } | null = null

    import('gsap').then(({ gsap }) => {
      if (cancelled || !root.current) return
      ctx = gsap.context(() => {
        const has = (sel: string) => (gsap.utils.toArray(sel) as Element[]).length > 0
        const r = () => gsap.utils.random(0, 1)

        for (const m of key.split(',') as FrameMotion[]) {
          switch (m) {
            case 'orbit': // ters yonde donen ikinci enerji halkasi + hafif nabiz
              if (has('.avf-ring2'))
                gsap.to('.avf-ring2', { rotation: -360, duration: 6 + r() * 4, ease: 'none', repeat: -1, transformOrigin: '50% 50%' })
              if (has('.avf-halo'))
                gsap.to('.avf-halo', { scale: 1.06, opacity: '+=0.15', duration: 2.4, ease: 'sine.inOut', repeat: -1, yoyo: true })
              break

            case 'orbitDot': // halka boyunca dolasan parlak nokta + yumusak hale nabzi
              if (has('.avf-sweep'))
                gsap.to('.avf-sweep', { rotation: 360, duration: 3.4, ease: 'none', repeat: -1, transformOrigin: '50% 50%' })
              if (has('.avf-halo'))
                gsap.to('.avf-halo', { opacity: 0.85, scale: 1.04, duration: 1.6, ease: 'sine.inOut', repeat: -1, yoyo: true })
              break

            case 'sweep': { // metal yuzeyde gezen isik parlamasi — kisa gecis, uzun bekleme
              if (!has('.avf-sweep')) break
              gsap.set('.avf-sweep', { rotation: -130, opacity: 0, transformOrigin: '50% 50%' })
              const tl = gsap.timeline({ repeat: -1, repeatRefresh: true })
              tl.to('.avf-sweep', { opacity: 0.9, duration: 0.25, ease: 'power1.out' })
                .to('.avf-sweep', { rotation: 130, duration: 1.1, ease: 'power2.inOut' }, '<')
                .to('.avf-sweep', { opacity: 0, duration: 0.3, ease: 'power1.in' }, '-=0.35')
                .set('.avf-sweep', { rotation: -130 })
                .to({}, { duration: () => 4 + r() * 4 })
              break
            }

            case 'strike': { // rastgele kisa cift yildirim
              if (!has('.avf-strike')) break
              gsap.set('.avf-strike', { opacity: 0 })
              const tl = gsap.timeline({ repeat: -1, repeatRefresh: true })
              tl.to('.avf-strike', { opacity: 1, duration: 0.04 })
                .to('.avf-strike', { opacity: 0, duration: 0.09 })
                .to('.avf-strike', { opacity: 0.85, duration: 0.04, delay: () => 0.05 + r() * 0.08 })
                .to('.avf-strike', { opacity: 0, duration: 0.16 })
                .to({}, { duration: () => 5 + r() * 5 })
              break
            }

            case 'wing': { // 6-10sn'de bir kanatlar parlar ve hafif acilir
              if (!has('.avf-d2')) break
              const tl = gsap.timeline({ repeat: -1, repeatRefresh: true })
              tl.to('.avf-d2', { scaleX: 1.12, scaleY: 1.06, filter: 'brightness(1.5)', duration: 0.5, ease: 'power2.out', transformOrigin: '100% 50%' })
                .to('.avf-d3', { scaleX: 1.12, scaleY: 1.06, filter: 'brightness(1.5)', duration: 0.5, ease: 'power2.out', transformOrigin: '0% 50%' }, '<')
                .to('.avf-d2, .avf-d3', { scaleX: 1, scaleY: 1, filter: 'brightness(1)', duration: 0.9, ease: 'power1.inOut' })
                .to({}, { duration: () => 6 + r() * 4 })
              break
            }

            case 'dice': { // 7-12sn'de bir kisa zar yuvarlama, yeni acida durur
              if (!has('.avf-d1')) break
              const tl = gsap.timeline({ repeat: -1, repeatRefresh: true })
              tl.to('.avf-d1', { rotation: () => 360 + Math.round(r() * 3) * 90, y: -3, duration: 0.55, ease: 'back.out(1.6)', transformOrigin: '50% 50%' })
                .to('.avf-d2', { rotation: () => -360 - Math.round(r() * 3) * 90, y: -3, duration: 0.55, ease: 'back.out(1.6)', transformOrigin: '50% 50%' }, '<')
                .to('.avf-d1, .avf-d2', { y: 0, duration: 0.3, ease: 'bounce.out' })
                .set('.avf-d1, .avf-d2', { rotation: 0 })
                .to({}, { duration: () => 7 + r() * 5 })
              break
            }

            case 'float': // hafif suzulme (zar/pul canliligi)
              if (has('.avf-d1')) gsap.to('.avf-d1', { y: -2.5, duration: 2.2, ease: 'sine.inOut', repeat: -1, yoyo: true })
              if (has('.avf-d2')) gsap.to('.avf-d2', { y: -2.5, duration: 2.2, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 0.5 })
              break

            case 'breathe': { // yavas kalp atisi (iki nabiz + duraklama)
              if (!has('.avf-halo')) break
              const tl = gsap.timeline({ repeat: -1 })
              tl.to('.avf-halo', { scale: 1.08, opacity: 0.95, duration: 0.28, ease: 'power2.out' })
                .to('.avf-halo', { scale: 1, opacity: 0.5, duration: 0.4, ease: 'power2.in' })
                .to('.avf-halo', { scale: 1.05, opacity: 0.8, duration: 0.24, ease: 'power2.out' })
                .to('.avf-halo', { scale: 1, opacity: 0.5, duration: 0.5, ease: 'power2.in' })
                .to({}, { duration: 1.6 })
              break
            }

            case 'burst': { // periyodik premium isik patlamasi
              if (!has('.avf-halo')) break
              const tl = gsap.timeline({ repeat: -1, repeatRefresh: true })
              tl.to('.avf-halo', { scale: 1.18, opacity: 1, duration: 0.4, ease: 'power2.out' })
              if (has('.avf-d1')) tl.to('.avf-d1', { filter: 'brightness(1.7)', duration: 0.4, ease: 'power2.out' }, '<')
              tl.to('.avf-halo', { scale: 1, opacity: 0.55, duration: 1.1, ease: 'power1.inOut' })
              if (has('.avf-d1')) tl.to('.avf-d1', { filter: 'brightness(1)', duration: 1.1, ease: 'power1.inOut' }, '<')
              tl.to({}, { duration: () => 4 + r() * 3 })
              break
            }

            case 'aura': // yavas enerji halesi (nefes alan)
              if (has('.avf-halo')) gsap.to('.avf-halo', { scale: 1.1, opacity: 0.75, duration: 3.2, ease: 'sine.inOut', repeat: -1, yoyo: true })
              break

            case 'rays': // donen isik huzmeleri
              if (has('.avf-rays')) gsap.to('.avf-rays', { rotation: 360, duration: 18, ease: 'none', repeat: -1, transformOrigin: '50% 50%' })
              break

            case 'sparkle': { // rastgele kristal parlamalari (dekor yildizlari)
              const stars = ['.avf-d1', '.avf-d2', '.avf-d3'].filter(has)
              stars.forEach((s, i) => {
                gsap.set(s, { opacity: 0, scale: 0.4 })
                gsap
                  .timeline({ repeat: -1, repeatRefresh: true, delay: i * 0.7 })
                  .to(s, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' })
                  .to(s, { opacity: 0, scale: 0.4, duration: 0.5, ease: 'power2.in' })
                  .to({}, { duration: () => 1.5 + r() * 3 })
              })
              break
            }

            case 'eyes': { // dragon: ara ara parlayan gozler
              if (!has('.avf-d1')) break
              gsap.set('.avf-d1, .avf-d2', { opacity: 0.55 })
              const tl = gsap.timeline({ repeat: -1, repeatRefresh: true })
              tl.to('.avf-d1, .avf-d2', { opacity: 1, filter: 'brightness(1.8)', duration: 0.18, ease: 'power2.out' })
                .to('.avf-d1, .avf-d2', { opacity: 0.55, filter: 'brightness(1)', duration: 0.5, ease: 'power2.in' })
                .to({}, { duration: () => 3.5 + r() * 3.5 })
              break
            }

            case 'glitch': { // cyberpunk: seyrek kisa glitch
              if (!has('.avf-strike')) break
              gsap.set('.avf-strike', { opacity: 0, x: 0 })
              const tl = gsap.timeline({ repeat: -1, repeatRefresh: true })
              tl.to('.avf-strike', { opacity: 0.9, x: () => -2 + r() * 4, duration: 0.05 })
                .to('.avf-strike', { x: () => -2 + r() * 4, duration: 0.05 })
                .to('.avf-strike', { opacity: 0, x: 0, duration: 0.08 })
                .to({}, { duration: () => 3.5 + r() * 4.5 })
              break
            }

            case 'flames': // ates: hale titremesi (kontrollu, cok hizli degil)
              if (has('.avf-halo')) {
                const tl = gsap.timeline({ repeat: -1, yoyo: true, repeatRefresh: true })
                tl.to('.avf-halo', { opacity: () => 0.6 + r() * 0.35, scaleY: () => 1 + r() * 0.08, duration: 0.5, ease: 'sine.inOut' })
              }
              break

            case 'smoke':
            case 'gravity':
              break // tsParticles ile islenir
          }
        }
      }, root.current)
    })

    return () => {
      cancelled = true
      if (ctx) ctx.revert()
    }
  }, [root, key, active])
}
