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
// Mac uzunlugu secenekleri (Tek Oyun ayri sekme = 1 puan). Tam tek sayi dizisi 3..25.
const LENGTHS = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]

interface BoardColors {
  id?: string // ozel desenli boardlar (or. 'citrus-wood') onizlemesi icin
  panel: string
  a: string
  b: string
  checker: string
  light?: string // acik pul rengi (onizleme gercek tahta ile ayni pulu gostersin)
  pointStyle?: 'sharp' | 'rounded'
  surface?: 'plain' | 'gradient' | 'felt' | 'wood'
  checkerStyle?: 'flat' | 'gloss' | 'ice' | 'ring' | 'neon'
  pointImgA?: string
  pointImgB?: string
  pointFitA?: import('../boardThemes').PointFit
  pointFitB?: import('../boardThemes').PointFit
  pointImgs?: Record<number, string>
  pointFits?: Record<number, import('../boardThemes').PointFit>
  surfaceImgLeft?: string
  surfaceImgRight?: string
  surfaceOpacity?: number
  pointTexts?: Record<number, string>
}

interface Props {
  onCreate: (opts: { target: number; timeControl: TimeControl; unrated: boolean; classic: boolean }) => void
  onJoin: (code: string) => void // arkadasin verdigi kodla odaya katil
  onCancel: () => void
  board: BoardColors
  onChangeBoard: () => void
  // Belirli bir oyuncuyu DAVET etme modu (cevrimici listeden kilic ikonu): secili rakip
  // gosterilir, "Oda Oluştur" yerine "Davet Gönder" -> onInvite; kod-ile-katil kutusu gizlenir.
  invitee?: { id: number; name: string; avatar?: string | null } | null
  onInvite?: (opts: { target: number; timeControl: TimeControl; unrated: boolean; classic: boolean }) => void
  defaultClassic?: boolean // KLASIK TAVLA girişi: klasik varsayılan ON + Maç Oyunu sekmesi açık
}

export default function FriendGameSetup({ onCreate, onJoin, onCancel, board, onChangeBoard, invitee, onInvite, defaultClassic = false }: Props) {
  const { t } = useT()
  useEscape(onCancel)
  // KLASIK girişte Maç Oyunu sekmesi açık başlar (klasik yalnız maç oyununda anlamlı).
  const [tab, setTab] = useState<'single' | 'match'>(defaultClassic ? 'match' : 'single')
  const [tc, setTc] = useState<TimeControl>('normal') // varsayilan sure: Normal
  const [length, setLength] = useState(5)
  const [code, setCode] = useState('') // arkadasin verdigi oda kodu
  // PUANSIZ mac: rating degismez, PR hesaplanir (mac analizinde) ama genel PR/siralamaya girmez.
  const [unrated, setUnrated] = useState(false)
  // KLASIK TAVLA: kup yok + mars=2 (yalniz Mac Oyunu; Tek Oyun kup/tek-puan ile zaten farkli).
  const [classic, setClassic] = useState(defaultClassic)
  const target = tab === 'single' ? 1 : length
  const inviting = !!invitee // davet modu mu?

  return (
    <div className="register-overlay page setup-page">
      <div className="setup-split">
        <div className="register-card setup-card">
          <h2>
            <Icon name={inviting ? 'sword' : 'users'} size={24} /> {inviting ? t('friend.inviteTitle') : t('friend.title')}
          </h2>

          {/* Davet modu: KIMI davet ettigin net gorunsun */}
          {inviting && (
            <div className="invite-target">
              <span className="invite-target-av" aria-hidden="true">
                {invitee!.avatar ? <img src={invitee!.avatar} alt="" /> : <Icon name="user" size={18} />}
              </span>
              <span className="invite-target-txt">
                <span className="invite-target-label">{t('friend.inviteWho')}</span>
                <strong>{invitee!.name}</strong>
              </span>
            </div>
          )}

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

          {/* Puanli / Puansiz: diger satirlarla ayni karo secici (checkbox gozden kaciyordu). */}
          <div className="setup-row">
            <div className="setup-label">{t('friend.ratingMode')}</div>
            <div className="setup-tiles">
              <button
                className={`setup-tile ${!unrated ? 'active' : ''}`}
                onClick={() => setUnrated(false)}
                aria-pressed={!unrated}
              >
                {t('friend.ratedChip')}
              </button>
              <button
                className={`setup-tile ${unrated ? 'active' : ''}`}
                onClick={() => setUnrated(true)}
                aria-pressed={unrated}
              >
                {t('friend.unratedChip')}
              </button>
            </div>
            {unrated && <p className="setup-unrated-hint">{t('friend.unratedHint')}</p>}
          </div>

          {/* KLASIK TAVLA: kup yok + mars=2 (yalniz Mac Oyunu'nda anlamli; Tek Oyun zaten tek puan). */}
          {tab === 'match' && (
            <div className="setup-row">
              <div className="setup-label">{t('classic.title')}</div>
              <div className="setup-tiles">
                <button
                  className={`setup-tile ${!classic ? 'active' : ''}`}
                  onClick={() => setClassic(false)}
                  aria-pressed={!classic}
                >
                  {t('friend.match')}
                </button>
                <button
                  className={`setup-tile ${classic ? 'active' : ''}`}
                  onClick={() => setClassic(true)}
                  aria-pressed={classic}
                >
                  {t('classic.title')}
                </button>
              </div>
              {classic && <p className="setup-unrated-hint">{t('classic.note')}</p>}
            </div>
          )}

          <div className="setup-actions">
            <Button variant="secondary" onClick={onCancel}>
              {t('setup.cancel')}
            </Button>
            {inviting ? (
              <Button variant="default" onClick={() => onInvite?.({ target, timeControl: tc, unrated, classic: tab === 'match' && classic })}>
                <Icon name="sword" size={18} /> {t('friend.inviteBtn')}
              </Button>
            ) : (
              <Button variant="default" onClick={() => onCreate({ target, timeControl: tc, unrated, classic: tab === 'match' && classic })}>
                <Icon name="play" size={18} /> {t('friend.create')}
              </Button>
            )}
          </div>

          {/* Arkadasin KOD verdiyse: buradan odaya katil (ayarlar odayi kuranin). Davet modunda gizli. */}
          {!inviting && (
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
          )}
        </div>

        <div className="setup-preview">
          <SetupBoard
            panel={board.panel}
            a={board.a}
            b={board.b}
            checker={board.checker}
            cream={board.light}
            pointStyle={board.pointStyle}
            surface={board.surface}
            checkerStyle={board.checkerStyle}
            pointImgA={board.pointImgA}
            pointImgB={board.pointImgB}
            pointFitA={board.pointFitA}
            pointFitB={board.pointFitB}
            pointImgs={board.pointImgs}
            pointFits={board.pointFits}
            surfaceImgLeft={board.surfaceImgLeft}
            surfaceImgRight={board.surfaceImgRight}
            surfaceOpacity={board.surfaceOpacity}
            pointTexts={board.pointTexts}
            themeId={board.id}
            onChangeBoard={onChangeBoard}
            changeLabel={t('setup.changeBoard')}
          />
        </div>
      </div>
    </div>
  )
}
