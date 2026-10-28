import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { CountryFlag } from './Flag'
import { Input } from '@/components/ui/input'
import { useT } from '../i18n'
import { dialOptions, dialCode, isoFromDial } from '../countries'

// ULUSLARARASI TELEFON ALANI: ulke arama kodu (bayrak + +kod) dropdown'i + ulusal numara.
// SAKLANAN deger:
//  - TR dial: '0' + 10 ulusal hane (05XXXXXXXXX) -> mevcut TR formatini + SMS OTP'yi KORUR.
//  - diger: '+' + dial + ulusal haneler (E.164). Boylece Malta vb. yabanci uyeler cebini girebilir.
export function isValidPhone(stored: string): boolean {
  if (!stored) return false
  if (/^0?5\d{9}$/.test(stored)) return true // TR cep
  if (/^\+[1-9]\d{6,14}$/.test(stored)) return true // uluslararasi (7-15 hane)
  return false
}

function parseStored(stored: string, countryIso: string): { iso: string; national: string } {
  const s = (stored || '').trim()
  if (/^0?5\d{9}$/.test(s)) {
    return { iso: 'TR', national: s.replace(/\D/g, '').replace(/^0/, '').slice(0, 10) }
  }
  if (s.startsWith('+')) {
    const iso = isoFromDial(s, countryIso) || countryIso || 'TR'
    const dial = dialCode(iso)
    const digits = s.replace(/\D/g, '')
    const national = dial && digits.startsWith(dial) ? digits.slice(dial.length) : digits
    return { iso, national }
  }
  return { iso: countryIso || 'TR', national: '' }
}

// Gorunum maskesi: TR "5XX XXX XX XX"; diger 3'lu gevsek gruplama.
function fmtNational(iso: string, d: string): string {
  if (iso === 'TR') return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean).join(' ')
  return d.replace(/(\d{3})(?=\d)/g, '$1 ').trim()
}

export default function PhoneField({
  id,
  country,
  value,
  onChange,
  invalid,
}: {
  id?: string
  country: string // kullanicinin sectigi ulke ISO -> dial varsayilani
  value: string // saklanan tam deger
  onChange: (stored: string) => void
  invalid?: boolean
}) {
  const { lang } = useT()
  const init = useMemo(() => parseStored(value, country), []) // yalniz ilk mount
  const [iso, setIso] = useState(init.iso)
  const [national, setNational] = useState(init.national)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Ulke degisince ve numara BOSsa dial'i ulkeye cek (Malta sec -> +356 otomatik gelsin).
  useEffect(() => {
    if (!national && country && dialCode(country)) setIso(country)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country])

  const emit = (nextIso: string, nextNat: string) => {
    const d = nextNat.replace(/\D/g, '')
    if (!d) return onChange('')
    if (nextIso === 'TR') onChange('0' + d.slice(0, 10))
    else onChange('+' + dialCode(nextIso) + d)
  }
  const pickIso = (v: string) => {
    setIso(v)
    setOpen(false)
    setQ('')
    emit(v, national)
  }
  const onNat = (raw: string) => {
    let d = raw.replace(/\D/g, '')
    if (iso === 'TR') {
      // Yapistirma/otomatik-doldurma ulke kodu veya basta-0 sokabilir ( or "905384408076",
      // "05384408076"): TR ulusal numara 10 hane ve 5 ile baslar -> prefix'i soyarak dogru yakala.
      d = d.replace(/^0+/, '')
      if (d.length > 10 && d.startsWith('90')) d = d.slice(2)
      d = d.slice(0, 10)
    } else {
      d = d.slice(0, 15)
    }
    setNational(d)
    emit(iso, d)
  }

  const opts = useMemo(() => dialOptions(lang), [lang])
  const norm = (s: string) => s.toLocaleLowerCase('tr').trim()
  const filtered = useMemo(() => {
    const nq = norm(q).replace(/^\+/, '')
    if (!nq) return opts
    return opts.filter((o) => norm(o.name).includes(nq) || o.dial.startsWith(nq) || o.code.toLowerCase() === nq)
  }, [q, opts])

  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div className="phone-field" ref={wrapRef}>
      <div className="phone-row">
        <button
          type="button"
          className="phone-dial"
          aria-invalid={invalid || undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <CountryFlag code={iso} size={18} />
          <span className="phone-dial__code">+{dialCode(iso)}</span>
          <Icon name="chevron" size={14} className="phone-dial__chev" />
        </button>
        <Input
          id={id}
          type="tel"
          inputMode={iso === 'TR' ? 'numeric' : 'tel'}
          autoComplete="tel"
          placeholder={iso === 'TR' ? '5XX XXX XX XX' : '000 000 000'}
          value={fmtNational(iso, national)}
          onChange={(e) => onNat(e.target.value)}
          // iOS Safari otomatik-doldurma kontrollu input'ta onChange'i kacirabilir -> React state bos
          // kalir, ekranda numara gorunur ama "gecersiz" der. Blur'da DOM degerini tekrar senkronla.
          onBlur={(e) => onNat(e.target.value)}
          aria-invalid={invalid || undefined}
        />
      </div>
      {open && (
        <div className="phone-pop" role="listbox">
          <div className="ss-search">
            <Icon name="search" size={15} />
            <input
              ref={searchRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={lang === 'tr' ? 'Ülke / kod ara…' : 'Search country / code…'}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false)
                else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (filtered[0]) pickIso(filtered[0].code)
                }
              }}
            />
          </div>
          <ul className="ss-list">
            {filtered.length === 0 && <li className="ss-empty">—</li>}
            {filtered.map((o) => (
              <li key={o.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.code === iso}
                  className={`phone-opt ${o.code === iso ? 'sel' : ''}`}
                  onClick={() => pickIso(o.code)}
                >
                  <CountryFlag code={o.code} size={18} />
                  <span className="phone-opt__name">{o.name}</span>
                  <span className="phone-opt__dial">+{o.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
