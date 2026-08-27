import type { CSSProperties } from 'react'
import './PremiumFrame.css'

// ============================================================================
// PremiumFrame — SVG tabanli, cok katmanli avatar cercevesi (prototip)
//  Rarity'ler geometri + materyal + animasyon acisindan GERCEKTEN farkli:
//    epic      -> Arcane Energy (violet/cyan, rune + dolasan enerji arki)
//    legendary -> Royal Gold (metalik altin bevel, tac + yakut, specular sweep)
//    mythic    -> Cosmic (konik enerji halkasi, yildiz partikulleri, yorunge)
//  Tum animasyonlar GPU-dostu (transform/opacity) + prefers-reduced-motion.
//  Her boyutta (48-160px) SVG oldugu icin kalite kaybi yok.
// ============================================================================

export type PremiumRarity = 'epic' | 'legendary' | 'mythic'

interface Props {
  rarity: PremiumRarity
  src?: string | null
  name?: string
  size?: number
  className?: string
}

// Benzersiz gradient id'leri (ayni sayfada birden fazla ornek cakismasin)
let _uid = 0
function useUid() {
  // Modul-seviyesi artan sayaç; SSR yok, render başına stabil olması gerekmiyor (id sadece kendi svg'sinde)
  return (_uid = (_uid + 1) % 100000)
}

