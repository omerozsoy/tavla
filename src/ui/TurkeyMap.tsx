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
    .replace(/\s*\(.*?\)\s*/g, '') // "İstanbul (Asya)" / "(Avrupa)" -> "İstanbul" (SVG İstanbul'u ikiye böler)
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

  // Yapışkan hover: :hover kullanılmıyor çünkü il sınırlarında/aralarında minik fare
  // oynamasında sürekli açılıp kapanıp titriyordu. Vurguyu (+balonu) yalnızca YENİ bir
  // kulüp iline girince değiştiririz; boşluk/sınırda kaybolmaz (mouseleave'de temizlenir).
  // Balon imleci takip ETMEZ -> ilin üst-ortasında sabit durur.
  function onOver(e: MouseEvent) {
    const g = (e.target as Element).closest('[data-iladi]')
    if (!g) return
    const key = normProvince(g.getAttribute('data-iladi') ?? '')
    if ((clubCounts[key] ?? 0) === 0) return // sadece kulübü olan iller
    const root = ref.current
    if (!root) return
    root.querySelectorAll('[data-iladi].hovered').forEach((x) => x.classList.remove('hovered'))
    // Aynı ile ait TÜM parçaları birlikte vurgula (İstanbul: Asya + Avrupa)
    const parts: Element[] = []
    root.querySelectorAll('[data-iladi]').forEach((x) => {
      if (normProvince(x.getAttribute('data-iladi') ?? '') === key) {
        x.classList.add('hovered')
        parts.push(x)
      }
    })
    // Balonu parçaların BİRLEŞİK bounding box'ının üst-ortasına sabitle (container'a göre)
    const cr = root.getBoundingClientRect()
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    parts.forEach((x) => {
      const b = x.getBoundingClientRect()
      left = Math.min(left, b.left)
      top = Math.min(top, b.top)
      right = Math.max(right, b.right)
    })
    const display = (g.getAttribute('data-iladi') ?? '').replace(/\s*\(.*?\)\s*/g, '').trim()
    setBalloon({
      name: display,
      clubs: clubNames[key] ?? [],
      x: (left + right) / 2 - cr.left,
      y: top - cr.top,
    })
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
