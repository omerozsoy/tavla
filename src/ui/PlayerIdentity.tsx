import AvatarFrame from './AvatarFrame'
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
  size?: number
  rankSize?: 'sm' | 'md'
  animated?: boolean
  lg?: boolean
  className?: string
}) {
  return (
    <span className={`player-id${lg ? ' lg' : ''}${className ? ' ' + className : ''}`}>
      <AvatarFrame src={avatar} frame={frame} size={size} name={name} animated={animated} />
      <span className="player-id-col">
        <span className="player-id-name">{name}</span>
        {rating != null && <DivisionChip rating={rating} size={rankSize} />}
      </span>
    </span>
  )
}
