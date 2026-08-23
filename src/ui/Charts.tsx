// Basit SVG grafikler (bagimlilik yok): cizgi + cubuk.

export function LineChart({
  data,
  color = 'var(--accent)',
  height = 60,
}: {
  data: number[]
  color?: string
  height?: number
}) {
  if (data.length < 2) return <div className="chart-empty">—</div>
  const w = 300
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = Math.max(1, max - min)
  const step = w / (data.length - 1)
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - 4 - ((v - min) / span) * (height - 8)).toFixed(1)}`)
  const area = `0,${height} ${pts.join(' ')} ${w},${height}`
  return (
    <svg className="line-chart" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height={height}>
      <polygon points={area} fill={color} opacity="0.12" />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// Cubuk grafik: her oge {label, value, sub?, good?} — good=true yesil, false kirmizi/notr
export function BarChart({
  items,
  suffix = '',
  height = 90,
  threshold = 50,
  invert = false,
}: {
  items: { label: string; value: number | null; sub?: string }[]
  suffix?: string
  height?: number
  threshold?: number // kazanma% icin 50 (ustunde yesil)
  invert?: boolean // PR gibi dusuk=iyi metrikler icin (esik altinda yesil)
}) {
  const vals = items.map((i) => i.value ?? 0)
  const max = Math.max(1, ...vals)
  return (
    <div className="bar-chart" style={{ ['--bc-h' as string]: `${height}px` }}>
      {items.map((it, i) => {
        const v = it.value
        const h = v == null ? 0 : Math.round((v / max) * 100)
        const good = v != null && (invert ? v <= threshold : v >= threshold)
        return (
          <div key={i} className="bar-col">
            <span className="bar-val">{v == null ? '—' : `${v}${suffix}`}</span>
            <div className="bar-track">
              <div className={`bar-fill ${good ? 'good' : 'bad'}`} style={{ height: `${h}%` }} />
            </div>
            <span className="bar-label">{it.label}</span>
            {it.sub && <span className="bar-sub">{it.sub}</span>}
          </div>
        )
      })}
    </div>
  )
}
