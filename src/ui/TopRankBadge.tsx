/**
 * TopRankBadge — isim yanında site geneli "top-3" rozeti.
 *   PR sıralamasında ilk 3  -> madalya ikonu (altın/gümüş/bronz)
 *   Rating sıralamasında ilk 3 -> kupa (ranking) ikonu (altın/gümüş/bronz)
 * İkisinde de ilk 3'teyse iki rozet yan yana görünür. Üzerine gelince (title)
 * "PR sıralamasında 1." gibi açıklama çıkar. Veri TopRanksProvider'dan gelir
 * (useTopRank); top-3 dışındaki oyuncuda hiçbir şey render edilmez.
 */
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useTopRank, type UserTopRank } from '../topRanks'

export default function TopRankBadge({
  userId,
  rank,
  size = 20,
  className,
}: {
  /** Oyuncu id — rozet durumu context'ten okunur. */
  userId?: number | null
  /** Alternatif: context yerine doğrudan sıra ver (id yoksa). */
  rank?: UserTopRank
  size?: number
  className?: string
}) {
  const { t } = useT()
  const fromCtx = useTopRank(userId)
  const r = rank ?? fromCtx
  const { prRank, ratingRank } = r
  if (!prRank && !ratingRank) return null

  return (
    <span className={`top-rank-badges${className ? ' ' + className : ''}`}>
      {ratingRank ? (
        <span
          className="top-rank-badge"
          data-kind="rating"
          data-rank={ratingRank}
          title={t('toprank.rating', { r: ratingRank })}
          aria-label={t('toprank.rating', { r: ratingRank })}
        >
          <Icon name="ranking" size={size} weight="fill" />
        </span>
      ) : null}
      {prRank ? (
        <span
          className="top-rank-badge"
          data-kind="pr"
          data-rank={prRank}
          title={t('toprank.pr', { r: prRank })}
          aria-label={t('toprank.pr', { r: prRank })}
        >
          <Icon name="medal" size={size} weight="fill" />
        </span>
      ) : null}
    </span>
  )
}
