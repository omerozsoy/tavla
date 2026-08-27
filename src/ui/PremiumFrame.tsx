import type { CSSProperties } from 'react'
import { useId } from 'react'
import './PremiumFrame.css'

// ============================================================================
// PremiumFrame — SVG tabanli, cok katmanli avatar cercevesi.
//  Rarity geometri/materyal/animasyon acisindan GERCEKTEN farkli:
//    rare      -> Tempered Silver (temiz metal + hafif enerji shimmer)
//    epic      -> Arcane Energy   (metal bevel + dolasan enerji arki + runeler)
//    legendary -> Royal Metal     (metalik bevel + tac + mucevher + specular sweep)
//    mythic    -> Cosmic          (konik enerji halkasi + yildizlar + wisp + yorunge)
//  Renkler CSS degiskenlerinden (--pf-1/2/4, --pf-dark, --pf-gem) gelir; boylece
//  ayni geometri farkli TEMALARLA (fire/ice/emerald/ruby/cyber/dragon...) ayni
//  premium kalitede ama gorsel olarak farkli olur. color-mix ile ton/golge turetilir.
//  GPU-dostu (transform/opacity/dash), prefers-reduced-motion destekli.
// ============================================================================

export type PremiumRarity = 'rare' | 'epic' | 'legendary' | 'mythic'
export type FrameTheme =
  | 'fire'
  | 'ice'
  | 'emerald'
  | 'ruby'
  | 'cyber'
  | 'dragon'
  | 'thunder'
  | 'silver'
  | 'gold'

interface Props {
  rarity: PremiumRarity
  theme?: FrameTheme
  src?: string | null
  name?: string
  size?: number
  animated?: boolean
  className?: string
}

const METAL_HI = 'color-mix(in srgb, var(--pf-2) 42%, #ffffff)'
const METAL_LO = 'color-mix(in srgb, var(--pf-2) 55%, #000000)'
const GOLD_HI = 'color-mix(in srgb, var(--pf-2) 30%, #ffffff)'
const GOLD_SH = 'color-mix(in srgb, var(--pf-2) 60%, #000000)'

function RareFrame({ id }: { id: string }) {
  const g = (s: string) => `${id}-${s}`
  return (
    <svg className="pf-svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={g('aura')} cx="50%" cy="46%" r="56%">
          <stop offset="60%" stopColor="var(--pf-2)" stopOpacity="0" />
          <stop offset="90%" stopColor="var(--pf-1)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--pf-1)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('metal')} x1="0.2" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={METAL_HI} />
          <stop offset="0.5" stopColor="var(--pf-2)" />
          <stop offset="1" stopColor={METAL_LO} />
        </linearGradient>
        <linearGradient id={g('shine')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--pf-1)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--pf-1)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--pf-1)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle className="pf-aura" cx="50" cy="50" r="49" fill={`url(#${g('aura')})`} />
      <circle cx="50" cy="50" r="43.5" stroke={`url(#${g('metal')})`} strokeWidth="4" />
      <circle cx="50" cy="50" r="45.6" stroke="var(--pf-dark)" strokeWidth="1" opacity="0.85" />
      <circle cx="50" cy="50" r="41.2" stroke="var(--pf-dark)" strokeWidth="1.2" opacity="0.7" />
      <circle cx="50" cy="50" r="40.2" stroke="var(--pf-1)" strokeWidth="0.6" opacity="0.4" />
      {/* 4 kucuk kardinal cizik (sade dekor) */}
      <g stroke="var(--pf-1)" strokeWidth="1.1" opacity="0.55" strokeLinecap="round">
        <path d="M50,3.5 v3.4" />
        <path d="M96.5,50 h-3.4" />
        <path d="M50,96.5 v-3.4" />
        <path d="M3.5,50 h3.4" />
      </g>
      {/* hafif shimmer (yavas) */}
      <g className="pf-sweep">
        <circle
          cx="50"
          cy="50"
          r="43.5"
          stroke={`url(#${g('shine')})`}
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeDasharray="12 264"
        />
      </g>
    </svg>
  )
}

