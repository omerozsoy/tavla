import { useState, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import ProfileStats from './ProfileStats'
import Achievements from './Achievements'
import { BadgeList } from './Badges'
import AvatarFrame from './AvatarFrame'
import PremiumPill from './PremiumPill'
import './profileShopLink.css'
import { Flag } from './Flag'
import SetupBoard from './SetupBoard'
import { useBoardDir } from './boardDirection'
import { useSwapStones } from './pieceColors'
import BoardPicker, { type BoardThemeOpt } from './BoardPicker'
import MembershipCard from './MembershipCard'
import AddressBook from './AddressBook'
import { Button } from '@/components/ui/button'
import { countryName } from '../countries'
import { type AvatarFrameDef } from './avatarFrames'
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
  // Uyelik karti (baslikin altinda). Bildirimler artik Mesajlar'da (birlesti).
  onRenew?: () => void
  onToggleAutoRenew?: (enabled: boolean) => void
  onOpenMatchHistory?: (matchId?: number) => void // Mac Analizleri sayfasi (id verilirse o mac acilir)
  onOpenAchievements?: () => void // Basarimlar (rozet galerisi)
  onOpenShop?: (tab: 'frame' | 'board') => void // (kullanılmıyor; geriye dönük)
  onOpenOrders?: () => void // Siparişlerim (sol menüden kaldırıldı -> profilden açılır)
  // "Tümü" bölümleri: profil Tahta/Avatar sekmelerinin altında TÜM tasarımlar + satın al
  allBoards?: BoardThemeOpt[] // tüm tahtalar (owned + kilitli)
  coins?: number
  onBuyItem?: (shopId: string) => void // 'theme.<id>' / 'frame.<id>' satın al
  framesSlot?: ReactNode // FrameShop: tüm çerçeveler + satın al/kuşan
  // Kontrollu sekme (URL'e yansisin diye App'ten gelir; verilmezse ic state ile calisir)
  tab?: ProfTab
  onTabChange?: (tab: ProfTab) => void
}

