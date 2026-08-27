import type { GameState, Player, Step } from '../engine/types'
import { PIP_POS } from './Dice'

// Analiz icin kucuk board: pozisyonu ciz + hamleyi ok(lar) ile goster.
// Olculer gercek tavla oranina gore turetilir; taslar sutun genisligine bagli
// (COL_W * 0.86) ve ust uste binmeden istiflenir (STEP >= cap).
const W = 300
const H = 210
const OFF_W = 18
const BAR_W = 16
const USABLE_W = W - OFF_W
const HALF_W = (USABLE_W - BAR_W) / 2
const COL_W = HALF_W / 6
const R = COL_W * 0.43 // tas yaricapi (cap ~= sutunun %86'si)
const STEP = R * 1.95 // istif adimi (ust uste binme yok)
const TRI_H = COL_W * 3.4 // kisa+genis ucgen
const TOP_Y = R + 3 // taslar board kenarina daha yakin otursun (havada durmasin)
const BOT_Y = H - (R + 3)

// Ok renkleri: parlak cekirdek + koyu casing (kenarlik). Casing sayesinde
// ok HANGI tema/board olursa olsun (sicak kiremit ya da koyu galaxy) gorunur;
// sari taslarin uzerinde bile koyu kenar ayirt ettirir.
const ARROW = '#f0a500' // onceki #ffd54a'dan daha koyu/doygun altin
const ARROW_EDGE = '#2a1206' // koyu casing/kontur

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
  player,
  dice,
}: {
  state: GameState
  steps: Step[]
  player: Player
  dice?: number[]
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

  // Pullar: normal tavla gibi ISTIFLENMIS diskler (nokta basina tek daire+sayi DEGIL).
  // 5'ten fazla tasta ust diske toplam sayi yazilir (kompakt board icin).
  const MAX = 5
  const discs = []
  for (let idx = 0; idx < 24; idx++) {
    const v = state.points[idx]
    if (v === 0) continue
    const n = Math.abs(v)
    const white = v > 0
    const l = LAYOUT[idx]
    const x = colX(l.col)
    const baseY = l.row === 'top' ? TOP_Y : BOT_Y
    const dir = l.row === 'top' ? 1 : -1
    const show = Math.min(n, MAX)
    for (let k = 0; k < show; k++) {
      const cy = baseY + dir * k * STEP
      const overflow = k === show - 1 && n > MAX
      discs.push(
        <g key={`d${idx}-${k}`}>
          <circle cx={x} cy={cy} r={R} fill={white ? 'var(--cream)' : 'var(--navy)'} stroke="#0007" strokeWidth={1} />
          {overflow && (
            <text
              x={x}
              y={cy + R * 0.35}
              fontSize={R * 1.1}
              fontWeight="700"
              textAnchor="middle"
              fill={white ? 'var(--tv-ink)' : '#fff'}
            >
              {n}
            </text>
          )}
        </g>,
      )
    }
  }
  // Bar pullari
  if (state.bar.white > 0)
    discs.push(
      <circle key="bw" cx={HALF_W + BAR_W / 2} cy={H / 2 + R + 3} r={R * 0.9} fill="var(--cream)" stroke="#0007" />,
    )
  if (state.bar.black > 0)
    discs.push(
      <circle key="bb" cx={HALF_W + BAR_W / 2} cy={H / 2 - (R + 3)} r={R * 0.9} fill="var(--navy)" stroke="#0007" />,
    )

  // Oklar (hamle adimlari)
  const arrows = steps.map((st, i) => {
    const from = anchor(st.from)
    const to = anchor(st.to)
    return (
      <g key={`a${i}`}>
        {/* koyu casing (govde kenarligi) */}
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={ARROW_EDGE}
          strokeWidth={4.6}
          strokeLinecap="round"
          opacity={0.7}
        />
        {/* parlak cekirdek + zarif ok ucu */}
        <line
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={ARROW}
          strokeWidth={2.2}
          strokeLinecap="round"
          markerEnd="url(#mbArrow)"
        />
        <circle cx={from.x} cy={from.y} r={R * 0.9} fill={ARROW} stroke={ARROW_EDGE} strokeWidth={1.2} />
        <text x={from.x} y={from.y + R * 0.36} fontSize={R * 1.15} fontWeight="800" textAnchor="middle" fill={ARROW_EDGE}>
          {i + 1}
        </text>
      </g>
    )
  })

  // Zarlar: normal oyundaki gibi board ortasinda (sag yari), oynayan tarafin rengiyle
  const dieEls =
    dice && dice.length >= 2
      ? (() => {
          const white = player === 'white'
          const face = white ? 'var(--cream)' : 'var(--navy)'
          const pipC = white ? 'var(--tv-ink)' : 'var(--cream)'
          const s = COL_W * 1.25
          const gap = s * 0.32
          const cx = HALF_W + BAR_W + HALF_W / 2 // sag yari merkezi
          const startX = cx - (s * 2 + gap) / 2
          const dy = H / 2 - s / 2
          return [dice[0], dice[1]].map((val, di) => {
            const dx = startX + di * (s + gap)
            return (
              <g key={`die${di}`}>
                <rect x={dx} y={dy} width={s} height={s} rx={s * 0.18} fill={face} stroke="#0007" strokeWidth={1} />
                {(PIP_POS[val] ?? []).map(([px, py], pi) => (
                  <circle key={pi} cx={dx + (s * px) / 100} cy={dy + (s * py) / 100} r={s * 0.08} fill={pipC} />
                ))}
              </g>
            )
          })
        })()
      : null

  return (
    <svg className="mini-board" viewBox={`0 0 ${W} ${H}`} width="100%">
      <defs>
        {/* Kucuk + zarif chevron ok ucu (userSpaceOnUse -> govde kalinligindan
            bagimsiz sabit kucuk boyut). Koyu konturlu ki her board'da secilsin. */}
        <marker
          id="mbArrow"
          markerUnits="userSpaceOnUse"
          markerWidth="11"
          markerHeight="11"
          refX="8.4"
          refY="5.5"
          orient="auto"
        >
          <path
            d="M1.6,1.4 L9,5.5 L1.6,9.6 L3.9,5.5 Z"
            fill={ARROW}
            stroke={ARROW_EDGE}
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
      <rect x="0" y="0" width={W} height={H} rx="8" fill="var(--panel)" />
      {/* orta bar */}
      <rect x={HALF_W} y="0" width={BAR_W} height={H} fill="var(--bar)" />
      {/* bear-off */}
      <rect x={USABLE_W} y="0" width={OFF_W} height={H} fill="var(--bar)" />
      {tris}
      {discs}
      {dieEls}
      {arrows}
    </svg>
  )
}
