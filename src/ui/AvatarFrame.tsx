import type { CSSProperties } from 'react'
import PremiumFrame, { frameVisual } from './PremiumFrame'
import { FRAME_RARITY_COLOR } from './avatarFrames'

// Avatar + (varsa) premium SVG cerceve. Cerceve tanimliysa ve boyut yeterliyse
// PremiumFrame (cok katmanli SVG) cizilir; kucuk/cercevesiz durumda sade dairesel
// avatar (cerceveliyse ince rarity halkasi) gosterilir.
interface Props {
  src?: string | null
  frame?: string | null
  size?: number
  name?: string
  alt?: string
  className?: string
  /** false: hareket durur (yogun listeler). Varsayilan true. */
  animated?: boolean
}

export default function AvatarFrame({
  src,
  frame,
  size = 64,
  name = '',
  alt = '',
  className = '',
  animated = true,
}: Props) {
  const visual = frameVisual(frame)
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  // Cerceveli + yeterli boyut -> premium SVG cerceve
  if (visual && size >= 40) {
    return (
      <PremiumFrame
        rarity={visual.rarity}
        theme={visual.theme}
        src={src}
        name={name}
        size={size}
        animated={animated}
        className={className}
      />
    )
  }

  // Kucuk / cercevesiz -> sade dairesel avatar (cerceveliyse ince rarity halkasi)
  const ring = visual ? FRAME_RARITY_COLOR[visual.rarity] : undefined
  return (
    <span
      className={`avf-simple ${className}`.trim()}
      style={
        {
          '--avf-size': `${size}px`,
          ...(ring ? { boxShadow: `0 0 0 2px ${ring}` } : {}),
        } as CSSProperties
      }
    >
      {src ? (
        <img src={src} alt={alt} draggable={false} />
      ) : (
        <span className="avf-simple-ini">{initial}</span>
      )}
    </span>
  )
}
