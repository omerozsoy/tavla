import { useId } from 'react'

// Kalkan (shield) amblem: logo kalkana kırpılır, çerçeve takım renkleri gradyanı (stroke).
// Path 100×100 kutuya sığar (cropper maskesiyle aynı → hizalı önizleme).
// Ayrı dosya: TeamTag (site geneli isim yanında) bunu import eder → koca TeamsView modülü
// ana bundle'a sürüklenmesin (TeamsView lazy kalsın).
export const SHIELD_PATH = 'M50 4 L86 13 Q90 14 90 19 L90 52 C90 78 74 94 50 98 C26 94 10 78 10 52 L10 19 Q10 14 14 13 Z'

export function TeamEmblem({ color1, color2, logo, label, size = 72 }: { color1: string; color2: string; logo?: string; label?: string; size?: number }) {
  const uid = useId().replace(/[:]/g, '')
  return (
    <svg viewBox="-5 -5 110 110" width={size} height={size}
      style={{ display: 'block', flexShrink: 0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.25))' }}>
      <defs>
        <linearGradient id={`tg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
        <clipPath id={`tc${uid}`}><path d={SHIELD_PATH} /></clipPath>
      </defs>
      <g clipPath={`url(#tc${uid})`}>
        {logo ? (
          <image href={logo} x="10" y="4" width="80" height="94" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <rect x="10" y="4" width="80" height="94" fill="#141922" />
            <text x="50" y="58" textAnchor="middle" fill="#fff" fontSize="30" fontWeight="800"
              fontFamily="system-ui, sans-serif">{(label || '?').slice(0, 4).toUpperCase()}</text>
          </>
        )}
      </g>
      <path d={SHIELD_PATH} fill="none" stroke={`url(#tg${uid})`} strokeWidth="6" strokeLinejoin="round" />
    </svg>
  )
}
