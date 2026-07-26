import { useState } from 'react'
import { useT } from '../i18n'

export type TimeControl = 'off' | 'standard' | 'fast'
export type SetupMode = 'pvb' | 'online'

export interface MatchOptions {
  mode: SetupMode
  target: number
  showPip: boolean
  showAnalysis: boolean
  timeControl: TimeControl
  difficulty?: 'neural' | 'heuristic'
}

interface Props {
  mode: SetupMode
  targets: readonly number[]
  initial: Omit<MatchOptions, 'mode'>
  onConfirm: (opts: MatchOptions) => void
  onCancel: () => void
}

export default function MatchSetup({ mode: initialMode, targets, initial, onConfirm, onCancel }: Props) {
  const { t } = useT()
  const [mode, setMode] = useState<SetupMode>(initialMode)
  const [target, setTarget] = useState(initial.target)
  const [showPip, setShowPip] = useState(initial.showPip)
  const [showAnalysis, setShowAnalysis] = useState(initial.showAnalysis)
  const [timeControl, setTimeControl] = useState<TimeControl>(initial.timeControl)
  const [difficulty, setDifficulty] = useState<'neural' | 'heuristic'>(
    initial.difficulty ?? 'neural',
  )

  return (
    <div className="register-overlay">
      <div className="register-card setup-card">
        <h2>{t('setup.newGame')}</h2>

        {/* Oyun modu (2 secenek) */}
        <div className="setup-row">
          <div className="setup-label">{t('setup.mode')}</div>
          <div className="setup-modes">
            <button
              className={`mode-choice ${mode === 'pvb' ? 'active' : ''}`}
              onClick={() => setMode('pvb')}
            >
              <span className="mode-ico">🤖</span>
              {t('home.vsBot')}
            </button>
            <button
              className={`mode-choice ${mode === 'online' ? 'active' : ''}`}
              onClick={() => setMode('online')}
            >
              <span className="mode-ico">🌐</span>
              {t('home.online')}
            </button>
          </div>
        </div>

        {/* Zorluk (yalnizca yapay zekaya karsi) */}
        {mode === 'pvb' && (
          <div className="setup-row">
            <div className="setup-label">{t('setup.difficulty')}</div>
            <div className="menu-targets">
              <button
                className={difficulty === 'neural' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => setDifficulty('neural')}
              >
                {t('menu.neural')}
              </button>
              <button
                className={difficulty === 'heuristic' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => setDifficulty('heuristic')}
              >
                {t('menu.fast')}
              </button>
            </div>
          </div>
        )}

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

        {/* Süre (saat) */}
        <div className="setup-row">
          <div className="setup-label">{t('setup.time')}</div>
          <div className="menu-targets">
            <button
              className={timeControl === 'standard' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setTimeControl('standard')}
            >
              {t('setup.timeStandard')}
            </button>
            <button
              className={timeControl === 'fast' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setTimeControl('fast')}
            >
              {t('setup.timeFast')}
            </button>
            <button
              className={timeControl === 'off' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setTimeControl('off')}
            >
              {t('setup.timeOff')}
            </button>
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
            onClick={() =>
              onConfirm({
                mode,
                target,
                showPip,
                showAnalysis,
                timeControl,
                difficulty: mode === 'pvb' ? difficulty : undefined,
              })
            }
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
