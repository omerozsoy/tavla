import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { listAdSlots, type AdSlot, type AdSlotPos } from '../api'
import './adStrip.css'
import { safeHref } from './safeHref'
import { Button } from '@/components/ui/button'

// Bu ID'li reklam link'e GİTMEZ; tıklanınca "stok tükendi" şaka modali açılır (bkz aşağı).
const PRANK_AD_ID = 1

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
  const [prank, setPrank] = useState(false)
  useEffect(() => {
    let alive = true
    loadAds().then((a) => alive && setAds(a))
    return () => {
      alive = false
    }
  }, [])

  // CLS: fetch bitene kadar ust (above-fold) slot yer ayirir (tum reklamlar SABIT boyut:
  // masaustu 1120x180, mobil 720x300 -> aspect biliniyor; iskelet birebir ayni yeri tutar,
  // reklam gelince KAYMAZ). Alt slotlar below-fold -> null (bos-slot bosluk riski yok).
  if (ads === null) {
    return slot === 'top' ? <div className="ad-strip ad-strip-top ad-skeleton" aria-hidden="true" /> : null
  }
  const ad = ads.find((a) => a.slot === slot && a.image)
  if (!ad) return null

  // Dis URL (http(s):// veya protokol-siz //) YENI sekmede; site-ici yol (/... ) AYNI pencerede
  // acilir (BannerSlider ile ayni konvansiyon). Boylece dahili reklam linki kullaniciyi siteden
  // koparmaz. rel="sponsored" her iki durumda kalir (reklam isareti); noopener/noreferrer yalniz
  // yeni sekmede anlamli.
  const isExternal = ad.link ? /^(https?:)?\/\//i.test(ad.link.trim()) : false

  // CLS: gorsel boyutlari SABIT (masaustu 1120x180, mobil 720x300). width/height ver ->
  // tarayici bytes inmeden dogru yuksekligi rezerve eder, gec yuklenen reklam alttaki
  // panelleri ITMEZ. (width:100%/height:auto CSS oranı korur; distortion yok.)
  const img = (
    <picture>
      {ad.image_mobile && (
        <source media="(max-width: 720px)" srcSet={srcOf(ad.image_mobile)} width={720} height={300} />
      )}
      <img className="ad-img" src={srcOf(ad.image)} alt="" width={1120} height={180} loading="lazy" />
    </picture>
  )

  // Şaka reklamı: link'e gitmez; tıklanınca "stok tükendi" modali açılır.
  if (ad.id === PRANK_AD_ID) {
    return (
      <div className={`ad-strip ad-strip-${slot}`}>
        <button type="button" className="ad-prank-trigger" onClick={() => setPrank(true)} aria-label="Reklam">
          {img}
        </button>
        {prank &&
          createPortal(
            <div className="register-overlay modal confirm-overlay" role="dialog" aria-modal="true" onClick={() => setPrank(false)}>
              <div className="register-card resign-card" onClick={(e) => e.stopPropagation()}>
                <h2>Stok tükendi.</h2>
                <p className="register-sub">Rakibiniz son paketi az önce satın aldı.</p>
                <Button onClick={() => setPrank(false)}>Biliyordum onda bir şey olduğunu!</Button>
              </div>
            </div>,
            document.body,
          )}
      </div>
    )
  }

  return (
    <div className={`ad-strip ad-strip-${slot}`}>
      {ad.link ? (
        <a
          href={safeHref(ad.link)}
          {...(isExternal
            ? { target: '_blank', rel: 'noopener noreferrer sponsored' }
            : { rel: 'sponsored' })}
          aria-label="Reklam"
        >
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  )
}