function EpicFrame({ id }: { id: string }) {
  const g = (s: string) => `${id}-${s}`
  const runes = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    const cx = 50 + Math.cos(a) * 46
    const cy = 50 + Math.sin(a) * 46
    return (
      <path
        key={i}
        d={`M${cx},${cy - 2.4} l1.8,2.4 -1.8,2.4 -1.8,-2.4 z`}
        className="pf-rune"
        style={{ ['--i' as string]: i }}
      />
    )
  })
  return (
    <svg className="pf-svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={g('aura')} cx="50%" cy="44%" r="58%">
          <stop offset="52%" stopColor="var(--pf-2)" stopOpacity="0" />
          <stop offset="82%" stopColor="var(--pf-2)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--pf-1)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('metal')} x1="0.15" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor={METAL_HI} />
          <stop offset="0.4" stopColor="var(--pf-2)" />
          <stop offset="1" stopColor={METAL_LO} />
        </linearGradient>
        <linearGradient id={g('energy')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--pf-1)" />
          <stop offset="1" stopColor="var(--pf-4)" />
        </linearGradient>
        <filter id={g('glow')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle className="pf-aura" cx="50" cy="50" r="49" fill={`url(#${g('aura')})`} />
      <circle cx="50" cy="50" r="43.5" stroke={`url(#${g('metal')})`} strokeWidth="5" />
      <circle cx="50" cy="50" r="46" stroke="var(--pf-dark)" strokeWidth="1" opacity="0.9" />
      <circle cx="50" cy="50" r="41" stroke="var(--pf-dark)" strokeWidth="1.6" opacity="0.85" />
      <circle cx="50" cy="50" r="39.9" stroke="var(--pf-1)" strokeWidth="0.7" opacity="0.5" />
      <g className="pf-runes" stroke="var(--pf-1)" strokeWidth="0.6" fill="var(--pf-dark)">
        {runes}
      </g>
      <g className="pf-arc">
        <circle
          cx="50"
          cy="50"
          r="43.5"
          stroke={`url(#${g('energy')})`}
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeDasharray="30 243"
          filter={`url(#${g('glow')})`}
        />
      </g>
    </svg>
  )
}

function LegendaryFrame({ id }: { id: string }) {
  const g = (s: string) => `${id}-${s}`
  return (
    <svg className="pf-svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={g('aura')} cx="50%" cy="48%" r="56%">
          <stop offset="60%" stopColor="var(--pf-2)" stopOpacity="0" />
          <stop offset="88%" stopColor="var(--pf-2)" stopOpacity="0.34" />
          <stop offset="100%" stopColor="var(--pf-1)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('gold')} x1="0.2" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="var(--pf-1)" />
          <stop offset="0.22" stopColor={GOLD_HI} />
          <stop offset="0.5" stopColor="var(--pf-2)" />
          <stop offset="0.72" stopColor={GOLD_SH} />
          <stop offset="1" stopColor="var(--pf-dark)" />
        </linearGradient>
        <radialGradient id={g('gem')} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="color-mix(in srgb, var(--pf-gem) 45%, #ffffff)" />
          <stop offset="0.4" stopColor="var(--pf-gem)" />
          <stop offset="1" stopColor="color-mix(in srgb, var(--pf-gem) 55%, #000000)" />
        </radialGradient>
        <linearGradient id={g('sweep')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff8e0" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff8e0" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff8e0" stopOpacity="0" />
        </linearGradient>
        <filter id={g('soft')} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
      </defs>
      <circle className="pf-aura" cx="50" cy="50" r="49" fill={`url(#${g('aura')})`} />
      <circle cx="50" cy="50" r="46.6" stroke="var(--pf-dark)" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="43.5" stroke={`url(#${g('gold')})`} strokeWidth="6" />
      <circle cx="50" cy="50" r="40.4" stroke={GOLD_SH} strokeWidth="1.3" opacity="0.9" />
      <circle cx="50" cy="50" r="39.7" stroke={GOLD_HI} strokeWidth="0.7" opacity="0.75" />
      <g className="pf-crown" fill={`url(#${g('gold')})`} stroke="var(--pf-dark)" strokeWidth="0.35">
        <path d="M50,1.4 l3.2,6.2 -6.4,0 z" />
        <path d="M41.5,4.2 l2.6,5.4 -5.6,0.4 z" />
        <path d="M58.5,4.2 l3,5.8 -5.6,-0.4 z" />
      </g>
      <circle cx="50" cy="5.6" r="2.1" fill={`url(#${g('gem')})`} stroke="var(--pf-dark)" strokeWidth="0.3" />
      <circle cx="93.2" cy="50" r="1.7" fill={`url(#${g('gem')})`} stroke="var(--pf-dark)" strokeWidth="0.3" />
      <circle cx="6.8" cy="50" r="1.7" fill={`url(#${g('gem')})`} stroke="var(--pf-dark)" strokeWidth="0.3" />
      <circle cx="50" cy="94.4" r="1.6" fill={`url(#${g('gem')})`} stroke="var(--pf-dark)" strokeWidth="0.3" />
      <g className="pf-sweep" filter={`url(#${g('soft')})`}>
        <circle
          cx="50"
          cy="50"
          r="43.5"
          stroke={`url(#${g('sweep')})`}
          strokeWidth="5.4"
          strokeLinecap="round"
          strokeDasharray="16 260"
        />
      </g>
    </svg>
  )
}

function MythicFrame({ id }: { id: string }) {
  const g = (s: string) => `${id}-${s}`
  const stars = [
    [50, 4.5, 1.2],
    [72, 10, 0.8],
    [90, 30, 1],
    [95, 55, 0.7],
    [82, 80, 1.1],
    [55, 95, 0.8],
    [28, 92, 1],
    [9, 68, 0.7],
    [5, 42, 1.1],
    [18, 16, 0.8],
    [38, 7, 0.7],
    [64, 90, 0.9],
  ] as const
  return (
    <svg className="pf-svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={g('aura')} cx="50%" cy="46%" r="60%">
          <stop offset="50%" stopColor="var(--pf-2)" stopOpacity="0" />
          <stop offset="82%" stopColor="var(--pf-2)" stopOpacity="0.44" />
          <stop offset="100%" stopColor="var(--pf-1)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('struct')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--pf-2) 55%, var(--pf-dark))" />
          <stop offset="1" stopColor="var(--pf-dark)" />
        </linearGradient>
        <filter id={g('glow')} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle className="pf-aura" cx="50" cy="50" r="49.5" fill={`url(#${g('aura')})`} />
      <circle cx="50" cy="50" r="46.4" stroke={`url(#${g('struct')})`} strokeWidth="3" />
      <circle cx="50" cy="50" r="41.4" stroke="var(--pf-dark)" strokeWidth="1.4" opacity="0.9" />
      <circle cx="50" cy="50" r="40.4" stroke="var(--pf-1)" strokeWidth="0.6" opacity="0.55" />
      <g className="pf-wisps" stroke="var(--pf-4)" strokeWidth="0.8" strokeLinecap="round" opacity="0.7">
        <circle cx="50" cy="50" r="43.8" strokeDasharray="10 265" pathLength="275" />
        <circle cx="50" cy="50" r="43.8" strokeDasharray="7 268" pathLength="275" style={{ animationDelay: '-4s' }} />
      </g>
      <g className="pf-stars" fill="var(--pf-1)">
        {stars.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} style={{ ['--i' as string]: i }} />
        ))}
      </g>
      <g className="pf-orbit">
        <circle cx="50" cy="6.2" r="1.7" fill="var(--pf-1)" filter={`url(#${g('glow')})`} />
      </g>
    </svg>
  )
}

