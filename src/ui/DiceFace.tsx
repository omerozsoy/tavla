// Klasik zar yuzu (pip'li) — 1..6 icin standart nokta dizilimi. Bagimlilik yok, tek SVG.
// Zar Ortalamalari gibi yerlerde "5 · 4" yazisi yerine gercek zar ikonu gostermek icin.

// 3x3 izgarada pip konumlari (sutun, satir) 0..2
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
}

export function DiceFace({ n, size = 22 }: { n: number; size?: number }) {
  const pips = PIPS[n] ?? []
  const pad = size * 0.24 // kenar bosluk
  const gap = (size - pad * 2) / 2 // iki pip arasi mesafe
  const r = size * 0.1 // pip yaricapi

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="dice-face-svg"
      role="img"
      aria-label={String(n)}
    >
      <rect
        x="0.75"
        y="0.75"
        width={size - 1.5}
        height={size - 1.5}
        rx={size * 0.2}
        fill="var(--dice-face-bg, #f6f1e7)"
        stroke="var(--dice-face-line, rgba(0,0,0,0.22))"
        strokeWidth="1"
      />
      {pips.map(([c, rw], i) => (
        <circle key={i} cx={pad + c * gap} cy={pad + rw * gap} r={r} fill="var(--dice-pip, #1c1a17)" />
      ))}
    </svg>
  )
}

export default DiceFace
