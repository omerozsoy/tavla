import type { CSSProperties } from 'react'
import { useId } from 'react'
import SoberFrame from './SoberFrame'
import { FRAME_BY_ID, FRAME_RARITY_COLOR } from './avatarFrames'

// Avatar + (varsa) sade cerceve. Cerceve tanimliysa ve boyut yeterliyse SoberFrame (CSS halka +
// secili animasyon) cizilir; kucuk/cercevesiz durumda sade dairesel avatar (cerceveliyse ince
// rarity halkasi). Eski PremiumFrame (24 tema) kaldirildi.
//
// PREMIUM HALKA (kullanici tasarimi): premium=true ise avatarin ETRAFINA SABIT kiremit halka +
// cember boyunca "PREMIUM · PREMIUM" yazisi. Avatar halkanin ICINE sigar (toplam kutu = size) ->
// hicbir konteynerde tasmaz/kirpilmaz, HER BOYUTTA gorunur. Avatarla tek parca (resim gibi).
interface Props {
  src?: string | null
  frame?: string | null
  size?: number
  name?: string
  alt?: string
  className?: string
  /** false: hareket durur (yogun listeler). Varsayilan true. */
  animated?: boolean
  /** true: premium uye -> avatar etrafinda kiremit "PREMIUM" halkasi. */
  premium?: boolean
}

// Premium halka — avatari saran SABIT kiremit cember; cember boyunca "PREMIUM · " yazisi.
// Renk site ana renginden var(--accent) (sabit hex YOK). viewBox 200 -> width=size (kutuya sigar).
function PremiumRing({ size }: { size: number }) {
  const id = useId()
  return (
    <span
      aria-hidden
      className="avf-ring"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', lineHeight: 0, zIndex: 3 }}
    >
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <path id={id} d="M 100,100 m -91,0 a 91,91 0 1,1 182,0 a 91,91 0 1,1 -182,0" fill="none" />
        </defs>
        {/* Kiremit bant + ince koyu kontur (ust/alt) */}
        <circle cx="100" cy="100" r="91" fill="none" stroke="var(--accent)" strokeWidth="17" />
        <circle cx="100" cy="100" r="99.5" fill="none" stroke="color-mix(in srgb, var(--accent) 55%, #000)" strokeWidth="1" />
        <circle cx="100" cy="100" r="82.5" fill="none" stroke="color-mix(in srgb, var(--accent) 55%, #000)" strokeWidth="1" />
        <text
          fill="#fff"
          fontFamily="'Outfit', system-ui, sans-serif"
          fontSize="9"
          fontWeight="700"
          letterSpacing="1.4"
        >
          <textPath href={`#${id}`} startOffset="0%" dominantBaseline="central">
            PREMIUM · PREMIUM · PREMIUM · PREMIUM · PREMIUM · PREMIUM · PREMIUM · PREMIUM ·{' '}
          </textPath>
        </text>
      </svg>
    </span>
  )
}

export default function AvatarFrame({
  src,
  frame,
  size = 64,
  name = '',
  alt = '',
  className = '',
  animated = true,
  premium = false,
}: Props) {
  const def = frame ? FRAME_BY_ID[frame] : undefined
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  // Premiumsa avatar, halkanin ICINE sigacak sekilde kucultulur (toplam kutu = size).
  const avSize = premium ? Math.round(size * 0.78) : size

  // Cerceveli -> SoberFrame (halka + animasyon); degilse sade dairesel avatar.
  const ring = def ? FRAME_RARITY_COLOR[def.rarity] : undefined
  const simpleWrap: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    width: avSize,
    height: avSize,
    borderRadius: '50%',
    overflow: 'hidden',
    background: 'radial-gradient(60% 55% at 50% 38%, #3b4a6b, #0d1120)',
    color: '#c9d4e8',
    fontWeight: 700,
    fontSize: Math.round(avSize * 0.4),
    lineHeight: 1,
    ...(ring ? { boxShadow: `0 0 0 2px ${ring}` } : {}),
  }
  const avatarEl =
    def && avSize >= 24 ? (
      <SoberFrame
        rarity={def.rarity}
        accent={def.accent}
        motion={animated ? def.motion : 'static'}
        size={avSize}
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

  if (!premium) return avatarEl
  // Premium: avatar (kucultulmus) ortada + etrafinda SABIT kiremit "PREMIUM" halkasi. Kutu = size.
  return (
    <span
      className="avf-premium"
      style={{
        position: 'relative',
        width: size,
        height: size,
        flex: '0 0 auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {avatarEl}
      <PremiumRing size={size} />
    </span>
  )
}
