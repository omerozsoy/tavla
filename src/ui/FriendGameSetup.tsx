import { useState } from 'react'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Coins } from './Coins'
import { Button } from '@/components/ui/button'
import { useEscape } from './useEscape'
import SetupBoard from './SetupBoard'
import type { TimeControl } from './MatchSetup'
import { BET_PCTS } from '../betOptions'
import { winDelta, lossDelta } from './Scoring'

// "Özel Oyun Oluştur" (arkadasinla oyna). Tasarim MatchSetup (YZ ile Oyna) ile AYNI:
// sol ayar karti (Oyun turu / Uzunluk / Saat) + sag board onizleme.
const CLOCKS: { id: TimeControl; key: string }[] = [
  { id: 'casual', key: 'setup.clockCasual' },
  { id: 'normal', key: 'setup.clockNormal' },
  { id: 'speed', key: 'setup.clockSpeed' },
]
// Mac uzunlugu secenekleri (Tek Oyun ayri sekme = 1 puan). 13 puana kadar (kullanici istegi).
const LENGTHS = [3, 5, 7, 9, 11, 13]
const CLASSIC_LENGTHS = [3, 5, 7] // KLASIK TAVLA: max 7 (9/11 yok)

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
  onCreate: (opts: { target: number; timeControl: TimeControl; unrated: boolean; classic: boolean; betPct: number }) => void
  onJoin: (code: string) => void // arkadasin verdigi kodla odaya katil
  onCancel: () => void
  board: BoardColors
  onChangeBoard: () => void
  coins?: number // kullanıcının coin'i (pot önizlemesi: bakiyenin %'si)
  // Belirli bir oyuncuyu DAVET etme modu (cevrimici listeden kilic ikonu): secili rakip
  // gosterilir, "Oda Oluştur" yerine "Davet Gönder" -> onInvite; kod-ile-katil kutusu gizlenir.
  invitee?: { id: number; name: string; avatar?: string | null; rating?: number | null } | null
  onInvite?: (opts: { target: number; timeControl: TimeControl; unrated: boolean; classic: boolean; betPct: number }) => void
  myRating?: number // kendi puanın (puanlı davette kazanç/kayıp tahmini için)
  defaultClassic?: boolean // KLASIK TAVLA girişi: klasik varsayılan ON + Maç Oyunu sekmesi açık
  titleOverride?: string // admin "Sayfa Metni" baslik override'i (davet modu HARIÇ; bos -> i18n varsayilani)
  // PUANLI DAVET (yalnız Çevrimiçi Oyuncular play tuşu): maç puanlı (unrated=false). TÜM seçenekler açık
  // (Tek Oyun=1 puanlık + tüm uzunluk/süreler); fark yalnız puanlı + "puanlı" notu. Varsayılan false.
  ranked?: boolean
  // DÜELLO modu (çevrimiçi takımlı oyuncuya kılıç): puansız + coin YOK; uzunluk yalnız 1/3/5.
  // Tek/Maç sekmeleri, bahis satırı ve kod-ile-katıl kutusu gizlenir. onInvite betPct=0 ile çağrılır.
  duel?: boolean
}

// Düello uzunlukları (puan): 1 / 3 / 5.
const DUEL_LENGTHS = [1, 3, 5]

