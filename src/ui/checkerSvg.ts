// PROSEDÜREL CHECKER SVG ÜRETİCİSİ — tek gerçek kaynak. React bileşeni (CheckerSkin.tsx) ve
// doğrulama galerisi AYNI bu fonksiyonu kullanır. Aile başına gerçek fiziksel reçine/sedef/cam/
// metalik estetiği: parlak kubbe, üst-sol speküler, kenar bevel/rim, organik feTurbulence damar,
// hafif translucent. Motor/board koduna dokunmaz — yalnız görsel katman.
//
// Her çağrı BENZERSİZ id ön-eki alır (feTurbulence seed + filtre/gradient id çakışmasın; sayfada
// düzinelerce pul olabilir). seed varyasyonu -> her pulun damar deseni organik/benzersiz.

import type { CheckerFamily } from '../checkers'

// ---- küçük renk yardımcıları (hex) ----
function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')
}
// amt>0 -> beyaza doğru (lighten), amt<0 -> siyaha doğru (darken); -1..1
function shade(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  const t = amt < 0 ? 0 : 255
  const p = Math.abs(amt)
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p)
}

export interface CheckerSvgOpts {
  family: CheckerFamily
  color: string // bu tarafın (oyuncu/rakip) rengi
  id: string // benzersiz ön-ek (filtre/gradient/seed)
  seed?: number // damar varyasyonu (yoksa id'den türetilir)
}

function seedFrom(id: string, seed?: number): number {
  if (typeof seed === 'number') return seed
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return h % 90
}

