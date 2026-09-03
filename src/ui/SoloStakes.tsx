import { useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Coins } from './Coins'
import { useEscape } from './useEscape'
import { Button } from '@/components/ui/button'
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

interface BoardColors {
  panel: string
  a: string
  b: string
  checker: string
}

interface Props {
  coins: number
  /** Oyuncunun SECILI (gercek) tahta temasi — onizleme + oyunda kullanilir. */
  board: BoardColors
  onPick: (stake: number) => void
  /** Tahtayi Degistir -> BoardSettings acar (oyuncu kendi tahtasini secer). */
  onChangeBoard: () => void
  onClose: () => void
}

export default function SoloStakes({ coins, board, onPick, onChangeBoard, onClose }: Props) {
  const { t } = useT()
  useEscape(onClose)
  // Baslangicta oynanabilir ilk seviye secili (yoksa ilk seviye)
  const [sel, setSel] = useState<SoloLevel>(
    () => SOLO_LEVELS.find((l) => coins >= l.stake) ?? SOLO_LEVELS[0],
  )
  const selLocked = coins < sel.stake

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="setup-split">
        <div className="register-card solo-card">
          <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </Button>
          <h2>
            <Icon name="coins" size={20} /> {t('solo.title')}
          </h2>
          <p className="register-sub">{t('solo.sub')}</p>
          <div className="solo-balance">
            <Coins amount={coins} size={16} />
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
                    <Coins amount={lv.stake} size={14} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="setup-preview">
          {/* Onizleme oyuncunun GERCEK tahtasini gosterir + ortada "Tahtayi Degistir".
              Seviye yalnizca bahsi belirler; tahta artik seviyeye kilitli degil. */}
          <SetupBoard
            panel={board.panel}
            a={board.a}
            b={board.b}
            checker={board.checker}
            onChangeBoard={onChangeBoard}
            changeLabel={t('setup.changeBoard')}
          />
          <div className="solo-preview-bar">
            <span className="solo-preview-info">
              {t('solo.level', { n: sel.level })} ·{' '}
              <Coins amount={sel.stake} size={14} />
            </span>
            <Button
              variant="default"
              className="solo-start"
              disabled={selLocked}
              onClick={() => onPick(sel.stake)}
            >
              <Icon name="play" size={18} /> {t('setup.start')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
