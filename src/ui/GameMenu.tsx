import { useT } from '../i18n'
import { Icon } from './Icon'

interface Row {
  label: string
  on: boolean
  toggle: () => void
}

interface Props {
  open: boolean
  showPip: boolean
  setShowPip: (v: boolean) => void
  showAnalysis: boolean
  setShowAnalysis: (v: boolean) => void
  learnMode: boolean
  setLearnMode: (v: boolean) => void
  autoRoll: boolean
  setAutoRoll: (v: boolean) => void
  soundOn: boolean
  toggleSound: () => void
  animOn: boolean
  toggleAnim: () => void
  canResign: boolean
  onLobby: () => void
  onResign: () => void
  onClose: () => void
}

// Oyun-ici menu (Galaxy tarzi): hizli ayarlar + Lobi/Cekil. Ana menuden bagimsiz.
export default function GameMenu(p: Props) {
  const { t } = useT()
  const rows: Row[] = [
    { label: t('gm.autoRoll'), on: p.autoRoll, toggle: () => p.setAutoRoll(!p.autoRoll) },
    { label: t('setup.pip'), on: p.showPip, toggle: () => p.setShowPip(!p.showPip) },
    { label: t('setup.analysis'), on: p.showAnalysis, toggle: () => p.setShowAnalysis(!p.showAnalysis) },
    { label: t('hint.learnMode'), on: p.learnMode, toggle: () => p.setLearnMode(!p.learnMode) },
    { label: t('gm.sound'), on: p.soundOn, toggle: p.toggleSound },
    { label: t('gm.anim'), on: p.animOn, toggle: p.toggleAnim },
  ]
  return (
    <>
      {p.open && <div className="gm-backdrop" onClick={p.onClose} />}
      <div className={`game-menu ${p.open ? 'open' : ''}`}>
        <div className="gm-rows">
          {rows.map((r) => (
            <button key={r.label} className="gm-row" onClick={r.toggle}>
              <span className="gm-label">{r.label}</span>
              <span className={`gm-state ${r.on ? 'on' : 'off'}`}>
                {r.on ? t('setup.on') : t('setup.off')}
              </span>
            </button>
          ))}
        </div>
        <div className="gm-actions">
          <button
            className="gm-circle lobby"
            onClick={() => {
              p.onClose()
              p.onLobby()
            }}
          >
            <span className="gm-circle-ic"><Icon name="home" size={22} /></span>
            <span className="gm-circle-lbl">{t('gm.lobby')}</span>
          </button>
          {p.canResign && (
            <button
              className="gm-circle resign"
              onClick={() => {
                p.onClose()
                p.onResign()
              }}
            >
              <span className="gm-circle-ic"><Icon name="flag" size={22} /></span>
              <span className="gm-circle-lbl">{t('resign.button')}</span>
            </button>
          )}
        </div>
      </div>
    </>
  )
}
