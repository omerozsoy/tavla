import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'

interface BoardThemeOpt {
  id: string
  name: string
  panel?: string
  a: string
  b: string
  checker?: string
  light?: string // acik pul rengi (onizleme gercek tahta ile ayni degeri kullansin)
  price?: number // coin ile alinan premium tema (plan kilidinden muaf)
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
}

interface Props {
  boardTheme: string
  setBoardTheme: (id: string) => void
  boardThemes: BoardThemeOpt[]
  rarityThemes?: BoardThemeOpt[] // rarity koleksiyonu (plan kilidiyle acilir)
  freeCount?: number // ilk N tahta ucretsiz; gerisi premium (kilitli)
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

// Kucuk tahta onizlemesi (Galaxy tarzi): zemin + iki renk ucgen + ornek pullar
function BoardPreview({ panel, a, b, checker, light }: { panel: string; a: string; b: string; checker: string; light?: string }) {
  const W = 104
  const H = 64
  const BAR = 6
  const half = (W - BAR) / 2
  const cw = half / 6
  const triH = 22
  const colX = (i: number) => (i < 6 ? i * cw : half + BAR + (i - 6) * cw)
  const tris = []
  for (let i = 0; i < 12; i++) {
    const x = colX(i)
    const cx = x + cw / 2
    tris.push(
      <polygon key={`t${i}`} points={`${x + 1},0 ${x + cw - 1},0 ${cx},${triH}`} fill={i % 2 === 0 ? a : b} opacity="0.92" />,
      <polygon key={`b${i}`} points={`${x + 1},${H} ${x + cw - 1},${H} ${cx},${H - triH}`} fill={i % 2 === 0 ? b : a} opacity="0.92" />,
    )
  }
  // Ornek pullar: sol-ust krem, sag-alt koyu (iki taraf da gorunsun)
  const disc = (x: number, y: number, fill: string) => (
    <circle cx={x} cy={y} r={cw / 2 - 0.5} fill={fill} stroke="#0004" strokeWidth="0.5" />
  )
  const c0 = colX(0) + cw / 2
  const c11 = colX(11) + cw / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="bp-svg" width="100%">
      <rect x="0" y="0" width={W} height={H} rx="5" fill={panel} />
      <rect x={half} y="0" width={BAR} height={H} fill="#0003" />
      {tris}
      {disc(c0, 7, light ?? 'var(--cream)')}
      {disc(c0, 7 + cw, light ?? 'var(--cream)')}
      {disc(c11, H - 7, checker)}
      {disc(c11, H - 7 - cw, checker)}
    </svg>
  )
}

export default function BoardSettings({
  boardTheme,
  setBoardTheme,
  boardThemes,
  rarityThemes = [],
  freeCount = 6,
  premium = false,
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
    <div className="register-overlay modal page">
      <div className="register-card board-settings-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </button>
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

        {/* Tahta rengi: mini tahta onizlemeleri */}
        <div className="setup-row">
          <div className="setup-label">{t('menu.board')}</div>
          <div className="board-previews">
            {boardThemes.map((bt, i) => {
              // Premium olmayan icin ilk freeCount haric kilitli (satin alinmis premium temalar haric)
              const locked = !premium && i >= freeCount && bt.price === undefined
              return (
                <button
                  key={bt.id}
                  className={`board-prev ${boardTheme === bt.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                  onClick={() => (locked ? onUpgrade?.() : setBoardTheme(bt.id))}
                >
                  <BoardPreview
                    panel={bt.panel ?? bt.b}
                    a={bt.a}
                    b={bt.b}
                    checker={bt.checker ?? bt.b}
                  />
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

        {/* Pip goster */}
        <button className={`setup-toggle ${showPip ? 'on' : ''}`} onClick={() => setShowPip(!showPip)}>
          <span>{t('setup.pip')}</span>
          <span className="setup-switch">{showPip ? t('setup.on') : t('setup.off')}</span>
        </button>

        {/* Analiz goster */}
        <button
          className={`setup-toggle ${showAnalysis ? 'on' : ''}`}
          onClick={() => setShowAnalysis(!showAnalysis)}
        >
          <span>{t('setup.analysis')}</span>
          <span className="setup-switch">{showAnalysis ? t('setup.on') : t('setup.off')}</span>
        </button>

        {/* Ogrenme modu */}
        <button
          className={`setup-toggle ${learnMode ? 'on' : ''}`}
          onClick={() => setLearnMode(!learnMode)}
        >
          <span><Icon name="graduation" size={16} /> {t('hint.learnMode')}</span>
          <span className="setup-switch">{learnMode ? t('setup.on') : t('setup.off')}</span>
        </button>
        <p className="setup-note">{t('hint.learnNote')}</p>

        <button className="galaxy-btn bs-save" onClick={onClose}>
          <Icon name="check" size={18} /> {t('settings.save')}
        </button>
      </div>
    </div>
  )
}
