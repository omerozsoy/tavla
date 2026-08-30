import { useState, type CSSProperties, type ReactNode } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import SetupBoard from './SetupBoard'
import { RARITY_COLORS } from './rarityColors'
import { MOVE_STYLES, type MoveStyle } from './moveAnim'

type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'club'

interface BoardThemeOpt {
  id: string
  name: string
  panel?: string
  a: string
  b: string
  checker?: string
  light?: string // acik pul rengi (onizleme gercek tahta ile ayni degeri kullansin)
  price?: number // coin fiyati (nadirlik bazli); ucretsiz/kulup -> undefined
  rarity?: Rarity
  owned?: boolean // sahip mi (ucretsiz/kulup/satin alinmis)
}

interface Props {
  boardTheme: string
  setBoardTheme: (id: string) => void
  boardThemes: BoardThemeOpt[]
  coins?: number // bakiye (satin alma icin yeterlilik)
  onBuy?: (shopId: string) => void // tahtayi coin ile ac ('theme.<id>')
  theme: 'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
  showPip: boolean
  setShowPip: (v: boolean) => void
  showAnalysis: boolean
  setShowAnalysis: (v: boolean) => void
  learnMode: boolean
  setLearnMode: (v: boolean) => void
  moveStyle: MoveStyle
  setMoveStyle: (v: MoveStyle) => void
  onClose: () => void
  embed?: boolean // gomulu render (overlay/kapat/kaydet yok)
  framesSlot?: ReactNode // "Avatar Cercevesi" sekmesi icerigi (FrameGallery embed)
}

// Nadirlik siralamasi + renkleri (kart cercevesi ve baslik). HEX'ler urun spesifikasyonundan.
const RARITY_ORDER: Rarity[] = ['club', 'common', 'rare', 'epic', 'legendary', 'mythic']
const RARITY_COLOR: Record<Rarity, string> = RARITY_COLORS

