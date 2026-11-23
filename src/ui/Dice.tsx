import type { CSSProperties } from 'react'
import type { Player } from '../engine/types'
import { useT } from '../i18n'

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

function Pips({ value }: { value: number }) {
  return (
    <>
      {(PIP_POS[value] ?? []).map(([x, y], i) => (
        <span key={i} className="pip-dot" style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
    </>
  )
}

// Gercek zar kubu (yalniz 3D tahta). Yuzler SABIT (karsi yuzler toplam 7): on=1 arka=6, sag=2 sol=5,
// ust=3 alt=4. `value` yalniz KUBU dondurur (--rx/--ry) -> istenen yuz one gelir. CSS die3d-throw
// container'i takla attirip bu duruia oturtur. 2D'de bu yol HIC calismaz (cube=false -> duz Die).
const CUBE_FACES: { cls: string; v: number }[] = [
  { cls: 'df-front', v: 1 },
  { cls: 'df-back', v: 6 },
  { cls: 'df-right', v: 2 },
  { cls: 'df-left', v: 5 },
  { cls: 'df-top', v: 3 },
  { cls: 'df-bottom', v: 4 },
]
// Deger -> kubu hangi [rotateX, rotateY] ile cevirince o yuz one bakar (face sabit acisini iptal eder).
const CUBE_REST: Record<number, [number, number]> = {
  1: [0, 0],
  6: [0, 180],
  2: [0, -90],
  5: [0, 90],
  3: [-90, 0],
  4: [90, 0],
}

export function Die({
  value,
  owner,
  used,
  half = false,
  className = '',
  cube = false,
}: {
  value: number
  owner: Player
  used: boolean
  half?: boolean
  className?: string
  cube?: boolean
}) {
  if (cube) {
    const [rx, ry] = CUBE_REST[value] ?? [0, 0]
    const style = { '--rx': `${rx}deg`, '--ry': `${ry}deg` } as CSSProperties
    return (
      <div
        className={`die3d ${owner} ${used ? 'used' : ''} ${half ? 'die-half' : ''} ${className}`}
        style={style}
      >
        {CUBE_FACES.map((f) => (
          <div key={f.cls} className={`die-face ${owner} ${f.cls}`}>
            <Pips value={f.v} />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className={`die-face ${owner} ${used ? 'used' : ''} ${half ? 'die-half' : ''} ${className}`}>
      <Pips value={value} />
    </div>
  )
}

export default function DiceRow({
  faces,
  owner,
  swappable,
  onSwap,
  className = '',
  cube = false,
}: {
  faces: DieFace[]
  owner: Player
  swappable?: boolean
  onSwap?: () => void
  className?: string
  cube?: boolean
}) {
  const { t } = useT()
  if (faces.length === 0) return null
  return (
    <div
      className={`board-dice ${swappable ? 'swappable' : ''} ${className}`}
      onClick={swappable ? onSwap : undefined}
      title={swappable ? t('dice.swap') : undefined}
      // Dokunmatikte title (hover ipucu) gorunmez: dugme rolu + etiket + gorunur ⇄ rozeti (CSS).
      role={swappable ? 'button' : undefined}
      tabIndex={swappable ? 0 : undefined}
      aria-label={swappable ? t('dice.swap') : undefined}
      onKeyDown={swappable ? (e) => (e.key === 'Enter' || e.key === ' ') && onSwap?.() : undefined}
    >
      {faces.map((f, i) => (
        // key'e deger dahil -> yeni atista yeniden mount olur, donme animasyonu oynar
        <Die key={`${i}-${f.value}`} value={f.value} owner={owner} used={f.used} half={f.half} cube={cube} />
      ))}
    </div>
  )
}
