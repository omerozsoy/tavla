import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { checkerPngUri, checkerSvgUri, rasterizeChecker } from './checkerRaster'
import type { CheckerSkin as Skin } from '../checkers'

/**
 * Bir dijital checker (pul) materyalini çizer. tone='dark' oyuncunun rengi, 'light' rakip/eş renk.
 * Motor/board/hareket koduna DOKUNMAZ — yalnız görsel katman.
 *
 * PERFORMANS: Malzeme prosedürel SVG'dir (buildCheckerSvg) ve pahalı feTurbulence filtreleri içerir.
 * Canlı inline SVG olarak çizmek yerine (aile+renk) başına BİR KEZ raster'lanmış görseli
 * (checkerRaster önbelleği) <img> ile gösteririz. Bir tarafın 15 pulu aynı görseli paylaşır →
 * filtre 30 yerine ~2 kez hesaplanır, hareket saf GPU kompozisyonu (varsayılan pul kadar akıcı).
 * Hazır PNG yoksa anında paylaşılan SVG data-uri gösterilir, ardından PNG'ye yükseltilir (flash yok).
 *
 * ADAPTIVE FINISH (skin.adaptive): renk sabit değil; pul kendi kabından AKTİF TAHTANIN pul rengini
 * (--cream=açık, --navy=koyu; swap + tema otomatik) canlı okur ve o renge dokusunu uygular.
 */
export default function CheckerSkin({
  skin,
  tone,
  size = 44,
  className,
}: {
  skin: Skin
  tone: 'dark' | 'light'
  size?: number | string // sayı=px; '100%' = kabı doldur (Board içinde)
  seed?: number // (artık kullanılmıyor — paylaşılan doku; geriye dönük uyum için imzada tutulur)
  className?: string
}) {
  const fallback = tone === 'dark' ? skin.dark : skin.light
  const ref = useRef<HTMLSpanElement>(null)
  const [color, setColor] = useState<string>(fallback)

  // Adaptive: kabın çözülmüş --cream/--navy'sini oku (tahta/swap değişince re-render'da güncellenir).
  useLayoutEffect(() => {
    if (!skin.adaptive || !ref.current) return
    const v = getComputedStyle(ref.current)
      .getPropertyValue(tone === 'light' ? '--cream' : '--navy')
      .trim()
    setColor(v || fallback)
  })

  // Görsel kaynağı: hazır PNG varsa onu, yoksa anında SVG data-uri; arka planda PNG'ye yükselt.
  const [uri, setUri] = useState<string>(() =>
    checkerPngUri(skin.family, color) ?? checkerSvgUri(skin.family, color),
  )
  useEffect(() => {
    const png = checkerPngUri(skin.family, color)
    if (png) {
      setUri(png)
      return
    }
    setUri(checkerSvgUri(skin.family, color)) // anında göster (paylaşılan, ucuz)
    let alive = true
    rasterizeChecker(skin.family, color).then((u) => {
      if (alive) setUri(u)
    })
    return () => {
      alive = false
    }
  }, [skin.family, color])

  return (
    <span
      ref={ref}
      className={`checker-skin${className ? ' ' + className : ''}`}
      style={{ width: size, height: size, display: 'inline-block', lineHeight: 0 }}
      aria-hidden="true"
    >
      <img
        src={uri}
        alt=""
        draggable={false}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </span>
  )
}