export default function BoardSettings({
  boardTheme,
  setBoardTheme,
  boardThemes,
  coins = 0,
  onBuy,
  theme,
  setTheme,
  showPip,
  setShowPip,
  showAnalysis,
  setShowAnalysis,
  learnMode,
  setLearnMode,
  moveStyle,
  setMoveStyle,
  onClose,
  embed,
  framesSlot,
}: Props) {
  const { t } = useT()
  useEscape(embed ? () => {} : onClose)
  // Ayarlar sekmeleri: genel (tema/pip/analiz/ogrenme) | tahta rengi | avatar cercevesi
  const [tab, setTab] = useState<'general' | 'board' | 'frame'>('general')
  // Ayarlar zaten anlik uygulanip localStorage'a yazilir; "Kaydet" sayfayi KAPATMAZ
  // (eskiden onClose -> ana sayfaya atiyordu). Sadece kisa "Kaydedildi" onayi gosterir.
  const [saved, setSaved] = useState(false)
  return (
    <div
      className={embed ? 'settings-embed' : 'register-overlay modal page'}
      role={embed ? undefined : 'dialog'}
      aria-modal={embed ? undefined : true}
    >
      <div
        className={`register-card board-settings-card ${embed ? 'is-embed' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {!embed && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="modal-close"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <Icon name="x" size={16} />
          </Button>
        )}
        {!embed && <h2><Icon name="settings" size={20} /> {t('menu.settings')}</h2>}

        {/* Ayarlar sekmeleri (UI/UX Pro Max segmented control) */}
        <div className="prof-tabs bs-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'general'}
            className={`prof-tab ${tab === 'general' ? 'active' : ''}`}
            onClick={() => setTab('general')}
          >
            <Icon name="settings" size={16} /> {t('settings.tabGeneral')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'board'}
            className={`prof-tab ${tab === 'board' ? 'active' : ''}`}
            onClick={() => setTab('board')}
          >
            <Icon name="dice" size={16} /> {t('settings.tabBoard')}
          </button>
          {framesSlot && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'frame'}
              className={`prof-tab ${tab === 'frame' ? 'active' : ''}`}
              onClick={() => setTab('frame')}
            >
              <Icon name="crown" size={16} /> {t('settings.tabFrame')}
            </button>
          )}
        </div>

        {tab === 'general' && (
          <>
        {/* Tema (koyu/acik) */}
        <div className="setup-row">
          <div className="setup-label">{t('menu.theme')}</div>
          <div className="menu-targets">
            <Button
              type="button"
              variant={theme === 'dark' ? 'secondary' : 'ghost'}
              onClick={() => setTheme('dark')}
            >
              <Icon name="moon" size={16} /> {t('theme.dark')}
            </Button>
            <Button
              type="button"
              variant={theme === 'light' ? 'secondary' : 'ghost'}
              onClick={() => setTheme('light')}
            >
              <Icon name="sun" size={16} /> {t('theme.light')}
            </Button>
          </div>
        </div>

        {/* Tas hareket animasyonu (kapali/kayma/yay/kaldir-birak) */}
        <div className="setup-row">
          <div className="setup-label">{t('settings.moveAnim')}</div>
          <div className="menu-targets move-anim-opts">
            {(['off', ...MOVE_STYLES] as MoveStyle[]).map((m) => (
              <Button
                key={m}
                type="button"
                variant={moveStyle === m ? 'secondary' : 'ghost'}
                className={moveStyle === m ? 'move-opt-active' : ''}
                aria-pressed={moveStyle === m}
                onClick={() => setMoveStyle(m)}
              >
                {moveStyle === m && <Icon name="check" size={14} />} {t('settings.move.' + m)}
              </Button>
            ))}
          </div>
          <p className="setup-note">
            <b>{t('settings.moveCurrent')}: {t('settings.move.' + moveStyle)}</b> · {t('settings.moveNote')}
          </p>
        </div>

        {/* Oyun ayarlari (pip/analiz/ogrenme) — tahta grid'inin USTUNDE, kolay erisim */}
        <button type="button" className={`setup-toggle ${showPip ? 'on' : ''}`} onClick={() => setShowPip(!showPip)}>
          <span>{t('setup.pip')}</span>
          <span className="setup-switch">{showPip ? t('setup.on') : t('setup.off')}</span>
        </button>
        <button
          type="button"
          className={`setup-toggle ${showAnalysis ? 'on' : ''}`}
          onClick={() => setShowAnalysis(!showAnalysis)}
        >
          <span>{t('setup.analysis')}</span>
          <span className="setup-switch">{showAnalysis ? t('setup.on') : t('setup.off')}</span>
        </button>
        <button
          type="button"
          className={`setup-toggle ${learnMode ? 'on' : ''}`}
          onClick={() => setLearnMode(!learnMode)}
        >
          <span><Icon name="graduation" size={16} /> {t('hint.learnMode')}</span>
          <span className="setup-switch">{learnMode ? t('setup.on') : t('setup.off')}</span>
        </button>
        <p className="setup-note">{t('hint.learnNote')}</p>
          </>
        )}

        {/* Tahta Rengi sekmesi: nadirlik gruplari, buyuk + tam pul dizili onizleme */}
        {tab === 'board' && (
        <div className="setup-row">
          <div className="setup-label">{t('menu.board')}</div>
          {RARITY_ORDER.map((tier) => {
            const items = boardThemes.filter((bt) => (bt.rarity ?? 'common') === tier)
            if (items.length === 0) return null
            return (
              <div className="rarity-group" key={tier}>
                <div
                  className={`rarity-title rarity-${tier}`}
                  style={{ ['--rarity-color']: RARITY_COLOR[tier] } as CSSProperties}
                >
                  <span className="rarity-dot" /> {t('rarity.' + tier)}
                  <span className="rarity-count">{items.length}</span>
                </div>
                <div className="board-previews board-previews-lg">
                  {items.map((bt) => {
                    const owned = bt.owned !== false && bt.price == null ? true : !!bt.owned
                    const price = bt.price
                    const buyable = !owned && price != null
                    const affordable = buyable && coins >= price
                    return (
                      <button
                        key={bt.id}
                        type="button"
                        className={`board-prev ${boardTheme === bt.id ? 'active' : ''} ${buyable ? 'locked' : ''}`}
                        style={{ ['--rarity-color']: RARITY_COLOR[tier] } as CSSProperties}
                        disabled={buyable && !affordable}
                        title={buyable ? `${bt.name} — ${price} coin` : bt.name}
                        onClick={() =>
                          owned ? setBoardTheme(bt.id) : affordable ? onBuy?.('theme.' + bt.id) : undefined
                        }
                      >
                        <SetupBoard
                          panel={bt.panel ?? bt.b}
                          a={bt.a}
                          b={bt.b}
                          checker={bt.checker ?? bt.b}
                          cream={bt.light}
                        />
                        {boardTheme === bt.id && (
                          <span className="bp-selected">
                            <Icon name="check" size={12} /> {t('shop.selected')}
                          </span>
                        )}
                        <span className="bp-name">{bt.name}</span>
                        {buyable && (
                          <span className="bp-price">
                            <Icon name="coin" size={12} /> {price.toLocaleString('tr-TR')}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        )}

        {/* Avatar Cercevesi sekmesi (FrameGallery embed) */}
        {tab === 'frame' && framesSlot}

        {!embed && (
          <Button
            type="button"
            variant="default"
            className="bs-save"
            onClick={() => {
              setSaved(true)
              window.setTimeout(() => setSaved(false), 1600)
            }}
          >
            <Icon name="check" size={18} /> {saved ? t('settings.saved') : t('settings.save')}
          </Button>
        )}
      </div>
    </div>
  )
}
