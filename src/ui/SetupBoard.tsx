import { Icon } from './Icon'

// Kurulum ekranlarindaki tahta onizlemesi: secilen temaya gore renklenir,
// baslangic dizilisinde istiflenmis pullar + iki zar. Ortada istege bagli
// "Tahtayi Degistir" butonu (tema seciciyi acar).

interface Props {
  panel: string
  a: string
  b: string
  checker: string
  cream?: string
  onChangeBoard?: () => void
  changeLabel?: string
}

// Standart baslangic dizilisi: {yari, satir, kolon(0-5), adet, beyaz?}
type Stack = { half: 'L' | 'R'; row: 'top' | 'bot'; col: number; n: number; w: boolean }
const START: Stack[] = [
  { half: 'L', row: 'top', col: 0, n: 5, w: true },
  { half: 'L', row: 'top', col: 4, n: 3, w: false },
  { half: 'R', row: 'top', col: 0, n: 5, w: false },
  { half: 'R', row: 'top', col: 5, n: 2, w: true },
  { half: 'L', row: 'bot', col: 0, n: 5, w: false },
  { half: 'L', row: 'bot', col: 4, n: 3, w: true },
  { half: 'R', row: 'bot', col: 0, n: 5, w: true },
  { half: 'R', row: 'bot', col: 5, n: 2, w: false },
]

// Zar yuzu pip konumlari (3x3 grid, 0..1)
const PIPS: Record<number, [number, number][]> = {
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
}

export default function SetupBoard({
  panel,
  a,
  b,
  checker,
  cream = '#f4efe6',
  onChangeBoard,
  changeLabel,
}: Props) {
  const W = 400
  const H = 264
  const PAD = 12
  const GAP = 18 // orta bar
  const halfW = (W - 2 * PAD - GAP) / 2
  const colW = halfW / 6
  const r = colW * 0.36 // pullar arasi/etrafinda daha ferah bosluk
  const triH = (H - 2 * PAD) * 0.34
  const halfX = (half: 'L' | 'R') => (half === 'L' ? PAD : PAD + halfW + GAP)
  const colCx = (half: 'L' | 'R', col: number) => halfX(half) + colW * (col + 0.5)

  const tris = []
  for (const half of ['L', 'R'] as const) {
    for (let col = 0; col < 6; col++) {
      const cx = colCx(half, col)
      const light = col % 2 === 0
      // ust ve alt ucgen ters renk (gercek tahta gibi)
      tris.push(
        <polygon
          key={`t-${half}-${col}`}
          points={`${cx - colW / 2 + 1},${PAD} ${cx + colW / 2 - 1},${PAD} ${cx},${PAD + triH}`}
          fill={light ? a : b}
          opacity="0.95"
        />,
        <polygon
          key={`btm-${half}-${col}`}
          points={`${cx - colW / 2 + 1},${H - PAD} ${cx + colW / 2 - 1},${H - PAD} ${cx},${H - PAD - triH}`}
          fill={light ? b : a}
          opacity="0.95"
        />,
      )
    }
  }

  // Dikey istif adimi: en yuksek yigin (5) yariya (PAD..H/2) sigmali; aksi halde
  // ust ve alt yiginlar merkezde ust uste biner. r*2+1 tercih, sigmiyorsa daraltilir.
  const maxStack = 5
  const step = Math.min(r * 2 + 1, (H / 2 - PAD - 2 * r - 4) / (maxStack - 1))
  const discs = []
  for (const s of START) {
    const cx = colCx(s.half, s.col)
    for (let k = 0; k < s.n; k++) {
      const cy = s.row === 'top' ? PAD + r + 1 + k * step : H - PAD - r - 1 - k * step
      discs.push(
        <circle
          key={`d-${s.half}-${s.row}-${s.col}-${k}`}
          cx={cx}
          cy={cy}
          r={r}
          fill={s.w ? cream : checker}
          stroke="rgba(0,0,0,0.28)"
          strokeWidth="1"
        />,
      )
    }
  }

  const die = (x: number, y: number, face: number, pip: string) => {
    const size = 34
    return (
      <g key={`die-${x}`}>
        <rect
          x={x - size / 2}
          y={y - size / 2}
          width={size}
          height={size}
          rx="7"
          fill={cream}
          stroke="rgba(0,0,0,0.25)"
        />
        {PIPS[face].map(([px, py], i) => (
          <circle
            key={i}
            cx={x - size / 2 + px * size}
            cy={y - size / 2 + py * size}
            r={3.1}
            fill={pip}
          />
        ))}
      </g>
    )
  }

  return (
    <div className="setup-board">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="setup-board-svg">
        <rect x="0" y="0" width={W} height={H} rx="16" fill={panel} />
        <rect x="0" y="0" width={W} height={H} rx="16" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
        {/* orta bar */}
        <rect x={PAD + halfW} y={PAD} width={GAP} height={H - 2 * PAD} rx="3" fill={checker} opacity="0.55" />
        {tris}
        {discs}
        {die(W * 0.28, H / 2, 5, checker)}
        {die(W * 0.72, H / 2, 3, a)}
      </svg>
      {onChangeBoard && (
        <button type="button" className="setup-board-change" onClick={onChangeBoard}>
          <Icon name="refresh" size={17} /> {changeLabel}
        </button>
      )}
    </div>
  )
}
