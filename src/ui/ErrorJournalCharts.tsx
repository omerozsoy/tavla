// Hata Günlüğü "Özet" grafikleri (bağımlılıksız SVG/HTML — Charts.tsx ile aynı yaklaşım).
//  - SeverityDonut : hataların derece dağılımı (bütünün yüzdesi -> halka/pasta)
//  - ErrorTrend    : zaman içinde hata oranı (çizgi; crosshair + tooltip)
//  - CategoryBars  : kategorilere göre hata oranı (uzun adlar + sıralama -> yatay çubuk;
//                    en çok zorlanılan 5 alan vurgulu, diğerleri gri)
// Renkler App.css token'larından (.ejc-* sınıfları); derece rengi tek-ton kiremit dizisi
// (açıktan koyuya, koyu temada kendi adımları) — dataviz validator'dan geçirildi.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useT } from '../i18n'
import type { EJCategoryStat, EJTrendPoint } from '../api'

const pct = (r: number) => `%${Math.round(r * 100)}`
const fmtInt = (n: number) => n.toLocaleString('tr-TR')

function useWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null)
  const [w, setW] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((e) => {
      const cw = e[0]?.contentRect.width
      if (cw && cw > 0) setW(Math.round(cw))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export function ChartEmpty({ text }: { text?: string }) {
  const { t } = useT()
  return <div className="ejc-empty">{text ?? t('ejc.noData')}</div>
}

// ---------------------------------------------------------------------------
// Halka: Küçük hata / Hata / Blunder dağılımı
// ---------------------------------------------------------------------------
export function SeverityDonut({ inaccuracies, mistakes, blunders }: { inaccuracies: number; mistakes: number; blunders: number }) {
  const { t } = useT()
  const [active, setActive] = useState<number | null>(null)
  const slices = [
    { key: 'minor', label: t('rep.minor'), value: inaccuracies, cls: 's1' },
    { key: 'error', label: t('rep.error'), value: mistakes, cls: 's2' },
    { key: 'blunder', label: t('rep.blunder'), value: blunders, cls: 's3' },
  ]
  const total = inaccuracies + mistakes + blunders
  if (total === 0) return <ChartEmpty />

  const R = 64
  const SW = 22
  const C = 2 * Math.PI * R
  const GAP = slices.filter((s) => s.value > 0).length > 1 ? 2.5 : 0 // dilimler arası yüzey boşluğu
  let acc = 0
  const arcs = slices.map((s, i) => {
    const len = (s.value / total) * C
    const a = { ...s, i, dash: Math.max(0, len - GAP), offset: -acc }
    acc += len
    return a
  })
  const cur = active != null ? slices[active] : null

  return (
    <div className="ejc-donut">
      <svg
        viewBox="0 0 160 160"
        className="ejc-donut-svg"
        role="img"
        aria-label={slices.map((s) => `${s.label} ${s.value}`).join(', ')}
      >
        <g transform="rotate(-90 80 80)">
          <circle cx="80" cy="80" r={R} className="ejc-donut-track" strokeWidth={SW} fill="none" />
          {arcs.map((a) =>
            a.value > 0 ? (
              <circle
                key={a.key}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                strokeWidth={active === a.i ? SW + 4 : SW}
                className={`ejc-sev ${a.cls}`}
                strokeDasharray={`${a.dash} ${C - a.dash}`}
                strokeDashoffset={a.offset}
                onPointerEnter={() => setActive(a.i)}
                onPointerLeave={() => setActive(null)}
                onPointerDown={() => setActive(a.i)}
              />
            ) : null,
          )}
        </g>
        {/* Merkez: seçili dilim değeri (hover/dokunma) ya da toplam */}
        <text x="80" y="76" textAnchor="middle" className="ejc-donut-num">
          {cur ? fmtInt(cur.value) : fmtInt(total)}
        </text>
        <text x="80" y="96" textAnchor="middle" className="ejc-donut-sub">
          {cur ? `${cur.label} · ${pct(cur.value / total)}` : t('ejc.errorsTotal')}
        </text>
      </svg>
      <ul className="ejc-legend">
        {slices.map((s, i) => (
          <li
            key={s.key}
            className={active === i ? 'on' : ''}
            tabIndex={0}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          >
            <span className={`ejc-swatch ${s.cls}`} aria-hidden="true" />
            <span className="ejc-leg-label">{s.label}</span>
            <span className="ejc-leg-val">
              <b>{fmtInt(s.value)}</b> · {pct(s.value / total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Çizgi: zaman içinde hata oranı
// ---------------------------------------------------------------------------
function fmtDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}` : iso
}

export function ErrorTrend({ points }: { points: EJTrendPoint[] }) {
  const { t } = useT()
  const [ref, w] = useWidth<HTMLDivElement>(480)
  const [hover, setHover] = useState<number | null>(null)
  if (points.length < 2) return <ChartEmpty text={t('ejc.trendNeedMore')} />

  const H = 200
  const padT = 14
  const padB = 28
  const padL = 40
  const padR = 14
  const plotW = Math.max(1, w - padL - padR)
  const plotH = H - padT - padB
  const maxRate = Math.max(...points.map((p) => p.errorRate))
  // "Yuvarlak" üst sınır: %10'luk adımlar (en az %10)
  const top = Math.max(0.1, Math.ceil(maxRate * 10) / 10)
  const ticks = [0, top / 2, top]
  const X = (i: number) => padL + (plotW * i) / (points.length - 1)
  const Y = (r: number) => padT + (1 - r / top) * plotH
  const d = points.map((p, i) => `${i ? 'L' : 'M'} ${X(i).toFixed(1)} ${Y(p.errorRate).toFixed(1)}`).join(' ')
  // X ekseni: genişliğe göre en fazla ~6 etiket
  const maxLabels = Math.max(2, Math.min(points.length, Math.floor(plotW / 64)))
  const step = Math.ceil((points.length - 1) / (maxLabels - 1))
  const xIdx = points.map((_, i) => i).filter((i) => i % step === 0 || i === points.length - 1)
  if (xIdx.length > 1 && xIdx[xIdx.length - 1] - xIdx[xIdx.length - 2] < step / 2) xIdx.splice(xIdx.length - 2, 1)

  const pick = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const ratio = (clientX - rect.left - padL) / plotW
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1))
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? points.length) - 1))
  }
  const hp = hover != null ? points[hover] : null
  const weekly = points[0]?.weekly

  return (
    <div
      className="ejc-trend"
      ref={ref}
      tabIndex={0}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerDown={(e) => pick(e.clientX)}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
      onKeyDown={onKey}
      onBlur={() => setHover(null)}
      aria-label={t('ejc.trendAria')}
    >
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={t('ejc.trendAria')}>
        {ticks.map((v, k) => (
          <g key={k}>
            <line className="ejc-grid" x1={padL} x2={w - padR} y1={Y(v)} y2={Y(v)} />
            <text className="ejc-tick" x={padL - 6} y={Y(v)} textAnchor="end" dominantBaseline="middle">
              {pct(v)}
            </text>
          </g>
        ))}
        {xIdx.map((i, k) => (
          <text
            key={i}
            className="ejc-tick"
            x={X(i)}
            y={H - 8}
            textAnchor={k === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
          >
            {fmtDay(points[i].date)}
          </text>
        ))}
        <path d={d} className="ejc-line" fill="none" />
        {points.length <= 31 &&
          points.map((p, i) => <circle key={i} cx={X(i)} cy={Y(p.errorRate)} r="3" className="ejc-dot" />)}
        {hp && (
          <g>
            <line className="ejc-cross" x1={X(hover!)} x2={X(hover!)} y1={padT} y2={padT + plotH} />
            <circle cx={X(hover!)} cy={Y(hp.errorRate)} r="5" className="ejc-dot on" />
          </g>
        )}
      </svg>
      {hp && (
        <div
          className="ejc-tip"
          style={{
            left: `${Math.min(Math.max(X(hover!), 70), w - 70)}px`,
            top: `${Y(hp.errorRate)}px`,
          }}
        >
          <strong>{pct(hp.errorRate)}</strong>
          <span>
            {fmtInt(hp.errors)} {t('errorJournal.errUnit')} / {fmtInt(hp.decisions)} {t('errorJournal.decUnit')}
            {hp.blunders > 0 && ` · ${fmtInt(hp.blunders)} blunder`}
          </span>
          <span>{weekly ? t('ejc.weekOf', { d: fmtDay(hp.date) }) : fmtDay(hp.date)}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Yatay çubuk: kategorilere göre hata oranı (sıralı)
// ---------------------------------------------------------------------------
export function CategoryBars({
  categories,
  order,
  catLabel,
  selected,
  onSelect,
  highlight = 5,
}: {
  categories: EJCategoryStat[]
  order: string[]
  catLabel: (id: string) => string
  selected: string | null
  onSelect: (id: string | null) => void
  highlight?: number
}) {
  const { t } = useT()
  const [tip, setTip] = useState<string | null>(null)
  const rows = categories
    .filter((c) => c.decisions > 0)
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors)
  if (rows.length === 0) return <ChartEmpty />
  const top = Math.max(0.1, Math.ceil(Math.max(...rows.map((r) => r.errorRate)) * 10) / 10)
  const ticks = [0, top / 2, top]
  const seen = new Set(rows.map((r) => r.category))
  const none = order.filter((id) => !seen.has(id))
  // Vurgu: yalnız en az 1 hatası olan ilk N kategori
  const hot = new Set(rows.filter((r) => r.errors > 0).slice(0, highlight).map((r) => r.category))

  return (
    <div className="ejc-bars">
      <div className="ejc-bars-axis" aria-hidden="true">
        <span />
        <span className="ejc-bars-scale">
          {ticks.map((v, k) => (
            <i key={k} style={{ left: `${(v / top) * 100}%` }}>
              {pct(v)}
            </i>
          ))}
        </span>
        <span />
      </div>
      <ul className="ejc-bars-list">
        {rows.map((c) => {
          const on = selected === c.category
          return (
            <li key={c.category}>
              <button
                type="button"
                className={`ejc-bar-row ${hot.has(c.category) ? 'hot' : ''} ${on ? 'on' : ''}`}
                onClick={() => onSelect(on ? null : c.category)}
                disabled={c.errors === 0}
                aria-pressed={on}
                onPointerEnter={() => setTip(c.category)}
                onPointerLeave={() => setTip(null)}
                onFocus={() => setTip(c.category)}
                onBlur={() => setTip(null)}
              >
                <span className="ejc-bar-label">
                  {catLabel(c.category)}
                  {/* Dokunmatikte de okunsun: kısa sayılar etiketin altında */}
                  <small>
                    {fmtInt(c.errors)} {t('errorJournal.errUnit')} · {fmtInt(c.decisions)} {t('errorJournal.decUnit')}
                  </small>
                </span>
                <span className="ejc-bar-track">
                  {ticks.slice(1).map((v, k) => (
                    <i key={k} className="ejc-bar-grid" style={{ left: `${(v / top) * 100}%` }} />
                  ))}
                  <span className="ejc-bar-fill" style={{ width: `${Math.max(c.errorRate > 0 ? 1.5 : 0, (c.errorRate / top) * 100)}%` }} />
                  {tip === c.category && (
                    <span className="ejc-tip ejc-bar-tip" role="tooltip">
                      <strong>{pct(c.errorRate)}</strong>
                      <span>
                        {fmtInt(c.errors)} {t('errorJournal.errUnit')} / {fmtInt(c.decisions)} {t('errorJournal.decUnit')}
                        {(c.blunders ?? 0) > 0 && ` · ${fmtInt(c.blunders ?? 0)} blunder`}
                      </span>
                      <span>
                        {t('ejc.equityLoss')}: {c.equityLoss.toFixed(3)}
                      </span>
                    </span>
                  )}
                </span>
                <span className="ejc-bar-val">{pct(c.errorRate)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {none.length > 0 && (
        <p className="ejc-note">
          {t('ejc.noDataCats')}: {none.map(catLabel).join(', ')}
        </p>
      )}
    </div>
  )
}
