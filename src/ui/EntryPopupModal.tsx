import { useEffect, useState } from 'react'
import { getEntryPopup, type EntryPopup } from '../api'
import { useEscape } from './useEscape'
import './entryPopup.css'

// Gorsel yolu: tam URL / mutlak yol ise oldugu gibi; ciplak yol ise panelden yuklenmis -> /uploads/
function srcOf(img: string): string {
  return /^(https?:|\/)/.test(img) ? img : '/uploads/' + img
}

const SEEN_KEY = 'tavla.entryPopupSeen' // "<id>:<v>" -> en son gosterilen banner surumu
const DAY_KEY = 'tavla.entryPopupDay' // "<id>:<v>:<YYYY-MM-DD>" -> gunde-bir icin son gun

function get(k: string): string | null {
  try {
    return localStorage.getItem(k) ?? sessionStorage.getItem(k)
  } catch {
    return null
  }
}

// Bu banner (id+surum) bu ziyaretciye simdi gosterilsin mi? frequency'e gore localStorage gate.
function shouldShow(p: EntryPopup, loggedIn: boolean): boolean {
  // Hedef kitle: misafir / uye / herkes.
  if (p.audience === 'guest' && loggedIn) return false
  if (p.audience === 'member' && !loggedIn) return false

  const key = `${p.id}:${p.v}`
  if (p.frequency === 'always') return true
  if (p.frequency === 'session') {
    try {
      return sessionStorage.getItem(SEEN_KEY) !== key
    } catch {
      return true
    }
  }
  // daily: bugun bu surum gosterildiyse tekrar gosterme.
  const today = new Date().toISOString().slice(0, 10)
  return get(DAY_KEY) !== `${key}:${today}`
}

// Gosterildi diye isaretle (frequency'e gore dogru depoya yaz).
function markSeen(p: EntryPopup): void {
  const key = `${p.id}:${p.v}`
  try {
    if (p.frequency === 'session') {
      sessionStorage.setItem(SEEN_KEY, key)
    } else if (p.frequency === 'daily') {
      const today = new Date().toISOString().slice(0, 10)
      localStorage.setItem(DAY_KEY, `${key}:${today}`)
    }
  } catch {
    /* localStorage yoksa yok say */
  }
}

/**
 * Siteye ilk girildiginde ekran ortasinda gosterilen KARE reklam pop-up'i ("Giris Kare Banner").
 * Panelden yonetilir (EntryPopupResource). Gosterim sikligi + hedef kitle admin secimine bagli;
 * frontend localStorage/sessionStorage ile gate'ler. Gorseli/link'i yoksa hicbir sey render etmez.
 */
export function EntryPopupModal({ loggedIn }: { loggedIn: boolean }) {
  const [popup, setPopup] = useState<EntryPopup | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    getEntryPopup()
      .then((p) => {
        if (!alive || !p || !p.image) return
        if (shouldShow(p, loggedIn)) {
          setPopup(p)
          setOpen(true)
          markSeen(p) // gosterildigi an isaretle (kapatmaya bagli degil)
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // loggedIn ilk deger ile gate'lenir; sonradan giris yaparsa yeniden acmayiz (spam olmasin).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => setOpen(false)
  useEscape(open ? close : undefined)

  if (!open || !popup) return null

  const img = (
    <picture>
      {popup.image_mobile && <source media="(max-width: 560px)" srcSet={srcOf(popup.image_mobile)} />}
      <img className="entry-popup-img" src={srcOf(popup.image)} alt="" />
    </picture>
  )

  return (
    <div className="entry-popup-overlay" onClick={close} role="dialog" aria-modal="true" aria-label="Duyuru">
      <div className="entry-popup-card" onClick={(e) => e.stopPropagation()}>
        <button className="entry-popup-close" onClick={close} aria-label="Kapat" type="button">
          ×
        </button>
        {popup.link ? (
          <a href={popup.link} target="_blank" rel="noopener noreferrer sponsored" onClick={close}>
            {img}
          </a>
        ) : (
          img
        )}
      </div>
    </div>
  )
}
