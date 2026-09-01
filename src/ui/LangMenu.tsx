import { useEffect, useRef, useState } from 'react'
import { LANGS, useT } from '../i18n'
import { Flag } from './Flag'
import { Button } from '@/components/ui/button'

// Bayrakli dil secici (native select SVG gosteremedigi icin ozel dropdown).
export default function LangMenu() {
  const { lang, setLang } = useT()
  const [open, setOpen] = useState(false)
  // Panel position:fixed -> ust bar overflow'una takilmaz / banner arkasinda kalmaz.
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const ref = useRef<HTMLDivElement>(null)

  function toggle() {
    setOpen((o) => {
      if (!o && ref.current) {
        const r = ref.current.getBoundingClientRect()
        setPos({ top: Math.round(r.bottom + 6), right: Math.round(Math.max(8, window.innerWidth - r.right)) })
      }
      return !o
    })
  }

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
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="[&_svg]:w-[24px]! [&_svg]:h-[17px]!"
        onClick={toggle}
        title={current.label}
        aria-label={current.label}
      >
        <Flag code={current.code} size={24} />
      </Button>
      {open && (
        <div className="lang-pop" style={{ position: 'fixed', top: pos.top, right: pos.right }}>
          {LANGS.map((l) => (
            <Button
              key={l.code}
              variant={l.code === lang ? 'secondary' : 'ghost'}
              type="button"
              className="w-full justify-start"
              onClick={() => {
                setLang(l.code)
                setOpen(false)
              }}
            >
              <Flag code={l.code} size={20} /> <span>{l.label}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
