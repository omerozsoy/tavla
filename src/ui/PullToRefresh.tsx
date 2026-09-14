import { useEffect, useRef, useState } from 'react'

// Sabit-kabuk SPA (body/.app overflow:hidden, 100dvh) -> tarayicinin NATIVE "asagi cek-yenile"si
// tetiklenmez (sayfa/doküman kaymaz). Bu bilesen en ustteki scroll konteynerinde asagi cekince
// KENDI yenilemesini yapar (location.reload). Yalniz dokunmatik; oyun tahtasi/giris alanlari
// haric (suruklemeyle catismasin). Reload artik taze index.html ceker (no-cache fix).
export default function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const st = useRef<{ active: boolean; y0: number; scroller: HTMLElement | null }>({ active: false, y0: 0, scroller: null })
  const THRESHOLD = 70
  const MAX = 100

  useEffect(() => {
    if (typeof matchMedia !== 'function' || !matchMedia('(pointer: coarse)').matches) return

    const scrollableAncestor = (el: HTMLElement | null): HTMLElement | null => {
      let n: HTMLElement | null = el
      while (n && n !== document.body) {
        const s = getComputedStyle(n)
        if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return n
        n = n.parentElement
      }
      return null
    }

    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1) return
      const target = e.target as HTMLElement
      // Oyun/sürükleme/giris alanlarinda devre disi
      if (
        target.closest('.board, .game-area, .game-view, [data-slot="bar"], .checker, .drag-layer, input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }
      const scroller = scrollableAncestor(target)
      if (scroller && scroller.scrollTop > 0) return // en ustte degil
      st.current = { active: true, y0: e.touches[0].clientY, scroller }
    }
    const onMove = (e: TouchEvent) => {
      if (!st.current.active) return
      const dy = e.touches[0].clientY - st.current.y0
      if (dy <= 0) {
        setPull(0)
        return
      }
      if (st.current.scroller && st.current.scroller.scrollTop > 0) {
        st.current.active = false
        setPull(0)
        return
      }
      e.preventDefault() // sayfayi kaydirma; pull gostergesini goster
      setPull(Math.min(MAX, dy * 0.5))
    }
    const onEnd = () => {
      if (!st.current.active) return
      st.current.active = false
      setPull((p) => {
        if (p >= THRESHOLD) {
          setRefreshing(true)
          setTimeout(() => location.reload(), 180)
          return THRESHOLD
        }
        return 0
      })
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove as EventListener)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [refreshing])

  if (pull <= 0 && !refreshing) return null
  const ready = refreshing || pull >= THRESHOLD
  return (
    <div
      className="ptr"
      style={{ transform: `translateX(-50%) translateY(${Math.max(pull - 22, -22)}px)`, opacity: Math.min(1, pull / 45) }}
      aria-hidden="true"
    >
      <span className={`ptr-ring ${ready ? 'ready' : ''} ${refreshing ? 'spin' : ''}`} style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)` }} />
    </div>
  )
}
