/**
 * RoleBadge — isim yanında site geneli ROL kalkanı.
 *   Yönetici (is_admin)  -> dolu KİREMİT kalkan (#A83A2B), hover "Yönetici"
 *   Destek   (is_support) -> dolu ŞEFTALİ kalkan (#ffa093), hover "Destek"
 * Veri RolesProvider'dan gelir (useRole); rolü olmayan oyuncuda hiçbir şey render
 * edilmez. Premium tacı gösterilen her yere userId ile eklenir -> [[TopRankBadge]] deseni.
 * İstersen userId yerine admin/support bayraklarını doğrudan ver (override).
 */
import { type CSSProperties } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useRole } from '../roles'

export default function RoleBadge({
  userId,
  admin: adminProp,
  support: supportProp,
  size = 18,
  className,
  style,
}: {
  /** Oyuncu id — rol durumu context'ten okunur. */
  userId?: number | null
  /** Alternatif: context yerine doğrudan ver (id yoksa). */
  admin?: boolean
  support?: boolean
  size?: number
  className?: string
  style?: CSSProperties
}) {
  const { t } = useT()
  const fromCtx = useRole(userId)
  const admin = adminProp ?? fromCtx.admin
  const support = supportProp ?? fromCtx.support
  if (!admin && !support) return null

  return (
    <span className={`role-badges${className ? ' ' + className : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, ...style }}>
      {admin && (
        <span
          className="role-badge role-badge--admin"
          role="img"
          aria-label={t('role.admin')}
          title={t('role.admin')}
          style={{ color: '#A83A2B', display: 'inline-flex' }}
        >
          <Icon name="shield-check" size={size} weight="fill" />
        </span>
      )}
      {support && (
        <span
          className="role-badge role-badge--support"
          role="img"
          aria-label={t('role.support')}
          title={t('role.support')}
          style={{ color: '#ffa093', display: 'inline-flex' }}
        >
          <Icon name="shield-check" size={size} weight="fill" />
        </span>
      )}
    </span>
  )
}
