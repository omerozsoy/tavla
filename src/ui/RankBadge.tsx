/**
 * RankBadge — oyuncu rütbe/rank rozeti (Emil Kowalski yaklaşımı: minimal, premium,
 * yüksek okunabilirlik, güçlü hiyerarşi, gereksiz efekt yok).
 *
 * Tek tasarım ailesi: [ICON] [RANK NAME] [SUBLEVEL]. Üç varyant:
 *   compact  — dar alanlar / oyuncu listeleri:  [icon] M2
 *   standard — profil, leaderboard:              [icon] Master M2
 *   featured — profil detayı / progression:      büyük ikon + ad + kod + eşik
 *
 * Renk/yüzey CSS token'larından gelir (--rank-*); burada renk hard-code YOK.
 * İkon SADECE Phosphor'dur (ranks.ts). Weight rütbeyle birlikte kontrollü artar.
 */

import { useT } from '../i18n'
import { rankOf, rankByFamily, type RankFamily, type RankTier } from '../ranks'

export type RankVariant = 'compact' | 'standard' | 'featured'
export type RankSize = 'sm' | 'md' | 'lg'

export interface RankBadgeProps {
  /** Rating verilirse kademe otomatik çözülür (rank/level'e göre önceliklidir). */
  rating?: number
  /** Aile (rating verilmediyse). */
  rank?: RankFamily
  /** Alt-seviye kodu, ör. 'M2' (rating verilmediyse). */
  level?: string | null
  variant?: RankVariant
  size?: RankSize
  /** featured'da rating eşiğini göster (ör. "2100+"). Varsayılan: featured'da açık. */
  showRating?: boolean
  /** Aile adını göster (compact'te varsayılan kapalı, diğerlerinde açık). */
  showLabel?: boolean
  className?: string
  title?: string
}

// featured için okunur rating eşiği metni ("1550+"; Rookie için "0+").
function threshold(t: RankTier): string {
  return `${t.min}+`
}

export function RankBadge({
  rating,
  rank,
  level,
  variant = 'standard',
  size = 'md',
  showRating,
  showLabel,
  className,
  title,
}: RankBadgeProps) {
  const { t } = useT()

  const tier: RankTier | undefined =
    rating != null ? rankOf(rating) : rankByFamily(rank ?? 'rookie', level)
  if (!tier) return null

  const familyName = t(tier.familyKey)
  const label = tier.code ? `${familyName} ${tier.code}` : familyName

  const wantLabel = showLabel ?? variant !== 'compact'
  const wantRating = showRating ?? variant === 'featured'

  // Icon boyutu: konteyner ~24-28px; ikon boyutu varyant + size'a göre.
  const iconSize = variant === 'featured' ? 26 : size === 'sm' ? 15 : 17

  const Icon = tier.Icon

  return (
    <span
      className={`rank-badge${className ? ' ' + className : ''}`}
      data-family={tier.family}
      data-tier={tier.tier}
      data-variant={variant}
      data-size={size}
      {...(tier.special ? { 'data-special': '' } : {})}
      {...(tier.apex ? { 'data-apex': '' } : {})}
      title={title ?? label}
      aria-label={label}
    >
      <span className="rank-badge__icon" aria-hidden="true">
        <Icon size={iconSize} weight={tier.weight} />
      </span>

      {variant === 'compact' ? (
        // compact: kod varsa kod; taban rütbelerde kısa aile adı
        <span className="rank-badge__code">{tier.code ?? familyName}</span>
      ) : (
        <span className="rank-badge__text">
          {wantLabel && <span className="rank-badge__name">{familyName}</span>}
          <span className="rank-badge__row">
            {tier.code && <span className="rank-badge__code">{tier.code}</span>}
            {wantRating && <span className="rank-badge__req">{threshold(tier)}</span>}
          </span>
        </span>
      )}
    </span>
  )
}
