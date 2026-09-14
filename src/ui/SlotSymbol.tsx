/**
 * Zar Slotu sembolü — tek bir makara hücresinin içeriği. Premium, hafif 3D casino sembolü
 * hissi (düz emoji/flat ikon DEĞİL): beveled kenar, cam parlaması, yumuşak iç gölge.
 *
 *  - Zar yüzü (d1..d6): kaliteli fildişi zar, standart pip yerleşimi, koyu benekler +
 *    üstte ışık highlight'ı, alt-iç gölge (kabartma).
 *  - 64 küpü (c64): JACKPOT sembolü — altın doubling cube, kabartma "64", sıcak glow.
 *
 * Tamamen SVG; kabın %100'ünü doldurur (makara boyutuna ölçeklenir). Renk/köşe değerleri
 * site token'larına bağlı; sabit hex yalnız fildişi/altın materyal tonlarında.
 *
 * NOT (SÖZLEŞME): `code` değerleri backend'in döndürdüğü SlotSymbolCode'dur — DEĞİŞTİRME.
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
  const gid = `ss-die-${value}`
  return (
    <svg viewBox="0 0 100 100" className="ss-svg" role="img" aria-label={`Zar ${value}`}>
      <defs>
        {/* Fildişi gövde: üstten aydınlık, alta doğru koyulaşan dikey gradient */}
        <linearGradient id={`${gid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#f6efe0" />
          <stop offset="1" stopColor="#e2d6bd" />
        </linearGradient>
        {/* Üst cam highlight'ı (parlak köşe) */}
        <radialGradient id={`${gid}-gloss`} cx="0.32" cy="0.24" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* Pip'ler: hafif kabartma (koyu, ortası biraz açık) */}
        <radialGradient id={`${gid}-pip`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#4a433a" />
          <stop offset="1" stopColor="#221e19" />
        </radialGradient>
      </defs>
      {/* Alt gölge (zarın oturduğu hafif zemin gölgesi) */}
      <rect x="9" y="12" width="82" height="82" rx="17" fill="#000000" opacity="0.16" />
      {/* Gövde */}
      <rect x="7" y="6" width="86" height="86" rx="17" fill={`url(#${gid}-body)`} stroke="#cbbd9f" strokeWidth="1.5" />
      {/* İç bevel çizgisi (kabartma kenar) */}
      <rect
        x="12"
        y="11"
        width="76"
        height="76"
        rx="13"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.55"
        strokeWidth="1.4"
      />
      {/* Cam parlaması */}
      <rect x="7" y="6" width="86" height="86" rx="17" fill={`url(#${gid}-gloss)`} />
      {pips.map((k) => {
        const [cx, cy] = P[k]
        return (
          <g key={k}>
            <circle cx={cx} cy={cy + 1.2} r="9" fill="#000000" opacity="0.12" />
            <circle cx={cx} cy={cy} r="9" fill={`url(#${gid}-pip)`} />
            <circle cx={cx - 2.4} cy={cy - 2.6} r="2.4" fill="#ffffff" opacity="0.28" />
          </g>
        )
      })}
    </svg>
  )
}

function CubeFace() {
  return (
    <svg viewBox="0 0 100 100" className="ss-svg" role="img" aria-label="64 küpü — Jackpot">
      <defs>
        {/* Altın metal gövde (jackpot sembolü altındır — premium fiziksel detay) */}
        <linearGradient id="ss-cube-body" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#ffe9ad" />
          <stop offset="0.42" stopColor="#f0c04e" />
          <stop offset="0.72" stopColor="#d69a2b" />
          <stop offset="1" stopColor="#a9741a" />
        </linearGradient>
        <radialGradient id="ss-cube-gloss" cx="0.3" cy="0.22" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="9" y="12" width="82" height="82" rx="17" fill="#000000" opacity="0.22" />
      <rect x="7" y="6" width="86" height="86" rx="17" fill="url(#ss-cube-body)" stroke="#8a5f14" strokeWidth="1.6" />
      {/* iç ince çerçeve (doubling cube kabartma hissi) */}
      <rect x="16" y="16" width="68" height="68" rx="12" fill="none" stroke="#5a3d0d" strokeOpacity="0.55" strokeWidth="1.6" />
      <rect x="13" y="11" width="74" height="74" rx="13" fill="none" stroke="#fff6da" strokeOpacity="0.6" strokeWidth="1.3" />
      <rect x="7" y="6" width="86" height="86" rx="17" fill="url(#ss-cube-gloss)" />
      <text
        x="50"
        y="53"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="40"
        fontWeight="800"
        fill="#4a2f08"
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
