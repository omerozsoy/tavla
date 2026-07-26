import { useState } from 'react'
import { useT } from '../i18n'

export interface MatchOptions {
  target: number
  showPip: boolean
  showAnalysis: boolean
}

interface Props {
  mode: 'local' | 'online'
  targets: readonly number[]
  initial: MatchOptions
  onConfirm: (opts: MatchOptions) => void
  onCancel: () => void
}

export default function MatchSetup({ mode, targets, initial, onConfirm, onCancel }: Props) {
  const { t } = useT()
  const [target, setTarget] = useState(initial.target)
  const [showPip, setShowPip] = useState(initial.showPip)
  const [showAnalysis, setShowAnalysis] = useState(initial.showAnalysis)

  return (
    <div className="register-overlay">
      <div className="register-card setup-card">
        <h2>{mode === 'online' ? t('setup.titleOnline') : t('setup.title')}</h2>

        {/* Oyun kaçta bitsin */}
        <div className="setup-row">
          <div className="setup-label">{t('setup.length')}</div>
          <div className="menu-targets">
            {targets.map((n) => (
              <button
                key={n}
                className={target === n ? 'menu-btn active' : 'menu-btn'}
                onClick={() => setTarget(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Pip göster */}
        <button
          className={`setup-toggle ${showPip ? 'on' : ''}`}
          onClick={() => setShowPip((v) => !v)}
        >
          <span>{t('setup.pip')}</span>
          <span className="setup-switch">{showPip ? t('setup.on') : t('setup.off')}</span>
        </button>

        {/* Analiz göster */}
        <button
          className={`setup-toggle ${showAnalysis ? 'on' : ''}`}
          onClick={() => setShowAnalysis((v) => !v)}
        >
          <span>{t('setup.analysis')}</span>
          <span className="setup-switch">{showAnalysis ? t('setup.on') : t('setup.off')}</span>
        </button>

        <div className="register-actions">
          <button
            className="galaxy-btn roll"
            onClick={() => onConfirm({ target, showPip, showAnalysis })}
          >
            {mode === 'online' ? t('setup.create') : t('setup.start')}
          </button>
          <button className="menu-btn" onClick={onCancel}>
            {t('setup.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
