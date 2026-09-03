import { useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import SetupBoard from './SetupBoard'
import type { TimeControl } from './MatchSetup'

// "Özel Oyun Oluştur" (arkadasinla oyna). Tasarim MatchSetup (YZ ile Oyna) ile AYNI:
// sol ayar karti (Oyun turu / Uzunluk / Saat) + sag board onizleme.
const CLOCKS: { id: TimeControl; key: string }[] = [
  { id: 'casual', key: 'setup.clockCasual' },
  { id: 'normal', key: 'setup.clockNormal' },
  { id: 'speed', key: 'setup.clockSpeed' },
]
// Mac uzunlugu secenekleri (Tek Oyun ayri sekme = 1 puan).
const LENGTHS = [3, 5, 7, 9, 11, 15, 25]

interface BoardColors {
  panel: string
  a: string
  b: string
  checker: string
}

interface Props {
  onCreate: (opts: { target: number; timeControl: TimeControl }) => void
  onJoin: (code: string) => void // arkadasin verdigi kodla odaya katil
  onCancel: () => void
  board: BoardColors
  onChangeBoard: () => void
}

export default function FriendGameSetup({ onCreate, onJoin, onCancel, board, onChangeBoard }: Props) {
  const { t } = useT()
  useEscape(onCancel)
  const [tab, setTab] = useState<'single' | 'match'>('single')
  const [tc, setTc] = useState<TimeControl>('casual')
  const [length, setLength] = useState(5)
  const [code, setCode] = useState('') // arkadasin verdigi oda kodu
  const target = tab === 'single' ? 1 : length

  return (
    <div className="register-overlay page setup-page">
      <div className="setup-split">
        <div className="register-card setup-card">
          <h2>
            <Icon name="users" size={24} /> {t('friend.title')}
          </h2>

          {/* Oyun türü: Tek Oyun / Maç Oyunu */}
          <div className="setup-row">
            <div className="setup-label">{t('friend.type')}</div>
            <div className="setup-tiles">
              <button
                className={`setup-tile ${tab === 'single' ? 'active' : ''}`}
                onClick={() => setTab('single')}
              >
                {t('friend.single')}
              </button>
              <button
                className={`setup-tile ${tab === 'match' ? 'active' : ''}`}
                onClick={() => setTab('match')}
              >
                {t('friend.match')}
              </button>
            </div>
          </div>

          {/* Uzunluk (yalnizca Maç Oyunu) */}
          {tab === 'match' && (
            <div className="setup-row">
              <div className="setup-label">{t('setup.length')}</div>
              <div className="target-grid">
                {LENGTHS.map((n) => (
                  <button
                    key={n}
                    className={`target-chip ${length === n ? 'active' : ''}`}
                    onClick={() => setLength(n)}
                    aria-pressed={length === n}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Süre (saat) — 3 preset */}
          <div className="setup-row">
            <div className="setup-label">{t('setup.time')}</div>
            <div className="setup-tiles">
              {CLOCKS.map((c) => (
                <button
                  key={c.id}
                  className={`setup-tile ${tc === c.id ? 'active' : ''}`}
                  onClick={() => setTc(c.id)}
                >
                  {t(c.key)}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-actions">
            <Button variant="secondary" onClick={onCancel}>
              {t('setup.cancel')}
            </Button>
            <Button variant="default" onClick={() => onCreate({ target, timeControl: tc })}>
              <Icon name="play" size={18} /> {t('friend.create')}
            </Button>
          </div>

          {/* Arkadasin KOD verdiyse: buradan odaya katil (ayarlar odayi kuranin) */}
          <div className="friend-join-box">
            <div className="setup-label">{t('friend.joinTitle')}</div>
            <div className="friend-join">
              <input
                className="friend-join-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                placeholder={t('mp.enterCode')}
                maxLength={5}
                autoCapitalize="characters"
                onKeyDown={(e) => e.key === 'Enter' && code.trim() && onJoin(code.trim())}
              />
              <Button variant="outline" disabled={!code.trim()} onClick={() => onJoin(code.trim())}>
                <Icon name="play" size={16} /> {t('mp.join')}
              </Button>
            </div>
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
