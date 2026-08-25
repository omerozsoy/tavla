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
  const y = (v: number) => height - 4 - ((v - min) / span) * (height - 8)
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`)
  const area = `0,${height} ${pts.join(' ')} ${w},${height}`
  const last = data[data.length - 1]
  return (
    <div className="line-chart-wrap">
      <svg
        className="line-chart"
        viewBox={`0 0 ${w} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        role="img"
        aria-label={`En düşük ${min}, en yüksek ${max}, son ${last}`}
      >
        {/* Ust/alt eksen kilavuz cizgileri (skill: axis-labels, gridline-subtle) */}
        <line x1="0" y1={y(max).toFixed(1)} x2={w} y2={y(max).toFixed(1)} className="lc-grid" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={y(min).toFixed(1)} x2={w} y2={y(min).toFixed(1)} className="lc-grid" vectorEffect="non-scaling-stroke" />
        <polygon points={area} fill={color} opacity="0.12" />
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Y-ekseni deger etiketleri (min/max) — non-uniform SVG'yi bozmadan HTML overlay */}
      <span className="lc-axis lc-max">{max}</span>
      <span className="lc-axis lc-min">{min}</span>
    </div>
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
  // Esik cizgisi konumu (deger uzayindan yuzdeye) — sadece olcek icindeyse goster
  const threshPct = threshold > 0 && threshold <= max ? (threshold / max) * 100 : null
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
              {threshPct != null && (
                <div
                  className="bar-thresh"
                  style={{ bottom: `${threshPct}%` }}
                  title={`Eşik: ${threshold}${suffix}`}
                  aria-hidden="true"
                />
              )}
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
