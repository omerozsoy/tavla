import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'

// Ozel tarih secici: native <input type=date> yerine. Ay/gun adlari uygulama diline
// gore (Intl), hafta PAZARTESI baslar, gorunum GG.AA.YYYY. Deger ISO (YYYY-MM-DD).
interface Props {
  value: string
  onChange: (v: string) => void
  max?: string // bu tarihten sonrasi secilemez (YYYY-MM-DD)
  placeholder?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const parseISO = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null
}

export default function DatePicker({ value, onChange, max, placeholder }: Props) {
  const { lang, t } = useT()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const parsed = parseISO(value)
  const start = parsed ? new Date(parsed.y, parsed.m, 1) : new Date()
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() })

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const fmt = new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const monthFmt = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' })
  const wdFmt = new Intl.DateTimeFormat(lang, { weekday: 'short' })
  // Pazartesi baslangicli gun basliklari (2024-01-01 Pazartesi)
  const weekdays = Array.from({ length: 7 }, (_, i) => wdFmt.format(new Date(2024, 0, 1 + i)))

  const display = parsed ? fmt.format(new Date(parsed.y, parsed.m, parsed.d)) : ''

  const first = new Date(view.y, view.m, 1)
  const offset = (first.getDay() + 6) % 7 // Pazartesi=0
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.y, view.m, 1 - offset + i))
  const maxP = max ? parseISO(max) : null
  const maxDate = maxP ? new Date(maxP.y, maxP.m, maxP.d) : null
  const today = new Date()
  const sameYMD = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const prevMonth = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const nextMonth = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))
  const pick = (d: Date) => {
    onChange(toISO(d.getFullYear(), d.getMonth(), d.getDate()))
    setOpen(false)
  }

  return (
    <div className="datepicker" ref={wrapRef}>
      <button
        type="button"
        className={`dp-input ${display ? '' : 'placeholder'}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="calendar" size={16} />
        <span>{display || placeholder || 'GG.AA.YYYY'}</span>
      </button>
      {open && (
        <div className="dp-pop">
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={prevMonth} aria-label="Önceki ay">
              ‹
            </button>
            <span className="dp-title">{monthFmt.format(new Date(view.y, view.m, 1))}</span>
            <button type="button" className="dp-nav" onClick={nextMonth} aria-label="Sonraki ay">
              ›
            </button>
          </div>
          <div className="dp-weekdays">
            {weekdays.map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          <div className="dp-grid">
            {cells.map((d, i) => {
              const other = d.getMonth() !== view.m
              const disabled = maxDate ? d > maxDate : false
              const selected = !!parsed && sameYMD(d, new Date(parsed.y, parsed.m, parsed.d))
              return (
                <button
                  key={i}
                  type="button"
                  className={`dp-day ${other ? 'other' : ''} ${selected ? 'selected' : ''} ${sameYMD(d, today) ? 'today' : ''}`}
                  disabled={disabled}
                  onClick={() => pick(d)}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
          <div className="dp-actions">
            <button
              type="button"
              className="dp-link"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              {t('date.clear')}
            </button>
            <button
              type="button"
              className="dp-link"
              onClick={() => {
                if (!maxDate || today <= maxDate) pick(today)
              }}
            >
              {t('date.today')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
