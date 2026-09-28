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


// Dil bayragi: dil kodu -> ulke (circle-flags). Ulke bayraklariyla AYNI daire gorunum.
const LANG_COUNTRY: Record<string, string> = {
  tr: 'TR',
  en: 'GB',
  es: 'ES',
  de: 'DE',
  fr: 'FR',
  el: 'GR',
  ru: 'RU',
  fa: 'IR',
}
export function Flag({ code, size = 20 }: { code: string; size?: number }) {
  const cc = LANG_COUNTRY[code]
  if (!cc) return null
  return <CountryFlag code={cc} size={size} title="" className="flag" />
}

// Ulke bayragi. Varsayilan: DAIRE icin cizilmis bayrak (circle-flags, MIT, public/flags/ altinda
// kendi sunucumuzdan) -> her ulke AYNI capta; dikdortgeni daireye kirpmadigimiz icin amblem
// kaymaz, Nepal gibi kare olmayan bayraklar kesilmez. shape="rect": dikdortgen (flagcdn) —
// yalniz tam bayrak gereken yerler (etkinlik afisi kurdelesi).
export function CountryFlag({
  code,
  size = 16,
  className = '',
  title,
  shape = 'circle',
}: {
  code?: string | null
  size?: number
  className?: string
  title?: string
  shape?: 'circle' | 'rect'
}) {
  // Kayitli deger kod ('TR') veya eski isim ('Türkiye') olabilir -> koda normalize et.
  const norm = normalizeCountry(code).trim()
  const isTrnc = norm.toUpperCase() === TRNC_CODE
  const c = norm.toLowerCase()
  if (!isTrnc && c.length !== 2) return null
  const label = title ?? (isTrnc ? 'KKTC' : c.toUpperCase())
  const circle = shape === 'circle'
  // KKTC circle-flags'te yok -> gomulu dikdortgen SVG, daireye kirpilir (objectFit cover).
  const src = isTrnc ? TRNC_SRC : circle ? `/flags/${c}.svg` : `https://flagcdn.com/${c}.svg`
  const style: CSSProperties = circle
    ? {
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'block',
        flex: '0 0 auto',
        // Ince halka: beyaz agirlikli bayraklar (Japonya vb.) acik zeminde kaybolmasin.
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.12)',
      }
    : {
        height: size,
        width: 'auto',
        display: 'block',
        flex: '0 0 auto',
      }
  return (
    <img
      src={src}
      alt={label}
      title={label}
      width={circle ? size : undefined}
      height={size}
      loading="lazy"
      draggable={false}
      className={className}
      style={style}
    />
  )
}