function EpicFrame({ id }: { id: number }) {
  const g = (s: string) => `ep${id}-${s}`
  // 8 rune (kardinal + ara) — kucuk kristal elmaslar
  const runes = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    const r = 46
    const cx = 50 + Math.cos(a) * r
    const cy = 50 + Math.sin(a) * r
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
          <stop offset="52%" stopColor="#3a1a6b" stopOpacity="0" />
          <stop offset="82%" stopColor="#7a45e0" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#12d6ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('metal')} x1="0.15" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#d8c7ff" />
          <stop offset="0.32" stopColor="#7d55d6" />
          <stop offset="0.62" stopColor="#3a2183" />
          <stop offset="1" stopColor="#160b34" />
        </linearGradient>
        <linearGradient id={g('energy')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#26e9ff" />
          <stop offset="0.5" stopColor="#7bb6ff" />
          <stop offset="1" stopColor="#c77bff" />
        </linearGradient>
        <filter id={g('glow')} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle className="pf-aura" cx="50" cy="50" r="49" fill={`url(#${g('aura')})`} />
      {/* dis metalik cerceve */}
      <circle cx="50" cy="50" r="43.5" stroke={`url(#${g('metal')})`} strokeWidth="5" />
      <circle cx="50" cy="50" r="46" stroke="#0b0620" strokeWidth="1" opacity="0.9" />
      {/* koyu iç bevel + parlak ic rim (derinlik) */}
      <circle cx="50" cy="50" r="41" stroke="#0d0726" strokeWidth="1.6" opacity="0.85" />
      <circle cx="50" cy="50" r="39.9" stroke="#cbb6ff" strokeWidth="0.7" opacity="0.55" />
      {/* runes */}
      <g className="pf-runes" stroke="#a789ff" strokeWidth="0.6" fill="#1a0f3d">
        {runes}
      </g>
      {/* dolasan enerji arki */}
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

function LegendaryFrame({ id }: { id: number }) {
  const g = (s: string) => `lg${id}-${s}`
  return (
    <svg className="pf-svg" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={g('aura')} cx="50%" cy="48%" r="56%">
          <stop offset="60%" stopColor="#4a3208" stopOpacity="0" />
          <stop offset="88%" stopColor="#e0a93a" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#fff0c0" stopOpacity="0" />
        </radialGradient>
        {/* metalik altin: koyu -> altin -> sampanya highlight -> koyu */}
        <linearGradient id={g('gold')} x1="0.2" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset="0.22" stopColor="#f6dc86" />
          <stop offset="0.46" stopColor="#cf9b34" />
          <stop offset="0.7" stopColor="#8a5c18" />
          <stop offset="1" stopColor="#452a0a" />
        </linearGradient>
        <radialGradient id={g('ruby')} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ff9a9a" />
          <stop offset="0.35" stopColor="#e01e3c" />
          <stop offset="1" stopColor="#66060f" />
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
      {/* dis koyu kenar + kalin metalik altin + ic golge + parlak rim */}
      <circle cx="50" cy="50" r="46.6" stroke="#2a1a06" strokeWidth="1.2" />
      <circle cx="50" cy="50" r="43.5" stroke={`url(#${g('gold')})`} strokeWidth="6" />
      <circle cx="50" cy="50" r="40.4" stroke="#3a2408" strokeWidth="1.3" opacity="0.9" />
      <circle cx="50" cy="50" r="39.7" stroke="#fff2c4" strokeWidth="0.7" opacity="0.7" />

      {/* Taç (üst orta) — 3 sivri altın uç + merkez yakut */}
      <g className="pf-crown" fill={`url(#${g('gold')})`} stroke="#2a1a06" strokeWidth="0.35">
        <path d="M50,1.4 l3.2,6.2 -6.4,0 z" />
        <path d="M41.5,4.2 l2.6,5.4 -5.6,0.4 z" />
        <path d="M58.5,4.2 l3,5.8 -5.6,-0.4 z" />
      </g>
      <circle cx="50" cy="5.6" r="2.1" fill={`url(#${g('ruby')})`} stroke="#2a1a06" strokeWidth="0.3" />
      {/* Yan yakutlar (E/W) + alt küçük süs */}
      <circle cx="93.2" cy="50" r="1.7" fill={`url(#${g('ruby')})`} stroke="#2a1a06" strokeWidth="0.3" />
      <circle cx="6.8" cy="50" r="1.7" fill={`url(#${g('ruby')})`} stroke="#2a1a06" strokeWidth="0.3" />
      <circle cx="50" cy="94.4" r="1.6" fill={`url(#${g('ruby')})`} stroke="#2a1a06" strokeWidth="0.3" />

      {/* Specular light sweep — halka üzerinde yavaşça ilerleyen parlak highlight */}
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

function MythicFrame({ id }: { id: number }) {
  const g = (s: string) => `my${id}-${s}`
  // yildiz partikulleri (halka bandinda rastgele-gibi konum)
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
          <stop offset="50%" stopColor="#1a0b3d" stopOpacity="0" />
          <stop offset="82%" stopColor="#6a2fd0" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#20c9ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={g('struct')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1b52" />
          <stop offset="1" stopColor="#070312" />
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
      {/* koyu dis yapi (kozmik enerji halkasi pf-cosmic ile CSS'ten gelir; SVG yapisal cizgiler ekler) */}
      <circle cx="50" cy="50" r="46.4" stroke={`url(#${g('struct')})`} strokeWidth="3" />
      <circle cx="50" cy="50" r="41.4" stroke="#0a0518" strokeWidth="1.4" opacity="0.9" />
      <circle cx="50" cy="50" r="40.4" stroke="#9a7bff" strokeWidth="0.6" opacity="0.55" />

      {/* enerji wisp'leri (yavas akan) */}
      <g className="pf-wisps" stroke="#b98bff" strokeWidth="0.8" strokeLinecap="round" opacity="0.7">
        <circle cx="50" cy="50" r="43.8" strokeDasharray="10 265" pathLength="275" />
        <circle
          cx="50"
          cy="50"
          r="43.8"
          strokeDasharray="7 268"
          pathLength="275"
          style={{ animationDelay: '-4s' }}
        />
      </g>

      {/* yildiz partikulleri */}
      <g className="pf-stars" fill="#fff">
        {stars.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} style={{ ['--i' as string]: i }} />
        ))}
      </g>

      {/* yorunge — halkayi dolasan tek parlak nokta */}
      <g className="pf-orbit">
        <circle cx="50" cy="6.2" r="1.7" fill="#dff3ff" filter={`url(#${g('glow')})`} />
      </g>
    </svg>
  )
}

export default function PremiumFrame({
  rarity,
  src,
  name = '',
  size = 96,
  className = '',
}: Props) {
  const id = useUid()
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className={`pf pf-${rarity} ${className}`.trim()}
      style={{ ['--pf-size' as string]: `${size}px` } as CSSProperties}
      data-rarity={rarity}
    >
      {rarity === 'mythic' && <span className="pf-cosmic" aria-hidden="true" />}
      <span className="pf-avatar">
        {src ? <img src={src} alt="" draggable={false} /> : <span className="pf-ini">{initial}</span>}
      </span>
      {rarity === 'epic' && <EpicFrame id={id} />}
      {rarity === 'legendary' && <LegendaryFrame id={id} />}
      {rarity === 'mythic' && <MythicFrame id={id} />}
    </span>
  )
}
