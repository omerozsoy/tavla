import { useT } from '../i18n'
import { Icon } from './Icon'
import { BADGE_MAP } from '../badges'
import { RankBadge } from './RankBadge'

// Rating'e gore rutbe rozeti. Yeni RankBadge tasarim sistemine koprudur; mevcut
// cagri yerleri (Leaderboard/PublicProfile/ProfileStats) degismeden yeni gorunumu alir.
// size 'sm' -> compact ([icon] M2), 'md' -> standard ([icon] Master M2).
export function DivisionChip({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  return <RankBadge rating={rating} variant={size === 'sm' ? 'compact' : 'standard'} size={size} />
}

// Kazanilmis rozetler listesi (bos ise mesaj)
export function BadgeList({ ids }: { ids?: string[] }) {
  const { t } = useT()
  const known = (ids ?? []).map((id) => BADGE_MAP[id]).filter(Boolean)
  return (
    <div className="badge-section">
      <div className="badge-head">
        <Icon name="medal" size={15} /> {t('badges.title')}
      </div>
      {known.length === 0 ? (
        <div className="badge-empty">{t('badges.empty')}</div>
      ) : (
        <div className="badge-grid">
          {known.map((b) => (
            <span key={b.id} className="badge-item" title={t(b.key)}>
              <Icon name={b.icon} size={18} />
              <span className="badge-name">{t(b.key)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
