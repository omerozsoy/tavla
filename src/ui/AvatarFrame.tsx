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

// Premium halka — avatari saran SABIT kiremit cember; cember boyunca 6 eslit "PREMIUM" + 6 nokta
// (kullanici SVG'si mat/premium-cember.svg). Renk token'dan koyu kiremit (var(--accent) x koyu;
// sabit hex YOK). viewBox 200 -> width=size (kutuya sigar, tasmaz).
const RING_WORDS = [8.333, 25, 41.667, 58.333, 75, 91.667]
const RING_DOTS = [0, 16.667, 33.333, 50, 66.667, 83.333]
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
          <path id={id} d="M 100,100 m -90,0 a 90,90 0 1,1 180,0 a 90,90 0 1,1 -180,0" fill="none" />
        </defs>
        <circle cx="100" cy="100" r="90" fill="none" stroke="color-mix(in srgb, var(--accent) 80%, #000)" strokeWidth="20" />
        <text fill="#fff" fontFamily="'Outfit', system-ui, sans-serif" fontSize="12.5" fontWeight="600" letterSpacing="1.2">
          {RING_WORDS.map((o, i) => (
            <textPath key={`w${i}`} href={`#${id}`} startOffset={`${o}%`} textAnchor="middle" dominantBaseline="central">
              PREMIUM
            </textPath>
          ))}
          {RING_DOTS.map((o, i) => (
            <textPath key={`d${i}`} href={`#${id}`} startOffset={`${o}%`} textAnchor="middle" dominantBaseline="central">
              ·
            </textPath>
          ))}
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