// Aile-bağımsız ortak parçalar (kubbe/rim/gloss/speküler) + aileye özel FINISH katmanı.
export function buildCheckerSvg({ family, color, id, seed }: CheckerSvgOpts): string {
  const s = seedFrom(id, seed)
  const s2 = (s + 37) % 97
  // renk kademeleri
  const hi = shade(color, 0.42)
  const mid = shade(color, 0.06)
  const lo = shade(color, -0.4)
  const edge = shade(color, -0.6)
  const veinLite = shade(color, 0.62)
  const veinDark = shade(color, -0.5)

  const P = id // id ön-eki

  // ortak defs (kubbe + rim + gloss + speküler) — id ön-ekli
  const commonDefs = `
    <radialGradient id="${P}-dome" cx="42%" cy="35%" r="82%">
      <stop offset="0%" stop-color="${hi}"/>
      <stop offset="52%" stop-color="${mid}"/>
      <stop offset="100%" stop-color="${lo}"/>
    </radialGradient>
    <radialGradient id="${P}-rim" cx="50%" cy="50%" r="50%">
      <stop offset="80%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="90%" stop-color="${shade(color, 0.5)}" stop-opacity="0.45"/>
      <stop offset="97%" stop-color="${edge}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${shade(color, -0.75)}" stop-opacity="0.9"/>
    </radialGradient>
    <linearGradient id="${P}-sheen" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.38)"/>
      <stop offset="26%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <radialGradient id="${P}-spec" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.95)"/>
      <stop offset="42%" stop-color="rgba(255,255,255,0.2)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </radialGradient>
    <clipPath id="${P}-clip"><circle cx="60" cy="60" r="54"/></clipPath>`

  const shadow = `<circle cx="60" cy="63" r="54" fill="rgba(0,0,0,0.40)" style="filter:blur(3px)"/>`
  const base = `<circle cx="60" cy="60" r="54" fill="url(#${P}-dome)"/>`
  const rim = `<circle cx="60" cy="60" r="54" fill="url(#${P}-rim)"/>`
  const specular = `<ellipse cx="44" cy="38" rx="20" ry="12" fill="url(#${P}-spec)"/>`
  const edgeLine = `<circle cx="60" cy="60" r="53.4" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.7"/>`
  const topSheen = `<circle cx="60" cy="60" r="54" fill="url(#${P}-sheen)"/>`

  // --- aileye özel finish ---
  let defs = ''
  let finish = ''

  if (family === 'pearl' || family === 'metallic') {
    // sedef / metalik: geniş açık akış (screen) + koyu derinlik (multiply) + parıltı
    const bf1 = family === 'metallic' ? '0.008 0.06' : '0.012 0.045'
    const bf2 = family === 'metallic' ? '0.02 0.12' : '0.013 0.05'
    // Metalik: açık parıltı taban rengi GÜMÜŞE boğmasın — screen opaklığı düşük, açık damar
    // daha az beyaz (+0.42), koyu multiply daha güçlü -> yüksek kontrastlı METAL görünüm + tema
    // rengi net okunur. Pearl daha yumuşak/açık kalır.
    const liteOpacity = family === 'metallic' ? 0.58 : 0.78
    const sparkleOpacity = family === 'metallic' ? 0.42 : 0.45
    const metalDark = family === 'metallic' ? shade(color, -0.62) : veinDark
    const lc = hexToRgb(family === 'metallic' ? shade(color, 0.42) : veinLite).map((v) => (v / 255).toFixed(3))
    const dc = hexToRgb(metalDark).map((v) => (v / 255).toFixed(3))
    defs = `
      <filter id="${P}-fl" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="${bf1}" numOctaves="4" seed="${s}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 ${lc[0]}  0 0 0 0 ${lc[1]}  0 0 0 0 ${lc[2]}  1.5 0 0 0 -0.55"/>
        <feGaussianBlur stdDeviation="${family === 'metallic' ? 0.3 : 0.45}"/>
      </filter>
      <filter id="${P}-fd" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="${bf2}" numOctaves="4" seed="${s2}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 ${dc[0]}  0 0 0 0 ${dc[1]}  0 0 0 0 ${dc[2]}  1.4 0 0 0 -0.62"/>
        <feGaussianBlur stdDeviation="0.5"/>
      </filter>
      <filter id="${P}-fs" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="0.06 0.11" numOctaves="2" seed="${(s + 11) % 90}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1.7 0 0 0 -0.95"/>
        <feGaussianBlur stdDeviation="0.25"/>
      </filter>`
    const darkOpacity = family === 'metallic' ? 0.72 : 0.6
    finish = `
      <rect x="6" y="6" width="108" height="108" filter="url(#${P}-fd)" opacity="${darkOpacity}" style="mix-blend-mode:multiply"/>
      <rect x="6" y="6" width="108" height="108" filter="url(#${P}-fl)" opacity="${liteOpacity}" style="mix-blend-mode:screen"/>
      <rect x="6" y="6" width="108" height="108" filter="url(#${P}-fs)" opacity="${sparkleOpacity}" style="mix-blend-mode:screen"/>
      ${topSheen}`
  } else if (family === 'marble') {
    // mermer: KESKİN ince damar (yüksek freq, dik eşik, az blur) — açık damar screen + koyu damar multiply
    const lc = hexToRgb(veinLite).map((v) => (v / 255).toFixed(3))
    const dc = hexToRgb(shade(color, -0.62)).map((v) => (v / 255).toFixed(3))
    defs = `
      <filter id="${P}-ml" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03 0.075" numOctaves="5" seed="${s}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 ${lc[0]}  0 0 0 0 ${lc[1]}  0 0 0 0 ${lc[2]}  3.2 0 0 0 -1.7"/>
        <feGaussianBlur stdDeviation="0.18"/>
      </filter>
      <filter id="${P}-md" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035 0.08" numOctaves="5" seed="${s2}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 ${dc[0]}  0 0 0 0 ${dc[1]}  0 0 0 0 ${dc[2]}  3.0 0 0 0 -1.75"/>
        <feGaussianBlur stdDeviation="0.2"/>
      </filter>`
    finish = `
      <rect x="6" y="6" width="108" height="108" filter="url(#${P}-md)" opacity="0.7" style="mix-blend-mode:multiply"/>
      <rect x="6" y="6" width="108" height="108" filter="url(#${P}-ml)" opacity="0.85" style="mix-blend-mode:screen"/>
      ${topSheen}`
  } else if (family === 'crystal') {
    // kristal: cam kubbe altında düz renk; büyük parlak gloss + translucent açık rim + alt kostik
    defs = `
      <radialGradient id="${P}-glass" cx="40%" cy="30%" r="70%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.55)"/>
        <stop offset="35%" stop-color="rgba(255,255,255,0.08)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
      <radialGradient id="${P}-caustic" cx="60%" cy="78%" r="42%">
        <stop offset="0%" stop-color="${shade(color, 0.35)}" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>`
    // kristalde rim daha AÇIK/camsı: ayrı rim
    finish = `
      <circle cx="60" cy="60" r="54" fill="url(#${P}-caustic)" style="mix-blend-mode:screen"/>
      <circle cx="60" cy="60" r="54" fill="url(#${P}-glass)"/>
      ${topSheen}`
  } else {
    // resin (fingerdish): kalın RAISED RIM + iç recessed DISH (swirl) + iç gölge (derinlik)
    const dishR = 37
    const lc = hexToRgb(veinLite).map((v) => (v / 255).toFixed(3))
    defs = `
      <radialGradient id="${P}-ring" cx="42%" cy="35%" r="80%">
        <stop offset="0%" stop-color="${shade(color, 0.3)}"/>
        <stop offset="60%" stop-color="${shade(color, -0.05)}"/>
        <stop offset="100%" stop-color="${shade(color, -0.55)}"/>
      </radialGradient>
      <radialGradient id="${P}-dish" cx="45%" cy="40%" r="70%">
        <stop offset="0%" stop-color="${shade(color, 0.15)}"/>
        <stop offset="100%" stop-color="${shade(color, -0.35)}"/>
      </radialGradient>
      <radialGradient id="${P}-dishshadow" cx="50%" cy="50%" r="50%">
        <stop offset="70%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.5)"/>
      </radialGradient>
      <filter id="${P}-rl" x="-25%" y="-25%" width="150%" height="150%">
        <feTurbulence type="fractalNoise" baseFrequency="0.02 0.06" numOctaves="4" seed="${s}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 ${lc[0]}  0 0 0 0 ${lc[1]}  0 0 0 0 ${lc[2]}  1.6 0 0 0 -0.7"/>
        <feGaussianBlur stdDeviation="0.4"/>
      </filter>
      <clipPath id="${P}-dishclip"><circle cx="60" cy="60" r="${dishR}"/></clipPath>`
    // resin: base -> rim rengi; sonra iç dish
    finish = `
      <g clip-path="url(#${P}-dishclip)">
        <circle cx="60" cy="60" r="${dishR}" fill="url(#${P}-dish)"/>
        <rect x="20" y="20" width="80" height="80" filter="url(#${P}-rl)" opacity="0.7" style="mix-blend-mode:screen"/>
        <circle cx="60" cy="60" r="${dishR}" fill="url(#${P}-dishshadow)"/>
      </g>
      <circle cx="60" cy="60" r="${dishR}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="1.4"/>
      <circle cx="60" cy="60" r="${dishR + 1.5}" fill="none" stroke="${shade(color, 0.4)}" stroke-opacity="0.5" stroke-width="0.8"/>
      ${topSheen}`
    // resinde taban ring gradyanı kullanılır (dome yerine)
    return svgWrap(P, s, `
      ${shadow}
      <circle cx="60" cy="60" r="54" fill="url(#${P}-ring)"/>
      <g clip-path="url(#${P}-clip)">${finish}</g>
      ${rim}${specular}${edgeLine}`, defs + commonDefs)
  }

  return svgWrap(P, s, `
    ${shadow}
    ${base}
    <g clip-path="url(#${P}-clip)">${finish}</g>
    ${rim}${specular}${edgeLine}`, defs + commonDefs)
}

function svgWrap(_p: string, _s: number, body: string, defs: string): string {
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${body}</svg>`
}
