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

// Gercek zar kubu (yalniz 3D tahta). ON YUZ HER ZAMAN `value` -> container'i buyuk acida (±90)
// dondurmeye gerek YOK (o yontem kubu kenar-ustu getirip perspektifle dilime cokuyordu). Kup hafif
// SABIT egimde durur (CSS --bx/--by) -> on + ust/yan yuzun dilimi gorunur. Diger 5 yuz gecerli zar
// duzeni (karsi yuzler toplam 7) -> takla sirasinda doner, dinlenmede yalniz dilim. 2D'de HIC render
// edilmez (cube=false -> duz Die). Siralama: on, arka, ust, sag, alt, sol (CSS df-* ile eslesir).
function cubeFaces(value: number): { cls: string; v: number }[] {
  const back = 7 - value
  const rest = [1, 2, 3, 4, 5, 6].filter((v) => v !== value && v !== back) // 4 deger
  return [
    { cls: 'df-front', v: value },
    { cls: 'df-back', v: back },
    { cls: 'df-top', v: rest[0] },
    { cls: 'df-right', v: rest[1] },
    { cls: 'df-bottom', v: rest[2] },
    { cls: 'df-left', v: rest[3] },
  ]
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
    return (
      <div className={`die3d ${owner} ${used ? 'used' : ''} ${half ? 'die-half' : ''} ${className}`}>
        {cubeFaces(value).map((f) => (
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
