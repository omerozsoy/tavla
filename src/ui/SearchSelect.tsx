import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useT } from '../i18n'

// Aranabilir açılır liste (ülke/il gibi uzun listeler için). Native <select> yerine:
// tıkla -> arama kutulu panel aç, yaz -> filtrele, seç -> kapat. Türkçe-duyarlı filtre.
export interface SSOption {
  value: string
  label: string
}

// Arama kutusu metinleri: i18n.tsx'e dokunmadan (paralel düzenleme) bileşen içinde tut; bilinmeyen
// dilde İngilizce'ye düşer (placeholder'lar kritik değil).
const SS_TXT: Record<string, { search: string; empty: string }> = {
  tr: { search: 'Ara…', empty: 'Sonuç yok' },
  en: { search: 'Search…', empty: 'No results' },
  es: { search: 'Buscar…', empty: 'Sin resultados' },
  de: { search: 'Suchen…', empty: 'Keine Treffer' },
  fr: { search: 'Rechercher…', empty: 'Aucun résultat' },
  el: { search: 'Αναζήτηση…', empty: 'Κανένα αποτέλεσμα' },
  ru: { search: 'Поиск…', empty: 'Нет результатов' },
  fa: { search: 'جستجو…', empty: 'نتیجه‌ای نیست' },
}

export default function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  ariaInvalid,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  options: SSOption[]
  placeholder?: string
  ariaInvalid?: boolean
}) {
  const { lang } = useT()
  const txt = SS_TXT[lang] ?? SS_TXT.en
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find((o) => o.value === value)

  // Türkçe-duyarlı normalize (İ/ı, locale lowercase) -> "İstanbul" "istanb" ile bulunur.
  const norm = (s: string) => s.toLocaleLowerCase('tr').trim()
  const filtered = useMemo(() => {
    const nq = norm(q)
    if (!nq) return options
    return options.filter((o) => norm(o.label).includes(nq))
  }, [q, options])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    setQ('')
  }

  return (
    <div className="search-select" ref={wrapRef}>
      <button
        id={id}
        type="button"
        className="ss-trigger"
        aria-invalid={ariaInvalid || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected ? 'ss-val' : 'ss-ph'}>{selected ? selected.label : placeholder}</span>
        <Icon name="chevron" size={16} className="ss-chev" />
      </button>
      {open && (
        <div className="ss-pop" role="listbox">
          <div className="ss-search">
            <Icon name="search" size={15} />
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={txt.search}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false)
                else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (filtered[0]) pick(filtered[0].value)
                }
              }}
            />
          </div>
          <ul className="ss-list">
            {filtered.length === 0 && <li className="ss-empty">{txt.empty}</li>}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={`ss-opt ${o.value === value ? 'sel' : ''}`}
                  onClick={() => pick(o.value)}
                >
                  <span>{o.label}</span>
                  {o.value === value && <Icon name="check" size={14} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
