import { useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import SetupBoard from './SetupBoard'

// Tek Oyun = money game: her zaman TEK oyun (1 puan). Puan/uzunluk secimi YOK.

export interface SoloLevel {
  level: number
  stake: number
  theme: string
  panel: string
  a: string
  b: string
}

// 12 sabit bahis seviyesi; her biri farkli bir tahta temasi.
export const SOLO_LEVELS: SoloLevel[] = [
  { level: 1, stake: 100, theme: 'tavla', panel: '#efeae1', a: '#d98b7a', b: '#a83a2b' },
  { level: 2, stake: 250, theme: 'walnut', panel: '#7a5230', a: '#caa06a', b: '#5c3a20' },
  { level: 3, stake: 500, theme: 'green', panel: '#2f7d4f', a: '#56b37a', b: '#22633e' },
  { level: 4, stake: 1000, theme: 'purple', panel: '#7a4fb0', a: '#a77ad0', b: '#5a3a8c' },
  { level: 5, stake: 2500, theme: 'teal', panel: '#2a8a8a', a: '#4fb3b3', b: '#1e6666' },
  { level: 6, stake: 5000, theme: 'red', panel: '#a83a3a', a: '#cc6a6a', b: '#7a2a2a' },
  { level: 7, stake: 10000, theme: 'night', panel: '#2a3560', a: '#4a5a9a', b: '#1c2444' },
  { level: 8, stake: 25000, theme: 'gray', panel: '#5a6478', a: '#8b95a8', b: '#434c5e' },
  { level: 9, stake: 50000, theme: 'ocean', panel: '#1f6f8b', a: '#3fa9c9', b: '#144f63' },
  { level: 10, stake: 100000, theme: 'gold', panel: '#b8912f', a: '#e8c14a', b: '#8a6a1a' },
  { level: 11, stake: 250000, theme: 'sunset', panel: '#c25a3a', a: '#f0894f', b: '#8f3a22' },
  { level: 12, stake: 1000000, theme: 'neon', panel: '#2a2a4a', a: '#18e0c0', b: '#7a1fb0' },
]

interface Props {
  coins: number
  onPick: (stake: number, theme: string) => void
  onClose: () => void
}

export default function SoloStakes({ coins, onPick, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  const fmt = (n: number) => n.toLocaleString('tr-TR')
  // Baslangicta oynanabilir ilk seviye secili (yoksa ilk seviye)
  const [sel, setSel] = useState<SoloLevel>(
    () => SOLO_LEVELS.find((l) => coins >= l.stake) ?? SOLO_LEVELS[0],
  )
  const selLocked = coins < sel.stake

  return (
    <div className="register-overlay modal page">
      <div className="setup-split">
        <div className="register-card solo-card">
          <button className="modal-close" onClick={onClose} aria-label="Kapat">
            <Icon name="x" size={16} />
          </button>
          <h2>
            <Icon name="play" size={20} /> {t('solo.title')}
          </h2>
          <p className="register-sub">{t('solo.sub')}</p>
          <div className="solo-balance">
            <Icon name="coin" size={15} /> {fmt(coins)}
          </div>

          <div className="solo-grid">
            {SOLO_LEVELS.map((lv) => {
              const locked = coins < lv.stake
              return (
                <button
                  key={lv.level}
                  className={`solo-tile ${locked ? 'locked' : ''} ${sel.level === lv.level ? 'selected' : ''}`}
                  disabled={locked}
                  onClick={() => setSel(lv)}
                  title={locked ? t('solo.locked') : t('solo.play')}
                >
                  <span className="solo-lvl">{t('solo.level', { n: lv.level })}</span>
                  <span
                    className="solo-board"
                    style={{
                      background: `linear-gradient(135deg, ${lv.a} 0%, ${lv.panel} 50%, ${lv.b} 100%)`,
                    }}
                  >
                    <span className="solo-dots">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <i key={i} />
                      ))}
                    </span>
                    {locked && (
                      <span className="solo-lock">
                        <Icon name="lock" size={18} />
                      </span>
                    )}
                  </span>
                  <span className="solo-stake">
                    <Icon name="coin" size={14} /> {fmt(lv.stake)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="setup-preview">
          <SetupBoard panel={sel.panel} a={sel.a} b={sel.b} checker={sel.b} />
          <div className="solo-preview-bar">
            <span className="solo-preview-info">
              {t('solo.level', { n: sel.level })} ·{' '}
              <b>
                <Icon name="coin" size={14} /> {fmt(sel.stake)}
              </b>
            </span>
            <button
              className="galaxy-btn solo-start"
              disabled={selLocked}
              onClick={() => onPick(sel.stake, sel.theme)}
            >
              <Icon name="play" size={18} /> {t('setup.start')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
