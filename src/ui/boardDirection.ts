import { useEffect, useState } from 'react'

// OYUN YONU: pullarin toplandigi (ev tahtasinin bulundugu) taraf.
//  'right' = varsayilan, ev tahtasi SAGDA (saga topla)
//  'left'  = tahta yatay AYNALANIR, ev tahtasi SOLDA (sola topla)
// Tek ayar TUM ekranlarda gecerli: tek oyun, yapay zeka maci, mac oyunu (online) ve
// pozisyon analizi. Kalicidir (localStorage) ve degisiklik ayni sekmedeki tum
// bilesenlere custom event ile, diger sekmelere 'storage' ile yayilir.
export type BoardDir = 'right' | 'left'

const KEY = 'tavla.boarddir'
const EVT = 'tavla-boarddir'

export function readBoardDir(): BoardDir {
  try {
    return localStorage.getItem(KEY) === 'left' ? 'left' : 'right'
  } catch {
    return 'right'
  }
}

export function writeBoardDir(dir: BoardDir) {
  try {
    localStorage.setItem(KEY, dir)
  } catch {
    /* kota/private-mode: yoksay */
  }
  window.dispatchEvent(new CustomEvent(EVT))
}

/** [yon, ayarla] — degeri kullanan her bilesen ayni anda guncellenir. */
export function useBoardDir(): [BoardDir, (d: BoardDir) => void] {
  const [dir, setDir] = useState<BoardDir>(readBoardDir)
  useEffect(() => {
    const sync = () => setDir(readBoardDir())
    window.addEventListener(EVT, sync)
    window.addEventListener('storage', sync) // baska sekmede degistiyse
    return () => {
      window.removeEventListener(EVT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])
  return [dir, writeBoardDir]
}
