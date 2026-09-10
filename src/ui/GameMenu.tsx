import { useT } from '../i18n'
import type { BoardDir } from './boardDirection'
import { Icon } from './Icon'

interface Row {
  label: string
  on: boolean
  toggle: () => void
  /** Ac/Kapa yerine metin gosteren satirlar (or. Oyun Yonu: Saga/Sola topla). */
  value?: string
}

interface Props {
  open: boolean
  showPip: boolean
  setShowPip: (v: boolean) => void
  showAnalysis: boolean
  setShowAnalysis: (v: boolean) => void
  learnMode: boolean
  setLearnMode: (v: boolean) => void
  /** Canlı PR (anlık performans reytingi) sidebar'da görünsün mü — SADECE pvb. */
  showLivePr: boolean
  setShowLivePr: (v: boolean) => void
  animOn: boolean
  toggleAnim: () => void
  /** Oyun yonu: pullarin toplandigi taraf. Tum modlarda ayni ayar. */
  boardDir: BoardDir
  setBoardDir: (d: BoardDir) => void
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
    { label: t('setup.pip'), on: p.showPip, toggle: () => p.setShowPip(!p.showPip) },
    // Canlı "Analizi göster" KALDIRILDI (maç sonu analizi yeterli). Öğrenme Modu SADECE pvb.
    ...(p.canAnalyze
      ? [
          { label: t('hint.learnMode'), on: p.learnMode, toggle: () => p.setLearnMode(!p.learnMode) },
          { label: t('gm.livePr'), on: p.showLivePr, toggle: () => p.setShowLivePr(!p.showLivePr) },
        ]
      : []),
    { label: t('gm.anim'), on: p.animOn, toggle: p.toggleAnim },
    {
      // Oyun yönü de switch: ON = sağa topla, OFF = sola topla (diğer satırlarla tutarlı).
      label: t('gm.boardDir'),
      on: p.boardDir === 'right',
      toggle: () => p.setBoardDir(p.boardDir === 'left' ? 'right' : 'left'),
    },
  ]
  return (
    <>
      {p.open && <div className="gm-backdrop" onClick={p.onClose} />}
      <div className={`game-menu ${p.open ? 'open' : ''}`} role="dialog" aria-modal="true">
        <div className="gm-head">
          <span className="gm-title">{t('gm.title')}</span>
          <button className="gm-close" onClick={p.onClose} aria-label={t('common.close')}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="gm-rows">
          {rows.map((r) => (
            <button key={r.label} type="button" className="gm-row" onClick={r.toggle}>
              <span className="gm-label">{r.label}</span>
              {r.value != null ? (
                <span className="gm-chip">{r.value}</span>
              ) : (
                <span className={`gm-switch ${r.on ? 'on' : 'off'}`} aria-hidden="true">
                  <span className="gm-knob" />
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Turnuvalar/Arkadaşlar/Mağaza KALDIRILDI — oyun sırasında navigasyon yok */}
        <div className="gm-actions">
          <button
            className="gm-circle lobby"
            onClick={() => {
              p.onClose()
              p.onLobby()
            }}
          >
            <span className="gm-circle-ic"><Icon name="home" size={18} /></span>
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
              <span className="gm-circle-ic"><Icon name="flag" size={18} /></span>
              <span className="gm-circle-lbl">{t('resign.button')}</span>
            </button>
          )}
        </div>
      </div>
    </>
  )
}
