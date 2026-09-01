import { useState } from 'react'
import './friendGameSetup.css'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import type { TimeControl } from './MatchSetup'

// "Özel Oyun Oluştur" (arkadasinla oyna): Tek oyun / Maç Oyunu sekmesi + Saat preseti
// (+ Maç Oyunu'nda 1-25 uzunluk slider'i). Onaylayinca davet-kodlu oda olusturulur.
const CLOCKS: { id: TimeControl; key: string }[] = [
  { id: 'casual', key: 'setup.clockCasual' },
  { id: 'normal', key: 'setup.clockNormal' },
  { id: 'speed', key: 'setup.clockSpeed' },
]

interface Props {
  onCreate: (opts: { target: number; timeControl: TimeControl }) => void
  onCancel: () => void
}

export default function FriendGameSetup({ onCreate, onCancel }: Props) {
  const { t } = useT()
  useEscape(onCancel)
  const [tab, setTab] = useState<'single' | 'match'>('single')
  const [tc, setTc] = useState<TimeControl>('casual')
  const [length, setLength] = useState(1)
  const target = tab === 'single' ? 1 : length

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card fg-card">
        <div className="fg-head">
          <button type="button" className="fg-back" onClick={onCancel} aria-label={t('common.close')}>
            <Icon name="arrow-right" size={20} />
          </button>
          <h2>{t('friend.title')}</h2>
        </div>

        {/* Tek oyun / Maç Oyunu sekmeleri */}
        <div className="fg-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'single'}
            className={`fg-tab ${tab === 'single' ? 'active' : ''}`}
            onClick={() => setTab('single')}
          >
            {t('friend.single')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'match'}
            className={`fg-tab ${tab === 'match' ? 'active' : ''}`}
            onClick={() => setTab('match')}
          >
            {t('friend.match')}
          </button>
        </div>

        {/* Saat */}
        <div className="fg-section-title">{t('friend.clock')}</div>
        <div className="fg-clocks">
          {CLOCKS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`fg-clock ${tc === c.id ? 'active' : ''}`}
              onClick={() => setTc(c.id)}
              aria-pressed={tc === c.id}
            >
              <span className={`fg-radio ${tc === c.id ? 'on' : ''}`} aria-hidden />
              <span className="fg-clock-lbl">{t(c.key)}</span>
            </button>
          ))}
        </div>

        {/* Uzunluk (yalnizca Maç Oyunu; Tek oyun = 1 puan) */}
        {tab === 'match' && (
          <>
            <div className="fg-section-title">{t('friend.length')}</div>
            <div className="fg-slider-row">
              <span className="fg-slider-val">{length}</span>
              <input
                type="range"
                min={1}
                max={25}
                step={1}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="fg-slider"
                aria-label={t('friend.length')}
              />
            </div>
          </>
        )}

        <Button variant="default" className="fg-create" onClick={() => onCreate({ target, timeControl: tc })}>
          <Icon name="play" size={18} /> {t('friend.create')}
        </Button>
      </div>
    </div>
  )
}
