/**
 * TurkeyMap — /kulup-rehberi üstünde interaktif Türkiye (81 il) haritası.
 * SVG public/turkiye.svg'den (dnomak/svg-turkiye-haritasi, MIT) runtime'da fetch
 * edilir → JS bundle şişmez, tarayıcı cache'ler. Kulübü olan iller vurgulanır;
 * tıklayınca o il seçilir (liste filtrelenir), tekrar tıklayınca kalkar.
 */

import { useEffect, useRef, useState, type MouseEvent } from 'react'

// Türkçe karakter-duyarlı normalize (eşleştirme için): İ/ı/ş/ğ/ü/ö/ç → i/s/g/u/o/c
export function normProvince(s: string): string {
  return s
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/[Şş]/g, 's')
    .replace(/[Ğğ]/g, 'g')
    .replace(/[Üü]/g, 'u')
    .replace(/[Öö]/g, 'o')
    .replace(/[Çç]/g, 'c')
    .toLowerCase()
    .trim()
}

interface Props {
  clubCounts: Record<string, number> // normProvince(il) -> kulüp sayısı
  selected: string | null // seçili il (ham ad) veya null
  onSelect: (province: string | null) => void
  countLabel: (n: number) => string // "3 kulüp" gibi (i18n)
}

export default function TurkeyMap({ clubCounts, selected, onSelect, countLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/turkiye.svg')
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => alive && setSvg(t))
      .catch(() => alive && setErr(true))
    return () => {
      alive = false
    }
  }, [])

  // SVG yüklenince: vurgulama + seçili + tooltip (title). clubCounts/selected değişince tazele.
  useEffect(() => {
    const el = ref.current
    if (!el || !svg) return
    const selNorm = selected ? normProvince(selected) : null
    el.querySelectorAll<SVGGElement>('[data-iladi]').forEach((g) => {
      const name = g.getAttribute('data-iladi') ?? ''
      const key = normProvince(name)
      const count = clubCounts[key] ?? 0
      g.classList.toggle('has-clubs', count > 0)
      g.classList.toggle('selected', selNorm !== null && selNorm === key)
      let title = g.querySelector('title') as SVGTitleElement | null
      if (!title) {
        title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
        g.appendChild(title)
      }
      title.textContent = count > 0 ? `${name} — ${countLabel(count)}` : name
    })
  }, [svg, clubCounts, selected, countLabel])

  function onClick(e: MouseEvent) {
    const g = (e.target as Element).closest('[data-iladi]')
    if (!g) return
    const name = g.getAttribute('data-iladi') ?? ''
    const key = normProvince(name)
    if ((clubCounts[key] ?? 0) === 0) return // kulübü olmayan il tıklanamaz
    onSelect(selected && normProvince(selected) === key ? null : name) // tekrar tıkla → temizle
  }

  if (err) return null
  return (
    // eslint-disable-next-line react/no-danger
    <div className="turkey-map" ref={ref} onClick={onClick} dangerouslySetInnerHTML={{ __html: svg }} />
  )
}
