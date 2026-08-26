import type { CSSProperties } from 'react'
import './AvatarFrame.css'

// Yeniden kullanilabilir avatar + animasyonli cerceve. Cerceve avatardan bagimsizdir
// (avatar degisince cerceve degismez). Tum stiller CSS'te [data-frame]. GPU-dostu
// (transform/opacity) + prefers-reduced-motion. size px olarak 40..128 arasi olceklenir.
interface Props {
  src?: string | null // avatar foto (data URL)
  frame?: string | null // cerceve slug (avatarFrames.ts)
  size?: number // px (varsayilan 64)
  name?: string // foto yoksa bas harf
  alt?: string
  className?: string
  /** false: animasyonlar durur (yogun listelerde performans). Varsayilan true. */
  animated?: boolean
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
  const initial = (name || '').trim().charAt(0).toUpperCase()
  return (
    <span
      className={`avf ${animated ? '' : 'avf-static'} ${className}`.trim()}
      data-frame={frame || undefined}
      style={{ '--avf-size': `${size}px` } as CSSProperties}
    >
      <span className="avf-ph">
        {src ? <img src={src} alt={alt} draggable={false} /> : <span className="avf-ini">{initial}</span>}
      </span>
      {frame && <span className="avf-deco" aria-hidden="true" />}
    </span>
  )
}
