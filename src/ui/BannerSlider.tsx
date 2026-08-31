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

const ROTATE_MS = 5000

/**
 * Ana sayfanin en ustunde tam genislikte donen banner slider'i (carousel).
 * Panelden (Banner) yonetilir; her banner bir turnuvaya baglidir, tiklaninca detay acilir.
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
        {banners.map((b) => (
          <button
            key={b.id}
            type="button"
            className="bs-slide"
            onClick={() => b.tournament_id != null && onOpen(b.tournament_id)}
            disabled={b.tournament_id == null}
            title={b.tournament_name ?? undefined}
          >
            <img src={srcOf(b.image)} alt={b.tournament_name ?? ''} loading="lazy" />
          </button>
        ))}
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
