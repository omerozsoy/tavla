import type { GameState, Player, Step } from '../engine/types'

// Analiz icin kucuk board: pozisyonu ciz + hamleyi ok(lar) ile goster.
const W = 280
const H = 168
const OFF_W = 16
const BAR_W = 14
const USABLE_W = W - OFF_W
const HALF_W = (USABLE_W - BAR_W) / 2
const COL_W = HALF_W / 6
const TRI_H = 60
const TOP_Y = 20
const BOT_Y = H - 20

// Nokta index'i (0-23) -> {col 0-11, row}
const LAYOUT: Record<number, { col: number; row: 'top' | 'bottom' }> = {}
;[12, 13, 14, 15, 16, 17].forEach((i, k) => (LAYOUT[i] = { col: k, row: 'top' })) // 13-18
;[18, 19, 20, 21, 22, 23].forEach((i, k) => (LAYOUT[i] = { col: 6 + k, row: 'top' })) // 19-24
;[11, 10, 9, 8, 7, 6].forEach((i, k) => (LAYOUT[i] = { col: k, row: 'bottom' })) // 12-7
;[5, 4, 3, 2, 1, 0].forEach((i, k) => (LAYOUT[i] = { col: 6 + k, row: 'bottom' })) // 6-1

function colX(col: number): number {
  return col < 6 ? COL_W * (col + 0.5) : HALF_W + BAR_W + COL_W * (col - 6 + 0.5)
}

function anchor(p: number | 'bar' | 'off'): { x: number; y: number } {
  if (p === 'bar') return { x: HALF_W + BAR_W / 2, y: H / 2 }
  if (p === 'off') return { x: USABLE_W + OFF_W / 2, y: H / 2 }
  const l = LAYOUT[p]
  return { x: colX(l.col), y: l.row === 'top' ? TOP_Y : BOT_Y }
}

export default function MiniBoard({
  state,
  steps,
}: {
  state: GameState
  steps: Step[]
  player: Player
}) {
  // Ucgenler
  const tris = []
  for (let idx = 0; idx < 24; idx++) {
    const l = LAYOUT[idx]
    const cx = colX(l.col)
    // Gercek tahta gibi iki renk ucgen (tema uyumlu; onceki soluk beyaz gorunmuyordu)
    const shade = idx % 2 === 0 ? 'var(--tri-a)' : 'var(--tri-b)'
    if (l.row === 'top') {
      tris.push(
        <polygon
          key={idx}
          points={`${cx - COL_W / 2 + 1},0 ${cx + COL_W / 2 - 1},0 ${cx},${TRI_H}`}
          fill={shade}
          opacity="0.7"
        />,
      )
    } else {
      tris.push(
        <polygon
          key={idx}
          points={`${cx - COL_W / 2 + 1},${H} ${cx + COL_W / 2 - 1},${H} ${cx},${H - TRI_H}`}
          fill={shade}
          opacity="0.7"
        />,
      )
    }
  }

  // Pullar (nokta basina bir daire + sayi)
  const discs = []
  for (let idx = 0; idx < 24; idx++) {
    const v = state.points[idx]
    if (v === 0) continue
    const { x, y } = anchor(idx)
    const white = v > 0
    discs.push(
      <g key={`d${idx}`}>
        <circle cx={x} cy={y} r={8} fill={white ? 'var(--cream)' : 'var(--navy)'} stroke="#0006" />
        <text
          x={x}
          y={y + 3}
          fontSize="9"
          fontWeight="700"
          textAnchor="middle"
          fill={white ? 'var(--tv-ink)' : '#fff'}
        >
          {Math.abs(v)}
        </text>
      </g>,
    )
  }
  // Bar pullari
  if (state.bar.white > 0)
    discs.push(
      <circle key="bw" cx={HALF_W + BAR_W / 2} cy={H / 2 + 12} r={7} fill="var(--cream)" stroke="#0006" />,
    )
  if (state.bar.black > 0)
    discs.push(
      <circle key="bb" cx={HALF_W + BAR_W / 2} cy={H / 2 - 12} r={7} fill="var(--navy)" stroke="#0006" />,
    )

  // Oklar (hamle adimlari)
  const arrows = steps.map((st, i) => {
    const from = anchor(st.from)
    const to = anchor(st.to)
    return (
      <g key={`a${i}`}>
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke="#ffd54a"
          strokeWidth={2.5}
          markerEnd="url(#mbArrow)"
          opacity={0.95}
        />
        <circle cx={from.x} cy={from.y} r={7} fill="#ffd54a" />
        <text x={from.x} y={from.y + 3} fontSize="9" fontWeight="800" textAnchor="middle" fill="var(--tv-ink)">
          {i + 1}
        </text>
      </g>
    )
  })

  return (
    <svg className="mini-board" viewBox={`0 0 ${W} ${H}`} width="100%">
      <defs>
        <marker id="mbArrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <polygon points="0,0 7,3.5 0,7" fill="#ffd54a" />
        </marker>
      </defs>
      <rect x="0" y="0" width={W} height={H} rx="8" fill="var(--panel)" />
      {/* orta bar */}
      <rect x={HALF_W} y="0" width={BAR_W} height={H} fill="var(--bar)" />
      {/* bear-off */}
      <rect x={USABLE_W} y="0" width={OFF_W} height={H} fill="var(--bar)" />
      {tris}
      {discs}
      {arrows}
    </svg>
  )
}
