import type { CSSProperties } from 'react'
import SoberFrame from './SoberFrame'
import { FRAME_BY_ID, FRAME_RARITY_COLOR } from './avatarFrames'

// Avatar + (varsa) sade cerceve. Cerceve tanimliysa ve boyut yeterliyse SoberFrame (CSS halka +
// secili animasyon) cizilir; kucuk/cercevesiz durumda sade dairesel avatar (cerceveliyse ince
// rarity halkasi). Eski PremiumFrame (24 tema) kaldirildi.
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
  const def = frame ? FRAME_BY_ID[frame] : undefined
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  // Cerceveli + yeterli boyut -> SoberFrame (halka + animasyon)
  if (def && size >= 32) {
    return (
      <SoberFrame
        accent={def.accent}
        motion={animated ? def.motion : 'static'}
        size={size}
        src={src ?? undefined}
        initial={initial}
        className={`avf-sober ${className}`.trim()}
      />
    )
  }

  // Kucuk / cercevesiz -> sade dairesel avatar (cerceveliyse ince rarity halkasi)
  const ring = def ? FRAME_RARITY_COLOR[def.rarity] : undefined
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