export default function FriendGameSetup({ onCreate, onJoin, onCancel, board, onChangeBoard, coins = 0, invitee, onInvite, defaultClassic = false, titleOverride, ranked = false, myRating, duel = false }: Props) {
  const { t } = useT()
  useEscape(onCancel)
  const [betPct, setBetPct] = useState(10) // yüzde bahis (min %10, potsuz maç yok)
  const [duelLen, setDuelLen] = useState(3) // düello uzunluğu (1/3/5)
  const pot = Math.floor((coins * betPct) / 100) // bu bahiste riske edilen coin
  // KLASIK girişte Maç Oyunu sekmesi açık başlar (klasik yalnız maç oyununda anlamlı). PUANLI davette
  // TÜM seçenekler açık (Tek Oyun=1 puanlık dahil) -> normal akışla birebir aynı, yalnız puanlı.
  const [tab, setTab] = useState<'single' | 'match'>(defaultClassic ? 'match' : 'single')
  const [tc, setTc] = useState<TimeControl>('normal') // varsayilan sure: Normal
  const [length, setLength] = useState(3)
  const [code, setCode] = useState('') // arkadasin verdigi oda kodu
  // Arkadaşlık/kılıç maçları PUANSIZ (2026-11-01): rating değişmez, PR yalnız analizde. İSTİSNA: puanlı
  // davet (ranked=true, yalnız Çevrimiçi Oyuncular play tuşu) -> unrated=false, sonuç rating'i değiştirir.
  const unrated = duel ? true : !ranked // düello DAİMA puansız
  // KLASIK TAVLA: kup yok + mars=2. Mod SAYFAYA gore SABIT (Modern /arkadasinla-oyna vs
  // Klasik /klasik-arkadasinla-oyna) -> tek sayfada Modern/Klasik gecisi YOK, ayri sayfalar.
  const classic = defaultClassic
  const target = duel ? duelLen : (tab === 'single' ? 1 : length)
  const inviting = !!invitee // davet modu mu?
  // Puanlı davette seçili uzunluğa göre kazanç/kayıp tahmini (backend RatingPolicy ile birebir formül,
  // Scoring.tsx'ten). Rating yoksa 1500 varsayılan. Uzunluk değişince C katsayısıyla canlı güncellenir.
  const estWin = ranked ? winDelta(myRating ?? 1500, invitee?.rating ?? 1500, target) : 0
  const estLoss = ranked ? Math.abs(lossDelta(myRating ?? 1500, invitee?.rating ?? 1500, target)) : 0

  return (
    <div className="register-overlay page setup-page">
      <div className="setup-split">
        <div className="register-card setup-card">
          <h2>
            <Icon name={duel ? 'swords' : inviting ? 'sword' : 'users'} size={24} /> {duel ? t('duel.title') : inviting ? t(ranked ? 'friend.inviteMatchTitle' : 'friend.inviteTitle') : titleOverride || (classic ? t('classic.title') : t('friend.title'))}
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
                {ranked && (
                  <span className="invite-target-est">
                    <span className="est-win">{t('friend.rankedWin', { win: estWin })}</span>
                    <span className="est-loss">{t('friend.rankedLoss', { loss: estLoss })}</span>
                  </span>
                )}
              </span>
            </div>
          )}

          {/* DÜELLO: uzunluk doğrudan 1/3/5 (tür sekmesi/bahis yok). Normal davet: Tek/Maç sekmeleri. */}
          {duel ? (
            <div className="setup-row">
              <div className="setup-label">{t('duel.pickPoints')}</div>
              <div className="target-grid">
                {DUEL_LENGTHS.map((n) => (
                  <button
                    key={n}
                    className={`target-chip ${duelLen === n ? 'active' : ''}`}
                    onClick={() => setDuelLen(n)}
                    aria-pressed={duelLen === n}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ) : (
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
          )}

          {/* Uzunluk (yalnizca Maç Oyunu; düelloda yukarıda 1/3/5) */}
          {!duel && tab === 'match' && (
            <div className="setup-row">
              <div className="setup-label">{t('setup.length')}</div>
              <div className="target-grid">
                {(classic ? CLASSIC_LENGTHS : LENGTHS).map((n) => (
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

          {/* Maks bahis (yüzde): potsuz maç YOK -> min %10. DÜELLOda coin/bahis YOK -> gizli. */}
          {!duel && (
            <div className="setup-row">
              <div className="setup-label">
                {t('setup.maxBet')} · <Coins amount={pot} size={13} />
              </div>
              <div className="setup-tiles bets">
                {BET_PCTS.map((pct) => (
                  <button
                    key={pct}
                    className={`setup-tile ${betPct === pct ? 'active' : ''}`}
                    onClick={() => setBetPct(pct)}
                  >
                    <span className="bet-pct">%{pct}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DÜELLO: puansız + galibiyet sıralaması notu. Normal davet: puanlı/puansız notu. */}
          <p className="setup-unrated-hint">{duel ? t('duel.intro') : t(ranked ? 'friend.rankedNote' : 'friend.alwaysUnrated')}</p>

          {/* KLASIK TAVLA sayfasi (yalniz Mac Oyunu'nda anlamli): mod sabit, sadece bilgi notu. */}
          {classic && tab === 'match' && <p className="setup-unrated-hint">{t('classic.note')}</p>}

          <div className="setup-actions">
            <Button variant="secondary" onClick={onCancel}>
              {t('setup.cancel')}
            </Button>
            {inviting ? (
              <Button variant="default" onClick={() => onInvite?.({ target, timeControl: tc, unrated, classic: duel ? false : tab === 'match' && classic, betPct: duel ? 0 : betPct })}>
                <Icon name={duel ? 'swords' : 'sword'} size={18} /> {duel ? t('duel.invite') : t('friend.inviteBtn')}
              </Button>
            ) : (
              <Button variant="default" onClick={() => onCreate({ target, timeControl: tc, unrated, classic: tab === 'match' && classic, betPct })}>
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
