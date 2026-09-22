/**
 * TopThreeShowcase — ana sayfa "Top List" öne çıkan İlk-3 podyumu (tam sayfa genişliği).
 * İki kolon: Puan (rating) ilk 3; PR ilk 3. Sıra 1/2/3 madalya rengiyle (altın/gümüş/bronz).
 * Satıra tıklayınca profil açılır. leaderboard()/prLeaderboard() ile veri gelir; ikisi de
 * boşsa bileşen HİÇ render edilmez (misafir/az-veri durumunda ana sayfayı kirletmez).
 *
 * Tasarım (Emil Kowalski craft): rafine easing, subtle hover, :active scale geri bildirimi,
 * satırlarda stagger giriş (yalnız transform/opacity), reduced-motion saygısı. Bkz topRank.css.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { leaderboard, prLeaderboard, type LeaderRow, type PrLeaderRow } from '../api'
import PlayerIdentity from './PlayerIdentity'
import './topRank.css'

interface RowData {
  id?: number
  name: string
  avatar?: string | null
  frame?: string | null
  premium?: boolean
  value: string
}

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

  const ratingRows: RowData[] = (rating ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    frame: r.frame,
    premium: r.premium,
    value: String(r.rating),
  }))
  const prRows: RowData[] = (pr ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    avatar: r.avatar,
    frame: r.frame,
    premium: r.premium,
    value: r.career_pr.toFixed(2),
  }))

  if (ratingRows.length === 0 && prRows.length === 0) return null

  const renderCol = (headKey: string, icon: 'ranking' | 'medal', rows: RowData[]) => (
    <div className="tts-col">
      <div className="tts-col-head">
        <Icon name={icon} size={14} weight="fill" /> {t(headKey)}
      </div>
      <div className="tts-list">
        {rows.map((r, i) => (
          <button
            key={r.id ?? i}
            type="button"
            className="tts-row"
            data-rank={i + 1}
            style={{ '--i': i } as CSSProperties}
            disabled={!r.id}
            onClick={() => r.id && onProfile(r.id)}
          >
            <span className="tts-rank" data-rank={i + 1} aria-hidden="true">
              {i + 1}
            </span>
            <span className="tts-name">
              <PlayerIdentity
                userId={r.id}
                name={r.name}
                avatar={r.avatar}
                frame={r.frame}
                size={28}
                rankSize="sm"
                premium={r.premium}
              />
            </span>
            <span className="tts-val">{r.value}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <section className="top-three-showcase" aria-label={t('toprank.showcaseTitle')}>
      <header className="tts-head">
        <span className="tts-title">
          <Icon name="crown" size={16} weight="fill" /> {t('toprank.showcaseTitle')}
        </span>
      </header>
      <div className="tts-cols">
        {ratingRows.length > 0 && renderCol('toprank.ratingTop', 'ranking', ratingRows)}
        {prRows.length > 0 && renderCol('toprank.prTop', 'medal', prRows)}
      </div>
    </section>
  )
}
