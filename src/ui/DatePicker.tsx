import { useEffect, useState } from 'react'
import { useT } from '../i18n'

// Dogum tarihi secici: Gun / Ay / Yil uc acilir liste. Deger ISO (YYYY-MM-DD).
// Ay adlari uygulama diline gore (Intl). Yil listesi max'e (varsa) gore ust sinirli.
interface Props {
  value: string
  onChange: (v: string) => void
  max?: string // bu tarihten sonrasi secilemez (YYYY-MM-DD)
  placeholder?: string // artik kullanilmiyor; imza uyumlulugu icin duruyor
}

const pad = (n: number) => String(n).padStart(2, '0')
const parseISO = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null
}
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

export default function DatePicker({ value, onChange, max }: Props) {
  const { lang, t } = useT()
  // sel: kaynak durum. d=0 / m=-1 / y=0 => secilmemis (kismi secim buradan tutulur).
  const [sel, setSel] = useState(() => {
    const p = parseISO(value)
    return { d: p ? p.d : 0, m: p ? p.m : -1, y: p ? p.y : 0 }
  })

  // Deger disaridan degisirse (form yukleme/reset) esitle; kismi secimi ezme.
  useEffect(() => {
    const p = parseISO(value)
    if (p) setSel((s) => (s.d === p.d && s.m === p.m && s.y === p.y ? s : { d: p.d, m: p.m, y: p.y }))
    // value === '' iken dokunma (kullanicinin surmekte olan secimi korunsun)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const maxP = max ? parseISO(max) : null
  const topYear = maxP ? maxP.y : new Date().getFullYear()
  const years = Array.from({ length: topYear - 1900 + 1 }, (_, i) => topYear - i)
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(lang, { month: 'long' }).format(new Date(2024, i, 1)),
  )

  // max'e gore ay/gun seceneklerini kis: (yil==maxYil => ay<=maxAy; ay==maxAy => gun<=maxGun)
  const atMaxYear = !!maxP && sel.y === maxP!.y
  const monthMax = atMaxYear ? maxP!.m : 11
  const months = monthNames.map((name, i) => ({ i, name })).filter((mm) => mm.i <= monthMax)

  const dimBase = sel.y > 0 && sel.m >= 0 ? daysInMonth(sel.y, sel.m) : 31
  const atMaxMonth = atMaxYear && sel.m === maxP!.m
  const dayMax = atMaxMonth ? Math.min(dimBase, maxP!.d) : dimBase
  const days = Array.from({ length: dayMax }, (_, i) => i + 1)

  // Tam ve gecerli tarih olusunca ISO gonder; degilse '' gonder.
  const commit = (d: number, m: number, y: number) => {
    let dd = d
    if (m >= 0 && y > 0 && d > 0) dd = Math.min(d, daysInMonth(y, m))
    // ay/yil degisince max ayindan/ayina gore ay-gunu de kisilabilir
    if (maxP && y === maxP.y && m === maxP.m && dd > maxP.d) dd = maxP.d
    if (maxP && y === maxP.y && m > maxP.m) m = maxP.m
    setSel({ d: dd, m, y })
    if (dd > 0 && m >= 0 && y > 0) onChange(`${y}-${pad(m + 1)}-${pad(dd)}`)
    else onChange('')
  }

  return (
    <div className="dp-selects3">
      <select
        value={sel.d > 0 ? sel.d : ''}
        onChange={(e) => commit(e.target.value === '' ? 0 : +e.target.value, sel.m, sel.y)}
        aria-label={t('dp.day')}
      >
        <option value="">{t('dp.day')}</option>
        {days.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select
        value={sel.m >= 0 ? sel.m : ''}
        onChange={(e) => commit(sel.d, e.target.value === '' ? -1 : +e.target.value, sel.y)}
        aria-label={t('dp.month')}
      >
        <option value="">{t('dp.month')}</option>
        {months.map((mm) => (
          <option key={mm.i} value={mm.i}>
            {mm.name}
          </option>
        ))}
      </select>
      <select
        value={sel.y > 0 ? sel.y : ''}
        onChange={(e) => commit(sel.d, sel.m, e.target.value === '' ? 0 : +e.target.value)}
        aria-label={t('dp.year')}
      >
        <option value="">{t('dp.year')}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
