import { useEffect, useState } from 'react'
import { listTournamentAds, type TournamentAd } from '../api'

interface Props {
  /** Reklama tiklaninca bagli turnuvanin detayini ac. */
  onOpen: (tournamentId: number) => void
}

// Gorsel yolu: tam URL / mutlak yol ise oldugu gibi; ciplak yol ise panelden yuklenmis -> /uploads/
function srcOf(img: string): string {
  return /^(https?:|\/)/.test(img) ? img : '/uploads/' + img
}

/**
 * Ana sayfanin en ustunde yan yana (en fazla 3) turnuva reklam gorseli seridi.
 * Panelden (Turnuva Reklam) yonetilir; her gorsel bir turnuvaya baglidir.
 */
export default function TournamentAds({ onOpen }: Props) {
  const [ads, setAds] = useState<TournamentAd[]>([])

  useEffect(() => {
    listTournamentAds()
      .then(setAds)
      .catch(() => {
        /* yoksay */
      })
  }, [])

  if (ads.length === 0) return null

  return (
    <div className="tourn-ads" data-count={ads.length}>
      {ads.map((ad) => (
        <button
          key={ad.id}
          type="button"
          className="tourn-ad"
          onClick={() => ad.tournament_id != null && onOpen(ad.tournament_id)}
          disabled={ad.tournament_id == null}
          title={ad.tournament_name ?? undefined}
        >
          <img src={srcOf(ad.image)} alt={ad.tournament_name ?? ''} loading="lazy" />
        </button>
      ))}
    </div>
  )
}
