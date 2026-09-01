import { useState, type CSSProperties } from 'react'
import { Icon, type IconName } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import ProfileStats from './ProfileStats'
import AvatarFrame from './AvatarFrame'
import { Flag } from './Flag'
import SetupBoard from './SetupBoard'
import MembershipCard from './MembershipCard'
import { Button } from '@/components/ui/button'
import { countryName } from '../countries'
import { type AvatarFrameDef } from './avatarFrames'
import { RARITY_COLORS } from './rarityColors'
import type { ServerUser, AppNotification } from '../api'

// Bildirim ikon adi -> gecerli Icon adi (bilinmeyen -> bell)
const NOTIF_ICON: Record<string, IconName> = {
  bell: 'bell', crown: 'crown', medal: 'medal', star: 'star', trophy: 'trophy', coin: 'coin',
}

// Sahip olunan tahta/cerceve icin gevsek tip (App'ten gelir)
interface BoardOpt {
  id: string
  name: string
  panel?: string
  a: string
  b: string
  checker?: string
  light?: string
  price?: number
  rarity?: string
}

interface Props {
  user: ServerUser
  avatar?: string | null
  boardTheme: string
  ownedBoards: BoardOpt[]
  ownedFrames: AvatarFrameDef[]
  onEdit: () => void
  onLogout?: () => void
  onSelectBoard?: (id: string) => void // profilden tahta rengi değiştir
  onSelectFrame?: (id: string | null) => void // profilden avatar çerçevesi değiştir
  onClose: () => void
  // Uyelik karti (baslikin altinda) + Bildirimler sekmesi
  onRenew?: () => void
  onToggleAutoRenew?: (enabled: boolean) => void
  notifications?: AppNotification[]
  onDeleteNotification?: (id: number) => void
  onDeleteAllNotifications?: () => void
  onOpenMatchHistory?: () => void // istatistik sekmesi -> Mac Analizleri sayfasi
}

function ageFrom(birth?: string | null): number | null {
  if (!birth) return null
  const d = new Date(birth)
  if (isNaN(d.getTime())) return null
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return a >= 0 && a < 130 ? a : null
}

