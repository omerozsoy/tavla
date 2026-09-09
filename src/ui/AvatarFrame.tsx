import type { CSSProperties } from 'react'
import SoberFrame from './SoberFrame'
import { FRAME_BY_ID, FRAME_RARITY_COLOR } from './avatarFrames'

// Avatar + (varsa) sade cerceve. Cerceve tanimliysa ve boyut yeterliyse SoberFrame (CSS halka +
// secili animasyon) cizilir; kucuk/cercevesiz durumda sade dairesel avatar (cerceveliyse ince
// rarity halkasi). Eski PremiumFrame (24 tema) kaldirildi.
//
// PREMIUM işareti AvatarFrame'de DEGIL: 24 animasyonlu cerceveyle cakismasin diye premium marker
// ismin YANINA (PlayerIdentity -> PremiumPill) konur. Bu bilesen yalniz avatar/cerceve cizer.
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

  // Cerceveli -> SoberFrame (halka + animasyon). Esik dusuk: hesap bari (28) + listeler (30)
  // dahil TUM site genelinde takili cerceve gorunsun.
  // Cercevesiz / kucuk -> sade dairesel avatar (boyut/daire/kirpma INLINE, CSS'e bagimli degil).
  const ring = def ? FRAME_RARITY_COLOR[def.rarity] : undefined
  const simpleWrap: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    width: size,
    height: size,
    borderRadius: '50%',
    overflow: 'hidden',
    background: 'radial-gradient(60% 55% at 50% 38%, #3b4a6b, #0d1120)',
    color: '#c9d4e8',
    fontWeight: 700,
    fontSize: Math.round(size * 0.4),
    lineHeight: 1,
    ...(ring ? { boxShadow: `0 0 0 2px ${ring}` } : {}),
  }
  // Cerceveli -> SoberFrame (halka + animasyon); degilse sade dairesel avatar.
  const avatarEl =
    def && size >= 24 ? (
      <SoberFrame
        rarity={def.rarity}
        accent={def.accent}
        motion={animated ? def.motion : 'static'}
        size={size}
        src={src ?? undefined}
        initial={initial}
        className={`avf-sober ${className}`.trim()}
      />
    ) : (
      <span className={`avf-simple ${className}`.trim()} style={simpleWrap}>
        {src ? (
          <img
            src={src}
            alt={alt}
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          initial
        )}
      </span>
    )

  return avatarEl
}
