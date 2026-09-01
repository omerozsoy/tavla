import AvatarFrame from './AvatarFrame'
import { CountryFlag } from './Flag'
import { DivisionChip } from './Badges'

/**
 * PlayerIdentity — site geneli tek oyuncu kimlik blogu: avatar + isim (ustte) +
 * rutbe (isim ALTINDA, ince/kibar altbaslik). Liderlik, canli maclar, profil vb.
 * her yerde ayni gorunum icin tek kaynak. Rutbe rozeti stili .player-id .rank-badge
 * ile sadelestirilir (Emil: renk yalniz aksan, ad koyu, rutbe muted).
 */
export default function PlayerIdentity({
  name,
  rating,
  avatar,
  frame,
  country,
  size = 30,
  rankSize = 'md',
  animated = false,
  lg = false,
  className,
}: {
  name: string
  rating?: number | null
  avatar?: string | null
  frame?: string | null
  country?: string | null
  size?: number
  rankSize?: 'sm' | 'md'
  animated?: boolean
  lg?: boolean
  className?: string
}) {
  // Bayrak boyutu avatara oranli (mini-avatar rozeti); kucuk avatarda bile okunur kalsin.
  const flagSize = Math.max(16, Math.round(size * 0.52))
  return (
    <span className={`player-id${lg ? ' lg' : ''}${className ? ' ' + className : ''}`}>
      <span className="player-id-avatar">
        <AvatarFrame src={avatar} frame={frame} size={size} name={name} animated={animated} />
        {country && <CountryFlag code={country} size={flagSize} className="player-id-flag" />}
      </span>
      <span className="player-id-col">
        <span className="player-id-name">{name}</span>
        {rating != null && <DivisionChip rating={rating} size={rankSize} />}
      </span>
    </span>
  )
}
