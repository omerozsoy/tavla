import { useT } from '../i18n'
import { Icon } from './Icon'
import { BADGE_MAP } from '../badges'
import { RankBadge } from './RankBadge'

// Rating'e gore rutbe rozeti. Yeni RankBadge tasarim sistemine koprudur; mevcut
// cagri yerleri (Leaderboard/PublicProfile/ProfileStats) degismeden yeni gorunumu alir.
// DAIMA standard: TAM isim gosterilir ("Intermediate I1"); size yalniz ikon olcegini
// belirler (sm=kucuk ikon + tam isim, md=buyuk). Kisa kod (sadece "I1") artik yok.
export function DivisionChip({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  return <RankBadge rating={rating} variant="standard" size={size} />
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
