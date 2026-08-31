import { useEffect, useRef, useState } from 'react'
import { listTournamentAds, type TournamentAd } from '../api'

interface Props {
  /** Banner'a tiklaninca bagli turnuvanin detayini ac. */
  onOpen: (tournamentId: number) => void
}

// Gorsel yolu: tam URL / mutlak yol ise oldugu gibi; ciplak yol ise panelden yuklenmis -> /uploads/
function srcOf(img: string): string {
  return /^(https?:|\/)/.test(img) ? img : '/uploads/' + img
}

const ROTATE_MS = 6000

/**
 * Ana sayfanin en ustunde tam genislikte (edge-to-edge) hero banner slider'i —
 * Christie's tarzi: buyuk gorsel + sol-alta editoryal metin bindirmesi (kicker/baslik/
 * alt metin/CTA) + gradient scrim. Panelden (Banner) yonetilir; her banner bir turnuvaya
 * baglidir, tiklaninca detay acilir. Metin alanlari bossa gorsel ciplak gosterilir.
 */
export default function BannerSlider({ onOpen }: Props) {
  const [banners, setBanners] = useState<TournamentAd[]>([])
  const [i, setI] = useState(0)
  const timer = useRef<number | null>(null)

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

  return (
    <div className="banner-slider" data-count={banners.length}>
      <div className="bs-track" style={{ transform: `translateX(-${i * 100}%)` }}>
        {banners.map((b) => {
          const hasText = !!(b.kicker || b.title || b.subtitle || b.cta)
          return (
            <button
              key={b.id}
              type="button"
              className="bs-slide"
              onClick={() => b.tournament_id != null && onOpen(b.tournament_id)}
              disabled={b.tournament_id == null}
              aria-label={b.title || b.tournament_name || 'Banner'}
            >
              <img src={srcOf(b.image)} alt={b.title || b.tournament_name || ''} loading="lazy" />
              {hasText && (
                <>
                  <span className="bs-scrim" aria-hidden="true" />
                  <span className="bs-content">
                    {b.kicker && <span className="bs-kicker">{b.kicker}</span>}
                    {b.title && <span className="bs-title">{b.title}</span>}
                    {b.subtitle && <span className="bs-sub">{b.subtitle}</span>}
                    {b.cta && (
                      <span className="bs-cta">
                        {b.cta} <span aria-hidden="true">→</span>
                      </span>
                    )}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </div>

      {banners.length > 1 && (
        <>
          <button
            type="button"
            className="bs-arrow bs-prev"
            onClick={() => go(i - 1)}
            aria-label="Önceki banner"
          >
            ‹
          </button>
          <button
            type="button"
            className="bs-arrow bs-next"
            onClick={() => go(i + 1)}
            aria-label="Sonraki banner"
          >
            ›
          </button>
          <div className="bs-dots">
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
        </>
      )}
    </div>
  )
}
