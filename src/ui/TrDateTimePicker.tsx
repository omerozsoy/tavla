import { useEffect, useState } from 'react'
import { useT } from '../i18n'

// Türkçe tarih+saat seçici: Gün / Ay(Türkçe) / Yıl / Saat / Dakika. Değer "YYYY-MM-DDTHH:MM"
// (datetime-local ile uyumlu). Yıl bu yıl..+2. Native datetime-local tarayıcı diline bağlı
// (mm/dd/yyyy, AM/PM) olduğundan bunun yerine kullanılır.
// KISMİ seçim İÇ state'te tutulur: her seçimde parent'a '' gönderip seçimi sıfırlamaz;
// yalnız 5 parça da seçilince "YYYY-MM-DDTHH:MM" emit eder (DatePicker ile aynı desen).
interface Props {
  value: string
  onChange: (v: string) => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
const parse = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s)
  return m
    ? { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +m[4], mi: +m[5] }
    : { y: 0, mo: -1, d: 0, h: -1, mi: -1 }
}

export default function TrDateTimePicker({ value, onChange }: Props) {
  const { lang, t } = useT()
  const [sel, setSel] = useState(() => parse(value))

  // Dışarıdan tam bir değer gelirse (reset/yükleme) eşitle; kısmi iç seçimi EZME (value==='').
  useEffect(() => {
    if (!value) return
    const p = parse(value)
    setSel((s) => (s.y === p.y && s.mo === p.mo && s.d === p.d && s.h === p.h && s.mi === p.mi ? s : p))
  }, [value])

  const thisYear = new Date().getFullYear()
  const years = [thisYear, thisYear + 1, thisYear + 2]
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(lang, { month: 'long' }).format(new Date(2024, i, 1)),
  )
  const dim = sel.y > 0 && sel.mo >= 0 ? daysInMonth(sel.y, sel.mo) : 31
  const days = Array.from({ length: dim }, (_, i) => i + 1)
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const mins = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

  const change = (patch: Partial<typeof sel>) => {
    const next = { ...sel, ...patch }
    if (next.y > 0 && next.mo >= 0 && next.d > 0) next.d = Math.min(next.d, daysInMonth(next.y, next.mo))
    setSel(next)
    const { y, mo, d, h, mi } = next
    onChange(y > 0 && mo >= 0 && d > 0 && h >= 0 && mi >= 0 ? `${y}-${pad(mo + 1)}-${pad(d)}T${pad(h)}:${pad(mi)}` : '')
  }
  const num = (v: string) => (v === '' ? -1 : +v)

  return (
    <div className="lts-dt">
      <select className="lts-gate-input" value={sel.d > 0 ? sel.d : ''} onChange={(e) => change({ d: e.target.value === '' ? 0 : +e.target.value })} aria-label={t('dp.day')}>
        <option value="">{t('dp.day')}</option>
        {days.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select className="lts-gate-input" value={sel.mo >= 0 ? sel.mo : ''} onChange={(e) => change({ mo: num(e.target.value) })} aria-label={t('dp.month')}>
        <option value="">{t('dp.month')}</option>
        {monthNames.map((n, i) => <option key={i} value={i}>{n}</option>)}
      </select>
      <select className="lts-gate-input" value={sel.y > 0 ? sel.y : ''} onChange={(e) => change({ y: e.target.value === '' ? 0 : +e.target.value })} aria-label={t('dp.year')}>
        <option value="">{t('dp.year')}</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <select className="lts-gate-input" value={sel.h >= 0 ? sel.h : ''} onChange={(e) => change({ h: num(e.target.value) })} aria-label={t('dp.hour')}>
        <option value="">{t('dp.hour')}</option>
        {hours.map((h) => <option key={h} value={h}>{pad(h)}</option>)}
      </select>
      <select className="lts-gate-input" value={sel.mi >= 0 ? sel.mi : ''} onChange={(e) => change({ mi: num(e.target.value) })} aria-label={t('dp.min')}>
        <option value="">{t('dp.min')}</option>
        {mins.map((mi) => <option key={mi} value={mi}>{pad(mi)}</option>)}
      </select>
    </div>
  )
}
