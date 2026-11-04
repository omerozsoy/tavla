/**
 * TeamTag — isim yanında site geneli TAKIM ETİKETİ rozeti (ör. KRT). Veri TeamTagsProvider'dan
 * (useTeamTag, userId); takımsız oyuncuda hiçbir şey render edilmez. RoleBadge deseni ([[RoleBadge.tsx]]).
 * userId yerine doğrudan tag verilebilir (override). Tıklanınca takım sayfasına gitmek isteğe bağlıdır
 * (burada salt görsel; derin-link üst bileşenin işi).
 */
import { type CSSProperties } from 'react'
import { useTeamTag } from '../teamTags'

export default function TeamTag({
  userId,
  tag: tagProp,
  size = 11,
  className,
  style,
}: {
  userId?: number | null
  tag?: string | null
  size?: number
  className?: string
  style?: CSSProperties
}) {
  const fromCtx = useTeamTag(userId)
  const tag = tagProp ?? fromCtx
  if (!tag) return null

  return (
    <span
      className={`team-tag${className ? ' ' + className : ''}`}
      title={tag}
      style={{
        display: 'inline-block',
        padding: '0 5px',
        marginLeft: 4,
        borderRadius: 5,
        background: 'var(--med-terracotta-dark, #A83A2B)',
        color: '#fff',
        fontSize: size,
        fontWeight: 700,
        lineHeight: 1.6,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {tag}
    </span>
  )
}
