import { useEffect, useState } from 'react'
import { listAdSlots, type AdSlot, type AdSlotPos } from '../api'
import './adStrip.css'

// Gorsel yolu: tam URL / mutlak yol ise oldugu gibi; ciplak yol ise panelden yuklenmis -> /uploads/
function srcOf(img: string): string {
  return /^(https?:|\/)/.test(img) ? img : '/uploads/' + img
}

// Tum reklamlar TEK sefer cekilir (3 slot ayni listeyi paylasir; modul-duzeyi promise cache).
let adsCache: Promise<AdSlot[]> | null = null
function loadAds(): Promise<AdSlot[]> {
  if (!adsCache) adsCache = listAdSlots().catch(() => [])
  return adsCache
}

/**
 * Ana sayfada paneller arasindaki yatay reklam seridi. Verilen slota (top/middle/bottom)
 * atanmis ILK yayindaki reklami gosterir; yoksa hicbir sey render etmez (bos yer birakmaz).
 * Masaustu + opsiyonel mobil gorsel <picture> ile; link varsa yeni sekmede acilir.
 */
export function AdStrip({ slot }: { slot: AdSlotPos }) {
  const [ads, setAds] = useState<AdSlot[] | null>(null)
  useEffect(() => {
    let alive = true
    loadAds().then((a) => alive && setAds(a))
    return () => {
      alive = false
    }
  }, [])

  const ad = ads?.find((a) => a.slot === slot && a.image)
  if (!ad) return null

  const img = (
    <picture>
      {ad.image_mobile && <source media="(max-width: 720px)" srcSet={srcOf(ad.image_mobile)} />}
      <img className="ad-img" src={srcOf(ad.image)} alt="" loading="lazy" />
    </picture>
  )

  return (
    <div className={`ad-strip ad-strip-${slot}`}>
      {ad.link ? (
        <a href={ad.link} target="_blank" rel="noopener noreferrer sponsored" aria-label="Reklam">
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  )
}
