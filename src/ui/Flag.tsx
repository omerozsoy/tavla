import type { CSSProperties } from 'react'
import { normalizeCountry, TRNC_CODE } from '../countries'

// KKTC bayragi: ISO kodu olmadigindan flagcdn servis etmez -> gomulu SVG (data-URI).
// Beyaz zemin, iki yatay kirmizi serit, ortada kirmizi hilal+yildiz (Turk bayraginin
// ters renkleri). <img> src'si oldugu icin CountryFlag'in yuvarlak/boyut mantigi aynen isler.
const TRNC_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800'>" +
  "<rect width='1200' height='800' fill='#fff'/>" +
  "<rect y='160' width='1200' height='66' fill='#E30A17'/>" +
  "<rect y='574' width='1200' height='66' fill='#E30A17'/>" +
  "<circle cx='540' cy='400' r='140' fill='#E30A17'/>" +
  "<circle cx='596' cy='400' r='112' fill='#fff'/>" +
  "<path fill='#E30A17' d='M720 305L741.3 370.6L810.3 370.6L754.5 411.2L775.8 476.9" +
  "L720 436.3L664.2 476.9L685.5 411.2L629.7 370.6L698.7 370.6Z'/>" +
  '</svg>'
const TRNC_SRC = `data:image/svg+xml,${encodeURIComponent(TRNC_SVG)}`

// SVG bayraklar (emoji bayraklar Windows'ta render olmadigindan). 5 dil.
export function Flag({ code, size = 20 }: { code: string; size?: number }) {
  const h = Math.round((size * 5) / 7)
  const common = {
    width: size,
    height: h,
    viewBox: '0 0 21 15',
    className: 'flag',
    role: 'img' as const,
    'aria-hidden': true,
  }
  const star =
    'M12 2l2.9 6.3 6.9.6-5.2 4.5 1.6 6.8L12 17l-6.2 3.8 1.6-6.8L2.2 9.5l6.9-.6z'
  switch (code) {
    case 'tr':
      return (
        <svg {...common}>
          <rect width="21" height="15" fill="#E30A17" />
          <circle cx="8.3" cy="7.5" r="3.6" fill="#fff" />
          <circle cx="9.5" cy="7.5" r="2.9" fill="#E30A17" />
          <path transform="translate(11,5.4) scale(0.175)" d={star} fill="#fff" />
        </svg>
      )
    case 'en':
      return (
        <svg {...common}>
          <rect width="21" height="15" fill="#012169" />
          <path d="M0,0 21,15 M21,0 0,15" stroke="#fff" strokeWidth="3" />
          <path d="M0,0 21,15 M21,0 0,15" stroke="#C8102E" strokeWidth="1.4" />
          <rect x="8.4" width="4.2" height="15" fill="#fff" />
          <rect y="5.4" width="21" height="4.2" fill="#fff" />
          <rect x="9.4" width="2.2" height="15" fill="#C8102E" />
          <rect y="6.4" width="21" height="2.2" fill="#C8102E" />
        </svg>
      )
    case 'es':
      return (
        <svg {...common}>
          <rect width="21" height="15" fill="#AA151B" />
          <rect y="3.75" width="21" height="7.5" fill="#F1BF00" />
        </svg>
      )
    case 'de':
      return (
        <svg {...common}>
          <rect width="21" height="5" fill="#000" />
          <rect y="5" width="21" height="5" fill="#DD0000" />
          <rect y="10" width="21" height="5" fill="#FFCE00" />
        </svg>
      )
    case 'fr':
      return (
        <svg {...common}>
          <rect width="7" height="15" fill="#0055A4" />
          <rect x="7" width="7" height="15" fill="#fff" />
          <rect x="14" width="7" height="15" fill="#EF4135" />
        </svg>
      )
    default:
      return null
  }
}

// Ulke bayragi (200+ ulke): ISO 3166-1 alpha-2 kodundan flagcdn SVG'si (or. 'TR' -> tr.svg).
// Yukaridaki 5-dil Flag'inin aksine tum ulkeleri kapsar. Emoji bayrak Windows'ta
// gorunmedigi icin gorsel. rounded=true: yuvarlak kirpilmis (mini-avatar rozeti).
// rounded=false: dogal en-boy oranli normal bayrak (yukseklik=size, genislik otomatik).
// Kod yok/gecersizse hicbir sey render etmez (graceful).
export function CountryFlag({
  code,
  size = 16,
  className = '',
  title,
  rounded = true,
}: {
  code?: string | null
  size?: number
  className?: string
  title?: string
  rounded?: boolean
}) {
  // Kayitli deger kod ('TR') veya eski isim ('Türkiye') olabilir -> koda normalize et.
  const norm = normalizeCountry(code).trim()
  const isTrnc = norm.toUpperCase() === TRNC_CODE
  const c = norm.toLowerCase()
  if (!isTrnc && c.length !== 2) return null
  const label = title ?? (isTrnc ? 'KKTC' : c.toUpperCase())
  const src = isTrnc ? TRNC_SRC : `https://flagcdn.com/${c}.svg`
  const style: CSSProperties = rounded
    ? {
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'block',
        flex: '0 0 auto',
      }
    : {
        height: size,
        width: 'auto',
        borderRadius: 2,
        display: 'block',
        flex: '0 0 auto',
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.12)',
      }
  return (
    <img
      src={src}
      alt={label}
      title={label}
      height={size}
      loading="lazy"
      draggable={false}
      className={className}
      style={style}
    />
  )
}
