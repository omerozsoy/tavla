import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'

// Ozel tarih secici: elle yazilabilir (GG.AA.YYYY) + ay/yil acilir listeli takvim.
// Ay/gun adlari uygulama diline gore (Intl), hafta PAZARTESI baslar. Deger ISO (YYYY-MM-DD).
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
// Elle yazilan metni (GG.AA.YYYY; . / veya - ayirici) parse et. Gecerli/gercek tarih degilse null.
const parseTyped = (s: string) => {
  const m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(s.trim())
  if (!m) return null
  const d = +m[1], mo = +m[2] - 1, y = +m[3]
  const dt = new Date(y, mo, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null
  return { y, m: mo, d }
}
const fmtText = (p: { y: number; m: number; d: number } | null) =>
  p ? `${pad(p.d)}.${pad(p.m + 1)}.${p.y}` : ''

export default function DatePicker({ value, onChange, max, placeholder }: Props) {
  const { lang, t } = useT()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(() => fmtText(parseISO(value)))
  const wrapRef = useRef<HTMLDivElement>(null)
  const parsed = parseISO(value)
  const start = parsed ? new Date(parsed.y, parsed.m, 1) : new Date()
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() })

  // Deger disaridan degisirse (form reset vb.) metni esitle — kullanici yazarken degil.
  useEffect(() => {
    setText(fmtText(parseISO(value)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

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

  const wdFmt = new Intl.DateTimeFormat(lang, { weekday: 'short' })
  // Pazartesi baslangicli gun basliklari (2024-01-01 Pazartesi)
  const weekdays = Array.from({ length: 7 }, (_, i) => wdFmt.format(new Date(2024, 0, 1 + i)))
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(lang, { month: 'long' }).format(new Date(2024, i, 1)),
  )

  const maxP = max ? parseISO(max) : null
  const maxDate = maxP ? new Date(maxP.y, maxP.m, maxP.d) : null
  const topYear = maxDate ? maxDate.getFullYear() : new Date().getFullYear()
  const years = Array.from({ length: topYear - 1900 + 1 }, (_, i) => topYear - i)

  const first = new Date(view.y, view.m, 1)
  const offset = (first.getDay() + 6) % 7 // Pazartesi=0
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.y, view.m, 1 - offset + i))
  const today = new Date()
  const sameYMD = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const prevMonth = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))
  const nextMonth = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))
  const commit = (y: number, m: number, d: number) => {
    onChange(toISO(y, m, d))
    setText(fmtText({ y, m, d }))
    setView({ y, m })
  }
  const pick = (d: Date) => {
    commit(d.getFullYear(), d.getMonth(), d.getDate())
    setOpen(false)
  }

  // Elle yazma: metni tut, tam ve gecerli tarih olusunca degeri gonder.
  const onType = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setText(raw)
    if (raw.trim() === '') {
      onChange('')
      return
    }
    const p = parseTyped(raw)
    if (p && (!maxDate || new Date(p.y, p.m, p.d) <= maxDate)) {
      onChange(toISO(p.y, p.m, p.d))
      setView({ y: p.y, m: p.m })
    }
  }
  const onBlur = () => {
    const p = parseTyped(text)
    if (p && (!maxDate || new Date(p.y, p.m, p.d) <= maxDate)) setText(fmtText(p))
    else if (text.trim() === '') onChange('')
    // gecersizse metni oldugu gibi birak (kullanici duzeltebilsin)
  }

  return (
    <div className="datepicker" ref={wrapRef}>
      <div className="dp-input">
        <button
          type="button"
          className="dp-cal"
          onClick={() => setOpen((o) => !o)}
          aria-label={t('reg.birthDate')}
        >
          <Icon name="calendar" size={16} />
        </button>
        <input
          className="dp-field"
          value={text}
          onChange={onType}
          onBlur={onBlur}
          inputMode="numeric"
          placeholder={placeholder || 'GG.AA.YYYY'}
          aria-invalid={text.trim() !== '' && !parseTyped(text)}
        />
      </div>
      {open && (
        <div className="dp-pop">
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={prevMonth} aria-label={t('dp.prevMonth')}>
              ‹
            </button>
            <div className="dp-selects">
              <select
                value={view.m}
                onChange={(e) => setView((v) => ({ ...v, m: +e.target.value }))}
                aria-label={t('dp.month')}
              >
                {monthNames.map((name, i) => (
                  <option key={i} value={i}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={view.y}
                onChange={(e) => setView((v) => ({ ...v, y: +e.target.value }))}
                aria-label={t('dp.year')}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="dp-nav" onClick={nextMonth} aria-label={t('dp.nextMonth')}>
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
                setText('')
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
