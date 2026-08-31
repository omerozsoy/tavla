import { useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import ProfileStats from './ProfileStats'
import AvatarFrame from './AvatarFrame'
import { Flag } from './Flag'
import SetupBoard from './SetupBoard'
import { Button } from '@/components/ui/button'
import { divisionOf, MAIN_DIVISIONS } from '../badges'
import { countryName } from '../countries'
import { framePrice, type AvatarFrameDef } from './avatarFrames'
import { RARITY_COLORS } from './rarityColors'
import type { ServerUser } from '../api'

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
}

const fmt = (n: number) => n.toLocaleString('tr-TR')

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
}: Props) {
  const { t, lang } = useT()
  // Profil açılışında İstatistikler sekmesi varsayılan seçili
  const [tab, setTab] = useState<'frames' | 'boards' | 'stats'>('stats')
  useEscape(onClose)

  const rating = user.rating ?? 0
  const coins = user.coins ?? 0
  const wins = user.wins ?? 0
  const games = user.games_played ?? 0
  const winRate = games > 0 ? Math.round((wins / games) * 100) : 0
  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.nickname
  const age = ageFrom(user.birth_date)
  const cc = (user.country || '').toLowerCase()
  const country = user.country ? countryName(user.country, lang) : ''

  // Puan ilerleme: mevcut ana kademe icinde sonraki kademeye ilerleme
  const div = divisionOf(rating)
  const idx = MAIN_DIVISIONS.findIndex((d) => d.key === div.key)
  const curMin = MAIN_DIVISIONS[idx]?.min ?? 0
  const nextMin = MAIN_DIVISIONS[idx + 1]?.min ?? curMin + 100
  const ratingPct = Math.max(0, Math.min(100, Math.round(((rating - curMin) / (nextMin - curMin)) * 100)))

  // Koleksiyon degeri: sahip olunan cerceve + odemeli tahta fiyatlari toplami
  const framesValue = ownedFrames.reduce((s, f) => s + (framePrice(f) ?? 0), 0)
  const boardsValue = ownedBoards.reduce((s, b) => s + (b.price ?? 0), 0)

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

        {/* --- Stat kartlari (İstatistikler sekmesinde gizli: dashboard zaten kapsıyor) --- */}
        {tab !== 'stats' && (
        <div className="prof-ov-stats">
          <div className="prof-ov-stat">
            <span className="pos-lbl"><Icon name="chart" size={15} /> {t('lb.rating')}</span>
            <span className="pos-val pos-navy">{fmt(rating)} GR</span>
            <span className="pos-bar"><i style={{ width: `${ratingPct}%` }} /></span>
            <span className="pos-sub">{t(div.key)}</span>
          </div>
          <div className="prof-ov-stat">
            <span className="pos-lbl"><Icon name="coin" size={15} /> {t('home.dash.coins')}</span>
            <span className="pos-val pos-gold">{fmt(coins)} GC</span>
          </div>
          <div className="prof-ov-stat">
            <span className="pos-lbl"><Icon name="trophy" size={15} /> {t('home.dash.wins')}</span>
            <span className="pos-val pos-green">%{winRate}</span>
            <span className="pos-sub">
              {fmt(games)} {t('home.dash.games')} · {fmt(wins)} {t('home.dash.wins')}
            </span>
          </div>
          <div className="prof-ov-stat">
            <span className="pos-lbl"><Icon name="star" size={15} /> {t('prof.collection')}</span>
            <span className="pos-val">{fmt(framesValue + boardsValue)} GC</span>
            <span className="pos-sub">
              {ownedBoards.length} {t('menu.board')} · {ownedFrames.length} {t('prof.avatars')}
            </span>
          </div>
        </div>
        )}

        {/* --- Sekmeler: Çerçeveler · Tahta Renkleri · İstatistikler --- */}
        <div className="prof-ov-tabs" role="tablist">
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
            aria-selected={tab === 'stats'}
            className={tab === 'stats' ? 'active' : ''}
            onClick={() => setTab('stats')}
          >
            {t('stats.title')}
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
            />
          </div>
        )}
      </div>
    </div>
  )
}
