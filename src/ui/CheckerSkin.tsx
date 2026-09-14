import { useId } from 'react'
import { buildCheckerSvg } from './checkerSvg'
import type { CheckerSkin as Skin } from '../checkers'

/**
 * Bir dijital checker (pul) materyalini SVG olarak çizer. tone='dark' oyuncunun rengi,
 * 'light' rakip/eş renk. Benzersiz useId ön-eki -> feTurbulence seed + filtre id çakışmaz;
 * her pul organik/benzersiz damar. SVG kendi ürettiğimiz güvenli içerik.
 * Motor/board/hareket koduna DOKUNMAZ — yalnız görsel katman.
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
  const color = tone === 'dark' ? skin.dark : skin.light
  const svg = buildCheckerSvg({ family: skin.family, color, id: uid, seed })
  return (
    <span
      className={`checker-skin${className ? ' ' + className : ''}`}
      style={{ width: size, height: size, display: 'inline-block', lineHeight: 0 }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
