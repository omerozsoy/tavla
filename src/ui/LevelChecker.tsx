/**
 * LevelChecker — TEK bir tavla pulunun 1..9 seviyede EVRİMİ (9 ayrı ikon DEĞİL).
 *
 * Aynı temel pul (dairesel gövde + kalın kenar + iç halka + bevel highlight + gölge)
 * her seviyede kademeli zenginleşir: daha kalın ring, daha fazla iç halka, daha güçlü
 * bevel, glow/aura, enerji halkası, sparkle, merkez geometrik işaret. Renkler kartın
 * mevcut seviye paletinden türetilir (light=lv.a, dark=lv.b) — her pul o seviyenin
 * background'una uyumlu. Salt SVG/CSS; harici görsel/emoji/PNG/yeni dependency YOK.
 */
import { type ReactNode } from 'react'
import './LevelChecker.css'

interface Props {
  level: number // 1..9
  light: string // seviyenin açık aksan rengi (SoloLevel.a)
  dark: string // seviyenin koyu aksan rengi (SoloLevel.b)
  locked?: boolean
}

// --- küçük hex renk yardımcıları (color-mix SVG stop'ta güvenilmez -> JS'te hesapla) ---
const clamp = (n: number) => Math.max(0, Math.min(255, n))
function hex2rgb(h: string): [number, number, number] {
  let s = h.replace('#', '')
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  const n = parseInt(s, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgb2hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((x) => clamp(Math.round(x)).toString(16).padStart(2, '0')).join('')
function mix(h1: string, h2: string, t: number) {
  const a = hex2rgb(h1)
  const b = hex2rgb(h2)
  return rgb2hex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}

// Seviyeye göre kademeli parametreler (index = level-1). Tek kaynak: "aynı pul, artan değer".
const RIM_W = [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5]
const GLOSS = [0.1, 0.14, 0.18, 0.24, 0.3, 0.36, 0.42, 0.5, 0.58]
const GLOW = [0, 0, 0, 0.16, 0.22, 0.28, 0.34, 0.42, 0.52]
const RINGS = [1, 2, 2, 3, 3, 3, 4, 4, 4]
const SPARK = [0, 0, 0, 1, 1, 2, 2, 3, 3]
const SPARK_POS = [
  { x: 80, y: 22 },
  { x: 22, y: 74 },
  { x: 78, y: 72 },
]

export default function LevelChecker({ level, light, dark, locked }: Props) {
  const i = Math.max(0, Math.min(8, level - 1))
  const rimW = RIM_W[i]
  const gloss = GLOSS[i]
  const glow = GLOW[i]
  const ringN = RINGS[i]
  const sparkN = SPARK[i]
  const hasAura = level >= 7
  const hasMetalRing = level >= 5
  const hasStuds = level >= 6
  const hasCrown = level >= 7
  const hasCenter = level >= 3
  const hasRosette = level >= 8

  // renk paleti (kart aksanından türetilir)
  const bodyHi = mix(light, '#ffffff', 0.5)
  const bodyMid = light
  const bodyLo = mix(dark, '#000000', 0.12)
  const rimHi = mix(light, '#ffffff', 0.62)
  const rimMid = dark
  const rimLo = mix(dark, '#000000', 0.45)
  const glowC = mix(light, '#ffffff', 0.25)

  const uid = `lc${level}`
  const bodyR = 42 - rimW

  // iç halkalar (bevel groove + dekoratif) — gövde kenarından içe doğru
  const rings: { r: number; stroke: string }[] = []
  rings.push({ r: bodyR - 1.6, stroke: rimLo }) // her seviyede: gövde-kenar oluğu (bevel)
  for (let k = 0; k < ringN - 1; k++) {
    rings.push({ r: bodyR - 6 - k * 4.5, stroke: k % 2 === 0 ? rimHi : rimLo })
  }

  // rim üzeri süs çentikleri (bezel) — üst seviyeler
  const studs: ReactNode[] = []
  if (hasStuds) {
    const count = level >= 9 ? 12 : 8
    for (let s = 0; s < count; s++) {
      const ang = (s / count) * Math.PI * 2 - Math.PI / 2
      const rr = 42 - rimW / 2
      const cx = 50 + Math.cos(ang) * rr
      const cy = 50 + Math.sin(ang) * rr
      studs.push(<circle key={s} cx={cx} cy={cy} r={0.9} fill={rimHi} opacity={0.75} />)
    }
  }

  return (
    <span className={`level-checker${locked ? ' is-locked' : ''}`} data-level={level} aria-hidden="true">
      <svg viewBox="0 0 100 100" role="img" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={glowC} stopOpacity="0.9" />
            <stop offset="55%" stopColor={glowC} stopOpacity="0.35" />
            <stop offset="100%" stopColor={glowC} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={bodyHi} />
            <stop offset="52%" stopColor={bodyMid} />
            <stop offset="100%" stopColor={bodyLo} />
          </linearGradient>
          <linearGradient id={`${uid}-rim`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rimHi} />
            <stop offset="48%" stopColor={rimMid} />
            <stop offset="100%" stopColor={rimLo} />
          </linearGradient>
          <radialGradient id={`${uid}-spec`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Aura (L7+) ve glow (L4+) — pulun arkasında kontrollü ışık */}
        {hasAura && <circle className="lc-aura" cx="50" cy="50" r="48" fill={`url(#${uid}-glow)`} />}
        {glow > 0 && <circle className="lc-glow" cx="50" cy="50" r="45" fill={`url(#${uid}-glow)`} opacity={glow} />}

        {/* zemin gölgesi */}
        <ellipse cx="50" cy="87" rx="30" ry="5.5" fill="#000000" opacity="0.22" />

        {/* enerji/metal halkası (L5+) */}
        {hasMetalRing && (
          <circle
            className="lc-ring"
            cx="50"
            cy="50"
            r="45.5"
            fill="none"
            stroke={rimHi}
            strokeWidth="0.8"
            strokeDasharray={level >= 7 ? '3 4' : '2 6'}
            opacity="0.55"
          />
        )}

        {/* kalın dış kenar + tinted gövde */}
        <circle cx="50" cy="50" r="42" fill={`url(#${uid}-rim)`} />
        <circle cx="50" cy="50" r={bodyR} fill={`url(#${uid}-body)`} />

        {/* iç halkalar (bevel + dekor) */}
        {rings.map((rg, k) => (
          <circle key={k} cx="50" cy="50" r={rg.r} fill="none" stroke={rg.stroke} strokeWidth="0.7" opacity="0.75" />
        ))}

        {/* rim çentikleri (L6+) */}
        {studs}

        {/* merkez geometrik tavla işareti (L3+); L8+ rozet (compass) */}
        {hasCenter && (
          <g opacity={0.6} stroke={rimHi} strokeWidth="0.9" fill="none">
            <rect
              x={50 - (level >= 8 ? 8 : 6)}
              y={50 - (level >= 8 ? 8 : 6)}
              width={(level >= 8 ? 8 : 6) * 2}
              height={(level >= 8 ? 8 : 6) * 2}
              transform="rotate(45 50 50)"
              rx="1"
            />
            <circle cx="50" cy="50" r="1.6" fill={rimHi} stroke="none" />
            {hasRosette && (
              <>
                <line x1="50" y1="38" x2="50" y2="62" />
                <line x1="38" y1="50" x2="62" y2="50" />
              </>
            )}
          </g>
        )}

        {/* çok küçük geometrik prestij tepesi (L7+) — ikon/emoji değil, ince metal çentik */}
        {hasCrown && (
          <path
            d="M43 15 L46.5 10 L50 15 L53.5 10 L57 15"
            fill="none"
            stroke={rimHi}
            strokeWidth="1.1"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.7"
          />
        )}

        {/* specular bevel highlight (parlaklık seviyeyle artar) */}
        <ellipse cx="38" cy="34" rx="16" ry="11" fill={`url(#${uid}-spec)`} opacity={gloss} />

        {/* sparkle (L4+) — 4 köşe minik yıldız */}
        {Array.from({ length: sparkN }).map((_, s) => {
          const p = SPARK_POS[s]
          return (
            <path
              key={s}
              className="lc-spark"
              style={{ ['--d' as string]: `${s * 0.7}s` }}
              d={`M${p.x} ${p.y - 3} L${p.x + 0.9} ${p.y - 0.9} L${p.x + 3} ${p.y} L${p.x + 0.9} ${p.y + 0.9} L${p.x} ${p.y + 3} L${p.x - 0.9} ${p.y + 0.9} L${p.x - 3} ${p.y} L${p.x - 0.9} ${p.y - 0.9} Z`}
              fill="#ffffff"
            />
          )
        })}
      </svg>
    </span>
  )
}
