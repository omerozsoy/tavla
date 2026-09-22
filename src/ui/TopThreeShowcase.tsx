/**
 * TopThreeShowcase — ana sayfa "Şampiyonlar" öne çıkan İlk-3 podyumu.
 * İki kolon: Puan (rating) ilk 3 = kupa + Rating; PR ilk 3 = madalya + career_pr.
 * Sıra 1/2/3 madalya rengiyle (altın/gümüş/bronz). Satıra tıklayınca profil açılır.
 * leaderboard()/prLeaderboard() ile veri gelir (isim/avatar taşır); ikisi de boşsa
 * bileşen HİÇ render edilmez (misafir/az-veri durumunda ana sayfayı kirletmez).
 */
import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { leaderboard, prLeaderboard, type LeaderRow, type PrLeaderRow } from '../api'
import PlayerIdentity from './PlayerIdentity'
import './topRank.css'

export default function TopThreeShowcase({ onProfile }: { onProfile: (id: number) => void }) {
  const { t } = useT()
  const [rating, setRating] = useState<LeaderRow[] | null>(null)
  const [pr, setPr] = useState<PrLeaderRow[] | null>(null)

  useEffect(() => {
    let alive = true
    leaderboard(3, 'rating')
      .then((r) => alive && setRating(r.slice(0, 3)))
      .catch(() => {})
    prLeaderboard(3)
      .then((r) => alive && setPr((r.players ?? []).slice(0, 3)))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const hasRating = (rating?.length ?? 0) > 0
  const hasPr = (pr?.length ?? 0) > 0
  if (!hasRating && !hasPr) return null

  return (
    <div className="top-three-showcase">
      <div className="tts-title">
        <Icon name="crown" size={17} weight="fill" /> {t('toprank.showcaseTitle')}
      </div>
      <div className="tts-cols">
        {hasRating && (
          <div className="tts-col">
            <div className="tts-col-head">
              <Icon name="ranking" size={15} weight="fill" /> {t('toprank.ratingTop')}
            </div>
            <div className="tts-list">
              {rating!.map((r, i) => (
                <button
                  key={r.id ?? i}
                  type="button"
                  className="tts-row"
                  data-rank={i + 1}
                  disabled={!r.id}
                  onClick={() => r.id && onProfile(r.id)}
                >
                  <span className="tts-medal">
                    <Icon name="ranking" size={18} weight="fill" />
                  </span>
                  <span className="tts-name">
                    <PlayerIdentity userId={r.id} name={r.name} avatar={r.avatar} frame={r.frame} size={26} rankSize="sm" premium={r.premium} />
                  </span>
                  <span className="tts-val">{r.rating}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {hasPr && (
          <div className="tts-col">
            <div className="tts-col-head">
              <Icon name="medal" size={15} weight="fill" /> {t('toprank.prTop')}
            </div>
            <div className="tts-list">
              {pr!.map((r, i) => (
                <button
                  key={r.id ?? i}
                  type="button"
                  className="tts-row"
                  data-rank={i + 1}
                  disabled={!r.id}
                  onClick={() => r.id && onProfile(r.id)}
                >
                  <span className="tts-medal">
                    <Icon name="medal" size={18} weight="fill" />
                  </span>
                  <span className="tts-name">
                    <PlayerIdentity userId={r.id} name={r.name} avatar={r.avatar} frame={r.frame} size={26} rankSize="sm" premium={r.premium} />
                  </span>
                  <span className="tts-val">{r.career_pr.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
