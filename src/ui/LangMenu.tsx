import { useEffect, useRef, useState } from 'react'
import { LANGS, useT } from '../i18n'
import { Flag } from './Flag'

// Bayrakli dil secici (native select SVG gosteremedigi icin ozel dropdown).
export default function LangMenu() {
  const { lang, setLang } = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]

  return (
    <div className="lang-menu" ref={ref}>
      <button
        type="button"
        className="account-btn icon lang-btn"
        onClick={() => setOpen((o) => !o)}
        title={current.label}
        aria-label={current.label}
      >
        <Flag code={current.code} size={20} />
      </button>
      {open && (
        <div className="lang-pop">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              className={`lang-opt ${l.code === lang ? 'active' : ''}`}
              onClick={() => {
                setLang(l.code)
                setOpen(false)
              }}
            >
              <Flag code={l.code} size={20} /> <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
