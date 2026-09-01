import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import { listTournamentAds, type TournamentAd } from '../api'
import { Icon } from './Icon'

interface Props {
  /** Banner'a tiklaninca bagli turnuvanin detayini ac. */
  onOpen: (tournamentId: number) => void
}

// Gorsel yolu: tam URL / mutlak yol ise oldugu gibi; ciplak yol ise panelden yuklenmis -> /uploads/
function srcOf(img: string): string {
  return /^(https?:|\/)/.test(img) ? img : '/uploads/' + img
}

// Secilen panel renginin acik mi koyu mu oldugu -> metin rengini otomatik ayarla (okunabilirlik).
function isLightColor(hex?: string | null): boolean {
  if (!hex) return true // varsayilan krem = acik
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return true
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  // algilanan parlaklik (0..255)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 150
}

const ROTATE_MS = 6000 // otomatik gecis araligi (editoryal metin okunacak kadar)
const DURATION = 560 // kayma animasyonu suresi (ms)

/**
 * Ana sayfa hero banner slider'i — Christie's tarzi SPLIT layout:
 * SOL panelde (duz sicak zemin) editoryal metin (kicker + serif baslik + alt metin +
 * meta + koyu dikdortgen CTA + noktalar), SAGDA gorsel. Panelden (Banner) yonetilir.
 *
 * Kayma motoru = CodePen "Responsive Image Slider" (dfitzy) sistemi, jQuery yerine
 * React ile: HER gecis TEK ADIMLIK yonlu kayma. Sonraki -> yeni slayt SAGDAN girer,
 * mevcut SOLA cikar; onceki -> tam tersi. Uzak bir noktaya tiklanınca aradaki
 * slaytlarin uzerinden supurmez; dogrudan tek kayisla gelir.
 */
