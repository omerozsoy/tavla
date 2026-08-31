import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'

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
  /** Analiz + Öğrenme Modu SADECE yapay zekaya karşı (pvb) oyunda gösterilir.
      Tek Oyun/Maç Oyunu (online) ve yerel pvp'de gizli — hile önlemi. */
  canAnalyze?: boolean
  canResign: boolean
  loggedIn?: boolean
  onTournaments?: () => void
  onFriends?: () => void
  onShop?: () => void
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
    // Canlı "Analizi göster" KALDIRILDI (maç sonu analizi yeterli). Öğrenme Modu SADECE pvb.
    ...(p.canAnalyze
      ? [{ label: t('hint.learnMode'), on: p.learnMode, toggle: () => p.setLearnMode(!p.learnMode) }]
      : []),
    { label: t('gm.sound'), on: p.soundOn, toggle: p.toggleSound },
    { label: t('gm.anim'), on: p.animOn, toggle: p.toggleAnim },
  ]
  return (
    <>
      {p.open && <div className="gm-backdrop" onClick={p.onClose} />}
      <div className={`game-menu ${p.open ? 'open' : ''}`}>
        <div className="gm-rows">
          {rows.map((r) => (
            <Button key={r.label} variant="ghost" className="w-full justify-between" onClick={r.toggle}>
              <span className="gm-label">{r.label}</span>
              <span className={`gm-state ${r.on ? 'on' : 'off'}`}>
                {r.on ? t('setup.on') : t('setup.off')}
              </span>
            </Button>
          ))}
        </div>
        {(p.onTournaments || (p.loggedIn && (p.onFriends || p.onShop))) && (
          <div className="gm-nav">
            {p.onTournaments && (
              <Button variant="ghost" className="w-full justify-start" onClick={() => { p.onClose(); p.onTournaments!() }}>
                <Icon name="medal" size={18} /> {t('menu.tournaments')}
              </Button>
            )}
            {p.loggedIn && p.onFriends && (
              <Button variant="ghost" className="w-full justify-start" onClick={() => { p.onClose(); p.onFriends!() }}>
                <Icon name="users" size={18} /> {t('menu.friends')}
              </Button>
            )}
            {p.loggedIn && p.onShop && (
              <Button variant="ghost" className="w-full justify-start" onClick={() => { p.onClose(); p.onShop!() }}>
                <Icon name="shop" size={18} /> {t('shop.title')}
              </Button>
            )}
          </div>
        )}
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
