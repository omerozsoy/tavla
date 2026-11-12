/**
 * TeamTag — isim yanında site geneli TAKIM AMBLEMİ (kalkan). Veri TeamTagsProvider'dan
 * (useTeamTag, userId); takımsız oyuncuda hiçbir şey render edilmez. RoleBadge deseni ([[RoleBadge.tsx]]).
 * Logo varsa kalkana kırpılır, yoksa takım renkleri + tag harfleri. Tıklama derin-linki üst bileşenin işi.
 */
import { type CSSProperties } from 'react'
import { useTeamTag } from '../teamTags'
import { TeamEmblem } from './TeamEmblem'

export default function TeamTag({
  userId,
  size = 24,
  className,
  style,
  showName = false,
}: {
  userId?: number | null
  size?: number
  className?: string
  style?: CSSProperties
  showName?: boolean // amblemin yanına takım adını minik yazıyla ekle (varsayılan kapalı)
}) {
  const info = useTeamTag(userId)
  if (!info) return null

  return (
    <span
      className={`team-tag${className ? ' ' + className : ''}`}
      title={info.name || info.tag}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 4, verticalAlign: 'middle', ...style }}
    >
      <TeamEmblem color1={info.color1} color2={info.color2} logo={info.logo || undefined} label={info.tag} size={size} />
      {showName && info.name && (
        <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>{info.name}</span>
      )}
    </span>
  )
}
