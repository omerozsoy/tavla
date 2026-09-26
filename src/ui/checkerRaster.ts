// CHECKER RASTER ÖNBELLEĞİ — performans katmanı. buildCheckerSvg'nin ürettiği prosedürel SVG
// pahalı feTurbulence/feColorMatrix/feGaussianBlur filtreleri içerir; canlı inline SVG olarak
// çizilince tahtadaki ~30 pulun her biri BENZERSİZ filtre zinciri raster'lar (pearl/marble/metallic
// ağır takılır). Oysa bir tahtada bir tarafın tüm pulları AYNI aile+renk: malzemeyi (aile+renk)
// başına BİR KEZ bitmap'e raster'layıp önbelleğe alır, tüm pullara aynı hazır görseli veririz.
// Böylece filtre 30 yerine ~2 kez (koyu+açık) hesaplanır; hareket/animasyon saf GPU kompozisyonu =
// varsayılan CSS pul kadar akıcı. Görsel neredeyse aynı (pul-başına damar varyasyonu bırakılır).
//
// Motor/board/hareket koduna DOKUNMAZ — yalnız render katmanı.

import { buildCheckerSvg } from './checkerSvg'
import type { CheckerFamily } from '../checkers'

const RASTER = 256 // px — retina-dostu raster çözünürlüğü (CSS ile küçültülür)
const FIXED_SEED = 7 // (aile+renk) başına deterministik tek doku — pul-başına benzersizlik yok

const svgCache = new Map<string, string>() // key -> svg data-uri (senkron, anında)
const pngCache = new Map<string, string>() // key -> png data-uri (async, raster sonrası)
const pending = new Map<string, Promise<string>>()

function key(family: CheckerFamily, color: string): string {
  return family + '|' + color.toLowerCase()
}

// Anında kullanılabilir SVG data-uri (aynı aile+renk → aynı string → tarayıcı bir kez çözer).
export function checkerSvgUri(family: CheckerFamily, color: string): string {
  const k = key(family, color)
  let u = svgCache.get(k)
  if (!u) {
    const svg = buildCheckerSvg({ family, color, id: 'ck', seed: FIXED_SEED })
    u = 'data:image/svg+xml,' + encodeURIComponent(svg)
    svgCache.set(k, u)
  }
  return u
}

// Hazırsa raster PNG data-uri, yoksa null (çağıran SVG'ye düşer + rasterizeChecker tetikler).
export function checkerPngUri(family: CheckerFamily, color: string): string | null {
  return pngCache.get(key(family, color)) ?? null
}

// SVG'yi offscreen canvas'a çizip PNG data-uri'ye çevirir; (aile+renk) başına bir kez. Başarısızsa
// SVG data-uri'ye düşer (yine paylaşılan tek görsel — canlı inline SVG'den çok daha ucuz).
export function rasterizeChecker(family: CheckerFamily, color: string): Promise<string> {
  const k = key(family, color)
  const hit = pngCache.get(k)
  if (hit) return Promise.resolve(hit)
  const inflight = pending.get(k)
  if (inflight) return inflight

  const p = new Promise<string>((resolve) => {
    const svgUri = checkerSvgUri(family, color)
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      resolve(svgUri)
      return
    }
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = RASTER
        canvas.height = RASTER
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          pending.delete(k)
          resolve(svgUri)
          return
        }
        ctx.drawImage(img, 0, 0, RASTER, RASTER)
        const png = canvas.toDataURL('image/png')
        pngCache.set(k, png)
        pending.delete(k)
        resolve(png)
      } catch {
        // canvas taint/toDataURL hatası — SVG data-uri'ye düş (same-origin data-uri olduğundan
        // pratikte taint olmaz; yine de emniyet).
        pending.delete(k)
        resolve(svgUri)
      }
    }
    img.onerror = () => {
      pending.delete(k)
      resolve(svgUri)
    }
    img.src = svgUri
  })
  pending.set(k, p)
  return p
}
