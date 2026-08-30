/**
 * Tas oynama (checker) hareket animasyonu — kaynak noktadan hedefe "ucan tas".
 * FLIP yaklasimi: hamle uygulaninca hedefte olusan GERCEK tas, kaynak konumundan
 * hedefe animasyonla gelir (kopya yok). 3 stil: kayma / yay / kaldir-birak.
 *
 * Kullanim (App.tsx):
 *   1) playSteps'te, state guncellenmeden ONCE kaynak dikdortgenini yakala: sourceRect(from)
 *   2) render sonrasi useLayoutEffect'te hedef tasi bul (destEl) ve flyChecker ile oynat.
 */

export type MoveStyle = 'off' | 'slide' | 'arc' | 'lift'

export const MOVE_STYLES: Exclude<MoveStyle, 'off'>[] = ['slide', 'arc', 'lift']

function gameBoard(): HTMLElement | null {
  // Oyun tahtasi: ekrandaki gorunur .board (ayarlar kapaliyken tek tanedir).
  const boards = Array.from(document.querySelectorAll<HTMLElement>('.board'))
  return boards.find((b) => b.offsetParent !== null) ?? boards[0] ?? null
}

/** Kaynak konumun (nokta index veya 'bar') en ust tasinin ekran dikdortgeni. */
export function sourceRect(from: number | 'bar'): DOMRect | null {
  const b = gameBoard()
  if (!b) return null
  if (from === 'bar') {
    const bar = b.querySelector<HTMLElement>('.bar')
    return bar?.getBoundingClientRect() ?? null
  }
  const chk = b.querySelector<HTMLElement>(`.point[data-point="${from}"] .checker:last-child`)
  if (chk) return chk.getBoundingClientRect()
  const pt = b.querySelector<HTMLElement>(`.point[data-point="${from}"]`)
  return pt?.getBoundingClientRect() ?? null
}

/** Hedefte yeni olusan tas ogesi (nokta -> en ust tas; 'off' -> son bear-off tasi). */
export function destEl(to: number | 'off'): HTMLElement | null {
  const b = gameBoard()
  if (!b) return null
  if (to === 'off') {
    const offs = b.querySelectorAll<HTMLElement>('.bearoff .off-checker')
    return offs[offs.length - 1] ?? b.querySelector<HTMLElement>('.bearoff')
  }
  return b.querySelector<HTMLElement>(`.point[data-point="${to}"] .checker:last-child`)
}

function frames(dx: number, dy: number, style: Exclude<MoveStyle, 'off'>): {
  k: Keyframe[]
  o: KeyframeAnimationOptions
} {
  // Tum keyframe'lerde AYNI transform fonksiyon listesi (translate+scale) -> WAAPI
  // parcali/atlamali gecis yapmaz (sondaki kirpismayi onler).
  const A = `translate(${dx}px, ${dy}px) scale(1)`
  const Z = 'translate(0px, 0px) scale(1)'
  if (style === 'arc') {
    // Orta nokta: iki ucun ortalamasindan 56px yukarida -> her zaman yukari kavis
    const mid = `translate(${dx / 2}px, ${dy / 2 - 56}px) scale(1.07)`
    return {
      k: [{ transform: A, offset: 0 }, { transform: mid, offset: 0.5 }, { transform: Z, offset: 1 }],
      o: { duration: 560, easing: 'cubic-bezier(0.45, 0, 0.3, 1)' },
    }
  }
  if (style === 'lift') {
    const s0 = 'drop-shadow(0 2px 4px rgba(0,0,0,.5))'
    const s1 = 'drop-shadow(0 12px 14px rgba(0,0,0,.4))'
    return {
      k: [
        { transform: `translate(${dx}px, ${dy}px) scale(1)`, filter: s0, offset: 0 },
        { transform: `translate(${dx}px, ${dy - 14}px) scale(1.14)`, filter: s1, offset: 0.2 },
        { transform: `translate(0px, -14px) scale(1.14)`, filter: s1, offset: 0.78 },
        { transform: `translate(0px, 4px) scale(0.97)`, filter: s0, offset: 0.9 },
        { transform: `translate(0px, 0px) scale(1)`, filter: 'none', offset: 1 },
      ],
      o: { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    }
  }
  // slide
  return {
    k: [{ transform: A }, { transform: Z }],
    o: { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  }
}

/**
 * Hedef tasi kaynaktan gelmis gibi oynat. `srcRect` hamle ONCESI yakalanmis olmali.
 * checker-place (dusme) efekti bu tas icin kapatilir; bitince stiller geri birakilir.
 */
export function flyChecker(el: HTMLElement, srcRect: DOMRect, style: Exclude<MoveStyle, 'off'>): void {
  const dr = el.getBoundingClientRect()
  const dx = srcRect.left - dr.left
  const dy = srcRect.top - dr.top
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
  const { k, o } = frames(dx, dy, style)
  // checker-place (dusme) efektini bu tas icin KALICI kapat: uygulanan inline 'none'
  // geri acilirsa CSS animasyonu yeniden tetiklenir -> sonda kirpisma olurdu. Geri acmiyoruz.
  el.style.animation = 'none'
  // fill:'forwards' -> son frame'de tutar. Son frame dogal konumla ayni (translate 0,
  // scale 1, filtre yok) oldugu icin bitiste snap/kirpisma olmaz. Layout-effect paint'ten
  // once calistigindan animate() ilk frame'i (kaynak) hemen uygular; ayri inline transform
  // gerekmez (flash yok).
  // fill:'both' -> baslamadan once ilk frame (kaynak) dolu (start flash yok),
  // bittikten sonra son frame tutulur. Son frame dogal konumla ozdes oldugu icin
  // cancel ile birakinca snap/kirpisma olmaz.
  const anim = el.animate(k, { ...o, fill: 'both' })
  anim.onfinish = () => {
    try {
      anim.cancel()
    } catch {
      /* yoksay */
    }
  }
}