type ProfTab = 'frames' | 'boards' | 'stats' | 'badges' | 'addresses'

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
  onOpenMatchHistory,
  onOpenAchievements,
  onOpenOrders,
  allBoards,
  coins,
  onBuyItem,
  framesSlot,
  tab: tabProp,
  onTabChange,
}: Props) {
  const { t, lang } = useT()
  // Oyun yönü + pul renkleri: kalıcı ayar (localStorage) profilden değişir, oyun senkron.
  const [boardDir, setBoardDir] = useBoardDir()
  const [swapStones, setSwapStones] = useSwapStones()
  // Profil açılışında İstatistikler sekmesi varsayılan seçili. Kontrollu (App'ten tab)
  // veya kontrolsuz (ic state) — her iki durumda setTab hem ici hem App'i gunceller.
  const [tabState, setTabState] = useState<ProfTab>('stats')
  const tab = tabProp ?? tabState
  const setTab = (v: ProfTab) => {
    setTabState(v)
    onTabChange?.(v)
  }
  useEscape(onClose)

  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.nickname
  const premium = user.plan_active !== 'free' // süresi geçerli ücretli plan -> avatar üstünde taç
  const age = ageFrom(user.birth_date)
  const cc = (user.country || '').toLowerCase()
  const country = user.country ? countryName(user.country, lang) : ''

  const equipped = ownedBoards.find((b) => b.id === boardTheme) ?? ownedBoards[0]
  const equippedFrame = ownedFrames.find((f) => f.id === user.avatar_frame)

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
              <div className="prof-ov-name">
                {fullName}
                {premium && <PremiumPill style={{ marginLeft: 8, verticalAlign: 'middle' }} />}
              </div>
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
                <Button variant="ghost" className="prof-ov-edit" onClick={onEdit}>
                  <Icon name="settings" size={16} /> {t('prof.editBtn')}
                </Button>
                {onOpenOrders && (
                  <Button variant="ghost" className="prof-ov-orders" onClick={onOpenOrders}>
                    <Icon name="package" size={16} /> {t('menu.myOrders')}
                  </Button>
                )}
                {/* Adreslerim: sekme yerine kimlik kartı aksiyon satırında (AddressBook'u açar) */}
                <Button
                  variant="ghost"
                  className={`prof-ov-addr ${tab === 'addresses' ? 'is-active' : ''}`}
                  onClick={() => setTab('addresses')}
                >
                  <Icon name="pin" size={16} /> {t('prof.addresses')}
                </Button>
                {onLogout && (
                  <Button variant="ghost" className="prof-ov-logout" onClick={onLogout}>
                    <Icon name="logout" size={16} /> {t('auth.logout')}
                  </Button>
                )}
              </div>
            </div>
          </div>
          {/* Premium karti: kimlik ile ayni ust satirda */}
          <MembershipCard user={user} onRenew={onRenew} onToggleAutoRenew={onToggleAutoRenew} />
        </div>

        {/* --- Alt satir: Tavla Tasarımları + Avatar Çerçevesi kutuları --- */}
        <div className="prof-ov-row2">
          {equipped && (
            <div className="prof-ov-board">
              {/* Sol: canlı önizleme + tema adı; tıklayınca Tavla Tasarımları sekmesine geçer. */}
              <button
                type="button"
                className="prof-ov-board-open"
                onClick={() => setTab('boards')}
                title={t('prof.changeBoard')}
              >
                {/* Önizleme oyun yönü (flip) + pul rengi (takas) ayarlarını CANLI ve
                    ANIMASYONLU yansıtır: yön -> yatay flip geçişi, renk -> pul/zar fill geçişi. */}
                <div
                  className={`prof-ov-board-prev${boardDir === 'left' ? ' flip' : ''}${swapStones ? ' swap' : ''}`}
                  style={boardVars(equipped)}
                >
                  <SetupBoard
                    panel={equipped.panel ?? equipped.b}
                    a={equipped.a}
                    b={equipped.b}
                    checker={swapStones ? (equipped.light ?? '#f4efe6') : (equipped.checker ?? equipped.b)}
                    cream={swapStones ? (equipped.checker ?? equipped.b) : equipped.light}
                  />
                </div>
                <div className="prof-ov-board-name">
                  <span className="prof-ov-board-lbl">{t('menu.board')}</span>
                  {equipped.name}
                  <span className="prof-ov-board-change">
                    <Icon name="settings" size={13} /> {t('prof.changeBoard')}
                  </span>
                </div>
              </button>

              {/* Sağ: oyunu etkileyen kalıcı ayarlar (eskiden oyun menüsündeydi). */}
              <div className="prof-ov-board-opts">
                <button
                  type="button"
                  className="prof-ov-opt"
                  onClick={() => setBoardDir(boardDir === 'left' ? 'right' : 'left')}
                >
                  <span className="prof-ov-opt-lbl">{t('gm.boardDir')}</span>
                  <span className="prof-ov-opt-ctl">
                    <span className="gm-hint">
                      {t(boardDir === 'right' ? 'dir.rightShort' : 'dir.leftShort')}
                    </span>
                    <span className={`gm-switch ${boardDir === 'right' ? 'on' : 'off'}`} aria-hidden="true">
                      <span className="gm-knob" />
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="prof-ov-opt"
                  onClick={() => setSwapStones(!swapStones)}
                >
                  <span className="prof-ov-opt-lbl">{t('gm.pieceColors')}</span>
                  <span className="prof-ov-opt-ctl">
                    <span className="gm-hint">{t(swapStones ? 'player.black' : 'player.white')}</span>
                    <span className={`gm-switch ${swapStones ? 'on' : 'off'}`} aria-hidden="true">
                      <span className="gm-knob" />
                    </span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Avatar Çerçevesi kutusu -> tıklayınca Avatarlar sekmesi */}
          <button
            type="button"
            className="prof-ov-frame"
            onClick={() => setTab('frames')}
            title={t('prof.changeFrame')}
          >
            <div className="prof-ov-frame-prev">
              <AvatarFrame src={avatar} frame={user.avatar_frame} size={84} name={fullName} animated />
            </div>
            <div className="prof-ov-board-name">
              <span className="prof-ov-board-lbl">{t('settings.tabFrame')}</span>
              {equippedFrame?.name ?? t('prof.frameDefault')}
              <span className="prof-ov-board-change">
                <Icon name="settings" size={13} /> {t('prof.changeFrame')}
              </span>
            </div>
          </button>
        </div>

        {/* --- Sekmeler: İstatistikler · Avatarlar · Tahta Tasarımı · Başarılar ---
           (Adreslerim aktifken şerit gizlenir, yerine alt başlık gösterilir) --- */}
        <div className="prof-ov-tabs" role="tablist" hidden={tab === 'addresses'}>
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
            aria-selected={tab === 'boards'}
            className={tab === 'boards' ? 'active' : ''}
            onClick={() => setTab('boards')}
          >
            {t('menu.board')} <span className="prof-ov-count">{ownedBoards.length}</span>
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
            aria-selected={tab === 'badges'}
            className={tab === 'badges' ? 'active' : ''}
            onClick={() => setTab('badges')}
          >
            {t('ach.title')}
          </button>
          {/* Adreslerim sekmesi kaldırıldı -> kimlik kartı aksiyon satırına taşındı */}
        </div>

        {/* Adreslerim aktifken: sekme şeridi yerine geri dönüşlü başlık göster */}
        {tab === 'addresses' && (
          <div className="prof-ov-subhead">
            <button type="button" className="prof-ov-subback" onClick={() => setTab('stats')}>
              <Icon name="arrow-right" size={15} /> {t('stats.title')}
            </button>
            <span className="prof-ov-subtitle">
              <Icon name="pin" size={16} /> {t('prof.addresses')}
            </span>
          </div>
        )}

        {tab === 'frames' && (
          <section className="prof-ov-col">
            {ownedFrames.length === 0 && <p className="prof-ov-empty">{t('prof.noAvatars')}</p>}
            {/* Sahip olunan avatarlar — Tavla Tasarımları ile AYNI yatay şerit düzeni */}
            {ownedFrames.length > 0 && <h4 className="prof-ov-all-t">{t('prof.myCollection')}</h4>}
            <div className="prof-ov-grid prof-ov-grid-board prof-ov-grid-frames">
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
                  <div className="prof-ov-item-frame">
                    <AvatarFrame src={avatar} frame={f.id} size={78} name={fullName} animated />
                  </div>
                  <span className="prof-ov-item-name">{f.name}</span>
                </button>
              ))}
            </div>
            {/* TÜM avatar çerçeveleri (satın al / kuşan) — sahip olduklarının altında */}
            {framesSlot && (
              <div className="prof-ov-all">
                <h4 className="prof-ov-all-t">{t('prof.allAvatars')}</h4>
                {framesSlot}
              </div>
            )}
          </section>
        )}

        {tab === 'boards' && (
          <section className="prof-ov-col">
            {ownedBoards.length > 0 && <h4 className="prof-ov-all-t">{t('prof.myCollection')}</h4>}
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
            {/* TÜM tahta tasarımları (satın al / kuşan) — sahip olduklarının altında */}
            {allBoards && allBoards.length > 0 && onSelectBoard && (
              <div className="prof-ov-all">
                <h4 className="prof-ov-all-t">{t('prof.allBoards')}</h4>
                <BoardPicker
                  boardTheme={boardTheme}
                  setBoardTheme={onSelectBoard}
                  boardThemes={allBoards}
                  coins={coins ?? 0}
                  onBuy={onBuyItem}
                />
              </div>
            )}
          </section>
        )}

        {tab === 'badges' && (
          <section className="prof-ov-col">
            {/* Rozetler (eski badge listesi) — istatistik sekmesinden buraya tasindi */}
            <BadgeList ids={user.badges} />
            <Achievements embed loggedIn />
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
              onOpenAchievements={onOpenAchievements}
            />
          </div>
        )}

        {tab === 'addresses' && <AddressBook />}
      </div>
    </div>
  )
}
