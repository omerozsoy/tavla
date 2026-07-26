import type { Player } from '../engine/types'

// Zar yuzu - pip (nokta) konumlari yuzde olarak (mutlak konumlandirma -> garanti render)
const PIP_POS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[30, 30], [70, 70]],
  3: [[30, 30], [50, 50], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
  5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
  6: [[30, 28], [70, 28], [30, 50], [70, 50], [30, 72], [70, 72]],
}

export interface DieFace {
  value: number
  used: boolean // oynanmis zar -> soluk
}

export function Die({ value, owner, used }: { value: number; owner: Player; used: boolean }) {
  const pos = PIP_POS[value] ?? []
  return (
    <div className={`die-face ${owner} ${used ? 'used' : ''}`}>
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
}: {
  faces: DieFace[]
  owner: Player
  swappable?: boolean
  onSwap?: () => void
}) {
  if (faces.length === 0) return null
  return (
    <div
      className={`board-dice ${swappable ? 'swappable' : ''}`}
      onClick={swappable ? onSwap : undefined}
      title={swappable ? 'Sırayı değiştir' : undefined}
    >
      {faces.map((f, i) => (
        <Die key={i} value={f.value} owner={owner} used={f.used} />
      ))}
    </div>
  )
}
