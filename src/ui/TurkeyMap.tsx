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
  clubNames: Record<string, string[]> // normProvince(il) -> kulüp adları (balon listesi)
  selected: string | null // seçili il (ham ad) veya null
  onSelect: (province: string | null) => void
  countLabel: (n: number) => string // "3 kulüp" gibi (i18n)
}

// Hover balonu durumu: hangi il + kulüpleri + imleç konumu (container'a göre)
interface Balloon {
  name: string
  clubs: string[]
  x: number
  y: number
}

export default function TurkeyMap({ clubCounts, clubNames, selected, onSelect, countLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState('')
  const [err, setErr] = useState(false)
  const [balloon, setBalloon] = useState<Balloon | null>(null)

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

  // SVG yüklenince: vurgulama + seçili. clubCounts/selected değişince tazele.
  // (Native <title> tooltip kaldırıldı -> yerine imleci takip eden özel balon; ayrıca
  //  effect artık countLabel'a bağlı değil -> mousemove'da gereksiz re-run olmaz.)
  useEffect(() => {
    const el = ref.current
    if (!el || !svg) return
    const selNorm = selected ? normProvince(selected) : null
    el.querySelectorAll<SVGGElement>('[data-iladi]').forEach((g) => {
      const key = normProvince(g.getAttribute('data-iladi') ?? '')
      const count = clubCounts[key] ?? 0
      g.classList.toggle('has-clubs', count > 0)
      g.classList.toggle('selected', selNorm !== null && selNorm === key)
    })
  }, [svg, clubCounts, selected])

  function onClick(e: MouseEvent) {
    const g = (e.target as Element).closest('[data-iladi]')
    if (!g) return
    const name = g.getAttribute('data-iladi') ?? ''
    const key = normProvince(name)
    if ((clubCounts[key] ?? 0) === 0) return // kulübü olmayan il tıklanamaz
    onSelect(selected && normProvince(selected) === key ? null : name) // tekrar tıkla → temizle
  }

  // İmleç konumunu container'a göre hesapla (balon yerleşimi için)
  function localXY(e: MouseEvent): { x: number; y: number } {
    const r = ref.current?.getBoundingClientRect()
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) }
  }

  // Yapışkan hover: :hover kullanılmıyor çünkü il sınırlarında/aralarında minik fare
  // oynamasında sürekli açılıp kapanıp titriyordu. Vurguyu (+balonu) yalnızca YENİ bir
  // kulüp iline girince değiştiririz; boşluk/sınırda kaybolmaz (mouseleave'de temizlenir).
  function onOver(e: MouseEvent) {
    const g = (e.target as Element).closest('[data-iladi]')
    if (!g) return
    const name = g.getAttribute('data-iladi') ?? ''
    const key = normProvince(name)
    if ((clubCounts[key] ?? 0) === 0) return // sadece kulübü olan iller
    const root = ref.current
    if (!root) return
    root.querySelectorAll('[data-iladi].hovered').forEach((x) => x.classList.remove('hovered'))
    g.classList.add('hovered')
    const { x, y } = localXY(e)
    setBalloon({ name, clubs: clubNames[key] ?? [], x, y })
  }
  function onMove(e: MouseEvent) {
    // Balon açıkken imleci takip etsin (içeriği değiştirmeden, sadece konum)
    setBalloon((b) => (b ? { ...b, ...localXY(e) } : b))
  }
  function onLeave() {
    ref.current?.querySelectorAll('[data-iladi].hovered').forEach((x) => x.classList.remove('hovered'))
    setBalloon(null)
  }

  if (err) return null
  return (
    <div
      className="turkey-map"
      ref={ref}
      onClick={onClick}
      onMouseOver={onOver}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {/* eslint-disable-next-line react/no-danger */}
      <div className="turkey-map-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      {balloon && (
        <div className="tm-balloon" style={{ left: balloon.x, top: balloon.y }}>
          <div className="tm-balloon-head">
            {balloon.name} · {countLabel(balloon.clubs.length)}
          </div>
          <ul className="tm-balloon-list">
            {balloon.clubs.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
