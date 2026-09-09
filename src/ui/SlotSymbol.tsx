/**
 * Zar Slotu sembolü — tek bir makara hücresinin içeriği. İki tür:
 *  - Zar yüzü (d1..d6): kaliteli fildişi zar, standart pip yerleşimi, koyu benekler.
 *  - 64 küpü (c64): tavla doubling cube görünümü — kiremit (accent) küp, büyük "64".
 *
 * Tamamen SVG; kabın %100'ünü doldurur (makara boyutuna ölçeklenir). Renk/köşe değerleri
 * site token'larına (var(--accent) vb.) bağlı — sabit hex yalnız zar fildişi/benek tonları.
 */
import type { SlotSymbolCode } from '../api'

// Standart zar pip koordinatları (100x100 viewBox, 3x3 ızgara).
const P = {
  tl: [30, 30],
  tr: [70, 30],
  ml: [30, 50],
  mr: [70, 50],
  c: [50, 50],
  bl: [30, 70],
  br: [70, 70],
} as const

const PIPS: Record<number, Array<keyof typeof P>> = {
  1: ['c'],
  2: ['tl', 'br'],
  3: ['tl', 'c', 'br'],
  4: ['tl', 'tr', 'bl', 'br'],
  5: ['tl', 'tr', 'c', 'bl', 'br'],
  6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
}

function DieFace({ value }: { value: number }) {
  const pips = PIPS[value] ?? PIPS[1]
  return (
    <svg viewBox="0 0 100 100" className="ss-svg" role="img" aria-label={`Zar ${value}`}>
      <defs>
        <linearGradient id={`ss-die-${value}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf7ee" />
          <stop offset="1" stopColor="#ece3d1" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="88" height="88" rx="18" fill={`url(#ss-die-${value})`} stroke="#d8ccb4" strokeWidth="2" />
      {pips.map((k) => {
        const [cx, cy] = P[k]
        return <circle key={k} cx={cx} cy={cy} r="9" fill="#2b2722" />
      })}
    </svg>
  )
}

function CubeFace() {
  return (
    <svg viewBox="0 0 100 100" className="ss-svg" role="img" aria-label="64 küpü">
      <defs>
        <linearGradient id="ss-cube" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--med-terracotta, #c9563f)" />
          <stop offset="1" stopColor="var(--med-terracotta-dark, #a83a2b)" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="88" height="88" rx="18" fill="url(#ss-cube)" stroke="#7d2a1e" strokeWidth="2" />
      {/* iç ince çerçeve (doubling cube kabartma hissi) */}
      <rect x="16" y="16" width="68" height="68" rx="12" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="2" />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="42"
        fontWeight="700"
        fill="#ffffff"
        style={{ fontFamily: 'var(--tv-font-display)' }}
      >
        64
      </text>
    </svg>
  )
}

export default function SlotSymbol({ code }: { code: SlotSymbolCode }) {
  if (code === 'c64') return <CubeFace />
  const v = Number(code.slice(1))
  return <DieFace value={v} />
}
