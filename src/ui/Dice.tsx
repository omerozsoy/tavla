import { useState } from 'react'
import type { Player } from '../engine/types'
import { useT } from '../i18n'

const SWAP_HINT_KEY = 'tavla.diceSwapHintSeen'

// Zar yuzu - pip (nokta) konumlari yuzde olarak (mutlak konumlandirma -> garanti render)
export const PIP_POS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 28], [70, 28], [30, 50], [70, 50], [30, 72], [70, 72]],
}

export interface DieFace {
  value: number
  used: boolean // oynanmis zar -> tam soluk
  // Cift zar: her zar 2 hamle. Bir hamle oynaninca zarin CAPRAZ yarisi solar (half=true),
  // ikinci hamlede zar tamamen solar (used=true). Boylece 4 hamle = 4 adim seffaflasma.
  half?: boolean
}

export function Die({
  value,
  owner,
  used,
  half = false,
  className = '',
}: {
  value: number
  owner: Player
  used: boolean
  half?: boolean
  className?: string
}) {
  const pos = PIP_POS[value] ?? []
  return (
    <div className={`die-face ${owner} ${used ? 'used' : ''} ${half ? 'die-half' : ''} ${className}`}>
      {pos.map(([x, y], i) => (
        <span key={i} className="pip-dot" style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
    </div>
  )
}

export default function DiceRow({
  faces,
  owner,
  swappable,
  onSwap,
  className = '',
}: {
  faces: DieFace[]
  owner: Player
  swappable?: boolean
  onSwap?: () => void
  className?: string
}) {
  const { t } = useT()
  // Tek-seferlik ipucu: swap'i ilk kez kullanana dek goster (kullanici "swap'i kesfedemiyorum").
  const [hintSeen, setHintSeen] = useState(() => {
    try {
      return localStorage.getItem(SWAP_HINT_KEY) === '1'
    } catch {
      return true // storage yoksa ipucuyla rahatsiz etme
    }
  })
  const handleSwap = () => {
    if (!hintSeen) {
      try {
        localStorage.setItem(SWAP_HINT_KEY, '1')
      } catch {
        /* yoksay */
      }
      setHintSeen(true)
    }
    onSwap?.()
  }
  if (faces.length === 0) return null
  const row = (
    <div
      className={`board-dice ${swappable ? 'swappable' : ''} ${className}`}
      onClick={swappable ? handleSwap : undefined}
      title={swappable ? t('dice.swap') : undefined}
      // Dokunmatikte title (hover ipucu) gorunmez: dugme rolu + etiket + gorunur ⇄ rozeti (CSS).
      role={swappable ? 'button' : undefined}
      tabIndex={swappable ? 0 : undefined}
      aria-label={swappable ? t('dice.swap') : undefined}
      onKeyDown={swappable ? (e) => (e.key === 'Enter' || e.key === ' ') && handleSwap() : undefined}
    >
      {faces.map((f, i) => (
        // key'e deger dahil -> yeni atista yeniden mount olur, donme animasyonu oynar
        <Die key={`${i}-${f.value}`} value={f.value} owner={owner} used={f.used} half={f.half} />
      ))}
    </div>
  )
  // Ipucu YOKSA DOM onceki haliyle AYNI (diger tum DiceRow cagrilari etkilenmez).
  if (!swappable || hintSeen) return row
  return (
    <div className="board-dice-wrap">
      {row}
      <div className="dice-swap-hint">{t('dice.swapHint')}</div>
    </div>
  )
}
