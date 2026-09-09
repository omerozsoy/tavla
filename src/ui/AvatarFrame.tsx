import type { CSSProperties } from 'react'
import { useId } from 'react'
import SoberFrame from './SoberFrame'
import { FRAME_BY_ID, FRAME_RARITY_COLOR } from './avatarFrames'

// Avatar + (varsa) sade cerceve. Cerceve tanimliysa ve boyut yeterliyse SoberFrame (CSS halka +
// secili animasyon) cizilir; kucuk/cercevesiz durumda sade dairesel avatar (cerceveliyse ince
// rarity halkasi). Eski PremiumFrame (24 tema) kaldirildi.
//
// PREMIUM TAC: premium=true ise avatarin USTUNE, daire GENISLIGINDE altin klasik tac oturur
// (kullanici secimi: "Klasik Altin Tac", tam-genislik). Tek kaynak -> PlayerIdentity uzerinden
// tum site (liderlik, canli maclar, profil, hesap bari) ayni tac. Gradient id useId ile benzersiz.
interface Props {
  src?: string | null
  frame?: string | null
  size?: number
  name?: string
  alt?: string
  className?: string
  /** false: hareket durur (yogun listeler). Varsayilan true. */
  animated?: boolean
  /** true: premium uye -> avatar ustunde altin tac. */
  premium?: boolean
}

// Premium tac — avatar dairesiyle AYNI genislikte, tepeye oturur (klasik 3 uclu altin, kiremit tasli).
function PremiumCrown({ size }: { size: number }) {
  const id = useId()
  return (
    <span
      aria-hidden
      className="avf-crown"
      style={{
        position: 'absolute',
        left: '50%',
        top: 0,
        width: size,
        transform: 'translate(-50%, -62%)',
        lineHeight: 0,
        pointerEvents: 'none',
        zIndex: 3,
        filter: 'drop-shadow(0 1.5px 2.5px rgba(0,0,0,0.22))',
      }}
    >
      <svg viewBox="0 0 120 74" width={size} height={(size * 74) / 120} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe9b0" />
            <stop offset="0.5" stopColor="#e9be5a" />
            <stop offset="1" stopColor="#c8962f" />
          </linearGradient>
        </defs>
        <path
          d="M8 60 L16 26 L40 48 L60 12 L80 48 L104 26 L112 60 Z"
          fill={`url(#${id})`}
          stroke="#a9782a"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <rect x="10" y="54" width="100" height="14" rx="3" fill={`url(#${id})`} stroke="#a9782a" strokeWidth="3" />
        <circle cx="16" cy="24" r="5.5" fill="#C9563F" />
        <circle cx="60" cy="10" r="6.5" fill="#C9563F" />
        <circle cx="104" cy="24" r="5.5" fill="#C9563F" />
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

  // Premium degilse dogrudan avatar; premiumsa konumlandirma sarmali + avatar ustunde altin tac.
  if (!premium) return avatarEl
  return (
    <span className="avf-crowned" style={{ position: 'relative', display: 'inline-flex', flex: '0 0 auto' }}>
      {avatarEl}
      <PremiumCrown size={size} />
    </span>
  )
}
