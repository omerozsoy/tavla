import { useT } from '../i18n'
import { Icon } from './Icon'
import { BADGE_MAP, divisionOf } from '../badges'

// Rating'e gore lig/division rozeti (ikon + ad, renk)
export function DivisionChip({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const { t } = useT()
  const d = divisionOf(rating)
  return (
    <span className={`division-chip ${size}`} style={{ color: d.color }} title={t(d.key)}>
      <Icon name={d.icon} size={size === 'sm' ? 13 : 15} />
      {size !== 'sm' && <span className="dc-name">{t(d.key)}</span>}
    </span>
  )
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
