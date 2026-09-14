import { useId, useLayoutEffect, useRef, useState } from 'react'
import { buildCheckerSvg } from './checkerSvg'
import type { CheckerSkin as Skin } from '../checkers'

/**
 * Bir dijital checker (pul) materyalini SVG olarak çizer. tone='dark' oyuncunun rengi,
 * 'light' rakip/eş renk. Benzersiz useId ön-eki -> feTurbulence seed + filtre id çakışmaz;
 * her pul organik/benzersiz damar. SVG kendi ürettiğimiz güvenli içerik.
 * Motor/board/hareket koduna DOKUNMAZ — yalnız görsel katman.
 *
 * ADAPTIVE FINISH (skin.adaptive): renk sabit değil; pul kendi kabından AKTİF TAHTANIN
 * pul rengini (--cream=açık, --navy=koyu; swap + tema otomatik) canlı okur ve o renge
 * malzeme dokusunu uygular. Board dışında (mağaza önizlemesi) değişken yoksa demo renge düşer.
 */
export default function CheckerSkin({
  skin,
  tone,
  size = 44,
  seed,
  className,
}: {
  skin: Skin
  tone: 'dark' | 'light'
  size?: number | string // sayı=px; '100%' = kabı doldur (Board içinde)
  seed?: number
  className?: string
}) {
  const uid = 'c' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const fallback = tone === 'dark' ? skin.dark : skin.light
  const ref = useRef<HTMLSpanElement>(null)
  const [live, setLive] = useState<string | null>(null)

  // Adaptive: kabın çözülmüş --cream/--navy'sini oku (tahta/swap değişince re-render'da güncellenir).
  useLayoutEffect(() => {
    if (!skin.adaptive || !ref.current) return
    const v = getComputedStyle(ref.current)
      .getPropertyValue(tone === 'light' ? '--cream' : '--navy')
      .trim()
    setLive(v || null)
  })

  const color = skin.adaptive ? live || fallback : fallback
  const svg = buildCheckerSvg({ family: skin.family, color, id: uid, seed })
  return (
    <span
      ref={ref}
      className={`checker-skin${className ? ' ' + className : ''}`}
      style={{ width: size, height: size, display: 'inline-block', lineHeight: 0 }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
