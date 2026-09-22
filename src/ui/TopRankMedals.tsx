/**
 * TopRankMedals — profil kartında BELİRGİN top-3 madalya bloğu (isim yanındaki küçük
 * TopRankBadge'in etiketli/büyük hâli). PR ilk 3 -> madalya, Rating ilk 3 -> kupa;
 * her biri "PR Sıralaması #1" gibi etiketle. Veri TopRanksProvider'dan (useTopRank);
 * oyuncu top-3 değilse HİÇBİR ŞEY render edilmez (yer kaplamaz).
 */
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useTopRank } from '../topRanks'
import './topRank.css'

export default function TopRankMedals({
  userId,
  className,
}: {
  userId?: number | null
  className?: string
}) {
  const { t } = useT()
  const { prRank, ratingRank } = useTopRank(userId)
  if (!prRank && !ratingRank) return null

  return (
    <div className={`top-rank-medals${className ? ' ' + className : ''}`}>
      {ratingRank ? (
        <span className="trm-chip" data-rank={ratingRank} title={t('toprank.rating', { r: ratingRank })}>
          <Icon name="ranking" size={20} weight="fill" />
          <span className="trm-text">
            <b>{t('toprank.ratingMedal')}</b>
            <em>#{ratingRank}</em>
          </span>
        </span>
      ) : null}
      {prRank ? (
        <span className="trm-chip" data-rank={prRank} title={t('toprank.pr', { r: prRank })}>
          <Icon name="medal" size={20} weight="fill" />
          <span className="trm-text">
            <b>{t('toprank.prMedal')}</b>
            <em>#{prRank}</em>
          </span>
        </span>
      ) : null}
    </div>
  )
}
