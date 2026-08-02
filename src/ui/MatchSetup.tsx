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
  difficulty?: number // 1..10 AI seviyesi
}

const AI_LEVELS = [
  'Beginner',
  'Rookie',
  'Casual',
  'Skilled',
  'Expert',
  'Master',
  'Grandmaster',
  'Elite',
  'Legend',
  'Neural AI',
]

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
  const [difficulty, setDifficulty] = useState<number>(initial.difficulty ?? 10)

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

        {/* Zorluk seviyesi (yalnizca yapay zekaya karsi) - 10 kademe */}
        {mode === 'pvb' && (
          <div className="setup-row">
            <div className="setup-label">
              {t('setup.difficulty')}: <b>{AI_LEVELS[difficulty - 1]}</b> ({difficulty}/10)
            </div>
            <input
              type="range"
              className="level-slider"
              min={1}
              max={10}
              step={1}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
            />
            <div className="level-grid">
              {AI_LEVELS.map((name, i) => (
                <button
                  key={name}
                  className={`level-chip ${difficulty === i + 1 ? 'active' : ''}`}
                  onClick={() => setDifficulty(i + 1)}
                >
                  {i + 1}. {name}
                </button>
              ))}
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
              className={timeControl !== 'off' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setTimeControl('standard')}
            >
              {t('setup.timeStandard')}
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