export default function BannerSlider({ onOpen }: Props) {
  const [banners, setBanners] = useState<TournamentAd[]>([])
  const [current, setCurrent] = useState(0)
  // Devam eden gecis: hedef indeks + yon (1=ileri/sagdan, -1=geri/soldan) + faz.
  // 'enter' = slaytlar baslangic konumuna (gecissiz) yerlesir; 'run' = son konuma animasyon.
  const [anim, setAnim] = useState<{ to: number; dir: 1 | -1; phase: 'enter' | 'run' } | null>(null)
  const touchX = useRef<number | null>(null)
  const reducedRef = useRef(false)

  useEffect(() => {
    reducedRef.current = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    listTournamentAds()
      .then(setBanners)
      .catch(() => {
        /* yoksay */
      })
  }, [])

  const multi = banners.length > 1
  const animating = anim !== null

  // Tek adimlik yonlu kaymayi baslat.
  const startMove = (to: number, dir: 1 | -1) => {
    if (animating || !multi || to === current || to < 0 || to >= banners.length) return
    if (reducedRef.current) {
      setCurrent(to) // hareket azalt: aninda gec
      return
    }
    setAnim({ to, dir, phase: 'enter' })
  }
  const next = () => startMove((current + 1) % banners.length, 1)
  const prev = () => startMove((current - 1 + banners.length) % banners.length, -1)
  const goTo = (d: number) => d !== current && startMove(d, d > current ? 1 : -1)

  // enter -> run: iki rAF sonra son konuma gecis (baslangic konumu bir kare boyanir).
  useEffect(() => {
    if (anim?.phase !== 'enter') return
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setAnim((a) => (a && a.phase === 'enter' ? { ...a, phase: 'run' } : a))),
    )
    return () => cancelAnimationFrame(id)
  }, [anim])

  // run bitince (DURATION) hedefi kesinlestir.
  useEffect(() => {
    if (anim?.phase !== 'run') return
    const t = window.setTimeout(() => {
      setCurrent(anim.to)
      setAnim(null)
    }, DURATION)
    return () => window.clearTimeout(t)
  }, [anim])

  // Otomatik gecis: animasyon yokken her ROTATE_MS'de bir ileri (current degisince saat sifirlanir).
  useEffect(() => {
    if (!multi || animating || reducedRef.current) return
    const t = window.setTimeout(() => startMove((current + 1) % banners.length, 1), ROTATE_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, animating, multi, banners.length])

  if (banners.length === 0) return null

  // Parmakla gezinme (mobil): yatay kaydirma esigi 40px
  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 40) return
    dx < 0 ? next() : prev()
  }

  // Bir slaytin translateX konumu (yuzde) + gecis. role: mevcut mu, giren mi.
  const transformFor = (role: 'current' | 'incoming'): CSSProperties => {
    if (!anim) return { transform: 'translateX(0)' }
    const run = anim.phase === 'run'
    const transition = run ? `transform ${DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none'
    let x: number
    if (role === 'current') x = run ? (anim.dir === 1 ? -100 : 100) : 0
    else x = run ? 0 : anim.dir === 1 ? 100 : -100
    return { transform: `translateX(${x}%)`, transition }
  }

  // Tek bir slaytin ic yapisi (tasarim ayni: sol panel + sag gorsel). role -> konum stili.
  const renderSlide = (b: TournamentAd, role: 'current' | 'incoming') => {
    const hasText = !!(b.logo || b.kicker || b.title || b.subtitle || b.meta || b.cta)
    return (
      <button
        key={`${role}-${b.id}`}
        type="button"
        className={`bs-slide${hasText ? ' has-text' : ''}${role === 'incoming' ? ' is-incoming' : ''}`}
        style={transformFor(role)}
        onClick={() => !animating && b.tournament_id != null && onOpen(b.tournament_id)}
        disabled={b.tournament_id == null}
        aria-label={b.title || b.tournament_name || 'Banner'}
        aria-hidden={role === 'incoming' ? true : undefined}
      >
        {hasText && (
          <span
            className="bs-panel"
            // Renk secilmemisse varsayilan SIYAH (sonradan admin panelden degistirilir).
            // Siyah koyu oldugu icin data-dark ile metin otomatik beyaza doner.
            data-dark={!isLightColor(b.panel_color || '#111111') ? '' : undefined}
            style={{ background: b.panel_color || '#111111' }}
          >
            {b.logo && <img className="bs-logo" src={srcOf(b.logo)} alt="" loading="lazy" />}
            {b.kicker && <span className="bs-kicker">{b.kicker}</span>}
            {b.title && <span className="bs-title">{b.title}</span>}
            {b.subtitle && <span className="bs-sub">{b.subtitle}</span>}
            {b.meta && (
              <span className="bs-meta">
                <Icon name="calendar" size={15} /> {b.meta}
              </span>
            )}
            {b.cta && <span className="bs-cta">{b.cta}</span>}
            {/* Noktalar sol panelin altinda (Christie's gibi) */}
            {multi && (
              <span className="bs-dots" onClick={(e) => e.stopPropagation()}>
                {banners.map((_, d) => (
                  <span
                    key={d}
                    role="button"
                    tabIndex={0}
                    aria-label={`Banner ${d + 1}`}
                    className={d === current ? 'active' : ''}
                    onClick={() => goTo(d)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && goTo(d)}
                  />
                ))}
              </span>
            )}
          </span>
        )}
        <span className="bs-media">
          <img src={srcOf(b.image)} alt={b.title || b.tournament_name || ''} loading="lazy" />
        </span>
      </button>
    )
  }

  const noneHaveText = !banners.some((b) => b.logo || b.kicker || b.title || b.subtitle || b.meta || b.cta)

  return (
    <div
      className="banner-slider"
      data-count={banners.length}
      onTouchStart={multi ? onTouchStart : undefined}
      onTouchEnd={multi ? onTouchEnd : undefined}
    >
      {/* Gorus penceresi: mevcut slayt akista (yuksekligi verir), giren slayt ustune mutlak biner */}
      <div className="bs-viewer">
        {renderSlide(banners[current], 'current')}
        {anim && renderSlide(banners[anim.to], 'incoming')}
      </div>

      {/* Yazisiz (ciplak gorsel) bannerlarda noktalar ortada altta */}
      {multi && noneHaveText && (
        <div className="bs-dots bs-dots-float">
          {banners.map((_, d) => (
            <button
              key={d}
              type="button"
              className={d === current ? 'active' : ''}
              onClick={() => goTo(d)}
              aria-label={`Banner ${d + 1}`}
            />
          ))}
        </div>
      )}

      {/* Sag-sol beyaz gezinme oklari (birden fazla banner) */}
      {multi && (
        <>
          <button type="button" className="bs-arrow bs-arrow-prev" onClick={prev} aria-label="Önceki banner">
            <Icon name="caret-left" size={22} />
          </button>
          <button type="button" className="bs-arrow bs-arrow-next" onClick={next} aria-label="Sonraki banner">
            <Icon name="caret-right" size={22} />
          </button>
        </>
      )}

      {/* Mobilde her zaman altta noktalar (parmakla gezinme gostergesi) */}
      {multi && (
        <div className="bs-dots bs-dots-mobile">
          {banners.map((_, d) => (
            <button
              key={d}
              type="button"
              className={d === current ? 'active' : ''}
              onClick={() => goTo(d)}
              aria-label={`Banner ${d + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
