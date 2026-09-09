import type { CSSProperties } from 'react'
import SoberFrame from './SoberFrame'
import { FRAME_BY_ID, FRAME_RARITY_COLOR } from './avatarFrames'

// Avatar + (varsa) sade cerceve. Cerceve tanimliysa ve boyut yeterliyse SoberFrame (CSS halka +
// secili animasyon) cizilir; kucuk/cercevesiz durumda sade dairesel avatar (cerceveliyse ince
// rarity halkasi). Eski PremiumFrame (24 tema) kaldirildi.
//
// PREMIUM ROZET: premium=true ise avatarin ALTINA kiremit "PREMIUM" KURDELE rozeti oturur
// (kullanici tasarimi; renk site ana renginden var(--accent)). Tek kaynak -> PlayerIdentity
// uzerinden tum site (liderlik, profil, hesap bari, ...) ayni rozet.
interface Props {
  src?: string | null
  frame?: string | null
  size?: number
  name?: string
  alt?: string
  className?: string
  /** false: hareket durur (yogun listeler). Varsayilan true. */
  animated?: boolean
  /** true: premium uye -> avatar ALTINDA kiremit "PREMIUM" kurdele rozeti. */
  premium?: boolean
}

// Premium rozeti — avatarin ALTINA oturan kiremit KURDELE (uclari kivrik/centikli), uzerinde
// "PREMIUM". Renk site ana renginden (var(--accent)); fold/stroke color-mix ile turer (sabit hex
// YASAK direktifi). Genislik ~avatarin 1.28 kati; hafif alta biner.
function PremiumBadge({ size }: { size: number }) {
  const w = Math.round(size * 1.28)
  const band: CSSProperties = { fill: 'var(--accent)', stroke: 'color-mix(in srgb, var(--accent) 55%, #000)', strokeWidth: 1 }
  const fold: CSSProperties = { fill: 'color-mix(in srgb, var(--accent) 60%, #000)' }
  return (
    <span
      aria-hidden
      className="avf-badge"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 0,
        width: w,
        transform: 'translate(-50%, 42%)',
        lineHeight: 0,
        pointerEvents: 'none',
        zIndex: 3,
        filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.28))',
      }}
    >
      <svg viewBox="0 0 128 44" width={w} height={(w * 44) / 128} style={{ display: 'block' }}>
        {/* arka kivrik uclar (koyu kiremit) */}
        <path d="M6 15 L34 15 L34 33 L6 33 L15 24 Z" style={fold} />
        <path d="M122 15 L94 15 L94 33 L122 33 L113 24 Z" style={fold} />
        {/* ana bant */}
        <path d="M24 10 Q64 6 104 10 L104 34 Q64 38 24 34 Z" style={band} strokeLinejoin="round" />
        {/* ust parlama */}
        <path d="M26 12 Q64 8.5 102 12 L102 18 Q64 15 26 18 Z" fill="rgba(255,255,255,0.18)" />
        <text
          x="64"
          y="26.5"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="12"
          fontWeight="800"
          letterSpacing="1.2"
          fill="#fff"
          fontFamily="var(--tv-font-ui, 'Segoe UI', system-ui, sans-serif)"
        >
          PREMIUM
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
    <span className="avf-premium" style={{ position: 'relative', display: 'inline-flex', flex: '0 0 auto' }}>
      {avatarEl}
      <PremiumBadge size={size} />
    </span>
  )
}