const DESIGN = {
  rare: RareFrame,
  epic: EpicFrame,
  legendary: LegendaryFrame,
  mythic: MythicFrame,
} as const

export default function PremiumFrame({
  rarity,
  theme,
  src,
  name = '',
  size = 96,
  animated = true,
  className = '',
}: Props) {
  const rid = useId().replace(/:/g, '')
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const Design = DESIGN[rarity]
  const cls = [
    'pf',
    `pf-${rarity}`,
    theme ? `pf-t-${theme}` : '',
    animated ? '' : 'pf-static',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <span className={cls} style={{ ['--pf-size' as string]: `${size}px` } as CSSProperties} data-rarity={rarity}>
      {rarity === 'mythic' && <span className="pf-cosmic" aria-hidden="true" />}
      <span className="pf-avatar">
        {src ? <img src={src} alt="" draggable={false} /> : <span className="pf-ini">{initial}</span>}
      </span>
      <Design id={rid} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Frame id -> premium gorsel (rarity + tema). Mevcut 24 frame'i buna esler.
// ---------------------------------------------------------------------------
export interface FrameVisual {
  rarity: PremiumRarity
  theme?: FrameTheme
}
const FRAME_VISUAL: Record<string, FrameVisual> = {
  // rare
  'neon-pulse': { rarity: 'rare', theme: 'cyber' },
  // epic
  'purple-vortex': { rarity: 'epic' },
  'ice-crown': { rarity: 'epic', theme: 'ice' },
  electric: { rarity: 'epic', theme: 'thunder' },
  cyberpunk: { rarity: 'epic', theme: 'cyber' },
  'dice-master': { rarity: 'epic', theme: 'emerald' },
  // legendary
  'royal-gold': { rarity: 'legendary', theme: 'gold' },
  inferno: { rarity: 'legendary', theme: 'fire' },
  diamond: { rarity: 'legendary', theme: 'ice' },
  emerald: { rarity: 'legendary', theme: 'emerald' },
  ruby: { rarity: 'legendary', theme: 'ruby' },
  vip: { rarity: 'legendary', theme: 'gold' },
  champion: { rarity: 'legendary', theme: 'gold' },
  'backgammon-king': { rarity: 'legendary', theme: 'gold' },
  'top-100': { rarity: 'legendary', theme: 'silver' },
  '1000-wins': { rarity: 'legendary', theme: 'gold' },
  // mythic
  'black-hole': { rarity: 'mythic' },
  galaxy: { rarity: 'mythic' },
  phoenix: { rarity: 'mythic', theme: 'fire' },
  dragon: { rarity: 'mythic', theme: 'dragon' },
  'thunder-god': { rarity: 'mythic', theme: 'thunder' },
  grandmaster: { rarity: 'mythic', theme: 'gold' },
  'tournament-champion': { rarity: 'mythic', theme: 'gold' },
  'season-champion': { rarity: 'mythic' },
}

export function frameVisual(id?: string | null): FrameVisual | undefined {
  if (!id) return undefined
  return FRAME_VISUAL[id]
}
