import { Icon } from './Icon'
import { useT } from '../i18n'
import './SocialTabs.css'

export type SocialTab = 'friends' | 'messages'

/**
 * Arkadaşlar + Mesajlar birleşik sayfasının üst sekme çubuğu. Friends/Messages bileşenlerinin
 * kendi <h2> başlığının YERİNE render edilir (onTab verilince). Tıklama App'te ilgili modal'ı
 * açar (karşılıklı-dışlar) -> aynı sayfada tab geçişi + URL /arkadaslar<->/mesajlar güncellenir.
 */
export default function SocialTabs({
  active,
  onTab,
  messagesBadge = 0,
}: {
  active: SocialTab
  onTab: (t: SocialTab) => void
  messagesBadge?: number
}) {
  const { t } = useT()
  const tab = (id: SocialTab, icon: 'users' | 'chat', label: string, badge = 0) => (
    <button
      type="button"
      role="tab"
      aria-selected={active === id}
      className={`social-tab ${active === id ? 'is-active' : ''}`}
      onClick={() => active !== id && onTab(id)}
    >
      <Icon name={icon} size={18} />
      <span>{label}</span>
      {badge > 0 && <span className="social-tab-badge">{badge > 99 ? '99+' : badge}</span>}
    </button>
  )
  return (
    <div className="social-tabs" role="tablist">
      {tab('friends', 'users', t('friends.title'))}
      {tab('messages', 'chat', t('dm.title'), messagesBadge)}
    </div>
  )
}
