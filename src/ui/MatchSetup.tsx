import { useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Coins } from './Coins'
import { Button } from '@/components/ui/button'
import SetupBoard from './SetupBoard'

export type TimeControl = 'casual' | 'normal' | 'speed'
export type SetupMode = 'pvb' | 'online'

export interface MatchOptions {
  mode: SetupMode
  target: number
  targets?: number[] // online: kabul edilen uzunluklar (coklu -> kolay eslesme)
  showPip: boolean
  showAnalysis: boolean
  timeControl: TimeControl
  ranked?: boolean // false = casual (puana etki etmez); yalnizca pvb
  difficulty?: number // 1..10 AI seviyesi
  betPct?: number // online: bakiyenin % kaci bahis (10/30/50/100)
  minRating?: number // online: rakip min puan filtresi
}

// Saat presetleri (Casual / Normal / Speed)
const CLOCKS: { id: TimeControl; key: string }[] = [
  { id: 'casual', key: 'setup.clockCasual' },
  { id: 'normal', key: 'setup.clockNormal' },
  { id: 'speed', key: 'setup.clockSpeed' },
]
// Maks bahis: bakiyenin yuzdesi
const BETS: { pct: number; key: string }[] = [
  { pct: 10, key: 'setup.betCareful' },
  { pct: 30, key: 'setup.betNormal' },
  { pct: 50, key: 'setup.betAggr' },
  { pct: 100, key: 'setup.betAll' },
]

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

// Her seviyenin hedef PR (performans reytingi) araligi — dusuk = daha iyi oyun.
// Seviye butonlarinin altinda muted olarak gosterilir ("Hedef PR 35–50" gibi).
const PR_TARGETS = [
  '35–50',
  '25–35',
  '18–25',
  '12–18',
  '8–12',
  '5–8',
  '3–5',
  '1.5–3',
  '0.5–1.5',
  '0–0.5',
]

interface BoardColors {
  panel: string
  a: string
  b: string
  checker: string
}

interface Props {
  mode: SetupMode
  targets: readonly number[]
  initial: Omit<MatchOptions, 'mode'>
  coins?: number
  board: BoardColors
  onChangeBoard: () => void
  onConfirm: (opts: MatchOptions) => void
  onCancel: () => void
}

export default function MatchSetup({
  mode: initialMode,
  targets,
  initial,
  coins = 0,
  board,
  onChangeBoard,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useT()
  const mode = initialMode // Mac Oyunu online-only; rematch pvb (mod degistirilmez)
  // Online: coklu uzunluk secilebilir (kolay eslesme). pvb: tek uzunluk.
  const [accepted, setAccepted] = useState<number[]>([initial.target])
  const toggleTarget = (n: number) => {
    if (mode !== 'online') {
      setAccepted([n])
      return
    }
    setAccepted((cur) =>
      cur.includes(n) ? (cur.length > 1 ? cur.filter((x) => x !== n) : cur) : [...cur, n].sort((a, b) => a - b),
    )
  }
  const [timeControl, setTimeControl] = useState<TimeControl>(initial.timeControl)
  const [difficulty, setDifficulty] = useState<number>(initial.difficulty ?? 10)
  const [betPct, setBetPct] = useState<number>(initial.betPct ?? 10)
  const [minRating, setMinRating] = useState<number>(initial.minRating ?? 0)
  const stake = Math.floor((coins * betPct) / 100)

  return (
    <div className="register-overlay page setup-page">
      <div className="setup-split">
      <div className="register-card setup-card">
        <h2>
          {mode === 'online' ? (
            <>
              <Icon name="ranking" size={24} /> {t('menu.match')}
            </>
          ) : (
            <>
              {/* Sayfa basligi menuden farkli: menu "YZ ile Oyna", sayfa "Yapay Zeka ile Oyna" */}
              <Icon name="robot" size={24} /> {t('home.vsBot')}
            </>
          )}
        </h2>

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
                  <span className="level-chip-name">{i + 1}. {name}</span>
                  <span className="level-chip-pr">{t('setup.targetPr')} {PR_TARGETS[i]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Oyun kaçta bitsin (online: birden fazla seçilebilir -> daha kolay eşleşme) */}
        <div className="setup-row">
          <div className="setup-label">{t('setup.length')}</div>
          <div className="target-grid">
            {targets.map((n) => (
              <button
                key={n}
                className={`target-chip ${accepted.includes(n) ? 'active' : ''}`}
                onClick={() => toggleTarget(n)}
                aria-pressed={accepted.includes(n)}
              >
                {n}
              </button>
            ))}
          </div>
          {mode === 'online' && (
            <div className="pa-depth-note">{t('setup.lengthMulti')}</div>
          )}
        </div>

        {/* Süre (saat) — 3 preset */}
        <div className="setup-row">
          <div className="setup-label">{t('setup.time')}</div>
          <div className="setup-tiles">
            {CLOCKS.map((c) => (
              <button
                key={c.id}
                className={`setup-tile ${timeControl === c.id ? 'active' : ''}`}
                onClick={() => setTimeControl(c.id)}
              >
                {t(c.key)}
              </button>
            ))}
          </div>
        </div>

        {/* Maks bahis + rakip min puan (yalnizca online) */}
        {mode === 'online' && (
          <>
            <div className="setup-row">
              <div className="setup-label">
                {t('setup.maxBet')} · <Coins amount={stake} size={13} />
              </div>
              <div className="setup-tiles bets">
                {BETS.map((b) => (
                  <button
                    key={b.pct}
                    className={`setup-tile ${betPct === b.pct ? 'active' : ''}`}
                    onClick={() => setBetPct(b.pct)}
                  >
                    <span>{t(b.key)}</span>
                    <span className="bet-pct">%{b.pct}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="setup-row">
              <div className="setup-label">
                {t('setup.minRating')}: <b>{minRating}</b>
              </div>
              <input
                type="range"
                className="level-slider"
                min={0}
                max={2000}
                step={50}
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
              />
            </div>
          </>
        )}

        {/* Bota karsi: her mac PUANLI + pip ACIK. Canli "Analizi goster" KALDIRILDI
            (mac sonu analizi yeterli). */}

        <div className="setup-actions">
          <Button variant="secondary" onClick={onCancel}>
            {t('setup.cancel')}
          </Button>
          <Button
            variant="default"
            onClick={() =>
              onConfirm({
                mode,
                target: mode === 'online' ? Math.max(...accepted) : accepted[0],
                targets: accepted,
                showPip: mode === 'pvb' ? true : initial.showPip,
                showAnalysis: false, // canli analiz kaldirildi
                timeControl,
                ranked: true,
                difficulty: mode === 'pvb' ? difficulty : undefined,
                betPct: mode === 'online' ? betPct : undefined,
                minRating: mode === 'online' ? minRating : undefined,
              })
            }
          >
            <Icon name="play" size={18} /> {t('setup.start')}
          </Button>
        </div>
      </div>
      <div className="setup-preview">
        <SetupBoard
          panel={board.panel}
          a={board.a}
          b={board.b}
          checker={board.checker}
          onChangeBoard={onChangeBoard}
          changeLabel={t('setup.changeBoard')}
        />
      </div>
      </div>
    </div>
  )
}
