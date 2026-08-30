import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
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
  onClose,
}: Props) {
  const { t, lang } = useT()
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

        {/* --- Stat kartlari --- */}
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

        {/* --- Koleksiyonlar --- */}
        <div className="prof-ov-cols">
          <section className="prof-ov-col">
            <h3 className="prof-ov-col-title">
              {t('prof.avatars')} <span className="prof-ov-count">{ownedFrames.length}</span>
            </h3>
            {ownedFrames.length === 0 ? (
              <p className="prof-ov-empty">{t('prof.noAvatars')}</p>
            ) : (
              <div className="prof-ov-grid">
                {ownedFrames.map((f) => (
                  <div
                    className={`prof-ov-item ${user.avatar_frame === f.id ? 'active' : ''}`}
                    key={f.id}
                    style={{ ['--rarity-color']: RARITY_COLORS[f.rarity] } as CSSProperties}
                  >
                    <AvatarFrame src={avatar} frame={f.id} size={62} name={fullName} animated />
                    <span className="prof-ov-item-name">{f.name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="prof-ov-col">
            <h3 className="prof-ov-col-title">
              {t('menu.board')} <span className="prof-ov-count">{ownedBoards.length}</span>
            </h3>
            <div className="prof-ov-grid prof-ov-grid-board">
              {ownedBoards.map((b) => (
                <div
                  className={`prof-ov-item ${boardTheme === b.id ? 'active' : ''}`}
                  key={b.id}
                  style={boardVars(b)}
                >
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
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
