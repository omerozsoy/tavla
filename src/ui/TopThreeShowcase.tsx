/**
 * TopThreeShowcase — ana sayfa "Top List" öne çıkan İlk-3 podyumu.
 * İki kolon: Puan (rating) ilk 3; PR ilk 3. Sıra 1/2/3 madalya rozetiyle (altın/gümüş/bronz).
 * Satıra tıklayınca profil açılır. leaderboard()/prLeaderboard() ile veri gelir; ikisi de
 * boşsa bileşen HİÇ render edilmez (misafir/az-veri durumunda ana sayfayı kirletmez).
 *
 * Tasarım: sitenin panel dili (.home-panel + .rank-row/.rank-medal/.rank-val) BİREBİR
 * kullanılır — diğer ana sayfa panelleriyle (Çevrimiçi Oyuncular / Canlı Maçlar / Sıralama)
 * görsel tutarlılık. Yalnız iki kolon düzeni topRank.css'te (.tts-cols). Bkz HomePanels.tsx.
 */
import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Icon, type IconName } from './Icon'
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

  const renderCol = (headKey: string, icon: IconName, rows: RowData[]) => (
    <div className="tts-col">
      <div className="tts-col-head">
        <Icon name={icon} size={14} weight="fill" /> {t(headKey)}
      </div>
      <div className="rank-list">
        {rows.map((r, i) => (
          <button
            key={r.id ?? i}
            type="button"
            className="rank-row"
            disabled={!r.id}
            onClick={() => r.id && onProfile(r.id)}
          >
            <span className={`rank-no rank-medal rank-medal-${i + 1}`}>{i + 1}</span>
            <span className="rank-name">
              <PlayerIdentity
                userId={r.id}
                name={r.name}
                avatar={r.avatar}
                frame={r.frame}
                size={30}
                rankSize="md"
                premium={r.premium}
                animated
              />
            </span>
            <span className="rank-val">{r.value}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <section className="home-panel tts-panel" aria-label={t('toprank.showcaseTitle')}>
      <div className="home-panel-head">
        <Icon name="crown" size={18} weight="fill" /> {t('toprank.showcaseTitle')}
      </div>
      <div className="tts-cols">
        {ratingRows.length > 0 && renderCol('toprank.ratingTop', 'ranking', ratingRows)}
        {prRows.length > 0 && renderCol('toprank.prTop', 'medal', prRows)}
      </div>
    </section>
  )
}
