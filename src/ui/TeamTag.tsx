/**
 * TeamTag — isim yanında site geneli TAKIM AMBLEMİ (kalkan). Veri TeamTagsProvider'dan
 * (useTeamTag, userId); takımsız oyuncuda hiçbir şey render edilmez. RoleBadge deseni ([[RoleBadge.tsx]]).
 * Logo varsa kalkana kırpılır, yoksa takım renkleri + tag harfleri. Tıklama derin-linki üst bileşenin işi.
 */
import { type CSSProperties } from 'react'
import { useTeamTag } from '../teamTags'
import { TeamEmblem } from './TeamsView'

export default function TeamTag({
  userId,
  size = 20,
  className,
  style,
}: {
  userId?: number | null
  size?: number
  className?: string
  style?: CSSProperties
}) {
  const info = useTeamTag(userId)
  if (!info) return null

  return (
    <span
      className={`team-tag${className ? ' ' + className : ''}`}
      title={info.tag}
      style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4, verticalAlign: 'middle', ...style }}
    >
      <TeamEmblem color1={info.color1} color2={info.color2} logo={info.logo || undefined} label={info.tag} size={size} />
    </span>
  )
}