export default function ProfileOverview({
  user,
  avatar,
  boardTheme,
  ownedBoards,
  ownedFrames,
  onEdit,
  onLogout,
  onSelectBoard,
  onSelectFrame,
  onClose,
  onRenew,
  onToggleAutoRenew,
  notifications,
  onDeleteNotification,
  onDeleteAllNotifications,
  onOpenMatchHistory,
}: Props) {
  const { t, lang } = useT()
  // Profil açılışında İstatistikler sekmesi varsayılan seçili
  const [tab, setTab] = useState<'frames' | 'boards' | 'stats' | 'notifs'>('stats')
  const unread = (notifications ?? []).filter((n) => !n.read).length
  useEscape(onClose)

  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.nickname
  const age = ageFrom(user.birth_date)
  const cc = (user.country || '').toLowerCase()
  const country = user.country ? countryName(user.country, lang) : ''

  const equipped = ownedBoards.find((b) => b.id === boardTheme) ?? ownedBoards[0]

  const boardVars = (b: BoardOpt): CSSProperties =>
    ({
      ['--panel']: b.panel ?? b.b,
      ['--tri-a']: b.a,
      ['--tri-b']: b.b,
      ['--navy']: b.checker ?? b.b,
      ['--cream']: b.light ?? '#f4efe6',
    }) as CSSProperties

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card prof-ov-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>

        {/* --- Kimlik + kusanili tahta --- */}
        <div className="prof-ov-top">
          <div className="prof-ov-id">
            <AvatarFrame src={avatar} frame={user.avatar_frame} size={96} name={fullName} animated />
            <div className="prof-ov-id-text">
              <div className="prof-ov-name">{fullName}</div>
              <div className="prof-ov-meta">
                {cc && <Flag code={cc} size={22} />}
                {country && <span>{country}</span>}
                {age != null && (
                  <>
                    <span className="prof-ov-dot" />
                    <span>{t('prof.age', { n: age })}</span>
                  </>
                )}
              </div>
              <div className="prof-ov-actions">
                <Button variant="secondary" className="prof-ov-edit" onClick={onEdit}>
                  <Icon name="settings" size={16} /> {t('prof.editBtn')}
                </Button>
                {onLogout && (
                  <Button variant="ghost" className="prof-ov-logout" onClick={onLogout}>
                    <Icon name="logout" size={16} /> {t('auth.logout')}
                  </Button>
                )}
              </div>
            </div>
          </div>
          {/* Premium karti: profil ile tahta arasinda (3'lu ust satir) */}
          <MembershipCard user={user} onRenew={onRenew} onToggleAutoRenew={onToggleAutoRenew} />
          {equipped && (
            <div className="prof-ov-board">
              <div className="prof-ov-board-prev" style={boardVars(equipped)}>
                <SetupBoard
                  panel={equipped.panel ?? equipped.b}
                  a={equipped.a}
                  b={equipped.b}
                  checker={equipped.checker ?? equipped.b}
                  cream={equipped.light}
                />
              </div>
              <div className="prof-ov-board-name">
                <span className="prof-ov-board-lbl">{t('menu.board')}</span>
                {equipped.name}
              </div>
            </div>
          )}
        </div>

        {/* --- Sekmeler: İstatistikler · Avatarlar · Tahta Tasarımı --- */}
        <div className="prof-ov-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'stats'}
            className={tab === 'stats' ? 'active' : ''}
            onClick={() => setTab('stats')}
          >
            {t('stats.title')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'frames'}
            className={tab === 'frames' ? 'active' : ''}
            onClick={() => setTab('frames')}
          >
            {t('prof.avatars')} <span className="prof-ov-count">{ownedFrames.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'boards'}
            className={tab === 'boards' ? 'active' : ''}
            onClick={() => setTab('boards')}
          >
            {t('menu.board')} <span className="prof-ov-count">{ownedBoards.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'notifs'}
            className={tab === 'notifs' ? 'active' : ''}
            onClick={() => setTab('notifs')}
          >
            {t('notif.title')}
            {unread > 0 && <span className="prof-ov-count prof-ov-count-alert">{unread}</span>}
          </button>
        </div>

        {tab === 'frames' && (
          <section className="prof-ov-col">
            {ownedFrames.length === 0 ? (
              <p className="prof-ov-empty">{t('prof.noAvatars')}</p>
            ) : (
              <div className="prof-ov-grid">
                {ownedFrames.map((f) => (
                  <button
                    type="button"
                    className={`prof-ov-item ${user.avatar_frame === f.id ? 'active' : ''}`}
                    key={f.id}
                    style={{ ['--rarity-color']: RARITY_COLORS[f.rarity] } as CSSProperties}
                    onClick={() => onSelectFrame?.(f.id)}
                    aria-pressed={user.avatar_frame === f.id}
                    title={f.name}
                  >
                    {user.avatar_frame === f.id && (
                      <span className="prof-ov-sel"><Icon name="check" size={12} /> {t('prof.selected')}</span>
                    )}
                    <AvatarFrame src={avatar} frame={f.id} size={62} name={fullName} animated />
                    <span className="prof-ov-item-name">{f.name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'boards' && (
          <section className="prof-ov-col">
            <div className="prof-ov-grid prof-ov-grid-board">
              {ownedBoards.map((b) => (
                <button
                  type="button"
                  className={`prof-ov-item ${boardTheme === b.id ? 'active' : ''}`}
                  key={b.id}
                  style={boardVars(b)}
                  onClick={() => onSelectBoard?.(b.id)}
                  aria-pressed={boardTheme === b.id}
                  title={b.name}
                >
                  {boardTheme === b.id && (
                    <span className="prof-ov-sel"><Icon name="check" size={12} /> {t('prof.selected')}</span>
                  )}
                  <div className="prof-ov-item-board">
                    <SetupBoard
                      panel={b.panel ?? b.b}
                      a={b.a}
                      b={b.b}
                      checker={b.checker ?? b.b}
                      cream={b.light}
                    />
                  </div>
                  <span className="prof-ov-item-name">{b.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {tab === 'stats' && (
          <div className="prof-ov-stats-tab">
            <ProfileStats
              embed
              avatar={avatar ?? undefined}
              frame={user.avatar_frame}
              name={fullName}
              onClose={() => {}}
              onOpenMatchHistory={onOpenMatchHistory}
            />
          </div>
        )}

        {tab === 'notifs' && (
          <section className="prof-ov-col profile-notifs">
            {(notifications?.length ?? 0) === 0 ? (
              <p className="prof-ov-empty">{t('notif.empty')}</p>
            ) : (
              <>
                <div className="pn-bar">
                  <button type="button" className="pn-clear" onClick={onDeleteAllNotifications}>
                    <Icon name="trash" size={15} /> {t('notif.clearAll')}
                  </button>
                </div>
                <ul className="pn-list">
                  {notifications!.map((n) => (
                    <li key={n.id} className={`pn-item ${n.read ? '' : 'unread'}`}>
                      <span className="pn-ic">
                        <Icon name={NOTIF_ICON[n.icon ?? 'bell'] ?? 'bell'} size={18} />
                      </span>
                      <span className="pn-txt">
                        <span className="pn-t">{n.title}</span>
                        {n.body && <span className="pn-b">{n.body}</span>}
                      </span>
                      <button
                        type="button"
                        className="pn-del"
                        onClick={() => onDeleteNotification?.(n.id)}
                        title={t('notif.delete')}
                        aria-label={t('notif.delete')}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
