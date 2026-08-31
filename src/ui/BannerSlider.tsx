import { useEffect, useRef, useState, type TouchEvent } from 'react'
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

const ROTATE_MS = 6000

/**
 * Ana sayfa hero banner slider'i — Christie's tarzi SPLIT layout:
 * SOL panelde (duz sicak zemin) editoryal metin (kicker + serif baslik + alt metin +
 * meta + koyu dikdortgen CTA + noktalar), SAGDA gorsel. Panelden (Banner) yonetilir;
 * her banner bir turnuvaya baglidir, tiklaninca detay acilir.
 * Metin alanlari TAMAMEN bossa panel cikmaz -> gorsel tam genislikte cikplak gosterilir.
 */
export default function BannerSlider({ onOpen }: Props) {
  const [banners, setBanners] = useState<TournamentAd[]>([])
  const [i, setI] = useState(0)
  const timer = useRef<number | null>(null)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    listTournamentAds()
      .then(setBanners)
      .catch(() => {
        /* yoksay */
      })
  }, [])

  // Otomatik gecis (birden fazla banner varsa; azaltilmis hareket tercihinde durur)
  useEffect(() => {
    if (banners.length <= 1) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    timer.current = window.setInterval(() => {
      setI((p) => (p + 1) % banners.length)
    }, ROTATE_MS)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [banners.length])

  if (banners.length === 0) return null

  const go = (n: number) => setI((n + banners.length) % banners.length)
  const multi = banners.length > 1

  // Parmakla gezinme (mobil): yatay kaydirma esigi 40px
  const onTouchStart = (e: TouchEvent) => {
    touchX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: TouchEvent) => {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) < 40) return
    go(dx < 0 ? i + 1 : i - 1)
  }

  return (
    <div
      className="banner-slider"
      data-count={banners.length}
      onTouchStart={multi ? onTouchStart : undefined}
      onTouchEnd={multi ? onTouchEnd : undefined}
    >
      <div className="bs-track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {banners.map((b) => {
          const hasText = !!(b.logo || b.kicker || b.title || b.subtitle || b.meta || b.cta)
          return (
            <button
              key={b.id}
              type="button"
              className={`bs-slide${hasText ? ' has-text' : ''}`}
              onClick={() => b.tournament_id != null && onOpen(b.tournament_id)}
              disabled={b.tournament_id == null}
              aria-label={b.title || b.tournament_name || 'Banner'}
            >
              {hasText && (
                <span
                  className="bs-panel"
                  data-dark={b.panel_color && !isLightColor(b.panel_color) ? '' : undefined}
                  style={b.panel_color ? { background: b.panel_color } : undefined}
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
                          className={d === i ? 'active' : ''}
                          onClick={() => go(d)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && go(d)}
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
        })}
      </div>

      {/* Yazisiz (ciplak gorsel) bannerlarda noktalar ortada altta */}
      {multi && !banners.some((b) => b.logo || b.kicker || b.title || b.subtitle || b.meta || b.cta) && (
        <div className="bs-dots bs-dots-float">
          {banners.map((_, d) => (
            <button
              key={d}
              type="button"
              className={d === i ? 'active' : ''}
              onClick={() => go(d)}
              aria-label={`Banner ${d + 1}`}
            />
          ))}
        </div>
      )}

      {/* Sag-sol beyaz gezinme oklari (birden fazla banner) */}
      {multi && (
        <>
          <button
            type="button"
            className="bs-arrow bs-arrow-prev"
            onClick={() => go(i - 1)}
            aria-label="Önceki banner"
          >
            <Icon name="caret-left" size={22} />
          </button>
          <button
            type="button"
            className="bs-arrow bs-arrow-next"
            onClick={() => go(i + 1)}
            aria-label="Sonraki banner"
          >
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
              className={d === i ? 'active' : ''}
              onClick={() => go(d)}
              aria-label={`Banner ${d + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
