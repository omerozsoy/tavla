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

// Iran bayragi (orijinal): amblem + kufi "Allahu Ekber" yazisi. Elle basitlestirilemez,
// kullanicinin verdigi resmi SVG gomulu (data-URI) -> dis servise (flagcdn) bagimli degil.
const IRAN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="630" height="360">' +
  '<rect width="630" height="360" fill="#da0000"/>' +
  '<rect width="630" height="240" fill="#fff"/>' +
  '<rect width="630" height="120" fill="#239f40"/>' +
  '<g transform="translate(8.4,100.4)">' +
  '<g id="tb4"><g id="tb1" fill="none" stroke="#fff" stroke-width="2">' +
  '<path id="tbp1" d="M0,1H26M1,10V5H9V9H17V5H12M4,9H6M26,9H21V5H29M29,0V9H37V0M33,0V9" transform="scale(1.4)"/>' +
  '<path id="tbp2" d="M0,7H9M10,7H19" transform="scale(2.8)"/>' +
  '<use xlink:href="#tbp2" y="120"/><use xlink:href="#tbp1" y="145.2"/></g>' +
  '<g id="tb3"><use xlink:href="#tb1" x="56"/><use xlink:href="#tb1" x="112"/><use xlink:href="#tb1" x="168"/></g></g>' +
  '<use xlink:href="#tb3" x="168"/><use xlink:href="#tb4" x="392"/></g>' +
  '<g fill="#da0000" transform="matrix(45,0,0,45,315,180)"><g id="emblem_half">' +
  '<path d="M 1.015679,-0.01556 A 0.77528237,0.7752862 0 0 1 0.60199011,0.67052066 1.0040699,1.0040749 0 0 0 0.44435035,-0.74067818 q -0.0221518,-0.0177005 -0.0452767,-0.0341288 A 0.77575926,0.7757631 0 0 1 1.015679,-0.01556 Z"/>' +
  '<path d="m 0.65590144,-0.04683837 a 0.92689013,0.92689472 0 0 1 -1.21301321,0.88105983 q 0.0245198,0.00118 0.0492749,0.001178 a 1.0158759,1.0158809 0 0 0 0.84183925,-1.58419413 0.92423346,0.92423804 0 0 1 0.32189906,0.7019563 z"/>' +
  '<path d="M 0.26154437,-0.94393072 A 0.14154065,0.14154135 0 0 1 1.7299476e-6,-0.86887791 L -0.01707249,-0.88602911 1.7299476e-6,-0.96931462 A 0.1321491,0.13214975 0 0 0 0.24983482,-1.0002001 a 0.14021999,0.14022068 0 0 1 0.0117096,0.0562694 z"/>' +
  '<path d="M 0.11992727,-0.71445117 A 0.31475286,0.31475442 0 0 1 1.2855032e-6,-0.81025163 L -0.0506876,-0.01642556 1.2855032e-6,1.0001998 0.07882572,0.89166862 0.0891995,0.64144186 0.09996594,0.3809197 l 0.0014156,-0.0334002 4.7111e-4,-0.0124172 0.002279,-0.0541474 0.006758,-0.1640148 0.005501,-0.13242286 0.001571,-0.03827263 0.002042,-0.04872535 V -0.71445117 Z M 1.2855032e-6,-0.54965037 9.0174383e-5,-0.54949481 1.2855032e-6,-0.54933925 Z m 0,0.86447753 V 0.3145916 L 3.946188e-4,0.31468049 Z"/>' +
  '</g><use xlink:href="#emblem_half" transform="scale(-1,1)"/></g>' +
  '</svg>'
const IRAN_SRC = `data:image/svg+xml,${encodeURIComponent(IRAN_SVG)}`

// SVG bayraklar (emoji bayraklar Windows'ta render olmadigindan). 8 dil.
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
    case 'el': // Yunanistan: 9 mavi/beyaz serit + sol ust mavi kanton icinde beyaz hac
      return (
        <svg {...common}>
          <rect width="21" height="15" fill="#0D5EAF" />
          <rect y="1.667" width="21" height="1.667" fill="#fff" />
          <rect y="5" width="21" height="1.667" fill="#fff" />
          <rect y="8.333" width="21" height="1.667" fill="#fff" />
          <rect y="11.667" width="21" height="1.667" fill="#fff" />
          <rect width="8.333" height="8.333" fill="#0D5EAF" />
          <rect x="3.333" width="1.667" height="8.333" fill="#fff" />
          <rect y="3.333" width="8.333" height="1.667" fill="#fff" />
        </svg>
      )
    case 'ru': // Rusya: beyaz/mavi/kirmizi yatay serit
      return (
        <svg {...common}>
          <rect width="21" height="15" fill="#fff" />
          <rect y="5" width="21" height="5" fill="#0039A6" />
          <rect y="10" width="21" height="5" fill="#D52B1E" />
        </svg>
      )
    case 'fa': // Iran: orijinal bayrak (amblem + kufi yazi) -> gomulu SVG (elle cizilemez)
      return (
        <img
          src={IRAN_SRC}
          alt="Iran"
          width={size}
          height={h}
          loading="lazy"
          draggable={false}
          aria-hidden
          style={{ objectFit: 'cover', borderRadius: 1, display: 'block' }}
        />
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
