import { useEffect, useState } from 'react'

// PUL RENKLERI: oyuncu kendi pullarini beyaz (varsayilan) ya da siyah gorebilir.
//  false = normal (oyuncu = beyaz/acik pul)
//  true  = takas (oyuncu = siyah/koyu pul) — SADECE gorsel, motor/mantik etkilenmez.
// boardDirection ile ayni desen: kalicidir (localStorage), ayni sekmedeki tum bilesenlere
// custom event ile, diger sekmelere 'storage' ile yayilir (profil <-> oyun senkron).
const KEY = 'tavla.swapstones'
const EVT = 'tavla-swapstones'

export function readSwapStones(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function writeSwapStones(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? '1' : '0')
  } catch {
    /* kota/private-mode: yoksay */
  }
  window.dispatchEvent(new CustomEvent(EVT))
}

/** [takas, ayarla] — degeri kullanan her bilesen ayni anda guncellenir. */
export function useSwapStones(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState<boolean>(readSwapStones)
  useEffect(() => {
    const sync = () => setOn(readSwapStones())
    window.addEventListener(EVT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return [on, writeSwapStones]
}
