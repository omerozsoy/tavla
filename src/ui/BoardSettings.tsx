import type { CSSProperties } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import SetupBoard from './SetupBoard'
import { RARITY_COLORS } from './rarityColors'

type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'club'

interface BoardThemeOpt {
  id: string
  name: string
  panel?: string
  a: string
  b: string
  checker?: string
  light?: string // acik pul rengi (onizleme gercek tahta ile ayni degeri kullansin)
  price?: number
  rarity?: Rarity
  locked?: boolean // plan/premium kilidi (App'te hesaplanir)
}

interface Props {
  boardTheme: string
  setBoardTheme: (id: string) => void
  boardThemes: BoardThemeOpt[]
  premium?: boolean
  onUpgrade?: () => void
  theme: 'dark' | 'light'
  setTheme: (t: 'dark' | 'light') => void
  showPip: boolean
  setShowPip: (v: boolean) => void
  showAnalysis: boolean
  setShowAnalysis: (v: boolean) => void
  learnMode: boolean
  setLearnMode: (v: boolean) => void
  onClose: () => void
}

// Nadirlik siralamasi + renkleri (kart cercevesi ve baslik). HEX'ler urun spesifikasyonundan.
const RARITY_ORDER: Rarity[] = ['club', 'common', 'rare', 'epic', 'legendary', 'mythic']
const RARITY_COLOR: Record<Rarity, string> = RARITY_COLORS

export default function BoardSettings({
  boardTheme,
  setBoardTheme,
  boardThemes,
  onUpgrade,
  theme,
  setTheme,
  showPip,
  setShowPip,
  showAnalysis,
  setShowAnalysis,
  learnMode,
  setLearnMode,
  onClose,
}: Props) {
  const { t } = useT()
  useEscape(onClose)
  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card board-settings-card" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="modal-close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <Icon name="x" size={16} />
        </Button>
        <h2><Icon name="settings" size={20} /> {t('menu.settings')}</h2>

        {/* Tema (koyu/acik) */}
        <div className="setup-row">
          <div className="setup-label">{t('menu.theme')}</div>
          <div className="menu-targets">
            <button
              className={theme === 'dark' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setTheme('dark')}
            >
              <Icon name="moon" size={16} /> {t('theme.dark')}
            </button>
            <button
              className={theme === 'light' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setTheme('light')}
            >
              <Icon name="sun" size={16} /> {t('theme.light')}
            </button>
          </div>
        </div>

        {/* Oyun ayarlari (pip/analiz/ogrenme) — tahta grid'inin USTUNDE, kolay erisim */}
        <button className={`setup-toggle ${showPip ? 'on' : ''}`} onClick={() => setShowPip(!showPip)}>
          <span>{t('setup.pip')}</span>
          <span className="setup-switch">{showPip ? t('setup.on') : t('setup.off')}</span>
        </button>
        <button
          className={`setup-toggle ${showAnalysis ? 'on' : ''}`}
          onClick={() => setShowAnalysis(!showAnalysis)}
        >
          <span>{t('setup.analysis')}</span>
          <span className="setup-switch">{showAnalysis ? t('setup.on') : t('setup.off')}</span>
        </button>
        <button
          className={`setup-toggle ${learnMode ? 'on' : ''}`}
          onClick={() => setLearnMode(!learnMode)}
        >
          <span><Icon name="graduation" size={16} /> {t('hint.learnMode')}</span>
          <span className="setup-switch">{learnMode ? t('setup.on') : t('setup.off')}</span>
        </button>
        <p className="setup-note">{t('hint.learnNote')}</p>

        {/* Tahta secimi: nadirlik gruplari, buyuk + tam pul dizili onizleme, rarity cercevesi */}
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
                    const locked = !!bt.locked
                    return (
                      <button
                        key={bt.id}
                        className={`board-prev ${boardTheme === bt.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                        style={{ ['--rarity-color']: RARITY_COLOR[tier] } as CSSProperties}
                        onClick={() => (locked ? onUpgrade?.() : setBoardTheme(bt.id))}
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
                        <span className="bp-name">
                          {locked && <Icon name="crown" size={11} />} {bt.name}
                        </span>
                        {locked && (
                          <span className="bp-lock">
                            <Icon name="crown" size={16} />
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

        <Button variant="default" className="bs-save" onClick={onClose}>
          <Icon name="check" size={18} /> {t('settings.save')}
        </Button>
      </div>
    </div>
  )
}
