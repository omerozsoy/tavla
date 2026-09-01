// Basit SVG grafikler (bagimlilik yok): cizgi + cubuk.
import { useEffect, useId, useRef, useState } from 'react'
import { useT } from '../i18n'

// Monotone cubic (d3.curveMonotoneX mantigi): overshoot YOK -> temiz, yumusak egri.
function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n < 2) return ''
  if (n === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x
    slope[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1)
  }
  const tan: number[] = [slope[0]]
  for (let i = 1; i < n - 1; i++) {
    if (slope[i - 1] * slope[i] <= 0) {
      tan[i] = 0
    } else {
      const w1 = 2 * dx[i] + dx[i - 1]
      const w2 = dx[i] + 2 * dx[i - 1]
      tan[i] = (w1 + w2) / (w1 / slope[i - 1] + w2 / slope[i])
    }
  }
  tan[n - 1] = slope[n - 2]
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3
    const c1y = pts[i].y + (tan[i] * dx[i]) / 3
    const c2x = pts[i + 1].x - dx[i] / 3
    const c2y = pts[i + 1].y - (tan[i + 1] * dx[i]) / 3
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${pts[i + 1].x.toFixed(2)} ${pts[i + 1].y.toFixed(2)}`
  }
  return d
}

const fmtAxis = (n: number) => n.toLocaleString('tr-TR')

export function LineChart({
  data,
  dates,
  color = 'var(--accent)',
  height = 88,
}: {
  data: number[]
  dates?: string[] // data ile hizali gun (YYYY-MM-DD) — X ekseninde gosterilir
  color?: string
  height?: number
}) {
  const { t } = useT()
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(320)
  // Yukseklik de OLCULUR: grafik kutuyu (sd-card) doldursun (prop = baslangic/yedek).
  const [boxH, setBoxH] = useState<number | null>(null)
  // Uzerine gelince o noktadaki degeri gostermek icin hover indeksi.
  const [hover, setHover] = useState<number | null>(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r?.width && r.width > 0) setW(Math.round(r.width))
      if (r?.height && r.height > 0) setBoxH(Math.round(r.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (data.length < 2) return <div className="chart-empty">—</div>

  const H = boxH ?? height // olculmus yukseklik (yoksa prop)
  const hasDates = !!(dates && dates.length === data.length)
  // Eksen etiketlerine yer: solda Y degerleri, altta tarih
  const padT = 12
  const padB = hasDates ? 26 : 14
  const padL = 46
  const padR = 14
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = Math.max(1e-9, max - min)
  const plotW = Math.max(1, w - padL - padR)
  const plotH = Math.max(1, H - padT - padB)
  const baseY = padT + plotH
  const X = (i: number) => padL + (plotW * i) / (data.length - 1)
  const Y = (v: number) => padT + (1 - (v - min) / span) * plotH
  const pts = data.map((v, i) => ({ x: X(i), y: Y(v) }))
  const line = monotonePath(pts)
  const first = pts[0]
  const lastP = pts[pts.length - 1]
  const area = `${line} L ${lastP.x.toFixed(2)} ${baseY} L ${first.x.toFixed(2)} ${baseY} Z`
  const last = data[data.length - 1]

  // Y ekseni: min..max arasi 4 aralik = 5 deger (ara baremler)
  const Y_TICKS = 4
  const yVals = Array.from({ length: Y_TICKS + 1 }, (_, k) => min + (span * k) / Y_TICKS)
  // X ekseni: en fazla 5 tarih etiketi (esit araliklarla)
  const xCount = hasDates ? Math.min(5, data.length) : 0
  const xIdx =
    xCount > 1
      ? Array.from({ length: xCount }, (_, k) => Math.round(((data.length - 1) * k) / (xCount - 1)))
      : []

  // Uzerine gelince en yakin veri noktasini bul.
  const onMove = (e: { clientX: number }) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = (e.clientX - rect.left - padL) / plotW
    const i = Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))))
    setHover(i)
  }
  const hoverX = hover != null ? X(hover) : 0
  const tipLeftPct = hover != null ? (hoverX / Math.max(1, w)) * 100 : 0

  return (
    <div
      className="line-chart-wrap"
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        className="line-chart"
        width={w}
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        role="img"
        aria-label={t('charts.axisSummary', { min, max, last })}
      >
        <defs>
          <linearGradient id={`lcg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.20" />
            <stop offset="70%" stopColor={color} stopOpacity="0.04" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Y baremleri: yatay gridline + sol deger etiketi */}
        {yVals.map((v, k) => {
          const y = Y(v)
          return (
            <g key={k}>
              <line className="lc-grid" x1={padL} y1={y} x2={w - padR} y2={y} />
              <text className="lc-tick lc-tick-y" x={padL - 6} y={y} dominantBaseline="middle" textAnchor="end">
                {fmtAxis(Math.round(v))}
              </text>
            </g>
          )
        })}
        <path d={area} fill={`url(#lcg-${uid})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.25"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Uc nokta: yumusak halka + dolu nokta */}
        <circle cx={lastP.x} cy={lastP.y} r="6" fill={color} opacity="0.15" />
        <circle cx={lastP.x} cy={lastP.y} r="3.1" fill={color} stroke="var(--card-bg)" strokeWidth="1.6" />
        {/* X ekseni: gun/tarih etiketleri */}
        {xIdx.map((i, k) => (
          <text
            key={k}
            className="lc-tick lc-tick-x"
            x={X(i)}
            y={H - 8}
            textAnchor={k === 0 ? 'start' : k === xIdx.length - 1 ? 'end' : 'middle'}
          >
            {fmtDay(dates![i])}
          </text>
        ))}
        {/* Hover: dikey kilavuz + vurgulu nokta */}
        {hover != null && (
          <g>
            <line className="lc-hover-line" x1={hoverX} y1={padT} x2={hoverX} y2={baseY} />
            <circle cx={hoverX} cy={Y(data[hover])} r="4" fill={color} stroke="var(--card-bg)" strokeWidth="1.8" />
          </g>
        )}
      </svg>
      {/* Hover tooltip: o noktadaki deger (+ tarih) */}
      {hover != null && (
        <div
          className="lc-tip"
          style={{ left: `${tipLeftPct}%`, top: `${Y(data[hover])}px` }}
        >
          <strong>{fmtAxis(data[hover])}</strong>
          {hasDates && <span>{fmtDay(dates![hover])}</span>}
        </div>
      )}
    </div>
  )
}

// 'YYYY-MM-DD' -> 'gg.aa' (kisa gun.ay); gecersizse bos
function fmtDay(iso?: string): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  return `${m[3]}.${m[2]}`
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
  const { t } = useT()
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
                  title={t('charts.threshold', { v: `${threshold}${suffix}` })}
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
