import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './App.css'
// Cerceve animasyon secim demosu: gizli /cerceve-anim, tum sade animasyonlar isimli.
const CerceveAnim = lazy(() => import('./ui/CerceveAnim'))
import type { GameState, Move, Player, Step } from './engine/types'
import { cloneState, gameOutcome, opponent, winner } from './engine/board'
import { applyStep, boardKey, generateMoves, hasNoMove } from './engine/moves'
import {
  initialState,
  legalNextSteps,
  newTurn,
  reachableFromChecker,
  secureDie,
} from './engine/game'
import { HeuristicBot } from './engine/engine'
import { FairDice } from './engine/fairDice'
import { NeuralBot, type RankedMove } from './engine/neuralBot'
import { moveNotation } from './engine/notation'
import { explainMove, type Reason } from './engine/explain'
import { divisionOfPR } from './badges'
import { Sound } from './sound'
import { evaluatePosition, pipCount } from './engine/evaluate'
import {
  canDouble,
  matchWinner,
  newMatch,
  scoreGame,
  setupNextGame,
  shouldAutoRoll,
  type MatchState,
} from './engine/match'
import { cubeAdvice, takeDecision, type CubeAction, type TakeAction } from './engine/cube'
import Board from './ui/Board'
import Sidebar from './ui/Sidebar'
import { TavlaTvLogo, TavlaTvMark } from './ui/TavlaTvLogo'
import DiceRow, { Die } from './ui/Dice'
import Auth from './ui/Auth'
import Lobby from './ui/Lobby'
import AnalysisPanel, { type MoveError } from './ui/AnalysisPanel'
import {
  createRoom,
  joinRoom,
  matchmake,
  cancelMatchmake,
  settleRoomConfirmed,
  saveBlunders,
  enterRoom,
  tournamentMatchRoom,
  reportTournament,
  listTournaments,
  type Tournament,
  buyItem,
  selectFrame,
  claimDaily,
  ping,
  markNotificationsRead,
  deleteNotifications,
  inviteFriend,
  respondInvite,
  type GameInvite as GameInviteT,
  type AppNotification,
  type TournNotice as TournNoticeT,
  showRoom,
  updateRoom,
  myActiveRooms,
  type ActiveRoom,
  sendChat,
  reportRating,
  resendVerification,
  ApiError as ApiErr,
  type Slot,
  type ChatMsg,
} from './api'
import Chat from './ui/Chat'
import ClockStack from './ui/ClockStack'
import BoardPickerModal from './ui/BoardPickerModal'
import { sourceRect, destEl, flyChecker, type MoveStyle } from './ui/moveAnim'
import PositionAnalyzer from './ui/PositionAnalyzer'
import SideMenu from './ui/SideMenu'
import { Icon } from './ui/Icon'
import GameMenu from './ui/GameMenu'
import Leaderboard from './ui/Leaderboard'
import RankInfo from './ui/RankInfo'
import FairnessModal from './ui/FairnessModal'
import Friends from './ui/Friends'
import Lessons from './ui/Lessons'
import Tournaments from './ui/Tournaments'
import BannerSlider from './ui/BannerSlider'
import SoloStakes from './ui/SoloStakes'
import ErrorJournal from './ui/ErrorJournal'
import MatchAnalytics from './ui/MatchAnalytics'
import GamePreview from './ui/GamePreview'
import ContentView from './ui/ContentView'
import QuizPlay from './ui/QuizPlay'
import Clubs from './ui/Clubs'
import Rules from './ui/Rules'
import NotificationBell from './ui/NotificationBell'
import Info from './ui/Info'
import LangMenu from './ui/LangMenu'
import type { ContentType } from './api'
import Shop from './ui/Shop'
import FrameShop from './ui/FrameShop'
import ProfileOverview from './ui/ProfileOverview'
import { AVATAR_FRAMES } from './ui/avatarFrames'
import FrameGallery from './ui/FrameGallery'
import AvatarFrame from './ui/AvatarFrame'
import MatchResult from './ui/MatchResult'
import MatchReport from './ui/MatchReport'
import { LiveMatchesPanel, RankingPanel, HomeFeatures, HomeDashboard, TournamentsPanel } from './ui/HomePanels'
import Spectate from './ui/Spectate'
import PublicProfile from './ui/PublicProfile'
import Membership from './ui/Membership'
import type { PlanId } from './plans'
import { COIN_PACKAGES } from './coinPackages'
import ResetPassword from './ui/ResetPassword'
import MatchSetup, { type MatchOptions, type SetupMode } from './ui/MatchSetup'
import {
  loadGame,
  loadProfile,
  saveGame,
  saveProfile,
  type Profile,
  type SavedGame,
  type MoveLogEntry,
} from './storage'
import { useT } from './i18n'
import { useToast } from './ui/Toast'
import { Button } from '@/components/ui/button'
import {
  getToken,
  loadServerGame,
  logout as apiLogout,
  deleteAccount as apiDeleteAccount,
  me as apiMe,
  saveServerGame,
  setAutoRenew as apiSetAutoRenew,
  toProfile,
  type ServerUser,
} from './api'

// Geri sayim bicimi: saniye -> "S:DD:SS"
function fmtCountdown(total: number): string {
  const s = Math.max(0, Math.floor(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// Zar gorunum sirasi: varsayilan olarak buyuk zar once (ciftte/tek zarda degismez).
// Oyuncu tahtada zara tiklayarak sirayi degistirebilir (canSwapDice).
function orderDice(dice: number[]): number[] {
  if (dice.length === 2 && dice[0] < dice[1]) return [dice[1], dice[0]]
  return dice
}

// gnubg tarzi hata siniflandirmasi (equity kaybina gore) -> ceviri anahtari
function classifyError(loss: number): { key: string; cls: string } {
  if (loss < 0.02) return { key: 'err.veryGood', cls: 'good' }
  if (loss < 0.04) return { key: 'err.small', cls: 'ok' }
  if (loss < 0.08) return { key: 'err.error', cls: 'bad' }
  return { key: 'err.blunder', cls: 'blunder' }
}

function applyPlayed(base: GameState, played: Step[]): GameState {
  const s = cloneState(base)
  for (const step of played) applyStep(s, step, base.turn)
  return s
}

function freshBoard(turn: Player): GameState {
  const s = initialState()
  s.turn = turn
  return s
}

type Mode = 'pvp' | 'pvb' | 'online'
type Difficulty = number // 1..10 AI seviyesi

// AI zorluk seviyeleri (1..10)
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
// Eski kayit ('neural'/'heuristic') veya sayi -> 1..10
function normDifficulty(d: unknown): number {
  if (typeof d === 'number' && d >= 1 && d <= 10) return Math.round(d)
  if (d === 'heuristic') return 3
  return 10 // 'neural' veya bilinmeyen -> en yuksek
}

interface RoomState {
  code: string
  slot: Slot
  oppName: string | null
  oppRating: number | null
  oppAvatar: string | null
  oppFrame: string | null
  status: 'waiting' | 'mm_waiting' | 'playing' | 'finished'
}
const BOT_PLAYER: Player = 'black'
const TARGETS = [1, 3, 5, 7, 9, 11] // mac uzunlugu secenekleri (1 = tek oyun)

// Board renk temalari — boardThemes.ts'e cikarildi (God-component kucultme, #10)
import {
  BOARD_THEMES,
  PREMIUM_THEMES,
  RARITY_THEMES,
  CLUB_THEMES,
  GALAXY_EXTRA_THEMES,
  ALL_THEMES,
  BOARD_ID_MIGRATE,
  hexLum,
  boardRarityOf,
  boardPrice,
  FREE_BOARDS,
} from './boardThemes'

// Bot temposu (ms) - daha yuksek = daha yavas/dogal
const BOT_ROLL_DELAY = 1000 // zar atmadan once (kisa dusunme)
const BOT_MOVE_DELAY = 900 // zar atildiktan sonra ilk tas oynanmadan once (zar okunabilsin)
const BOT_STEP_DELAY = 1050 // her tas arasi (bear-off/toplama dahil tek tek izlenebilsin)
const BOT_END_DELAY = 1200 // son tastan sonra sira gecmeden once (~1sn ara: sira aniden gecmesin)

interface BotAnim {
  steps: Step[]
  index: number
}

interface OpeningResult {
  white: number
  black: number
  winner: Player
  winnerDie: number
  loserDie: number
}

interface GameEnd {
  winner: Player
  points: number
  mult: number
  dropped: boolean
  timeout?: boolean // sure bitiminden dolayi kayip
  resigned?: boolean // pes etme/cekilme
}

// Kup danismani ipucu: ya roll-oncesi teklif tavsiyesi (offer) ya da take/drop (respond)
type CubeHint =
  | {
      kind: 'offer'
      winPct: number
      gammonPct: number
      equity: number
      oppTakePct: number
      action: CubeAction
    }
  | { kind: 'respond'; take: TakeAction; winPct: number; tpPct: number }

// Oyun saati (her hamle sirasi icin, her turda sifirlanir):
//  12sn hamle suresi -> bitince 30sn geri sayim -> sonra 30sn "son asama" (30dan)
//  son asama da biterse sirasi gelen oyuncu oyunu kaybeder.
// Saat: hamle suresi (delay) + rezerv (over). Backgammon Galaxy tarzi 3 preset.
type TimeControl = 'casual' | 'normal' | 'speed'
// over = PUAN BASINA ana sure (sn); freshMatchClock bunu mac uzunluguyla carpar.
// Rahat 3dk/puan, Normal 1dk/puan, Hizli 0.4dk/puan (=24sn). Delay = hamle basina gecikme.
// NOT: online'da sunucu (App\Services\MatchClock) ayni degerlerle OTORITERdir; bu presetler
// pvb (bota karsi) icin ve online'da sunucu saati gelene kadar ilk gosterim icindir.
const CLOCK_PRESETS: Record<TimeControl, { move: number; over: number }> = {
  casual: { move: 15, over: 180 }, // Rahat: 15sn/hamle + 3dk/puan
  normal: { move: 10, over: 60 }, // Normal: 10sn/hamle + 1dk/puan
  speed: { move: 8, over: 24 }, // Hizli: 8sn/hamle + 0.4dk/puan (24sn)
}
const FINAL_STAGE = 30 // son asama uyari esigi (sn)
const MOVE_DELAY = CLOCK_PRESETS.normal.move // varsayilan/fallback
const OVER_TOTAL = CLOCK_PRESETS.normal.over

export default function App() {
  const { t } = useT()
  const pName = (p: Player) => t(p === 'white' ? 'player.white' : 'player.black')
  const [saved] = useState(() => loadGame())
  const [user, setUser] = useState<ServerUser | null>(null)
  const [guestProfile, setGuestProfile] = useState<Profile | null>(() => loadProfile())
  const [authChecked, setAuthChecked] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [profileEditMode, setProfileEditMode] = useState(false) // Profil: false=genel bakis, true=duzenleme formu
  const [showAuth, setShowAuth] = useState(false) // giris/kayit modali acik mi
  // Sifre sifirlama: link'ten ?action=reset&token=&email= geldiyse
  const [resetInfo, setResetInfo] = useState<{ email: string; token: string } | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      if (p.get('action') === 'reset' && p.get('token') && p.get('email')) {
        return { email: p.get('email') as string, token: p.get('token') as string }
      }
    } catch {
      /* yok */
    }
    return null
  })
  // E-posta dogrulama sonucu: link'ten ?verified=1/0 geldiyse bildirim goster
  const [verifyNotice] = useState<'ok' | 'fail' | null>(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('verified')
      if (v === '1') return 'ok'
      if (v === '0') return 'fail'
    } catch {
      /* yok */
    }
    return null
  })
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  // Profil hep dolu: giris yoksa varsayilan misafir (Auth artik modal, tam ekran gate degil)
  const guestDefault: Profile = {
    firstName: '',
    lastName: '',
    country: '',
    nickname: t('auth.guestNick'),
    email: '',
  }
  const profile: Profile = user ? toProfile(user) : (guestProfile ?? guestDefault)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      // Mediterranean Club: ESAS tema LIGHT (warm ivory + mediterranean blue).
      // Kullanici koyu varyanti sectiyse ('dark') ona saygi goster.
      return localStorage.getItem('tavla.theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  const [boardTheme, setBoardTheme] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('tavla.board')
      // Rebrand migration: eski varsayilan tahtalari (blue/walnut) bir kez TavlaTv'ye tasi.
      // NOT: bos (yeni kullanici) ARTIK burada yakalanmaz -> asagida 'standart' varsayilanina duser.
      if (!localStorage.getItem('tavla.board.rebrand')) {
        localStorage.setItem('tavla.board.rebrand', '1')
        if (stored === 'blue' || stored === 'walnut') {
          localStorage.setItem('tavla.board', 'tavla')
          return 'tavla'
        }
      }
      // v2 migration: yalniz eski varsayilan 'tavla' secmis kullaniciyi Galaxy'ye tasi.
      // Bilincli baska tema (neptune vb.) veya yeni kullanici (bos) dokunulmaz.
      if (!localStorage.getItem('tavla.board.v2galaxy')) {
        localStorage.setItem('tavla.board.v2galaxy', '1')
        if (stored === 'tavla') {
          localStorage.setItem('tavla.board', 'galaxy')
          return 'galaxy'
        }
      }
      // Yeni uye / hic secim yapmamis -> marka renkli 'Standart' board varsayilan gelir.
      // Mevcut secim (galaxy dahil) korunur.
      if (!stored) {
        localStorage.setItem('tavla.board', 'standart')
        return 'standart'
      }
      return stored
    } catch {
      return 'standart'
    }
  })
  const [mode, setMode] = useState<Mode>(saved?.mode ?? 'pvb')
  const [difficulty, setDifficulty] = useState<Difficulty>(normDifficulty(saved?.difficulty))
  const [match, setMatch] = useState<MatchState>(() => saved?.match ?? newMatch(1))
  const [starter, setStarter] = useState<Player>(saved?.starter ?? 'white')
  const [turnStart, setTurnStart] = useState<GameState>(() => saved?.turnStart ?? freshBoard('white'))
  const [played, setPlayed] = useState<Step[]>(saved?.played ?? [])
  const [selectedFrom, setSelectedFrom] = useState<number | 'bar' | null>(null)
  const [cubePending, setCubePending] = useState<Player | null>(null) // teklif eden
  // Kup danismani (insan icin): roll-oncesi teklif tavsiyesi veya take/drop tavsiyesi
  const [cubeHint, setCubeHint] = useState<CubeHint | null>(null)
  const cubeHintRef = useRef<CubeHint | null>(null) // karar aninda loglamak icin
  const [gameEnd, setGameEnd] = useState<GameEnd | null>(saved?.gameEnd ?? null)
  const [botAnim, setBotAnim] = useState<BotAnim | null>(null) // bot tas-tas oynatma
  const [botDance, setBotDance] = useState(false) // bot "hamle yok" -> popup 2sn gorunur, sonra gecer
  // "Hamle yok" merkezi banner (pvb'de status mesaji gizli -> rakip/ben gele atinca gorunur)
  const [noMoveFlash, setNoMoveFlash] = useState<string | null>(null)
  const [turnsPlayed, setTurnsPlayed] = useState(saved?.turnsPlayed ?? 0) // ilk elde kup yok
  const [opening, setOpening] = useState<'roll' | 'reveal' | null>(saved ? null : 'roll')
  const [openingResult, setOpeningResult] = useState<OpeningResult | null>(null)
  // Online oda
  const [room, setRoom] = useState<RoomState | null>(null)
  const [roomBusy, setRoomBusy] = useState(false)
  const [roomError, setRoomError] = useState('')
  const [oppStarted, setOppStarted] = useState(false) // p2: ilk snapshot geldi mi
  const [chat, setChat] = useState<ChatMsg[]>([]) // online sohbet mesajlari
  const [showPip, setShowPip] = useState(true) // pip sayilari gorunur mu
  const [setup, setSetup] = useState<null | SetupMode>(null) // mac kurulum modali (baslangic modu)
  const [resignOpen, setResignOpen] = useState(false) // pes et menusu acik mi
  const [boardPickerOpen, setBoardPickerOpen] = useState(false) // kurulumda hizli tahta secim modali
  const [shopTab, setShopTab] = useState<'coins' | 'board' | 'frame'>('coins') // Magaza acilis sekmesi
  const [analyzerOpen, setAnalyzerOpen] = useState(false) // pozisyon analiz modulu
  const [leaderboardOpen, setLeaderboardOpen] = useState(false) // liderlik tablosu modali
  const [ranksOpen, setRanksOpen] = useState(false) // "Rutbeler" (RankProgression) modali
  const [infoOpen, setInfoOpen] = useState(false) // "Bilgi" sayfasi
  const [statsOpen, setStatsOpen] = useState(false) // istatistiklerim modali
  const [fairOpen, setFairOpen] = useState(false) // adil zar modali
  const [friendsOpen, setFriendsOpen] = useState(false) // arkadaslar modali
  const [lessonsOpen, setLessonsOpen] = useState(false) // dersler modali
  const [tournOpen, setTournOpen] = useState(false) // turnuvalar modali
  const [tournDetailId, setTournDetailId] = useState<number | null>(null) // acik turnuva detayi (URL: /turnuvalar/{id})
  const [soloOpen, setSoloOpen] = useState(false) // Tek Oyun bahis gridi
  const [blunderOpen, setBlunderOpen] = useState(false) // hata gunlugu
  const [matchHistOpen, setMatchHistOpen] = useState(false) // mac analizleri (gecmis maclar)
  const [frameAnimOpen, setFrameAnimOpen] = useState(false) // Animasyon secim demosu (/cerceve-anim)
  const [gamePreviewOpen, setGamePreviewOpen] = useState(false) // oyun ekrani layout onizleme
  const [contentView, setContentView] = useState<ContentType | null>(null) // acik icerik sayfasi
  const [newsSlug, setNewsSlug] = useState<string | null>(null) // acik haber detayi (slug) - /haberler/<slug>
  const [quizOpen, setQuizOpen] = useState(false) // quiz oynanis
  const [clubsOpen, setClubsOpen] = useState(false) // kulupler + lig
  const [rulesOpen, setRulesOpen] = useState(false) // nasil oynanir rehberi
  const [spectate, setSpectate] = useState<{ code: string; p1: string; p2: string } | null>(null)
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]) // devam eden online maclarim
  const [homeProfileId, setHomeProfileId] = useState<number | null>(null) // lobi siralamasindan profil
  const [memOpen, setMemOpen] = useState(false) // uyelik yukseltme modali
  const stakeRef = useRef(0) // aktif bahisli online oyunun tutari (0 = bahissiz)
  // Arkadaslik (davet kodu) maci mi? true -> NE puan NE coin (dostluk). Davet=friendly,
  // eslesme havuzu/solo=ranked. Mac-sonu raporu + coin settle bunu okur.
  const friendlyRef = useRef(false)
  const minRatingRef = useRef(0) // Mac Oyunu: rakip min puan filtresi
  const betPctRef = useRef(0) // Mac Oyunu: bahis = bakiyenin %'si (0 = pct bahis yok)
  const mmOriginRef = useRef<'match' | 'solo'>('match') // eslesme hangi kurulumdan basladi (iptalde geri don)
  const [shopOpen, setShopOpen] = useState(false) // magaza modali
  const [frameGalleryOpen, setFrameGalleryOpen] = useState(false) // avatar cerceve galerisi

  // --- URL yonlendirme (hash tabanli) ---
  // Acik sayfa URL'de gorunur; tarayici geri/ileri tuslari ve dogrudan link/yer imi calisir.
  // NOT: Hook'lar erken return'lerden ONCE, tum sayfa state'leri tanimlandiktan sonra durmali.
  const currentSlug = editProfile
    ? 'profil'
    : infoOpen
    ? 'bilgi'
    : leaderboardOpen
    ? 'lider-tablosu'
    : ranksOpen
    ? 'rutbeler'
    : tournOpen
      ? tournDetailId != null
        ? 'turnuvalar/' + tournDetailId
        : 'turnuvalar'
      : shopOpen
        ? 'magaza'
        : frameGalleryOpen
          ? 'cerceveler'
        : statsOpen
          ? 'istatistiklerim'
          : friendsOpen
            ? 'arkadaslar'
            : blunderOpen
              ? 'hata-gunlugu'
              : matchHistOpen
                ? 'mac-analizleri'
              : frameAnimOpen
                ? 'cerceve-anim'
              : gamePreviewOpen
                ? 'oyun-onizleme'
              : fairOpen
                ? 'adillik'
                : lessonsOpen
                  ? 'dersler'
                  : soloOpen
                    ? 'tek-oyun'
                    : contentView === 'event'
                      ? 'turnuva-takvimi'
                      : contentView === 'service'
                        ? 'hizmetler'
                        : contentView === 'blog'
                          ? 'blog'
                          : contentView === 'news'
                            ? newsSlug
                              ? 'haberler/' + newsSlug
                              : 'haberler'
                          : contentView === 'magazine'
                            ? 'tavla-magazin'
                            : contentView === 'club'
                              ? 'kulup-rehberi'
                              : quizOpen
                                ? 'bulmaca'
                                : clubsOpen
                                  ? 'kulupler'
                                  : rulesOpen
                                    ? 'nasil-oynanir'
                                    : analyzerOpen
                                      ? 'pozisyon-analizi'
                                      : setup === 'online'
                                        ? 'yeni-oyun'
                                      : setup === 'pvb'
                                        ? 'yz-ile-oyna'
                                        : ''

  // Hata Gunlugu PREMIUM-only: URL/deep-link ile (/hata-gunlugu) premium OLMAYAN giren
  // kullaniciyi uyelik ekranina yonlendir (menu zaten gate'li; bu URL bypass'ini kapatir).
  // NOT: bu hook ust hook bolgesinde (erken-return'lerden ONCE) durmali — sabit sira;
  // premium'u user'dan inline turetir ki gec tanimlanan `premium` const'una baglanmasin.
  useEffect(() => {
    const isPrem = user?.plan_active === 'star' || user?.plan_active === 'starpro'
    if (blunderOpen && user && !isPrem) {
      setBlunderOpen(false)
      setMemOpen(true)
    }
  }, [blunderOpen, user])

  // URL yolu -> state: dogrudan link, yer imi, geri/ileri tusu (closeAllPages hoisted)
  // Temiz path kullanilir (SEO): /yz-ile-oyna  (hash # yok; eski /yapay-zeka alias)
  useEffect(() => {
    const applyFromPath = () => {
      const slug = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, '')).trim()
      const seg = slug.split('/')
      const root = seg[0] // ilk segment (ör. 'haberler/<slug>' -> 'haberler')
      closeAllPages()
      setAnalyzerOpen(false)
      setMemOpen(false)
      switch (root) {
        case 'lider-tablosu':
          setLeaderboardOpen(true)
          break
        case 'rutbeler':
          setRanksOpen(true)
          break
        case 'bilgi':
          setInfoOpen(true)
          break
        case 'turnuvalar':
          setTournOpen(true)
          // /turnuvalar/{id} -> dogrudan o turnuvanin detayini ac
          setTournDetailId(seg[1] && /^\d+$/.test(seg[1]) ? parseInt(seg[1], 10) : null)
          break
        case 'magaza':
          setShopOpen(true)
          break
        case 'cerceveler':
          setFrameGalleryOpen(true)
          break
        case 'istatistiklerim':
          setProfileEditMode(false) // profil ANA sayfasi (İstatistikler varsayilan sekme)
          setEditProfile(true)
          break
        case 'arkadaslar':
          setFriendsOpen(true)
          break
        case 'hata-gunlugu':
          setBlunderOpen(true)
          break
        case 'mac-analizleri':
          setMatchHistOpen(true)
          break
        case 'cerceve-anim':
          setFrameAnimOpen(true)
          break
        case 'oyun-onizleme':
          setGamePreviewOpen(true)
          break
        case 'adillik':
          setFairOpen(true)
          break
        case 'dersler':
          setLessonsOpen(true)
          break
        case 'tek-oyun':
          setSoloOpen(true)
          break
        case 'turnuva-takvimi':
          setContentView('event')
          break
        case 'hizmetler':
          setContentView('service')
          break
        case 'blog':
          setContentView('blog')
          break
        case 'haberler':
          setContentView('news')
          setNewsSlug(seg[1] ?? null) // /haberler/<slug> -> detay
          break
        case 'tavla-magazin':
          setContentView('magazine')
          break
        case 'kulup-rehberi':
          setContentView('club')
          break
        case 'ayarlar':
        case 'tahta-ayarlari': // eski slug -> Magaza'nin Tahta Rengi sekmesi
          setShopTab('board')
          setShopOpen(true)
          break
        case 'bulmaca':
          setQuizOpen(true)
          break
        case 'kulupler':
          setClubsOpen(true)
          break
        case 'nasil-oynanir':
          setRulesOpen(true)
          break
        case 'pozisyon-analizi':
          setAnalyzerOpen(true)
          break
        case 'yeni-oyun':
          setSetup('online')
          break
        case 'yz-ile-oyna':
        case 'yapay-zeka': // eski slug -> geriye donuk uyum
          setSetup('pvb')
          break
        case 'profil':
        case 'profil-duzenle': // eski slug -> geriye donuk uyum
          setProfileEditMode(false)
          setEditProfile(true)
          break
        default:
          break // ana sayfa (bos path)
      }
    }
    applyFromPath()
    window.addEventListener('popstate', applyFromPath)
    return () => window.removeEventListener('popstate', applyFromPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // state -> URL yolu: menuden sayfa acildikca temiz path guncellenir
  useEffect(() => {
    const pathSlug = decodeURIComponent(window.location.pathname.replace(/^\/+|\/+$/g, '')).trim()
    if (pathSlug === currentSlug) return // zaten senkron (path'ten uygulandi)
    const search = window.location.search
    if (currentSlug) {
      window.history.pushState(null, '', '/' + currentSlug + search)
    } else {
      window.history.replaceState(null, '', '/' + search)
    }
  }, [currentSlug])

  const [invites, setInvites] = useState<GameInviteT[]>([]) // gelen oyun davetleri
  const [tournNotices, setTournNotices] = useState<TournNoticeT[]>([]) // sirasi gelen turnuva maclari
  const [notifications, setNotifications] = useState<AppNotification[]>([]) // sistem bildirimleri
  const [unreadNotif, setUnreadNotif] = useState(0) // okunmamis bildirim sayisi (can rozeti)
  const [rewardReady, setRewardReady] = useState(false) // 6 saatlik odul hazir mi
  const [rewardSecs, setRewardSecs] = useState(0) // sonraki odule kalan saniye (geri sayim)
  // Acilista her zaman ana menu; kayitli oyun varsa menude "Aktif Oyunlar" ile devam edilir
  const [home, setHome] = useState(true)
  const [lobbyTourns, setLobbyTourns] = useState<Tournament[]>([]) // lobide gosterilen aktif turnuvalar
  const [timeControl, setTimeControl] = useState<TimeControl>('normal')
  const [rankedMatch, setRankedMatch] = useState(true) // false = casual (puana etki etmez)
  const clockRef = useRef(CLOCK_PRESETS.normal) // secili saat preseti (delay/over)
  const onlineTargetRef = useRef(1) // online oda kurulunca kullanilacak mac uzunlugu
  const targetsRef = useRef<number[]>([1]) // eslesme icin kabul edilen uzunluklar (coklu)
  const matchTargetSyncedRef = useRef(false) // eslesme sonrasi anlasilan uzunluk uygulandi mi
  // Saat: hamle gecikmesi (delay, her tur sifirlanir) + oyuncu-basi rezerv bankasi
  // (white/black; maca gore kurulur, turlar boyunca tukenir - Galaxy tarzi).
  const [clock, setClock] = useState<{ delay: number; white: number; black: number }>({
    delay: MOVE_DELAY,
    white: OVER_TOTAL,
    black: OVER_TOTAL,
  })
  // AFK (sunucu-otoriter): kayba kalan saniye (yalniz son 15sn'de dolu) + sirasi gelen renk.
  const [afkLeft, setAfkLeft] = useState<number | null>(null)
  const [srvActive, setSrvActive] = useState<Player | null>(null)
  // Mac basi taze saat: rezerv bankasi = puan-basi sure x mac uzunlugu (her oyuncuya)
  const freshMatchClock = (target: number) => {
    const bank = clockRef.current.over * Math.max(1, target)
    return { delay: clockRef.current.move, white: bank, black: bank }
  }
  const appliedVersionRef = useRef(-1)
  const syncEnabledRef = useRef(false)
  const lastSyncRef = useRef('') // en son gonderilen/uygulanan durum imzasi (echo engelle)
  // Bitmis mac restore edildiyse puan tekrar bildirilmesin (refresh koruma)
  const ratingReportedRef = useRef(!!(saved && (saved.gameEnd || matchWinner(saved.match))))
  const turnRankedRef = useRef<RankedMove[] | null>(null) // tur basi tam siralama (hata tespiti)
  const [message, setMessage] = useState(() => t('msg.roll'))
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [currentProbs, setCurrentProbs] = useState<number[] | null>(null)
  const [ranked, setRanked] = useState<RankedMove[] | null>(null)
  const [analysisBoard, setAnalysisBoard] = useState<GameState | null>(null) // mini board pozisyonu
  // Ipucu / Ogrenme modu: mevcut konumdaki en iyi hamle + gerekceleri (ekstra ag cagrisi yok)
  const [curBest, setCurBest] = useState<{ notation: string; equity: number; reasons: Reason[] } | null>(null)
  const [hintShown, setHintShown] = useState(false) // ipucu butonuna basildi mi
  const [learnMode, setLearnMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tavla.learn') === '1'
    } catch {
      return false
    }
  })
  // PR (Performans Reytingi): her oyuncu icin karar basina kaybedilen equity
  const [prStats, setPrStats] = useState<{
    white: { loss: number; decisions: number }
    black: { loss: number; decisions: number }
  }>({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
  // PR'in EN GUNCEL degeri: mac-sonu raporu (async recordPR'lar report closure'undan
  // SONRA bittigi icin) stale prStats yerine bu ref'ten okur -> kendi PR'im null dusmez.
  const prStatsRef = useRef(prStats)
  prStatsRef.current = prStats
  // Sans (luck): oyuncu-basi birikmis equity sansi (zarlarin sanslilik toplami)
  const [prLuck, setPrLuck] = useState<{ white: number; black: number }>({ white: 0, black: 0 })
  const luckSigRef = useRef('') // ayni turda sansi iki kez saymayi engelle
  const [coinDelta, setCoinDelta] = useState<number | null>(null) // bahisli macta kazanan coin transferi
  const [ratingChange, setRatingChange] = useState<{ before: number; after: number } | null>(null)
  // Gecici bildirim: birlesik toast sistemi (src/ui/Toast). Ag hatalari + e-posta
  // dogrulama sonucu buradan gecer; eski yerel ".verify-toast" render'i kaldirildi.
  const notify = useToast()
  // Mac gunlugu (insanin kararlari): rapor/istatistik icin
  const [matchLog, setMatchLog] = useState<MoveLogEntry[]>([])
  // En guncel log (mac-sonu kaydi async analizler bittikten sonra bunu okur)
  const matchLogRef = useRef<MoveLogEntry[]>([])
  matchLogRef.current = matchLog
  // Bekleyen (async) hamle analizi sayaci: online mac-sonu kaydi bunlar bitene kadar bekler
  const pendingAnalysisRef = useRef(0)
  const [resultView, setResultView] = useState<null | 'stats' | 'analysis'>(null) // rapor modali
  const [lastError, setLastError] = useState<MoveError | null>(null)
  const heuristicRef = useRef(new HeuristicBot())
  const neuralRef = useRef(new NeuralBot())
  const fairRef = useRef(new FairDice()) // adil (dogrulanabilir) zar ureticisi
  const tournMatchRef = useRef<{ tid: number; matchKey: string; oppId: number } | null>(null)
  neuralRef.current.level = difficulty // AI seviyesini uygula
  const engine = neuralRef.current // tum seviyeler sinir agi (seviyeye gore gurultu)

  // Refresh'te oyun kaybolmasin: saveGame, ILK restore bitene kadar localStorage'i
  // EZMEZ (hydratedRef). Boylece restore effect'i kaydi TAZE okur — StrictMode dev
  // remount'unda bile ezme olmaz. "Once useMemo ile yakala" kirilgan numarasi YOK.
  const hydratedRef = useRef(false)

  // Oyunu yerel kaydet (offline/misafir icin). gameEnd de kaydedilir ki
  // refresh'te bitmis oyun yeniden "kazanildi" sayilip tekrar puanlanmasin.
  useEffect(() => {
    if (!hydratedRef.current) return // ilk restore bitene kadar localStorage'i EZME (kritik)
    // pr/luck da kaydedilir -> refresh/resume'da PR/Sans/Seviye kaybolmaz
    // inGame: kayit aninda oyun gorunumunde miydik -> refresh'te ana sayfadan oyuna zorla sokma
    saveGame({ mode, difficulty, match, starter, turnsPlayed, turnStart, played, gameEnd, pr: prStats, luck: prLuck, inGame: !home })
  }, [mode, difficulty, match, starter, turnsPlayed, turnStart, played, gameEnd, prStats, prLuck, home])

  // Kaydedilmis oyunu state'e uygula (sunucudan yukleme)
  function applySavedGame(g: SavedGame) {
    setMode(g.mode)
    setDifficulty(normDifficulty(g.difficulty))
    setMatch(g.match)
    setStarter(g.starter)
    setTurnStart(g.turnStart)
    // Bot yarim animasyonda kaydedildiyse (played>0, sira bot) temizle -> bot devam etsin (takilma fix)
    setPlayed(g.mode === 'pvb' && g.turnStart.turn === BOT_PLAYER ? [] : g.played)
    setTurnsPlayed(g.turnsPlayed)
    setSelectedFrom(null)
    setCubePending(null)
    setGameEnd(g.gameEnd ?? null)
    setBotAnim(null)
    setOpening(null)
    setOpeningResult(null)
    // PR + Sans'i da geri yukle -> refresh/resume sonrasi mac sonu ekraninda oyuncunun
    // seviyesi/PR/sansi "—"/+0 olmaz (kayittaki birikmis degerler korunur).
    if (g.pr) setPrStats(g.pr)
    if (g.luck) setPrLuck(g.luck)
    // Bitmis mac yeniden yuklendiyse puani tekrar bildirme
    ratingReportedRef.current = !!(g.gameEnd || matchWinner(g.match))
    // Aktif (bitmemis) bot/lokal oyun geri yuklendiyse: SADECE kayit aninda kullanici
    // oyun gorunumundeyse (inGame) oyuna don. Ana sayfadayken (inGame=false) veya eski
    // kayitta (undefined) HOME'da kal -> aktif oyun "Devam Et" cubuguyla erisilir.
    // (Boylece refresh, terk edilmis eski AI oyununa ZORLA sokmaz; oyun da kaybolmaz.)
    if (
      g.inGame === true &&
      g.mode !== 'online' &&
      !matchWinner(g.match) &&
      (g.turnsPlayed > 0 || !!g.gameEnd)
    ) {
      setHome(false)
    }
  }

  // Acilista oyunu geri yukle. KRITIK: ayni cihazda refresh'te YEREL kayit (her hamlede
  // localStorage'a yazilir) EN TAZE kaynaktir. Sunucu kaydi debounce'lu + cok-cihaz icin;
  // eski/bos donup taze yerel oyunu EZMEMELI. Bu yuzden aktif bir yerel (bot/lokal) oyun
  // varsa GIRIS YAPMIS olsa bile once onu yukle; sunucu yalniz yerel yoksa (cok-cihaz).
  useEffect(() => {
    const token = getToken()
    // saveGame henuz calismadi (hydrated=false) -> localStorage TAZE. Dogrudan oku.
    const local = loadGame()
    const localActive =
      !!local &&
      local.mode !== 'online' &&
      !matchWinner(local.match) &&
      (local.turnsPlayed > 0 || !!local.gameEnd)
    const finish = () => {
      hydratedRef.current = true // artik saveGame yazabilir
      setAuthChecked(true)
    }
    if (!token) {
      if (local) applySavedGame(local) // misafir: yerel oyunu geri yukle
      finish()
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const u = await apiMe()
        if (cancelled) return
        setUser(u)
        if (localActive) {
          applySavedGame(local!) // taze yerel aktif oyun -> sunucuyu bekleme/ezdirme
          return
        }
        const g = await loadServerGame().catch(() => null)
        if (cancelled) return
        if (g) applySavedGame(g as SavedGame)
        else if (local) applySavedGame(local) // sunucuda yoksa yerele dus
      } catch {
        await apiLogout() // gecersiz token -> temizle
      } finally {
        if (!cancelled) finish()
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Giris yapmissa oyunu sunucuya da kaydet (debounce)
  useEffect(() => {
    if (!user) return
    const timer = window.setTimeout(() => {
      saveServerGame({ mode, difficulty, match, starter, turnsPlayed, turnStart, played }).catch(
        () => {},
      )
    }, 800)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mode, difficulty, match, starter, turnsPlayed, turnStart, played])

  // Tema (koyu/acik) + board rengi -> DOM'a uygula ve kaydet
  useEffect(() => {
    const root = document.documentElement
    // Eski id -> yeni id gecisi (rename edilen boardlar): bir kez tasit
    if (!ALL_THEMES.some((x) => x.id === boardTheme) && BOARD_ID_MIGRATE[boardTheme]) {
      setBoardTheme(BOARD_ID_MIGRATE[boardTheme])
      return
    }
    root.setAttribute('data-theme', theme)
    root.setAttribute('data-board', boardTheme)
    const bt = ALL_THEMES.find((x) => x.id === boardTheme) ?? BOARD_THEMES[0]
    // Kulup boardlari: oyun yuzeyini (panel + ucgenler) HAFIF pastel yap (hue korunur,
    // %15 beyaz karisim) -> pullar daha da ayrisir; renk kimligi bozulmaz. Pul/cerceve haric.
    const surf = (c: string) =>
      bt.rarity === 'club' ? `color-mix(in srgb, ${c} 85%, white)` : c
    root.style.setProperty('--panel', surf(bt.panel))
    root.style.setProperty('--tri-a', surf(bt.a))
    root.style.setProperty('--tri-b', surf(bt.b))
    root.style.setProperty('--navy', bt.checker) // koyu pul temaya uyar
    // Cerceve + acik pul: tema verirse uygula, yoksa temizle (CSS varsayilanina don)
    if (bt.frame) root.style.setProperty('--bar', bt.frame)
    else root.style.removeProperty('--bar')
    if (bt.light) root.style.setProperty('--cream', bt.light)
    else root.style.removeProperty('--cream')
    // Zar arka planlari: tema ozel verir; yoksa acik/koyu pul rengine duser (CSS fallback)
    const dieVars: [string, string | undefined][] = [
      ['--die1-bg', bt.d1Bg], ['--die1-pip', bt.d1Pip],
      ['--die2-bg', bt.d2Bg], ['--die2-pip', bt.d2Pip],
    ]
    for (const [k, v] of dieVars) {
      if (v) root.style.setProperty(k, v)
      else root.style.removeProperty(k)
    }
    // Kup HER ZAMAN temaya uyar: ozel verilmezse aksan point rengi (a), metin luminance'a gore
    const cubeBg = bt.cubeBg ?? bt.a
    const cubeText = bt.cubeText ?? (hexLum(cubeBg) > 150 ? '#161616' : '#ffffff')
    root.style.setProperty('--cube-bg', cubeBg)
    root.style.setProperty('--cube-text', cubeText)
    // Pul stili (flat/gloss/ice/ring/neon) + yuzey motifi (plain/gradient/felt)
    // -> data-attribute; CSS bunlara gore pul/yuzey gorunumunu degistirir.
    root.setAttribute('data-checker', bt.checkerStyle ?? 'flat')
    root.setAttribute('data-surface', bt.surface ?? 'plain')
    root.setAttribute('data-board-rarity', bt.rarity ?? 'common') // kulup board: pullara gumus halka
    // Watermark rengi: board zemini acik -> koyu logo, koyu -> acik logo (0.05-0.09 alfa)
    root.style.setProperty(
      '--wm-color',
      hexLum(bt.panel) > 150 ? 'rgba(12,18,45,0.09)' : 'rgba(255,255,255,0.075)',
    )
    try {
      localStorage.setItem('tavla.theme', theme)
      localStorage.setItem('tavla.board', boardTheme)
    } catch {
      /* yok */
    }
  }, [theme, boardTheme])

  // Lobiye girildiginde aktif turnuvalari cek (bitmis olanlar haric)
  useEffect(() => {
    if (!home) return
    let cancelled = false
    listTournaments()
      .then((ts) => {
        if (!cancelled) setLobbyTourns(ts.filter((x) => x.status !== 'finished'))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [home])

  const working = useMemo(() => applyPlayed(turnStart, played), [turnStart, played])
  const gameWon = winner(working) !== null
  const mWinner = matchWinner(match)
  const matchOver = mWinner !== null
  const diceRolled = turnStart.dice.length > 0
  const isBotTurn = mode === 'pvb' && turnStart.turn === BOT_PLAYER
  const online = mode === 'online' && room !== null
  const myColor: Player = room?.slot === 'p2' ? 'black' : 'white'
  // Online'da siyah oyuncu tahtayi 180 cevrilmis gorur (kendi taslari altta)
  const flipBoard = online && myColor === 'black'
  // Saat, kurulumda bir sure secildiyse (kapali degilse) calisir
  const clockOn = true // Galaxy tarzi: her oyunda saat acik (3 preset)
  const onlineReady = !online || (room!.status === 'playing' && (room!.slot === 'p1' || oppStarted))
  const myTurn = online ? turnStart.turn === myColor : !isBotTurn
  const interactive =
    onlineReady &&
    myTurn &&
    !gameWon &&
    gameEnd === null &&
    !matchOver &&
    cubePending === null &&
    !opening

  const nextSteps = useMemo(
    () => (diceRolled && !gameWon ? legalNextSteps(turnStart, played) : []),
    [turnStart, played, diceRolled, gameWon],
  )

  const selectableFroms = useMemo(() => {
    const set = new Set<number | 'bar'>()
    if (!interactive) return set
    for (const st of nextSteps) set.add(st.from)
    return set
  }, [nextSteps, interactive])

  // Secili tasin (1+ zarla, birlesik dahil) ulasabilecegi hedefler -> step dizisi
  const dragTargets = useMemo(() => {
    if (!interactive || selectedFrom === null) return new Map<number | 'off', Step[]>()
    return reachableFromChecker(turnStart, played, selectedFrom)
  }, [interactive, selectedFrom, turnStart, played])

  const targets = useMemo(() => new Set(dragTargets.keys()), [dragTargets])

  const remainingDice = useMemo(() => {
    const dice = turnStart.dice.slice()
    for (const st of played) {
      const idx = dice.indexOf(st.die)
      if (idx >= 0) dice.splice(idx, 1)
    }
    return dice
  }, [turnStart, played])

  // freshBank=true: yeni MAC -> rezerv bankasi bastan dolar.
  // freshBank=false: mac ici SONRAKI oyun -> rezerv bankasi korunur (Galaxy: mac-basi saat),
  //   sadece hamle gecikmesi sifirlanir.
  function resetGameUi(freshBank = true) {
    setPlayed([])
    setSelectedFrom(null)
    setCubePending(null)
    setGameEnd(null)
    setLastError(null)
    setRanked(null)
    setCurrentProbs(null)
    setTurnsPlayed(0)
    setOpening('roll') // her yeni oyun acilis atisiyla baslar
    setOpeningResult(null)
    if (freshBank) {
      const bank = clockRef.current.over * Math.max(1, match.target)
      setClock({ delay: clockRef.current.move, white: bank, black: bank })
    } else {
      setClock((c) => ({ ...c, delay: clockRef.current.move }))
    }
    ratingReportedRef.current = false // yeni mac -> puan tekrar islenebilir
  }

  // PR: bu hamlede wildbg'ye gore kaybedilen equity'yi kaydet (senkron; tur basi analizini kullanir)
  function recordPR(before: GameState, steps: Step[]) {
    if (steps.length === 0) return
    const mover = before.turn
    const moves = generateMoves(before)
    if (moves.length <= 1) return // zorunlu/tek hamle -> karar sayilmaz
    const seq = turnsPlayed // bu turun sirasi (async bot kaydinda korunur)
    // Bot (pvb'de siyah): secilen hamlenin gercek equity kaybi (seviyeye gore)
    if (mode === 'pvb' && mover === BOT_PLAYER) {
      const loss = neuralRef.current.lastLoss ?? 0
      setPrStats((s) => ({
        ...s,
        black: { loss: s.black.loss + loss, decisions: s.black.decisions + 1 },
      }))
      // Botun (rakip) hamlesini de analize kaydet: siralamayi arka planda hesapla
      const playedKey = boardKey(applyPlayed(before, steps))
      neuralRef.current
        .analyzeMoves(before)
        .then((ranks) => {
          if (ranks.length === 0 || (ranks[0].probs?.length ?? 0) < 6) return
          const pl = ranks.find((r) => r.move.resultKey === playedKey) ?? ranks[0]
          const cands = ranks.slice(0, 5).map((r) => ({
            notation: moveNotation(r.move, mover),
            equity: r.equity,
            steps: r.move.steps,
          }))
          setMatchLog((log) => [
            ...log,
            {
              notation: moveNotation(pl.move, mover),
              best: moveNotation(ranks[0].move, mover),
              loss: Math.max(0, ranks[0].equity - pl.equity),
              pos: before,
              steps: ranks[0].move.steps,
              playedSteps: pl.move.steps,
              player: mover,
              dice: [...before.dice],
              cands,
              probs: pl.probs,
              seq,
            },
          ])
        })
        .catch(() => {})
      return
    }
    // Insan: hamlenin gercek equity kaybini NEURAL siralamayla kaydet.
    // Onemli: tur basi siralama (turnRankedRef) async oldugundan hizli oynanınca
    // (ozellikle otomatik zar) hazir olmayabilir. O yuzden hazirsa hizli yol,
    // degilse HER ZAMAN arka planda yeniden analiz ederek kaydi garanti et.
    const humanColor: Player = online ? myColor : 'white'
    const playedKey = boardKey(applyPlayed(before, steps))
    const record = (ranks: RankedMove[]) => {
      if (ranks.length === 0 || (ranks[0].probs?.length ?? 0) < 6) return
      const pl = ranks.find((r) => r.move.resultKey === playedKey) ?? ranks[0]
      const loss = Math.max(0, ranks[0].equity - pl.equity)
      setPrStats((s) => ({
        ...s,
        [mover]: { loss: s[mover].loss + loss, decisions: s[mover].decisions + 1 },
      }))
      // Sans (luck): bu turun sansi = gercek zarin en iyi equity'si (ranks[0]) - 21 zarin
      // beklenen en iyisi. recordPR promise'i (analiz effect'i gibi) IPTAL EDILMEZ -> hizli
      // oynayinca bile guvenilir birikir. Tur basina bir kez (luckSig).
      const luckKey = `${mover}:${seq}`
      if (luckKey !== luckSigRef.current) {
        luckSigRef.current = luckKey
        const actualBest = ranks[0].equity
        neuralRef.current
          .expectedBestEquity(before, mover)
          .then((expEq) => setPrLuck((s) => ({ ...s, [mover]: s[mover] + (actualBest - expEq) })))
          .catch(() => {})
      }
      if (mover !== humanColor) return
      // Her hamle icin tam analiz verisi: konum, zar, siralı adaylar (equity), kazanma%
      const cands = ranks.slice(0, 5).map((r) => ({
        notation: moveNotation(r.move, mover),
        equity: r.equity,
        steps: r.move.steps,
      }))
      setMatchLog((log) => [
        ...log,
        {
          notation: moveNotation(pl.move, mover),
          best: moveNotation(ranks[0].move, mover),
          loss,
          pos: before,
          steps: ranks[0].move.steps,
          playedSteps: pl.move.steps,
          player: mover,
          dice: [...before.dice],
          cands,
          probs: pl.probs,
          seq,
        },
      ])
    }
    // Hizli yol: tur basi siralama tam ve bu turun konumuna aitse dogrudan kullan
    const pre = turnRankedRef.current
    if (
      pre &&
      pre.length > 0 &&
      (pre[0].probs?.length ?? 0) >= 6 &&
      pre.some((r) => r.move.resultKey === playedKey)
    ) {
      record(pre)
    } else {
      // Async analiz: mac-sonu kaydi bunun bitmesini bekleyebilsin diye say
      pendingAnalysisRef.current++
      neuralRef.current
        .analyzeMoves(before)
        .then(record)
        .catch(() => {})
        .finally(() => {
          pendingAnalysisRef.current = Math.max(0, pendingAnalysisRef.current - 1)
        })
    }
  }

  function commitTurn(finalPlayed: Step[]) {
    // Her oyuncunun hamlesini PR'a ekle (online'da sadece kendi hamlelerim gecer)
    void recordPR(turnStart, finalPlayed)
    const s = applyPlayed(turnStart, finalPlayed)
    s.turn = opponent(s.turn)
    s.dice = []
    s.diceUsed = []
    setTurnStart(s)
    setPlayed([])
    setSelectedFrom(null)
    setRanked(null)
    setCurrentProbs(null)
    setTurnsPlayed((n) => n + 1)
    if (!winner(s)) setMessage(t('msg.turnOf', { name: pName(s.turn) }))
  }

  function computeMoveError(finalPlayed: Step[]): MoveError | null {
    // Hata tespiti icin TUM turun siralamasini kullan (tur basinda hesaplanan)
    const turnRanked = turnRankedRef.current
    // Analiz paneli SADECE yapay zekaya karşı (pvb). Tek Oyun/Maç Oyunu/pvp'de asla
    // gösterme — hile önlemi (PR/istatistik hesabı arka planda yine calisir).
    if (!showAnalysis || mode !== 'pvb' || !turnRanked || turnRanked.length === 0) return null
    const resultKey = boardKey(applyPlayed(turnStart, finalPlayed))
    const pl = turnRanked.find((r) => r.move.resultKey === resultKey)
    if (!pl) return null
    const best = turnRanked[0]
    const loss = Math.max(0, best.equity - pl.equity)
    const { key, cls } = classifyError(loss)
    return {
      loss,
      label: t(key),
      cls,
      best: moveNotation(best.move, turnStart.turn),
      played: moveNotation(pl.move, turnStart.turn),
    }
  }

  function doRoll() {
    // Roll oncesi kup teklif tavsiyesi varsa: insan katlamak yerine zar atti ->
    // "pas" karari olarak logla (guclu tavsiyeyi kacirdiysa hata sayilir).
    if (cubeHintRef.current?.kind === 'offer') logCubeDecision('no-double')
    const dice = orderDice(fairRef.current.next()) // varsayilan: buyuk zar once (tikla-degistir mevcut)
    Sound.dice()
    const rolled = newTurn(turnStart, dice)
    setTurnStart(rolled)
    setPlayed([])
    setSelectedFrom(null)
    setLastError(null)
    setRanked(null)
    setCurrentProbs(null)
    const moves = generateMoves(rolled)
    setMessage(
      hasNoMove(moves)
        ? t('msg.noMovePass', { name: pName(rolled.turn) })
        : t('msg.playing', { name: pName(rolled.turn), dice: dice.join(', ') }),
    )
  }

  // ---- Kup ----
  // Insan kup kararini (teklif/pas/take/drop) danisman tavsiyesiyle karsilastir
  // ve mac raporuna kaydet. Yalnizca insanin kendi karari loglanir.
  function logCubeDecision(chosen: 'double' | 'no-double' | 'take' | 'drop') {
    const h = cubeHintRef.current
    if (!h) return
    cubeHintRef.current = null // ayni karari iki kez loglama
    const humanColor: Player = online ? myColor : 'white'
    let recommended: string
    let correct: boolean
    let win: number
    let equity = 0
    if (h.kind === 'offer') {
      recommended = h.action
      win = h.winPct
      equity = h.equity
      const shouldDouble = h.action === 'double-take' || h.action === 'double-pass'
      correct = chosen === 'double' ? shouldDouble : !shouldDouble
    } else {
      recommended = h.take
      win = h.winPct
      correct = chosen === h.take
    }
    setMatchLog((log) => [
      ...log,
      {
        notation: '',
        best: '',
        loss: 0,
        player: humanColor,
        pos: turnStart,
        seq: turnsPlayed,
        cube: { win, equity, recommended, chosen, correct },
      },
    ])
  }

  // Rakip/bot kup eylemini (analiz verisi olmadan) .mat icin logla. Insanin karari
  // logCubeDecision ile (tavsiye/dogruluk dahil) loglanir; bu yalnizca eylem + oyuncu.
  // Online'da rakibin karari kendi istemcisinde loglanip senkronla gelir -> burada sadece
  // pvb (bot) ve yerel pvp'de karsi taraf icin cagrilir (cift loglama olmaz).
  function logCubeAction(chosen: 'double' | 'take' | 'drop', player: Player) {
    setMatchLog((log) => [
      ...log,
      {
        notation: '',
        best: '',
        loss: 0,
        player,
        pos: turnStart,
        seq: turnsPlayed,
        cube: { win: 0, equity: 0, recommended: chosen, chosen, correct: true },
      },
    ])
  }

  function handleDouble(player: Player) {
    if (diceRolled || !canDouble(match, player, cubePending !== null)) return
    const humanColor: Player = online ? myColor : 'white'
    if (player === humanColor) logCubeDecision('double')
    else logCubeAction('double', player)
    setCubePending(player)
    setMessage(t('msg.doubled', { name: pName(player), value: match.cube.value * 2 }))
  }
  function handleTake() {
    if (!cubePending) return
    const doubler = cubePending
    const taker = opponent(doubler)
    const humanColor: Player = online ? myColor : 'white'
    if (taker === humanColor) logCubeDecision('take')
    else logCubeAction('take', taker)
    setMatch((m) => ({ ...m, cube: { value: m.cube.value * 2, owner: taker } }))
    setCubePending(null)
    setMessage(t('msg.took', { name: pName(taker), doubler: pName(doubler) }))
  }
  function handleDrop() {
    if (!cubePending) return
    const doubler = cubePending
    const humanColor: Player = online ? myColor : 'white'
    if (opponent(doubler) === humanColor) logCubeDecision('drop')
    else logCubeAction('drop', opponent(doubler))
    const points = match.cube.value
    setMatch((m) => scoreGame(m, doubler, points))
    setGameEnd({ winner: doubler, points, mult: 1, dropped: true })
    setCubePending(null)
  }

  // ---- Pes etme / cekilme (1=oyun, 2=gammon, 3=backgammon) ----
  // Cekilen oyuncunun konumuna gore adil puan: tas topladiysa 1 (single),
  // hic toplamadiysa 2 (gammon), barda/rakip evinde tasi varsa 3 (backgammon).
  function resignMultiplier(state: GameState, loser: Player): 1 | 2 | 3 {
    if (state.off[loser] > 0) return 1
    const w = opponent(loser)
    if (state.bar[loser] > 0) return 3
    const [hs, he] = w === 'white' ? [0, 6] : [18, 24]
    const sign = loser === 'white' ? 1 : -1
    for (let i = hs; i < he; i++) if (state.points[i] * sign > 0) return 3
    return 2
  }

  function handleResign() {
    setResignOpen(false)
    const loser: Player = online ? myColor : 'white' // pvb'de insan beyaz
    const w = opponent(loser)
    const mult = resignMultiplier(working, loser)
    const points = match.cube.value * mult
    setMatch((m) => scoreGame(m, w, m.cube.value * mult))
    setGameEnd({ winner: w, points, mult, dropped: false, resigned: true })
  }

  // ---- Oyun sonu (bear off) cozumleme ----
  useEffect(() => {
    if (gameEnd || cubePending) return
    const w = winner(working)
    if (!w) return
    const outcome = gameOutcome(working)
    if (!outcome) return
    const points = match.cube.value * outcome.multiplier
    setMatch((m) => scoreGame(m, w, m.cube.value * outcome.multiplier))
    setGameEnd({ winner: w, points, mult: outcome.multiplier, dropped: false })
  }, [working, gameEnd, cubePending, match.cube.value])

  // ---- Bot sirasi: kup teklifi -> zar -> oyna ----
  useEffect(() => {
    if (!isBotTurn || gameEnd || matchOver || cubePending || botAnim || opening || played.length > 0)
      return
    let cancelled = false
    let timer: number
    if (!diceRolled) {
      timer = window.setTimeout(async () => {
        if (turnsPlayed > 0 && canDouble(match, BOT_PLAYER, false) && match.cube.value < 8) {
          try {
            const probs = await neuralRef.current.evalPosition(turnStart, BOT_PLAYER)
            const w = probs[0] + probs[1] + probs[2]
            if (!cancelled && w >= 0.7 && w <= 0.97) {
              logCubeAction('double', BOT_PLAYER) // botun kup teklifini .mat icin logla
              setCubePending(BOT_PLAYER)
              setMessage(t('msg.doubledAsk', { value: match.cube.value * 2 }))
              return
            }
          } catch {
            /* ag yuklenemedi - kupsuz devam */
          }
        }
        if (!cancelled) doRollFor(turnStart)
      }, BOT_ROLL_DELAY)
    } else {
      timer = window.setTimeout(async () => {
        const moves = generateMoves(turnStart)
        if (hasNoMove(moves)) {
          // Bot "hamle yok": hemen gecme -> popup 2sn gorunsun (botDance effect gecer)
          if (!cancelled) setBotDance(true)
          return
        }
        let move: Move
        try {
          setMessage(t('msg.neuralThinking'))
          move = await Promise.resolve(engine.chooseMove(turnStart))
        } catch (e) {
          // Sinir agi yuklenemedi -> oyun takilmasin, hizli bota dus
          console.error('Sinir ağı hatası, hızlı bota geçildi:', e)
          if (!cancelled) setMessage(t('msg.neuralFailed'))
          move = heuristicRef.current.chooseMove(turnStart)
        }
        if (cancelled) return
        // Tas tas oynat: animasyonu baslat (bkz. bot animasyon effect'i)
        if (move.steps.length === 0) commitTurn([])
        else {
          setPlayed([])
          setBotAnim({ steps: move.steps, index: 0 })
        }
      }, BOT_MOVE_DELAY)
    }
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBotTurn, gameEnd, matchOver, cubePending, botAnim, opening, diceRolled, played, turnStart, engine, match, turnsPlayed])

  // ---- Bot "hamle yok" -> popup 2sn goster, sonra sirayi gec ----
  useEffect(() => {
    if (!botDance) return
    const name = pName(turnStart.turn)
    setMessage(t('msg.noMovePass', { name }))
    setNoMoveFlash(name) // pvb'de status gizli -> merkezi banner ile goster
    const timer = window.setTimeout(() => {
      setNoMoveFlash(null)
      setBotDance(false)
      commitTurn([])
    }, 2100)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botDance])

  // ---- Bot hamlesini tas tas oynat ----
  useEffect(() => {
    if (!botAnim) return
    if (botAnim.index >= botAnim.steps.length) {
      // Tum taslar oynandi -> kisa bekle, sirayi gec
      const t = window.setTimeout(() => {
        commitTurn(botAnim.steps)
        setBotAnim(null)
      }, BOT_END_DELAY)
      return () => window.clearTimeout(t)
    }
    // Sonraki tasi oyna
    const t = window.setTimeout(() => {
      setPlayed(botAnim.steps.slice(0, botAnim.index + 1))
      setBotAnim({ steps: botAnim.steps, index: botAnim.index + 1 })
    }, BOT_STEP_DELAY)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botAnim])

  function doRollFor(base: GameState) {
    const dice = orderDice(fairRef.current.next()) // buyuk zar once (gorunum)
    Sound.dice()
    setTurnStart(newTurn(base, dice))
    setMessage(t('msg.botPlaying', { dice: dice.join(', ') }))
  }

  // ---- Bot kup cevabi (insan katladiginda) ----
  useEffect(() => {
    if (mode !== 'pvb' || cubePending !== 'white') return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const probs = await neuralRef.current.evalPosition(turnStart, 'white')
        const botWin = probs[3] + probs[4] + probs[5]
        if (cancelled) return
        if (botWin >= 0.24) handleTake()
        else handleDrop()
      } catch {
        if (!cancelled) handleTake()
      }
    }, 800)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cubePending, mode, turnStart])

  // ---- Analiz (her zar sonrasi guncellenir) ----
  // Not: PR/hata tespiti icin tur basi siralama panel KAPALIYKEN de hesaplanir.
  useEffect(() => {
    if (!interactive || !diceRolled || gameWon) return
    if (remainingDice.length === 0) return // tur tamamlandi, analiz yok
    // Panel kapali VE ogrenme modu kapali: mid-turn analiz yok (sadece tur basi -> PR)
    if (!showAnalysis && !learnMode && played.length > 0) return
    // Analiz durumu: hic oynanmadiysa tur basi; oynandiysa mevcut konum + kalan zarlar
    const analysisState =
      played.length === 0
        ? turnStart
        : (() => {
            const s = cloneState(working)
            s.dice = remainingDice.slice()
            s.diceUsed = remainingDice.map(() => false)
            return s
          })()
    let cancelled = false
    setAnalysisLoading(true)
    ;(async () => {
      try {
        const [r, cp] = await Promise.all([
          neuralRef.current.analyzeMoves(analysisState),
          neuralRef.current.evalPosition(analysisState, analysisState.turn),
        ])
        if (!cancelled) {
          if (played.length === 0) {
            turnRankedRef.current = r // tur basi siralama (PR + hata)
            // Sans (luck) artik burada DEGIL: recordPR icinde hesaplaniyor (bu effect
            // hizli oynayinca cleanup ile iptal olup luck'i kaybediyordu).
          }
          if (r.length > 0) {
            const b = r[0]
            setCurBest({
              notation: moveNotation(b.move, analysisState.turn),
              equity: b.equity,
              reasons: explainMove(analysisState, b.move, analysisState.turn),
            })
          }
          if (showAnalysis) {
            setRanked(r)
            setCurrentProbs(cp)
            setAnalysisBoard(analysisState)
          }
        }
      } catch (e) {
        // Sinir agi yuklenemedi/hata -> hizli (heuristik) siralama
        console.error('Analiz: sinir agi hatasi, hizli tahmine geciliyor:', e)
        if (!cancelled) {
          const mover = analysisState.turn
          const ranks = generateMoves(analysisState)
            .map((move) => ({
              move,
              equity: evaluatePosition(applyPlayed(analysisState, move.steps), mover),
              probs: [] as number[],
            }))
            .sort((a, b) => b.equity - a.equity)
          if (played.length === 0) turnRankedRef.current = ranks
          if (ranks.length > 0) {
            const b = ranks[0]
            setCurBest({
              notation: moveNotation(b.move, mover),
              equity: b.equity,
              reasons: explainMove(analysisState, b.move, mover),
            })
          }
          if (showAnalysis) {
            setRanked(ranks)
            setCurrentProbs(null)
            setAnalysisBoard(analysisState)
          }
        }
      } finally {
        if (!cancelled) setAnalysisLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnalysis, learnMode, interactive, diceRolled, played, turnStart, working, remainingDice, gameWon])

  // ---- Kup danismani (insan) ----
  // Roll oncesi insan katlayabiliyorsa: teklif tavsiyesi. Insan kup teklifiyle
  // karsilastiysa: take/drop tavsiyesi. Sinir agiyla pozisyonu 1-ply degerlendirir.
  useEffect(() => {
    const humanColor: Player = online ? myColor : 'white'
    const onRollCanDouble =
      interactive &&
      !diceRolled &&
      !gameWon &&
      turnsPlayed > 0 &&
      cubePending === null &&
      turnStart.turn === humanColor &&
      canDouble(match, humanColor, false)
    const facingDouble =
      cubePending !== null &&
      cubePending !== humanColor &&
      opponent(cubePending) === humanColor
    if (!onRollCanDouble && !facingDouble) {
      setCubeHint(null)
      cubeHintRef.current = null
      return
    }
    let cancelled = false
    neuralRef.current
      .evalPosition(turnStart, humanColor)
      .then((probs) => {
        if (cancelled || (probs?.length ?? 0) < 6) return
        const hint: CubeHint = onRollCanDouble
          ? { kind: 'offer', ...cubeAdvice(probs) }
          : { kind: 'respond', ...takeDecision(probs) }
        setCubeHint(hint)
        cubeHintRef.current = hint
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, diceRolled, gameWon, turnsPlayed, cubePending, turnStart, match, online, myColor])

  // Ogrenme modu tercihini sakla
  useEffect(() => {
    try {
      localStorage.setItem('tavla.learn', learnMode ? '1' : '0')
    } catch {
      /* yok */
    }
  }, [learnMode])

  // Tur/hamle degisince ipucu gorunumu sifirlansin (ogrenme modunda otomatik geri gelir)
  useEffect(() => {
    setHintShown(false)
    setCurBest(null)
  }, [turnStart, played.length])

  // Insan sirasi: hamle yok -> otomatik gec; ZORUNLU adim (tek tam hamle / kirik tas
  // girisinde alternatif yok / tek yasal adim) -> otomatik oyna. Adim adim ilerler:
  // sonraki adim da zorunluysa o da oynanir. Secim varsa durur (oyuncu oynar).
  useEffect(() => {
    if (!interactive || !diceRolled) return
    // Mevcut pozisyon: tur basi -> turnStart; mid-turn -> working + kalan zarlar
    const cur =
      played.length === 0
        ? turnStart
        : (() => {
            const s = cloneState(working)
            s.dice = remainingDice.slice()
            s.diceUsed = remainingDice.map(() => false)
            return s
          })()
    const moves = generateMoves(cur)
    // Tur basi + hic hamle yok -> otomatik "hamle yok" deyip gec
    if (played.length === 0 && hasNoMove(moves)) {
      const name = pName(turnStart.turn)
      setMessage(t('msg.noMovePass', { name }))
      setNoMoveFlash(name) // pvb'de status gizli -> merkezi banner ile goster
      const timer = window.setTimeout(() => {
        setNoMoveFlash(null)
        commitTurn([])
      }, 2100) // "hamle yok" ~2sn ekranda kalsin
      return () => window.clearTimeout(timer)
    }
    // Tur basi + tek tam hamle -> komple oyna (otomatik onayli, mevcut davranis)
    if (played.length === 0 && moves.length === 1 && moves[0].steps.length > 0) {
      const only = moves[0]
      setMessage(t('msg.forcedAuto'))
      const timer = window.setTimeout(() => commitTurn(only.steps), 1400)
      return () => window.clearTimeout(timer)
    }
    // Zorunlu ilk adim: tum yasal diziler ayni ilk adimla basliyorsa (kirik tas
    // girisinde tek giris / tek yasal adim) -> o adimi otomatik oyna.
    const firstKeys = new Set(
      moves.map((m) => m.steps[0]).filter(Boolean).map((s) => `${s!.from}>${s!.to}:${s!.die}`),
    )
    const onlyStep = moves.map((m) => m.steps[0]).find(Boolean)
    if (firstKeys.size === 1 && onlyStep) {
      setMessage(t('msg.forcedAuto'))
      const timer = window.setTimeout(() => playSteps([onlyStep]), 1250)
      return () => window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, diceRolled, played.length, turnStart, working, remainingDice])

  // Acilis atisi sonucunu uygula: yuksek zar baslar (esit olamaz - cagiran garanti eder).
  function resolveOpening(w: number, b: number) {
    const winner: Player = w > b ? 'white' : 'black'
    setOpeningResult({
      white: w,
      black: b,
      winner,
      winnerDie: Math.max(w, b),
      loserDie: Math.min(w, b),
    })
    setOpening('reveal')
    setMessage(t('msg.openingResult', { name: pName(winner), a: Math.max(w, b), b: Math.min(w, b) }))
  }

  // Lokal: rasgele iki farkli zar.
  function handleOpeningRoll() {
    let w = secureDie()
    let b = secureDie()
    while (w === b) {
      w = secureDie()
      b = secureDie()
    }
    resolveOpening(w, b)
  }

  // Online: oda kodu + oyun no'dan DETERMINISTIK acilis -> iki istemci ayni sonucu
  // uretir (ekstra senkron gerekmez). Her oyunda skor toplamiyla degisir.
  function seededOpening(code: string, gameNo: number) {
    const seed = `${code}:${gameNo}`
    let h = 2166136261
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    const w = (Math.abs(h) % 6) + 1
    let b = (Math.abs(h >> 5) % 6) + 1
    if (b === w) b = (b % 6) + 1 // esitse kaydir (asla berabere degil)
    resolveOpening(w, b)
  }

  // Acilis sonucunu goster, sonra kazananin turuyla basla (iki FARKLI zar -> ilk hamle asla cift degil)
  useEffect(() => {
    if (opening !== 'reveal' || !openingResult) return
    const { winner, winnerDie, loserDie } = openingResult
    const timer = window.setTimeout(() => {
      const s = freshBoard(winner)
      s.dice = [winnerDie, loserDie]
      s.diceUsed = [false, false]
      setTurnStart(s)
      setStarter(winner)
      setOpening(null)
      setMessage(t('msg.playing', { name: pName(winner), dice: `${winnerDie}, ${loserDie}` }))
    }, 1700)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening, openingResult])

  // Acilis zarini OTOMATIK at (tum oyunlarda). Lokal -> rasgele; online -> oda
  // kodu + oyun no'dan deterministik (iki istemci ayni). Kimin baslayacagini belirler.
  useEffect(() => {
    if (opening !== 'roll' || cubePending || gameEnd || matchOver) return
    // Online'da rakip hazir olana kadar bekle (mm_waiting / tek kisi)
    if (online && (!onlineReady || room?.status !== 'playing')) return
    const id = window.setTimeout(() => {
      if (online && room) {
        // Oyun no = macta bugune dek toplanan puan (iki istemci ayni deger)
        seededOpening(room.code, match.score.white + match.score.black)
      } else {
        handleOpeningRoll()
      }
    }, 800)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening, online, onlineReady, room?.status, cubePending, gameEnd, matchOver])

  // Oyun durumunun imzasi (sadece oyunu ilgilendiren alanlar) -> echo tespiti
  function stateSig(
    m: MatchState,
    st: Player,
    tp: number,
    ts: GameState,
    pl: Step[],
    cp: Player | null = null,
    ge: GameEnd | null = null,
  ): string {
    return JSON.stringify({
      match: m,
      starter: st,
      turnsPlayed: tp,
      turnStart: ts,
      played: pl,
      cubePending: cp,
      // Sadece senkronla gosterilen bitisler imzayi degistirsin (normal galibiyet lokal)
      gameEnd: ge && (ge.dropped || ge.timeout || ge.resigned) ? ge : null,
    })
  }

  // ---- Oyun saati ----
  // Yeni tur/hamle sirasi baslayinca 12sn + 60sn ek sureyi sifirla
  useEffect(() => {
    // Yeni tur: yalnizca hamle gecikmesini sifirla; rezerv bankasi tukenmeye devam eder
    setClock((c) => ({ ...c, delay: clockRef.current.move }))
  }, [turnStart.turn, turnsPlayed])

  // Her saniye: once 12sn gecikme, o bitince ek sure (30+30) azalir
  useEffect(() => {
    if (!clockOn || gameEnd || matchOver || opening || cubePending || gameWon) return
    if (online && !onlineReady) return
    const id = window.setInterval(() => {
      setClock((c) => {
        if (c.delay > 0) return { ...c, delay: c.delay - 1 }
        // Gecikme bitti -> sirasi gelen oyuncunun rezerv bankasi azalir
        if (turnStart.turn === 'white') return { ...c, delay: 0, white: Math.max(0, c.white - 1) }
        return { ...c, delay: 0, black: Math.max(0, c.black - 1) }
      })
    }, 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockOn, gameEnd, matchOver, opening, cubePending, gameWon, turnStart.turn, online, onlineReady])

  // AFK geri sayimi (sunucu-otoriter): son 15sn'de saniye saniye akit (poll her ~1.2sn
  // duzeltir). Yalniz online'da; gercek kayip sunucuda ilan edilir.
  useEffect(() => {
    if (!online || afkLeft == null) return
    const id = window.setInterval(() => setAfkLeft((a) => (a == null ? a : Math.max(0, a - 1))), 1000)
    return () => window.clearInterval(id)
  }, [online, afkLeft == null])

  // Ek sure bitti -> sirasi gelen oyuncu oyunu kaybeder.
  // ONLINE: karar SUNUCUDA verilir (state.gameEnd olarak gelir) -> burada lokal karar YOK
  // (aksi halde latency/drift ile haksiz kayip olur). Yalniz pvb (bota karsi) lokal calisir.
  useEffect(() => {
    if (online) return
    if (!clockOn || gameEnd || matchOver) return
    const who = turnStart.turn
    const bank = who === 'white' ? clock.white : clock.black
    if (clock.delay > 0 || bank > 0) return
    if (online && myColor !== who) return // online'da sadece suresi biten ilan etsin
    const w = opponent(who)
    // Rezerv saati mac-basidir: bitince maci komple kaybedersin (Galaxy tarzi forfeit)
    setMatch((m) => scoreGame(m, w, Math.max(m.cube.value, m.target - m.score[w])))
    setGameEnd({ winner: w, points: match.cube.value, mult: 1, dropped: false, timeout: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, clockOn, gameEnd, matchOver, turnStart.turn, online, myColor])

  // Online analiz: oyun basinda sinir agini ONCEDEN yukle -> recordPR ilk hamleden
  // itibaren hazir (aksi halde tembel yukleme yavas kalir, ilk hamleler kaydedilmez).
  useEffect(() => {
    if (online && room?.status === 'playing') void neuralRef.current.ready().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.status])

  // ---- Online mac bitince Elo puanini bildir (sadece giris yapmis kullanici) ----
  useEffect(() => {
    if (!online || !user || ratingReportedRef.current) return
    const mW = matchWinner(match)
    if (!mW) return
    ratingReportedRef.current = true
    const won = mW === myColor
    const oppRating = room?.oppRating ?? 1500
    const before = user.rating ?? 1500
    // Bekleyen (async) hamle analizleri bitene kadar bekle (max ~1.5s) -> online analiz
    // log'u TAM kaydolsun (son hamleler kaybolmasin). Sonra en guncel log ile bildir.
    void (async () => {
      for (let i = 0; i < 30 && pendingAnalysisRef.current > 0; i++) {
        await new Promise((res) => setTimeout(res, 100))
      }
      // Son setPrStats'lerin flush olması için kısa bekleme; sonra EN GUNCEL prStatsRef'ten
      // oku (rapor closure'undaki stale prStats degil) -> kendi PR'im "—" dusmesin.
      await new Promise((res) => setTimeout(res, 200))
      const prRef = (c: Player): number | null => {
        const s = prStatsRef.current[c]
        return s.decisions > 0 ? (s.loss / s.decisions) * 500 : null
      }
      reportRating(
        won,
        oppRating,
        match.target,
        prRef(myColor),
        prLuck[myColor] - prLuck[opponent(myColor)], // goreceli sans (zero-sum)
        match.score[myColor],
        match.score[opponent(myColor)],
        room?.oppName ?? null,
        prRef(opponent(myColor)),
        JSON.stringify({ hc: myColor, log: matchLogRef.current.slice(-250) }),
        !friendlyRef.current, // ranked: eslesme/solo puanli; ARKADASLIK maci puansiz
        stakeRef.current > 0 ? 'coin' : 'match', // Jeton (duz coin bahsi) vs N-puanlik mac
        room?.code ?? null, // oda kodu -> backend friendly odayi kesin puansiz yapar
      )
        .then((r) => {
          setRatingChange({ before, after: r.rating })
          setUser((u) => (u ? { ...u, rating: r.rating } : u))
        })
        .catch(() => {
          // Ag hatasi: puan sunucuya islenemedi -> sessiz kalma, kullaniciyi uyar.
          notify.error(t('net.ratingFailed'))
        })
    })()
    // Bahisli oyun (Tek Oyun sabit / Mac Oyunu %) -> coin transferi.
    // Sunucu kazanani yetkili belirler; rakip beyani/durum gec gelirse pending doner,
    // settleRoomConfirmed birkac kez deneyip guncel bakiyeyi getirir.
    if (!friendlyRef.current && (stakeRef.current > 0 || betPctRef.current > 0) && room?.code) {
      settleRoomConfirmed(room.code, won)
        .then((r) => {
          if (typeof r.coins === 'number') setUser((u) => (u ? { ...u, coins: r.coins } : u))
          // Mac sonu ekraninda gosterilecek coin transferi (kazanan +, kaybeden -)
          if (r.ok && typeof r.stake === 'number') setCoinDelta(won ? r.stake : -r.stake)
          // ok=false && pending: rakip henuz sonucu bildirmedi -> coin askida (uyar)
          else if (!r.ok && r.pending) notify.error(t('net.settlePending'))
        })
        .catch(() => {
          notify.error(t('net.settleFailed'))
        })
      stakeRef.current = 0
      betPctRef.current = 0
    }
    // Turnuva maciysa sonucu otomatik bildir (bracket ilerlesin)
    const tm = tournMatchRef.current
    if (tm && user) {
      const winnerId = won ? user.id : tm.oppId
      reportTournament(tm.tid, tm.matchKey, winnerId).catch(() => {})
      tournMatchRef.current = null
    }
    // Hata gunlugu: bu macin en kotu hamlelerini kaydet (yalnizca kendi hamlelerim)
    if (user) {
      // Mac baglami: hangi mac / kiminle / kac kac (online rakip = insan)
      const ctx = {
        opp: room?.oppName ?? null,
        ai_level: null,
        score_me: match.score[myColor],
        score_opp: match.score[opponent(myColor)],
        won,
      }
      const bl = matchLog
        .filter((e) => e.loss >= 0.08 && e.player === myColor)
        .sort((a, b) => b.loss - a.loss)
        .slice(0, 5)
        .map((e) => ({
        loss: e.loss,
        played: e.notation,
        best: e.best,
        pos: e.pos ? JSON.stringify(e.pos) : undefined,
        steps: e.steps ? JSON.stringify(e.steps) : undefined,
        player: e.player,
        ...ctx,
      }))
      saveBlunders(bl).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, user, match, myColor, room])

  // Bota karsi mac bitince de puan islensin (bot puani zorluga gore).
  // Casual (rankedMatch=false) macta puana/lig'e etki yok; PR + hata gunlugu kalir.
  useEffect(() => {
    if (mode !== 'pvb' || !user || ratingReportedRef.current) return
    const mW = matchWinner(match)
    if (!mW) return
    ratingReportedRef.current = true
    // Giris yapmis kullanicinin AI maci HER ZAMAN kaydedilir (misafir haric).
    // Casual'da rating degismez: ranked=false -> backend Elo/lig islemez, delta=0 kaydeder.
    {
      const botRating = 900 + difficulty * 100 // seviye 1 -> 1000, seviye 10 -> 1900
      const won = mW === 'white' // pvb'de insan beyaz
      const before = user.rating ?? 1500
      reportRating(
        won,
        botRating,
        match.target,
        prOf('white'),
        prLuck.white - prLuck.black, // goreceli sans (zero-sum)
        match.score.white,
        match.score.black,
        `${AI_LEVELS[difficulty - 1]}`,
        prOf('black'),
        JSON.stringify({ hc: 'white', log: matchLog.slice(-250) }),
        rankedMatch,
      )
        .then((r) => {
          setRatingChange({ before, after: r.rating })
          setUser((u) => (u ? { ...u, rating: r.rating } : u))
        })
        .catch(() => {})
    }
    // Hata gunlugu: bu macin en kotu hamlelerini kaydet (yalnizca insan; bot degil)
    // Mac baglami: rakip = AI (zorluk), skor, sonuc (insan beyaz)
    const ctx = {
      opp: null,
      ai_level: difficulty,
      score_me: match.score.white,
      score_opp: match.score.black,
      won: mW === 'white',
    }
    const bl = matchLog
      .filter((e) => e.loss >= 0.08 && e.player === 'white')
      .sort((a, b) => b.loss - a.loss)
      .slice(0, 5)
      .map((e) => ({
        loss: e.loss,
        played: e.notation,
        best: e.best,
        pos: e.pos ? JSON.stringify(e.pos) : undefined,
        steps: e.steps ? JSON.stringify(e.steps) : undefined,
        player: e.player,
        ...ctx,
      }))
    saveBlunders(bl).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, user, match, difficulty])

  // ---- Online: sunucudan gelen durumu uygula ----
  function applyOnlineState(snap: SavedGame) {
    // Uygulanan durumu imzala ki geri gonderme (echo) olmasin
    lastSyncRef.current = stateSig(
      snap.match,
      snap.starter,
      snap.turnsPlayed,
      snap.turnStart,
      snap.played ?? [],
      snap.cubePending ?? null,
      snap.gameEnd ?? null,
    )
    setMatch(snap.match)
    setStarter(snap.starter)
    setTurnsPlayed(snap.turnsPlayed)
    setTurnStart(snap.turnStart)
    setPlayed(snap.played ?? [])
    // Rakibin gonderdigi saati al
    if (snap.clock)
      setClock({
        delay: snap.clock.delay ?? MOVE_DELAY,
        white: snap.clock.white ?? snap.clock.over ?? OVER_TOTAL,
        black: snap.clock.black ?? snap.clock.over ?? OVER_TOTAL,
      })
    setSelectedFrom(null)
    setCubePending(snap.cubePending ?? null) // rakibin kup teklifi/yaniti senkron
    // Rakibin PR + Sans'ini kendi renginden al (kendi rengimi lokal hesaplarim)
    const oppColor = opponent(myColor)
    if (snap.pr?.[oppColor]) {
      setPrStats((s) => ({ ...s, [oppColor]: snap.pr![oppColor] }))
    }
    if (snap.luck && typeof snap.luck[oppColor] === 'number') {
      setPrLuck((s) => ({ ...s, [oppColor]: snap.luck![oppColor] }))
    }
    // Rakibin analiz hamlelerini birlestir: kendi hamlelerim + rakibin gonderdikleri
    if (snap.moves) {
      const oppMoves = snap.moves.filter((e) => e.player === oppColor)
      setMatchLog((prev) => [...prev.filter((e) => e.player === myColor), ...oppMoves])
    }
    setBotAnim(null)
    setOpening(null)
    setOppStarted(true)
    // Oyun sonu (normal galibiyet DAHIL) senkronla: aliciya gameEnd, kendi kazanma
    // effect'inden ONCE set edilir -> effect `if (gameEnd) return` ile atlar (cift-sayim
    // yok) ve skor iki istemcide de tutar. null senkronlanmaz (sonraki-oyun gecisinde
    // rakibin sonuc ekrani erken kapanmasin; her oyuncu kendi "sonraki oyun"uyla ilerler).
    if (snap.gameEnd) setGameEnd(snap.gameEnd)
  }

  // Online: yerel degisikligi odaya gonder (senkron)
  // ONEMLI: bagimliliklarda tum `room` nesnesi YOK -> her yoklamada (oppName/status
  // yenilenince) tekrar gondermeyi onler. Ayrica imza ayni ise (echo) gondermez;
  // aksi halde iki istemci birbirinin eski durumunu yeniden uygulayip hamleyi siler.
  const roomCode = room?.code
  const roomStatus = room?.status
  useEffect(() => {
    if (!online || !roomCode || roomStatus !== 'playing' || !syncEnabledRef.current) return
    const sig = stateSig(match, starter, turnsPlayed, turnStart, played, cubePending, gameEnd)
    if (sig === lastSyncRef.current) return // degismedi / echo -> gonderme
    const timer = window.setTimeout(() => {
      lastSyncRef.current = sig
      const snap = {
        mode,
        difficulty,
        match,
        starter,
        turnsPlayed,
        turnStart,
        played,
        clock: { delay: clock.delay, white: clock.white, black: clock.black },
        gameEnd,
        cubePending,
        pr: prStats,
        luck: prLuck,
        // Analiz hamleleri: yuk boyutunu sinirla (son 80 hamle senkronlanir)
        moves: matchLog.slice(-80),
      }
      // Mac bittiyse odayi 'finished' isaretle -> Canli Maclar'da gorunmesin (bug: bitmis
      // mac status='playing' kalip 3dk listede duruyordu).
      updateRoom(roomCode, snap, matchOver ? 'finished' : undefined)
        .then((r) => {
          appliedVersionRef.current = r.version
        })
        .catch(() => {})
    }, 200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, roomCode, roomStatus, match, starter, turnsPlayed, turnStart, played, cubePending, gameEnd])

  // Online: odayi periyodik yokla (rakip hamlesi + durum)
  useEffect(() => {
    if (!online || !room) return
    let cancelled = false
    const poll = async () => {
      try {
        const rv = await showRoom(room.code)
        if (cancelled || !rv) return
        setRoom((r) =>
          r
            ? {
                ...r,
                oppName: r.slot === 'p1' ? rv.p2_name : rv.p1_name,
                oppRating: r.slot === 'p1' ? rv.p2_rating : rv.p1_rating,
                oppAvatar: r.slot === 'p1' ? rv.p2_avatar : rv.p1_avatar,
                oppFrame: r.slot === 'p1' ? (rv.p2_frame ?? null) : (rv.p1_frame ?? null),
                status: rv.status,
              }
            : r,
        )
        if (rv.messages) setChat(rv.messages)
        // Bekleyen oyuncu (p1) eslesince: sunucunun anlastigi uzunlugu uygula (henuz
        // hamle senkronu gelmeden). Bir kez ve yalnizca oyun baslamadan.
        if (!matchTargetSyncedRef.current && rv.target != null && appliedVersionRef.current < 0) {
          matchTargetSyncedRef.current = true
          if (onlineTargetRef.current !== rv.target) {
            onlineTargetRef.current = rv.target
            setMatch(newMatch(rv.target))
            setClock(freshMatchClock(rv.target))
          }
        }
        if (rv.version > appliedVersionRef.current && rv.state) {
          appliedVersionRef.current = rv.version
          syncEnabledRef.current = true
          applyOnlineState(rv.state as SavedGame) // lastSyncRef'i kendi ayarlar (echo yok)
        }
        // Sunucu-otoriter saat: her poll'de (state degismese de) guncel saat + AFK.
        // Kayip (timeout/AFK) sunucu tarafinda ilan edilir ve state.gameEnd olarak gelir
        // (applyOnlineState onu uygular) -> lokal timeout karari online'da devre disi.
        const sc = rv.clock
        if (sc) {
          setClock({ delay: sc.delay, white: sc.white, black: sc.black })
          setSrvActive(sc.active === 'white' ? 'white' : sc.active === 'black' ? 'black' : null)
          setAfkLeft(sc.afk)
        }
      } catch {
        /* gecici */
      }
    }
    const id = window.setInterval(poll, 1200)
    poll()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.code])

  // Dogrulama sonucu (link'ten ?verified=1/0): birlesik toast olarak goster ve
  // URL'den parametreyi temizle (refresh'te tekrar cikmasin). Tek sefer tetiklenir.
  const verifyNotifiedRef = useRef(false)
  useEffect(() => {
    if (!verifyNotice || verifyNotifiedRef.current) return
    verifyNotifiedRef.current = true
    if (verifyNotice === 'ok') notify.success(t('verify.ok'))
    else notify.error(t('verify.fail'))
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('verified')
      window.history.replaceState({}, '', url.pathname + url.search)
    } catch {
      /* yok */
    }
  }, [verifyNotice, notify, t])

  // E-posta dogrulama linkini tekrar gonder
  async function handleResendVerification() {
    if (resendState === 'sending') return
    setResendState('sending')
    try {
      await resendVerification()
      setResendState('sent')
    } catch {
      setResendState('idle')
    }
  }

  // Ses: her tas oynandiginda (played uzayinca)
  const prevPlayedLenRef = useRef(0)
  useEffect(() => {
    if (played.length > prevPlayedLenRef.current) Sound.move()
    prevPlayedLenRef.current = played.length
  }, [played.length])
  // Ses: oyun bitince kazanma/kaybetme
  const soundedEndRef = useRef(false)
  useEffect(() => {
    if (!gameEnd) {
      soundedEndRef.current = false
      return
    }
    if (soundedEndRef.current) return
    soundedEndRef.current = true
    const humanColor: Player = mode === 'online' && room?.slot === 'p2' ? 'black' : 'white'
    if (gameEnd.winner === humanColor) Sound.win()
    else Sound.lose()
  }, [gameEnd, mode, room])
  // Ses: kup teklifi
  useEffect(() => {
    if (cubePending) Sound.double()
  }, [cubePending])

  // Acilista takilma fix: kayitli oyun bot yarim-animasyonda kaydedildiyse
  // (sira bot + played>0) played temizlenir ki bot turunu bastan oynasin.
  useEffect(() => {
    if (saved && saved.mode === 'pvb' && saved.turnStart?.turn === BOT_PLAYER && (saved.played?.length ?? 0) > 0) {
      setPlayed([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Kalp atisi: giris yapiliysa cevrimici tut + gelen davetleri yokla
  useEffect(() => {
    if (!user) {
      setInvites([])
      setTournNotices([])
      setNotifications([])
      setUnreadNotif(0)
      return
    }
    let cancelled = false
    const beat = () => {
      ping()
        .then((r) => {
          if (!cancelled) {
            setInvites(r.invites ?? [])
            setTournNotices(r.tournament_matches ?? [])
            setRewardReady(!!r.reward_ready)
            setRewardSecs(r.reward_seconds ?? 0)
            setNotifications(r.notifications ?? [])
            setUnreadNotif(r.unread ?? 0)
            if (typeof r.coins === 'number') setUser((u) => (u ? { ...u, coins: r.coins } : u))
          }
        })
        .catch(() => {})
    }
    beat()
    const id = window.setInterval(beat, 20000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [user])

  // Odul geri sayimi: her saniye azalt (ping 20sn'de bir gercek degeri yeniler)
  useEffect(() => {
    if (rewardReady || rewardSecs <= 0) return
    const id = window.setInterval(() => setRewardSecs((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [rewardReady, rewardSecs > 0])

  // Magaza: satin al / cerceve tak
  async function handleBuy(shopId: string) {
    try {
      const r = await buyItem(shopId)
      setUser((u) => (u ? { ...u, coins: r.coins, unlocks: r.unlocks } : u))
      // Tahta satin alindiysa dogrudan kusan (yeni tahtayi hemen gorsun)
      if (shopId.startsWith('theme.')) setBoardTheme(shopId.slice('theme.'.length))
    } catch {
      /* yetersiz coin vb. -> sessizce yoksay */
    }
  }
  async function handleEquipFrame(id: string | null) {
    try {
      const r = await selectFrame(id)
      setUser((u) => (u ? { ...u, avatar_frame: r.avatar_frame } : u))
    } catch {
      /* yoksay */
    }
  }
  async function handleDaily() {
    try {
      const r = await claimDaily()
      setUser((u) => (u ? { ...u, coins: r.coins } : u))
      if (r.claimed) {
        setRewardReady(false)
        setRewardSecs(6 * 3600) // hemen 6 saat geri sayima gec (ping dogrular)
      }
      return { claimed: r.claimed, reward: r.reward }
    } catch {
      return { claimed: false }
    }
  }
  // Ust coin rozetine tiklaninca: odul hazirsa al, degilse magazayi ac
  async function handleCoinClick() {
    if (rewardReady) {
      const r = await handleDaily()
      if (r.claimed) Sound.win()
    } else {
      setShopOpen(true)
    }
  }

  const [menuOpen, setMenuOpen] = useState(false) // mobil hamburger menu acik mi
  const [gameMenuOpen, setGameMenuOpen] = useState(false) // oyun-ici menu (Galaxy tarzi)
  const [autoRoll, setAutoRoll] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tavla.autoroll') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('tavla.autoroll', autoRoll ? '1' : '0')
    } catch {
      /* yok */
    }
  }, [autoRoll])
  const [animOn, setAnimOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tavla.animoff') !== '1'
    } catch {
      return true
    }
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-anim', animOn ? 'on' : 'off')
    try {
      localStorage.setItem('tavla.animoff', animOn ? '0' : '1')
    } catch {
      /* yok */
    }
  }, [animOn])
  // Tas hareket animasyonu stili (kapali/kayma/yay/kaldir-birak) — kullanici secer
  // Tas hareket stili: Ayarlar'dan secici KALDIRILDI; mevcut localStorage degeri (varsa)
  // korunur, yoksa 'slide'. Artik degismedigi icin setter yok.
  const [moveStyle] = useState<MoveStyle>(() => {
    try {
      const v = localStorage.getItem('tavla.move')
      return v === 'off' || v === 'slide' || v === 'arc' || v === 'lift' ? v : 'slide'
    } catch {
      return 'slide'
    }
  })
  // FLIP: playSteps state'i guncellemeden ONCE kaynak dikdortgenini buraya yazar;
  // render sonrasi useLayoutEffect hedef tasi kaynaktan ucurur.
  const pendingFlightRef = useRef<{ to: number | 'off'; srcRect: DOMRect } | null>(null)

  // Otomatik zar: insanin sirasi gelince zar otomatik atilir (kucuk gecikme).
  // Kup teklif etme secenegi yoksa (1 puanlik oyun, Crawford, olu kup, rakip
  // kupu tutuyorsa veya ilk el) beklemenin anlami yok -> autoRoll kapali olsa
  // bile otomatik at. Kup karari verilebilecekse yalnizca autoRoll acikken at.
  useEffect(() => {
    if (!interactive || diceRolled || opening || cubePending || gameWon) return
    if (!shouldAutoRoll(match, turnStart.turn, turnsPlayed, autoRoll)) return
    const id = window.setTimeout(() => doRoll(), 500)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRoll, interactive, diceRolled, opening, cubePending, gameWon, turnStart, turnsPlayed, match])

  // Mobil: kucuk ekran + dikey yon -> oyunda yatay cevirme uyarisi
  const [portraitMobile, setPortraitMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px) and (orientation: portrait)')
    const on = () => setPortraitMobile(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  // Manuel yatay: cihazin donme kilidi acikken (iPhone) fiziksel cevirmeden
  // gorunumu 90 dondurup yatay oynatir. Kullanici "yine de yatay oyna" ile secer.
  // Mobil portre: FIZIKSEL cevirme (native landscape) kullanilir. Kirik CSS 90°
  // rotate hack'i kaldirildi; eski kayitli flag temizlenir, class asla eklenmez.
  useEffect(() => {
    try {
      localStorage.removeItem('tv-force-landscape')
    } catch {
      /* yok */
    }
    document.getElementById('root')?.classList.remove('force-landscape')
  }, [])

  // Tam ekran (browser Fullscreen API) — oyun ekraninda ac/kapa butonu.
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onFs = () => {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      // Tam ekranda ust hesap barini gizle (CSS: html.fs-active .account-bar)
      document.documentElement.classList.toggle('fs-active', fs)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }

  // Lobide asagi-cek-yenile (pull-to-refresh). App sabit ekran (body overflow:hidden)
  // oldugu icin tarayicinin native jesti calismaz; en ustteyken cekince kendimiz reload ederiz.
  const [ptrDist, setPtrDist] = useState(0)
  const ptrDistRef = useRef(0)
  const ptrPullingRef = useRef(false)
  useEffect(() => {
    if (!home) return
    const THRESHOLD = 66
    const MAX = 92
    let startY = 0
    const scroller = () => document.querySelector('.lobby-main') as HTMLElement | null
    const onStart = (e: TouchEvent) => {
      const sc = scroller()
      if (sc && sc.scrollTop <= 0 && e.touches.length === 1) {
        startY = e.touches[0].clientY
        ptrPullingRef.current = true
      } else {
        ptrPullingRef.current = false
      }
    }
    const onMove = (e: TouchEvent) => {
      if (!ptrPullingRef.current) return
      const dy = e.touches[0].clientY - startY
      const d = dy > 0 ? Math.min(dy * 0.45, MAX) : 0
      ptrDistRef.current = d
      setPtrDist(d)
    }
    const onEnd = () => {
      if (ptrPullingRef.current && ptrDistRef.current >= THRESHOLD) {
        setPtrDist(MAX)
        window.location.reload()
        return
      }
      ptrPullingRef.current = false
      ptrDistRef.current = 0
      setPtrDist(0)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [home])

  // Online host (p1): rakip katilinca acilis atisini baslat
  useEffect(() => {
    if (!online || room?.slot !== 'p1' || room?.status !== 'playing') return
    if (syncEnabledRef.current) return
    syncEnabledRef.current = true
    setTurnStart(freshBoard('white'))
    setPlayed([])
    setOpening('roll')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.slot, room?.status])

  async function handleCreateRoom(target = 1) {
    setRoomBusy(true)
    setRoomError('')
    try {
      friendlyRef.current = true // davet ile kurulan oda = arkadaslik maci (puan/coin YOK)
      stakeRef.current = 0
      betPctRef.current = 0
      const res = await createRoom(profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar, timeControl)
      appliedVersionRef.current = -1
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      setOppStarted(false)
      setChat([])
      ratingReportedRef.current = false
      setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
    setMatchLog([])
    setRatingChange(null)
      setClock(freshMatchClock(onlineTargetRef.current))
      fairRef.current = new FairDice()
      setMatch(newMatch(target))
      setStarter('white')
      setTurnsPlayed(0)
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
      setCubePending(null)
      setGameEnd(null)
      setBotAnim(null)
      setOpening('roll') // otomatik acilis zari -> kimin baslayacagi belirlenir
      setRoom({
        code: res.room.code,
        slot: res.slot,
        oppName: null,
        oppRating: null,
        oppAvatar: null,
        oppFrame: null,
        status: res.room.status,
      })
    } catch {
      setRoomError(t('mp.connError'))
    } finally {
      setRoomBusy(false)
    }
  }

  // Tek Oyun: bahis + tema sec -> ayni bahisli online eslesmeye gir (tek oyun)
  function startSoloStake(stake: number, target = 1) {
    stakeRef.current = stake
    betPctRef.current = 0 // Tek Oyun sabit bahis (pct degil)
    minRatingRef.current = 0 // Tek Oyun: puan filtresi yok
    // Tahta ARTIK seviyeye kilitli degil: oyuncunun secili boardTheme'i korunur
    // (Tahtayi Degistir ile kendisi secer).
    setSoloOpen(false)
    mmOriginRef.current = 'solo' // iptalde Tek Oyun ekranina don
    onlineTargetRef.current = target // secilen puan hedefi (1 = tek oyun)
    targetsRef.current = [target]
    setMode('online')
    setHome(false)
    handleMatchmake()
  }

  // Hizli eslesme: havuza gir; matched ise hemen basla, degilse mm_waiting'de bekle
  async function handleMatchmake() {
    setRoomBusy(true)
    setRoomError('')
    friendlyRef.current = false // eslesme havuzu / Tek Oyun = puanli/coinli (dostluk degil)
    try {
      const res = await matchmake(
        profile?.nickname ?? t('auth.guestNick'),
        user?.rating,
        profile.avatar,
        stakeRef.current,
        user?.id,
        minRatingRef.current,
        betPctRef.current,
        targetsRef.current,
        timeControl,
      )
      // Eslesme olduysa sunucu ortak uzunlugu (target) verir; olmadiysa gecici (max).
      matchTargetSyncedRef.current = res.room.target != null
      if (res.room.target != null) onlineTargetRef.current = res.room.target
      appliedVersionRef.current = -1
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      setOppStarted(false)
      setChat([])
      ratingReportedRef.current = false
      setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
      setMatchLog([])
      setRatingChange(null)
      setClock(freshMatchClock(onlineTargetRef.current))
      fairRef.current = new FairDice()
      setMatch(newMatch(onlineTargetRef.current))
      setStarter('white')
      setTurnsPlayed(0)
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
      setCubePending(null)
      setGameEnd(null)
      setBotAnim(null)
      setOpening('roll') // otomatik acilis zari -> kimin baslayacagi belirlenir
      setRoom({
        code: res.room.code,
        slot: res.slot,
        oppName: res.slot === 'p2' ? res.room.p1_name : res.room.p2_name,
        oppRating: res.slot === 'p2' ? res.room.p1_rating : res.room.p2_rating,
        oppAvatar: res.slot === 'p2' ? res.room.p1_avatar : res.room.p2_avatar,
        oppFrame: res.slot === 'p2' ? (res.room.p1_frame ?? null) : (res.room.p2_frame ?? null),
        status: res.room.status,
      })
    } catch (err) {
      // ApiError (status var) -> sunucunun gercek mesajini goster; yoksa ag hatasi
      const e = err as { status?: number; errors?: Record<string, string[]>; message?: string }
      if (e?.status) {
        const first = e.errors ? Object.values(e.errors)[0]?.[0] : undefined
        setRoomError(first || e.message || t('mp.connError'))
      } else {
        setRoomError(t('mp.connError'))
      }
    } finally {
      setRoomBusy(false)
    }
  }

  async function handleCancelMatch() {
    stakeRef.current = 0 // bahis eslesmesi iptal edildi
    betPctRef.current = 0
    try {
      await cancelMatchmake()
    } catch {
      /* yoksay */
    }
    // Oda/eslesme durumunu temizle. handleLeaveRoom ana sayfaya atardi; burada ise
    // eslesmeyi baslatan kurulum ekranina geri donuyoruz (kullanici kaldigi yere donsun).
    setRoom(null)
    syncEnabledRef.current = false
    appliedVersionRef.current = -1
    setOppStarted(false)
    setChat([])
    tournMatchRef.current = null
    setHome(false)
    if (mmOriginRef.current === 'solo') setSoloOpen(true)
    else setSetup('online')
  }

  async function handleJoinRoom(code: string) {
    setRoomBusy(true)
    setRoomError('')
    try {
      friendlyRef.current = true // koda katilma = arkadaslik maci (puan/coin YOK)
      stakeRef.current = 0
      betPctRef.current = 0
      const res = await joinRoom(code, profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar, timeControl)
      appliedVersionRef.current = -1
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      fairRef.current = new FairDice()
      setOppStarted(false)
      setChat([])
      ratingReportedRef.current = false
      setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
    setMatchLog([])
    setRatingChange(null)
      setClock(freshMatchClock(onlineTargetRef.current))
      setOpening('roll') // otomatik acilis zari -> kimin baslayacagi belirlenir
      setRoom({
        code: res.room.code,
        slot: res.slot,
        oppName: res.slot === 'p2' ? res.room.p1_name : res.room.p2_name,
        oppRating: res.slot === 'p2' ? res.room.p1_rating : res.room.p2_rating,
        oppAvatar: res.slot === 'p2' ? res.room.p1_avatar : res.room.p2_avatar,
        oppFrame: res.slot === 'p2' ? (res.room.p1_frame ?? null) : (res.room.p2_frame ?? null),
        status: res.room.status,
      })
    } catch (e) {
      setRoomError(
        e instanceof ApiErr && e.status === 404
          ? t('mp.roomNotFound')
          : e instanceof ApiErr && e.status === 409
            ? t('mp.roomFull')
            : t('mp.connError'),
      )
    } finally {
      setRoomBusy(false)
    }
  }

  // Turnuva maci: iki oyuncu ayni odaya girer; mac bitince sonuc otomatik bildirilir
  async function handlePlayTournamentMatch(tid: number, m: { key: string }, oppId: number) {
    setTournOpen(false)
    setRoomBusy(true)
    setRoomError('')
    try {
      const code = await tournamentMatchRoom(tid, m.key)
      const res = await enterRoom(code, profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar, timeControl)
      tournMatchRef.current = { tid, matchKey: m.key, oppId }
      appliedVersionRef.current = -1
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      fairRef.current = new FairDice()
      setOppStarted(false)
      setChat([])
      ratingReportedRef.current = false
      setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
      setMatchLog([])
      setRatingChange(null)
      setClock(freshMatchClock(onlineTargetRef.current))
      onlineTargetRef.current = 1 // turnuva maci: tek oyun
      targetsRef.current = [1]
      setMatch(newMatch(1))
      setStarter('white')
      setTurnsPlayed(0)
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
      setCubePending(null)
      setGameEnd(null)
      setBotAnim(null)
      setOpening('roll') // otomatik acilis zari -> kimin baslayacagi belirlenir
      setHome(false)
      setMode('online')
      setRoom({
        code: res.room.code,
        slot: res.slot,
        oppName: res.slot === 'p2' ? res.room.p1_name : res.room.p2_name,
        oppRating: res.slot === 'p2' ? res.room.p1_rating : res.room.p2_rating,
        oppAvatar: res.slot === 'p2' ? res.room.p1_avatar : res.room.p2_avatar,
        oppFrame: res.slot === 'p2' ? (res.room.p1_frame ?? null) : (res.room.p2_frame ?? null),
        status: res.room.status,
      })
    } catch {
      setRoomError(t('mp.connError'))
      setTournOpen(true)
    } finally {
      setRoomBusy(false)
    }
  }

  // Paylasimli kodla online oyuna gir (arkadas daveti). Turnuva baglami yok.
  async function enterOnlineByCode(code: string, target = 3) {
    setRoomBusy(true)
    setRoomError('')
    try {
      const res = await enterRoom(code, profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar, timeControl)
      tournMatchRef.current = null
      appliedVersionRef.current = -1
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      fairRef.current = new FairDice()
      setOppStarted(false)
      setChat([])
      ratingReportedRef.current = false
      setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
      setMatchLog([])
      setRatingChange(null)
      setClock(freshMatchClock(onlineTargetRef.current))
      onlineTargetRef.current = target
      targetsRef.current = [target]
      setMatch(newMatch(target))
      setStarter('white')
      setTurnsPlayed(0)
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
      setCubePending(null)
      setGameEnd(null)
      setBotAnim(null)
      setOpening('roll') // otomatik acilis zari -> kimin baslayacagi belirlenir
      setHome(false)
      setMode('online')
      setRoom({
        code: res.room.code,
        slot: res.slot,
        oppName: res.slot === 'p2' ? res.room.p1_name : res.room.p2_name,
        oppRating: res.slot === 'p2' ? res.room.p1_rating : res.room.p2_rating,
        oppAvatar: res.slot === 'p2' ? res.room.p1_avatar : res.room.p2_avatar,
        oppFrame: res.slot === 'p2' ? (res.room.p1_frame ?? null) : (res.room.p2_frame ?? null),
        status: res.room.status,
      })
    } catch {
      setRoomError(t('mp.connError'))
    } finally {
      setRoomBusy(false)
    }
  }

  // Arkadasi oyuna davet et: kod al, odaya gir, arkadas kabul edince baslar
  async function handleInviteFriend(userId: number) {
    setFriendsOpen(false)
    try {
      const { code } = await inviteFriend(userId)
      await enterOnlineByCode(code)
    } catch {
      /* yoksay */
    }
  }
  async function handleAcceptInvite(inv: GameInviteT) {
    setInvites((list) => list.filter((i) => i.id !== inv.id))
    try {
      const r = await respondInvite(inv.id, true)
      if (r.code) await enterOnlineByCode(r.code)
    } catch {
      /* yoksay */
    }
  }
  async function handleDeclineInvite(inv: GameInviteT) {
    setInvites((list) => list.filter((i) => i.id !== inv.id))
    respondInvite(inv.id, false).catch(() => {})
  }

  function handleLeaveRoom() {
    stakeRef.current = 0
    betPctRef.current = 0
    setRoom(null)
    syncEnabledRef.current = false
    appliedVersionRef.current = -1
    setOppStarted(false)
    setChat([])
    tournMatchRef.current = null
    setHome(true)
  }

  // Devam eden online maca GERI DON: odayi kur; poll (room.code'a bagli) sunucudaki
  // guncel state'i applyOnlineState ile geri yukler ve senkronu acar.
  function rejoinRoom(r: ActiveRoom) {
    const tgt = r.target ?? 1
    onlineTargetRef.current = tgt
    matchTargetSyncedRef.current = true
    appliedVersionRef.current = -1 // poll guncel state'i uygulasin
    syncEnabledRef.current = false // poll apply edince acilir (echo yok)
    setMode('online')
    fairRef.current = new FairDice()
    setMatch(newMatch(tgt))
    setClock(freshMatchClock(tgt))
    setStarter('white')
    setTurnsPlayed(0)
    setTurnStart(freshBoard('white'))
    setPlayed([])
    setSelectedFrom(null)
    setCubePending(null)
    setGameEnd(null)
    setBotAnim(null)
    setOpening(null)
    setOppStarted(true)
    setChat([])
    closeAllPages()
    setRoom({
      code: r.code,
      slot: r.slot,
      oppName: r.opp_name ?? '',
      oppRating: r.opp_rating ?? null,
      oppAvatar: r.opp_avatar ?? null,
      oppFrame: null,
      status: 'playing',
    })
    setHome(false)
  }

  // Lobide: giris yapan kullanicinin devam eden online maclarini cek (geri donme banner'i)
  useEffect(() => {
    if (!user || !home) {
      setActiveRooms([])
      return
    }
    let alive = true
    myActiveRooms()
      .then((rs) => alive && setActiveRooms(rs))
      .catch(() => alive && setActiveRooms([]))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, home])

  // Online sohbet: mesaj gonder (sunucu guncel listeyi doner)
  async function handleSendChat(text: string) {
    if (!room) return
    try {
      const res = await sendChat(room.code, text)
      if (res.messages) setChat(res.messages)
    } catch {
      /* yoksay - sonraki yoklamada gelir */
    }
  }

  // Mac kurulum ekrani onaylandi -> ayarlari uygula, maci/odayi baslat
  function applyMatchSetup(opts: MatchOptions) {
    setShowPip(opts.showPip)
    setShowAnalysis(opts.showAnalysis)
    setTimeControl(opts.timeControl)
    setRankedMatch(opts.ranked ?? true)
    clockRef.current = CLOCK_PRESETS[opts.timeControl]
    if (opts.difficulty) setDifficulty(opts.difficulty)
    setSetup(null)
    setHome(false)
    // Mac Oyunu: her zaman online -> gercek rakiple dogrudan eslesme (Oyunu Baslat)
    if (opts.mode === 'online') {
      mmOriginRef.current = 'match' // iptalde Mac kurulum ekranina don
      targetsRef.current = opts.targets && opts.targets.length ? opts.targets : [opts.target]
      onlineTargetRef.current = Math.max(...targetsRef.current) // gecici; anlasilan uzunluk eslesmede kesinlesir
      stakeRef.current = 0 // Mac Oyunu sabit stake degil, % bahis kullanir
      betPctRef.current = opts.betPct ?? 0
      minRatingRef.current = opts.minRating ?? 0
      setMode('online')
      setHome(false)
      handleMatchmake()
    } else {
      handleNewMatch(opts.target, 'pvb')
    }
  }

  // Hamleyi onayla ve sirayi rakibe ver
  function handleConfirm() {
    const err = computeMoveError(played)
    if (err) setLastError(err)
    commitTurn(played)
  }

  // Bir step dizisini oyna. Tur otomatik BITMEZ (Onayla gerekir).
  function playSteps(seq: Step[]) {
    // Tas hareket animasyonu: state guncellenmeden ONCE kaynak konumunu yakala.
    // Birlesik hamlede (seq>1) tek ucus: ilk adimin kaynagi -> son adimin hedefi.
    if (
      moveStyle !== 'off' &&
      animOn &&
      seq.length > 0 &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const r = sourceRect(seq[0].from)
      if (r) pendingFlightRef.current = { to: seq[seq.length - 1].to, srcRect: r }
    }
    setPlayed([...played, ...seq])
    setSelectedFrom(null)
  }

  // Hamle uygulandiktan (render) sonra hedef tasi kaynaktan ucur.
  useLayoutEffect(() => {
    const f = pendingFlightRef.current
    if (!f || moveStyle === 'off') {
      pendingFlightRef.current = null
      return
    }
    pendingFlightRef.current = null
    const el = destEl(f.to)
    if (el) flyChecker(el, f.srcRect, moveStyle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [played])

  // TEK TIK: kaynaga tiklayinca oyna.
  // Oncelik: toplama (bear-off) varsa topla; yoksa aktif zar.
  function handleSelectFrom(from: number | 'bar') {
    if (!interactive) return
    const stepsFrom = nextSteps.filter((s) => s.from === from)
    if (stepsFrom.length === 0) return
    const offStep = stepsFrom.find((s) => s.to === 'off')
    if (offStep) {
      playSteps([offStep])
      return
    }
    const active = remainingDice[0]
    const step = stepsFrom.find((s) => s.die === active) ?? stepsFrom[0]
    playSteps([step])
  }

  // Surukleme baslarken kaynagi sec (yesil hedefler gorunur)
  function handleDragFrom(from: number | 'bar') {
    if (!interactive) return
    setSelectedFrom(from)
  }

  // Hedefe birak -> o hedefe giden dizi (birlesik 8 dahil) oyna
  function handleSelectTarget(to: number | 'off') {
    if (!interactive || selectedFrom === null) return
    const seq = dragTargets.get(to)
    if (!seq || seq.length === 0) return
    playSteps(seq)
  }

  // Zar sirasini degistir (2-1 -> 1-2): once oynanacak zari sec
  function handleSwapDice() {
    if (!interactive || turnStart.dice.length !== 2 || played.length !== 0) return
    const s = cloneState(turnStart)
    s.dice = [turnStart.dice[1], turnStart.dice[0]]
    setTurnStart(s)
    setSelectedFrom(null)
  }

  // Geri al: son oynanan tek adimi geri al (komple degil)
  function handleUndo() {
    setPlayed((p) => p.slice(0, -1))
    setSelectedFrom(null)
  }

  function handleNewMatch(target = match.target, nextMode = mode) {
    if (nextMode !== 'online') {
      setRoom(null)
      syncEnabledRef.current = false
    }
    setMode(nextMode)
    fairRef.current = new FairDice() // yeni mac -> yeni adil-zar taahhudu
    setMatch(newMatch(target))
    setStarter('white')
    setTurnStart(freshBoard('white'))
    resetGameUi()
    setPrStats({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
    setPrLuck({ white: 0, black: 0 })
    setCoinDelta(null)
    setMatchLog([])
    setRatingChange(null) // yeni mac -> PR sifirla
    setMessage(t('msg.newMatch'))
  }

  function handleLogout() {
    apiLogout()
    setUser(null)
    setGuestProfile(null)
  }

  function nextGame() {
    const m2 = setupNextGame(match)
    const s = opponent(starter)
    setStarter(s)
    setMatch(m2)
    setTurnStart(freshBoard(s))
    resetGameUi(false) // mac-basi rezerv saati: bankayi koru, sadece hamle gecikmesini sifirla
    setMessage(m2.isCrawford ? t('msg.crawfordGame') : t('msg.nextGame'))
  }

  // ---- Overlay icerikleri ----
  // "hamle yok" popup: insan sirasinda VEYA bot dans ederken (izleyenler gorsun) goster
  const noMove = (interactive || botDance) && diceRolled && hasNoMove(generateMoves(turnStart))
  const showRoll = interactive && !diceRolled
  // Tum oynanabilir zarlar oynandi -> onay bekleniyor
  const turnComplete =
    interactive && diceRolled && played.length > 0 && nextSteps.length === 0
  const humanCanDouble =
    showRoll && turnsPlayed > 0 && canDouble(match, turnStart.turn, false)
  // Kup teklifine yanit: pvp (ayni ekran), bota karsi, veya online'da rakip teklif ettiyse
  const humanRespond =
    cubePending !== null &&
    (mode === 'pvp' || cubePending === BOT_PLAYER || (online && cubePending !== myColor))
  // Online'da kendi teklifim: rakibin yanitini bekliyorum
  const cubeWaiting = online && cubePending === myColor
  const canSwapDice =
    interactive &&
    played.length === 0 &&
    remainingDice.length === 2 &&
    remainingDice[0] !== remainingDice[1]
  // Zar yuzleri: hep 2 zar goster, oynananlari soluk yap (ciftte yarisi soluk)
  const diceFaces = ((): { value: number; used: boolean }[] => {
    const d = turnStart.dice
    if (d.length === 0) return []
    if (d.length === 4) {
      const faded = Math.floor(played.length / 2) // her zar 2 hamle
      return [
        { value: d[0], used: faded >= 1 },
        { value: d[0], used: faded >= 2 },
      ]
    }
    const used = [false, false]
    for (const st of played) {
      for (let i = 0; i < d.length; i++) {
        if (!used[i] && d[i] === st.die) {
          used[i] = true
          break
        }
      }
    }
    return d.map((v, i) => ({ value: v, used: used[i] }))
  })()
  const pipTop = pipCount(working, 'black')
  const pipBottom = pipCount(working, 'white')

  // PR (Performans Reytingi): karar basina ortalama equity kaybi x 500 (dusuk = iyi)
  const prOf = (c: Player): number | null =>
    prStats[c].decisions > 0 ? (prStats[c].loss / prStats[c].decisions) * 500 : null
  // PR -> seviye unvani (9 kademeli standart tavla tablosu; badges.ts)
  const prBand = (p: number | null): string => (p == null ? '' : divisionOfPR(p).key)
  const prHumanColor: Player = online ? myColor : 'white'
  const prValue = prOf(prHumanColor)
  const prBandKey = prBand(prValue)
  // Sans: kendi rengim lokal; online rakip senkronla gelir (hesaplamadiysa —).
  // pvb'de bot hesaplanmaz -> null (—).
  const luckOf = (c: Player): number | null => {
    if (mode === 'pvb' && c === BOT_PLAYER) return null
    if (online && c !== myColor && prStats[c].decisions === 0) return null
    return prLuck[c]
  }

  let centerMain: React.ReactNode = null
  if (opening === 'roll') {
    centerMain = (
      <div className="result-box">
        <div className="result-title">{t('opening.title')}</div>
        <div className="opening-rolling">
          <Die value={1} owner="white" used={false} className="rolling" />
          <Die value={6} owner="black" used={false} className="rolling" />
        </div>
        <div className="result-points">{t('opening.rolling')}</div>
      </div>
    )
  } else if (opening === 'reveal' && openingResult) {
    centerMain = (
      <div className="result-box">
        <div className="result-title">{t('opening.title')}</div>
        <div className="opening-dice">
          <div className={`opening-side ${openingResult.winner === 'white' ? 'win' : ''}`}>
            <Die value={openingResult.white} owner="white" used={false} />
            <span>{t('player.white')}</span>
          </div>
          <div className={`opening-side ${openingResult.winner === 'black' ? 'win' : ''}`}>
            <Die value={openingResult.black} owner="black" used={false} />
            <span>{t('player.black')}</span>
          </div>
        </div>
        <div className="result-points">
          {t('msg.openingResult', {
            name: pName(openingResult.winner),
            a: openingResult.winnerDie,
            b: openingResult.loserDie,
          })}
        </div>
      </div>
    )
  } else if (gameEnd && !matchOver) {
    // Oyun bitti ama mac surer -> kucuk kutu (mac bitince tam ekran MatchResult gosterilir)
    const multKey =
      gameEnd.mult === 3 ? 'mult.backgammon' : gameEnd.mult === 2 ? 'mult.gammon' : 'mult.normal'
    const title =
      gameEnd.timeout
        ? t('result.timeout', { name: pName(gameEnd.winner) })
        : gameEnd.resigned
          ? t('result.resign', { name: pName(gameEnd.winner) })
          : gameEnd.dropped
            ? t('result.cubeDrop', { name: pName(gameEnd.winner) })
            : t('result.won', { name: pName(gameEnd.winner), type: t(multKey) })
    centerMain = (
      <div className="result-box">
        <div className="result-title">{title}</div>
        <div className="result-points">{t('result.points', { n: gameEnd.points })}</div>
        {prValue != null && (
          <div className="result-pr">
            {t('pr.your')}: <b>PR {prValue.toFixed(1)}</b> · {t(prBandKey)}
          </div>
        )}
        <div className="result-actions">
          {matchOver ? (
            <Button variant="default" onClick={() => handleNewMatch()}>
              {t('btn.newMatch')}
            </Button>
          ) : (
            <Button variant="default" onClick={nextGame}>
              {t('btn.nextGame')}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => (online ? handleLeaveRoom() : setHome(true))}
          >
            <Icon name="home" /> {t('home.title')}
          </Button>
        </div>
      </div>
    )
  } else if (humanRespond) {
    centerMain = (
      <div className="result-box">
        <div className="result-title">
          {t('msg.doubled', { name: pName(cubePending!), value: match.cube.value * 2 })}
        </div>
        {cubeHint?.kind === 'respond' && (
          <div className={`cube-advice ${cubeHint.take === 'take' ? 'ok' : 'warn'}`}>
            <Icon name="bulb" size={14} />
            {t(cubeHint.take === 'take' ? 'cube.advTake' : 'cube.advDrop')} ·{' '}
            {t('cube.win')} {cubeHint.winPct.toFixed(0)}%
          </div>
        )}
        <div className="cube-actions">
          <Button variant="default" onClick={handleTake}>
            {t('btn.take')}
          </Button>
          <Button variant="default" onClick={handleDrop}>
            {t('btn.drop')}
          </Button>
        </div>
      </div>
    )
  } else if (cubeWaiting) {
    centerMain = (
      <div className="result-box">
        <div className="result-title">
          {t('msg.doubled', { name: pName(cubePending!), value: match.cube.value * 2 })}
        </div>
        <div className="err-detail">{t('cube.waiting')}</div>
      </div>
    )
  } else if (noMove) {
    centerMain = (
      <div className="result-box no-moves">
        <div className="board-dice nm-dice">
          {diceFaces.map((f, i) => (
            <Die key={i} value={f.value} owner={turnStart.turn} used={f.used} />
          ))}
        </div>
        <div className="result-title">{t('overlay.noMoves')}</div>
        <div className="err-detail">{t('overlay.noMovesSub')}</div>
      </div>
    )
  }

  // Ana slot (sirasi gelenin): Onayla / Roll / zarlar
  const primary = centerMain ? null : turnComplete ? (
    <Button variant="default" onClick={handleConfirm}>
      {t('btn.confirm')}
    </Button>
  ) : showRoll ? (
    <Button variant="default" onClick={doRoll}>
      {t('btn.roll')}
    </Button>
  ) : diceRolled && diceFaces.length > 0 ? (
    <DiceRow
      faces={diceFaces}
      owner={turnStart.turn}
      swappable={canSwapDice}
      onSwap={handleSwapDice}
    />
  ) : null

  // Yan slot: Double / Geri
  const secondary =
    centerMain || !interactive
      ? null
      : humanCanDouble
        ? (
            <div className="cube-offer">
              {cubeHint?.kind === 'offer' && (
                <div
                  className={`cube-advice ${
                    cubeHint.action === 'no-double' ? 'muted' : 'ok'
                  }`}
                >
                  <Icon name="bulb" size={14} />
                  {t(`cube.adv.${cubeHint.action}`)} · {t('cube.win')}{' '}
                  {cubeHint.winPct.toFixed(0)}%
                </div>
              )}
              <Button variant="default" onClick={() => handleDouble(turnStart.turn)}>
                {t('btn.double')}
              </Button>
            </div>
          )
        : diceRolled && played.length > 0
          ? (
              <Button variant="default" onClick={handleUndo}>
                {t('btn.undo')}
              </Button>
            )
          : null

  // Sirasi gelenin ana butonu (Onayla/Zar) kendi ev tarafinda durur.
  // Normal tahtada beyaz sagda; cevrili tahtada (siyah bakisi) siyah sagda.
  const mySideRight = flipBoard ? turnStart.turn === 'black' : turnStart.turn === 'white'
  const centerRight = mySideRight ? primary : secondary
  const centerLeft = mySideRight ? secondary : primary

  const myName = profile?.nickname ?? t('player.you')
  const blackName = online
    ? myColor === 'black'
      ? myName
      : (room?.oppName ?? '…')
    : mode === 'pvb'
      ? t('player.bot')
      : t('player.black')
  const whiteName = online
    ? myColor === 'white'
      ? myName
      : (room?.oppName ?? '…')
    : mode === 'pvb'
      ? myName
      : t('player.white')
  const topInfo = {
    name: blackName,
    avatar: '🐱',
    sub: online
      ? myColor === 'black'
        ? t('player.you')
        : t('mp.title')
      : mode === 'pvb'
        ? `${AI_LEVELS[difficulty - 1]} (${difficulty})`
        : t('player.p2'),
    off: working.off.black,
    active: turnStart.turn === 'black' && !gameWon && !gameEnd,
    color: 'black' as const,
    score: match.score.black,
    target: match.target,
    rating: online ? (myColor === 'black' ? (user?.rating ?? null) : room?.oppRating ?? null) : null,
    avatarUrl: online ? (myColor === 'black' ? profile.avatar : (room?.oppAvatar ?? null)) : null,
    frame: online ? (myColor === 'black' ? (user?.avatar_frame ?? null) : (room?.oppFrame ?? null)) : null,
  }
  const bottomInfo = {
    name: whiteName,
    avatar: '🧑‍🚀',
    sub: online
      ? myColor === 'white'
        ? t('player.you')
        : t('mp.title')
      : mode === 'pvb'
        ? t('player.human')
        : t('player.p1'),
    off: working.off.white,
    active: turnStart.turn === 'white' && !gameWon && !gameEnd,
    color: 'white' as const,
    score: match.score.white,
    target: match.target,
    rating: online ? (myColor === 'white' ? (user?.rating ?? null) : room?.oppRating ?? null) : null,
    avatarUrl: online ? (myColor === 'white' ? profile.avatar : (room?.oppAvatar ?? null)) : profile.avatar,
    frame: online ? (myColor === 'white' ? (user?.avatar_frame ?? null) : (room?.oppFrame ?? null)) : (user?.avatar_frame ?? null),
  }

  // Sifre sifirlama ekrani (e-postadaki linkten gelince)
  if (resetInfo) {
    return (
      <ResetPassword
        email={resetInfo.email}
        token={resetInfo.token}
        onDone={() => {
          setResetInfo(null)
          try {
            window.history.replaceState(null, '', '/')
          } catch {
            /* yok */
          }
        }}
      />
    )
  }

  // Auth kontrolu bitene kadar bekle
  if (!authChecked) {
    return (
      <div className="register-overlay">
        <div className="register-card">{t('an.loading')}</div>
      </div>
    )
  }

  // Ortak Auth handler'lari (giris/kayit modali + profil duzenleme sayfasi paylasir)
  const authProps = {
    onAuthed: (u: ServerUser, isNew?: boolean) => {
      const wasEditing = editProfile
      // Misafirken bitmis bir mac state'te duruyorsa, giris/kayit sonrasi puan
      // raporu efekti (user null->dolu) geriye donuk tetiklenip bu maci YENI
      // hesaba yazmasin. loadServerGame async oldugundan mac hemen sifirlanmaz;
      // bayragi setUser'dan ONCE kapatiyoruz (applySavedGame sonra dogru ayarlar).
      if (matchWinner(match)) ratingReportedRef.current = true
      setUser(u)
      setGuestProfile(null)
      setShowAuth(false)
      // Yeni Google kullanicisi: takma ismini kendi secsin (profil ekrani acilir)
      if (isNew) {
        setEditProfile(true)
        return
      }
      // Profil duzenlemeden kaydedince ANA SAYFAYA DONME: sayfada kal (Auth "Kaydedildi"
      // gosterir). Sadece giris/kayit akisinda (wasEditing=false) kapat + oyunu yukle.
      if (!wasEditing) {
        setEditProfile(false)
        loadServerGame()
          .then((g) => {
            if (g) applySavedGame(g as SavedGame)
          })
          .catch(() => {})
      }
    },
    onGuest: (p: Profile) => {
      saveProfile(p)
      setGuestProfile(p)
      setUser(null)
      setEditProfile(false)
      setShowAuth(false)
    },
    onCancel: () => {
      setEditProfile(false)
      setShowAuth(false)
    },
    onDeleteAccount: () => {
      apiDeleteAccount().finally(() => {
        setUser(null)
        setGuestProfile(null)
        setEditProfile(false)
        setShowAuth(false)
        setHome(true)
      })
    },
  }
  // Uyelik karti (ProfileOverview, baslik alti): "Uyeligi Yenile" -> odeme modali;
  // "Yenilemeyi iptal/ac" -> auto_renew degistir + kullaniciyi tazele.
  const handleRenew = () => setMemOpen(true)
  const handleToggleAutoRenew = async (enabled: boolean) => {
    try {
      const r = await apiSetAutoRenew(enabled)
      setUser(r.user)
    } catch {
      /* sessiz: profil kartinda kritik degil */
    }
  }
  // Giris/kayit: SAYFA gorunumu (modal degil) — sol menu gorunur kalir, form
  // menunun sagindaki alanda ortalanmis kart olarak acilir. Cikis: Vazgec / Misafir.
  const authModal = showAuth ? <Auth key="auth" page {...authProps} /> : null
  // Ucretli plan aktif mi (premium ozellik kilidi)
  const premium = user?.plan_active === 'star' || user?.plan_active === 'starpro'

  // Tahta tema listesi: nadirlik bazli COIN fiyati + sahiplik (unlocks). Ucretsiz: standart/tavla/galaxy + kulup.
  const boardUnlocks = user?.unlocks ?? []
  const boardOwned = (id: string) => FREE_BOARDS.has(id) || boardUnlocks.includes('theme.' + id)
  const boardThemeList = [
    ...[...BOARD_THEMES, ...PREMIUM_THEMES, ...RARITY_THEMES, ...GALAXY_EXTRA_THEMES].map((tt) => ({
      ...tt,
      rarity: boardRarityOf(tt),
      price: boardPrice(tt),
      owned: boardOwned(tt.id),
    })),
    ...CLUB_THEMES.map((tt) => ({
      ...tt,
      rarity: 'club' as const,
      price: boardPrice(tt),
      owned: boardOwned(tt.id),
    })),
  ]

  // Profilim "Istatistiklerim" sekmesine gomulu detayli istatistik sayfasi
  // Sahip olunan tahtalar (kilitli olmayanlar) + cerceveler (unlocks) — Profil genel bakisi
  const ownedBoards = boardThemeList.filter((b) => b.owned)
  const ownedFrames = AVATAR_FRAMES.filter((f) => (user?.unlocks ?? []).includes('frame.' + f.id))

  // Bildirim sil (Profilim > Bildirimler): tek (id) veya toplu (id yok). Optimistik.
  function handleDeleteNotification(id: number) {
    setNotifications((ns) => ns.filter((n) => n.id !== id))
    deleteNotifications([id]).catch(() => {})
  }
  function handleDeleteAllNotifications() {
    setNotifications([])
    setUnreadNotif(0)
    deleteNotifications().catch(() => {})
  }

  // Profil sayfasi: girisliyse once GENEL BAKIS; "Profili Duzenle" -> form. Misafir -> direkt form.
  const editProfilePage = editProfile ? (
    user && !profileEditMode ? (
      <ProfileOverview
        user={user}
        avatar={profile.avatar ?? null}
        boardTheme={boardTheme}
        ownedBoards={ownedBoards}
        ownedFrames={ownedFrames}
        onEdit={() => setProfileEditMode(true)}
        onLogout={handleLogout}
        onSelectBoard={setBoardTheme}
        onSelectFrame={handleEquipFrame}
        onClose={() => setEditProfile(false)}
        onRenew={handleRenew}
        onToggleAutoRenew={handleToggleAutoRenew}
        notifications={notifications}
        onDeleteNotification={handleDeleteNotification}
        onDeleteAllNotifications={handleDeleteAllNotifications}
      />
    ) : (
      <Auth
        key={user ? `edit-${user.id}` : 'edit-guest'}
        page
        editUser={user}
        editGuest={!user ? guestProfile : null}
        emailUnverified={!!user && !user.email_verified_at}
        resendState={resendState}
        onResendVerification={handleResendVerification}
        {...authProps}
        onCancel={() => (user ? setProfileEditMode(false) : setEditProfile(false))}
      />
    )
  ) : null

  // Sag ust hesap bari (lobi + oyun ekraninda ortak)
  // Oyun ekraninda mi (cekilme butonu bunun icin)
  const accountBar = (
    <div className="account-bar">
      {/* Sol: TavlaTV logosu (ana sayfaya doner). Sag: hesap kontrolleri. */}
      <button
        type="button"
        className="ab-brand"
        onClick={() => menuProps.onHome()}
        title={t('home.title')}
        aria-label={t('brand.name')}
      >
        {/* Genis ekranda wordmark; mobilde kompakt sembol (yer acar) */}
        <span className="ab-logo-full">
          <TavlaTvLogo size={38} />
        </span>
        <span className="ab-logo-mark">
          <TavlaTvMark size={40} />
        </span>
      </button>
      {/* Birlesik hesap kimlik pili: avatar+isim + coin + rating tek buyuk pill icinde */}
      <div className="account-id">
      <button
        type="button"
        className="account-name"
        onClick={() =>
          goPage(() => {
            setProfileEditMode(false)
            setEditProfile(true)
          })
        }
        title={t('menu.editProfile')}
      >
        <AvatarFrame
          src={profile.avatar}
          frame={user?.avatar_frame}
          size={28}
          name={profile.nickname}
          className="account-avf"
        />
        {profile.nickname}
      </button>
      {user && (
        <button
          type="button"
          className="stat-chip stat-chip-coin"
          onClick={() => goPage(() => setShopOpen(true))}
          title={t('shop.title')}
        >
          <span className="stat-chip-ic"><Icon name="coin" size={18} /></span>
          <span className="stat-chip-body">
            <span className="stat-chip-val">{(user.coins ?? 0).toLocaleString('tr-TR')}</span>
            <span className="stat-chip-bar" aria-hidden="true">
              <i style={{ width: `${((user.coins ?? 0) % 1000) / 10}%` }} />
            </span>
          </span>
        </button>
      )}
      {user?.rating != null && (
        <span className="stat-chip stat-chip-rating">
          <span className="stat-chip-ic"><Icon name="star" size={18} /></span>
          <span className="stat-chip-body">
            <span className="stat-chip-val">{user.rating.toLocaleString('tr-TR')}</span>
            <span className="stat-chip-bar" aria-hidden="true">
              <i style={{ width: `${user.rating % 100}%` }} />
            </span>
          </span>
        </span>
      )}
      </div>
      {/* Ödül bildirimin (bell) SOLUNDA */}
      {user &&
        (rewardReady ? (
          <Button
            variant="outline"
            className="btn-reward"
            onClick={handleCoinClick}
            title={t('reward.claim')}
          >
            <Icon name="gift" size={15} /> 500
          </Button>
        ) : (
          <span className="reward-count" title={t('reward.in')}>
            <Icon name="gift" size={14} /> {fmtCountdown(rewardSecs)}
          </span>
        ))}
      {user && (
        <NotificationBell
          items={notifications}
          unread={unreadNotif}
          onOpen={() => {
            // Okundu = SADECE okundu isaretle (silme YOK). Rozet 0'a duser; bildirimler
            // kalir -> kullanici Profilim > Bildirimler sekmesinde gorup silebilir.
            setUnreadNotif(0)
            setNotifications((ns) => ns.map((n) => ({ ...n, read: true })))
            markNotificationsRead().catch(() => {})
          }}
        />
      )}
      {user && (
        <Button variant="outline" onClick={() => goPage(() => setShopOpen(true))}>
          <Icon name="shop" size={15} /> {t('shop.title')}
        </Button>
      )}
      {!user && (
        <Button variant="default" onClick={() => setShowAuth(true)}>
          {t('account.auth')}
        </Button>
      )}
      <span className="account-sep" />
      <Button
        variant="ghost"
        size="icon"
        className="[&_svg]:size-[24px]!"
        title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
        aria-label={t('menu.theme')}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <Icon name="sun" size={24} /> : <Icon name="moon" size={24} />}
      </Button>
      <LangMenu />
    </div>
  )

  // Mobil hamburger + arka perde (drawer menu)
  const mobileNav = (
    <>
      <button
        className="hamburger"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={t('common.menu')}
      >
        <Icon name="menu" size={24} />
      </button>
      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}
    </>
  )

  // Yarim kalan (bitmemis) mac var mi -> menude "Aktif Oyunlar"
  const hasActiveGame = !matchOver && (turnsPlayed > 0 || !!gameEnd)

  // Menuden acilan TUM sayfa overlaylerini kapat (setup HARIC). Ayni anda page-host
  // icinde birden fazla '.page' acik kalirsa yigilirlar (bkz Magaza+Ayarlar bug'i).
  function closeMenuPages() {
    // Tam-ekran overlay'ler: menu/logo navigasyonu bunlari da KAPATMALI yoksa ustte
    // kalip sayfayi kilitler (auth/uyelik). Bkz [[menu-sayfa-kayit]].
    setShowAuth(false)
    setMemOpen(false)
    setLeaderboardOpen(false)
    setRanksOpen(false)
    setInfoOpen(false)
    setTournOpen(false)
    setTournDetailId(null)
    setShopOpen(false)
    setFrameGalleryOpen(false)
    setStatsOpen(false)
    setFriendsOpen(false)
    setBlunderOpen(false)
    setMatchHistOpen(false)
    setFrameAnimOpen(false)
    setGamePreviewOpen(false)
    setFairOpen(false)
    setLessonsOpen(false)
    setSoloOpen(false)
    setContentView(null)
    setNewsSlug(null)
    setQuizOpen(false)
    setClubsOpen(false)
    setRulesOpen(false)
    setAnalyzerOpen(false)
    setEditProfile(false)
  }
  // Menuden acilan tum sayfalari kapat (ayni anda tek sayfa acik kalir) + kurulum ekrani
  function closeAllPages() {
    closeMenuPages()
    setSetup(null)
  }
  const goPage = (open: () => void) => {
    // Aktif oyundayken menu sayfalari (Magaza, Turnuvalar, Liderlik, Cerceve Galerisi
    // vb.) ACILMAZ; oyunu bolmesin. Oyun menusunun Ana Menu/Pes Et'i goPage kullanmaz.
    if (!home && !setup && hasActiveGame) return
    closeAllPages()
    open()
  }

  // Ortak menu callback'leri (ana sayfa + oyun ekrani ayni menu)
  const menuProps = {
    loggedIn: !!user,
    hasActiveGame,
    onNewGame: () => {
      closeAllPages()
      setSetup('online')
    }, // Mac Oyunu her zaman online (gercek rakip)
    onSolo: () => goPage(() => setSoloOpen(true)),
    onAiGame: () => {
      closeAllPages()
      setSetup('pvb')
    }, // Yapay zekaya karsi oyna (bot)
    onResume: () => {
      closeAllPages() // acik menu sayfasi (turnuvalar vb.) kalmasin, oyuna don
      setHome(false)
    },
    onHome: () => {
      closeAllPages()
      if (online) handleLeaveRoom()
      else setHome(true)
    },
    onLeaderboard: () => goPage(() => setLeaderboardOpen(true)),
    onRanks: () => goPage(() => setRanksOpen(true)),
    onInfo: () => goPage(() => setInfoOpen(true)),
    onTournaments: () =>
      goPage(() => {
        setTournDetailId(null) // menuden liste (varsa eski detay kapansin)
        setTournOpen(true)
      }),
    // Ana sayfa reklamindan: dogrudan ilgili turnuvanin detayini ac
    onTournamentAd: (id: number) =>
      goPage(() => {
        setTournDetailId(id)
        setTournOpen(true)
      }),
    onShop: () => goPage(() => setShopOpen(true)),
    // Zaten premium isem menude "Uyelik" gosterme (undefined -> SideMenu gizler);
    // uyelik bilgisi profil sayfasinda gosterilir. Free/misafir icin upsell ekrani acilir.
    onMembership: premium ? undefined : () => setMemOpen(true),
    onMyStats: () =>
      user
        ? goPage(() => {
            setProfileEditMode(false) // profil ANA sayfasi (İstatistikler varsayilan)
            setEditProfile(true)
          })
        : setShowAuth(true),
    onFriends: () => goPage(() => setFriendsOpen(true)),
    onAnalyzer: () => goPage(() => setAnalyzerOpen(true)),
    // Premium arac: uye/premium OLMAYAN da menude GORUR; tiklayinca uyelik ekrani acilir
    onBlunders: () => (premium ? goPage(() => setBlunderOpen(true)) : setMemOpen(true)),
    onMatchHistory: () => (user ? goPage(() => setMatchHistOpen(true)) : setShowAuth(true)),
    onLessons: () => goPage(() => setLessonsOpen(true)),
    onFairness: () => goPage(() => setFairOpen(true)),
    onCalendar: () => goPage(() => setContentView('event')),
    onClubs: () => goPage(() => setContentView('club')), // Tavla Kulupleri = il bazinda rehber (seeder)

    onServices: () => goPage(() => setContentView('service')),
    onBlog: () => goPage(() => setContentView('blog')),
    onNews: () => goPage(() => setContentView('news')),
    onMagazine: () => goPage(() => setContentView('magazine')),
    onQuiz: () => goPage(() => setQuizOpen(true)),
  }

  // Gelen oyun davetleri + sirasi gelen turnuva maclari (sabit, ust uste)
  const showTournNotices = home && tournNotices.length > 0
  const inviteBanner = (invites.length > 0 || showTournNotices) && (
    <div className="invite-stack">
      {invites.map((inv) => (
        <div key={inv.id} className="invite-card">
          <span className="invite-text">
            <Icon name="play" size={16} /> <b>{inv.from}</b> {t('friends.invitedYou')}
          </span>
          <Button variant="default" aria-label={t('friends.accept')} onClick={() => handleAcceptInvite(inv)}>
            {t('friends.accept')}
          </Button>
          <Button variant="destructive" aria-label={t('friends.decline')} onClick={() => handleDeclineInvite(inv)}>
            {t('friends.decline')}
          </Button>
        </div>
      ))}
      {showTournNotices &&
        tournNotices.map((tn) => (
          <div key={`${tn.tid}-${tn.match}`} className="invite-card tourn-notice">
            <span className="invite-text">
              <Icon name="medal" size={16} /> <b>{tn.tname}</b>:{' '}
              {t('tourn.yourMatch', { name: tn.oppName })}
            </span>
            <Button
              variant="default"
              onClick={() => handlePlayTournamentMatch(tn.tid, { key: tn.match }, tn.oppId)}
            >
              {t('tourn.play')}
            </Button>
          </div>
        ))}
    </div>
  )

  // Menuden acilan tum modaller (her iki ekranda ortak)
  // Menuden acilan sayfa acik mi (ana sayfada icerik alanina AKIS ICINDE gomulur)
  const anyPageOpen =
    leaderboardOpen ||
    ranksOpen ||
    infoOpen ||
    tournOpen ||
    shopOpen ||
    frameGalleryOpen ||
    statsOpen ||
    friendsOpen ||
    blunderOpen ||
    matchHistOpen ||
    frameAnimOpen ||
    gamePreviewOpen ||
    fairOpen ||
    lessonsOpen ||
    soloOpen ||
    !!contentView ||
    quizOpen ||
    clubsOpen ||
    rulesOpen ||
    analyzerOpen ||
    editProfile

  // Sidebar aktif-sayfa gostergesi: acik olan sayfanin menu anahtari (navy highlight)
  const activeKey = infoOpen
    ? 'info'
    : ranksOpen
    ? 'ranks'
    : leaderboardOpen
    ? 'leaderboard'
    : tournOpen
      ? 'tournaments'
      : shopOpen
        ? 'shop'
        : statsOpen
          ? 'stats'
          : friendsOpen
            ? 'friends'
            : blunderOpen
              ? 'blunders'
              : matchHistOpen
                ? 'matchHistory'
                : fairOpen
                  ? 'fairness'
                  : soloOpen
                    ? 'solo'
                    : analyzerOpen
                      ? 'analyzer'
                      : clubsOpen
                        ? 'clubs'
                        : lessonsOpen
                          ? 'lessons'
                          : memOpen
                            ? 'membership'
                            : contentView === 'event'
                              ? 'calendar'
                              : contentView === 'club'
                                ? 'clubs'
                                : contentView === 'service'
                                  ? 'services'
                                  : contentView === 'news'
                                    ? 'news'
                                    : contentView === 'magazine'
                                      ? 'magazine'
                                      : setup === 'online'
                                        ? 'match'
                                        : setup === 'pvb'
                                          ? 'aiGame'
                                          : ''

  // Sayfa-tipi menu icerikleri (ana sayfada in-flow, oyun icinde overlay)
  const menuPages = (
    <>
      {editProfilePage}
      {friendsOpen && user && (
        <Friends onInvite={handleInviteFriend} onClose={() => setFriendsOpen(false)} />
      )}
      {leaderboardOpen && (
        <Leaderboard currentName={profile.nickname} onClose={() => setLeaderboardOpen(false)} />
      )}
      {infoOpen && (
        <Info
          onClose={() => setInfoOpen(false)}
          currentRating={user?.rating ?? undefined}
          fair={{
            commitment: fairRef.current.commitment,
            clientSeed: fairRef.current.clientSeed,
            serverSeed: matchWinner(match) ? fairRef.current.serverSeed : undefined,
            rolls: fairRef.current.nonce,
          }}
        />
      )}
      {ranksOpen && (
        <RankInfo currentRating={user?.rating ?? undefined} onClose={() => setRanksOpen(false)} />
      )}
      {/* Istatistiklerim ayri sayfa DEGIL -> Profilim "Istatistiklerim" sekmesine gomulu */}
      {fairOpen && (
        <FairnessModal
          commitment={fairRef.current.commitment}
          clientSeed={fairRef.current.clientSeed}
          serverSeed={matchWinner(match) ? fairRef.current.serverSeed : undefined}
          rolls={fairRef.current.nonce}
          onClose={() => setFairOpen(false)}
        />
      )}
      {lessonsOpen && <Lessons onClose={() => setLessonsOpen(false)} />}
      {shopOpen && user && (
        <Shop
          coins={user.coins ?? 0}
          rewardReady={rewardReady}
          rewardSecs={rewardSecs}
          onDaily={handleDaily}
          onBuyCoins={(pkgId) => {
            const pkg = COIN_PACKAGES.find((p) => p.id === pkgId)
            // TODO: gercek odeme akisi (Garanti) coin paketi icin baglanacak
            notify.show(t('shop.coinSoon', { pkg: pkg?.name ?? '' }), 'info')
          }}
          onMembership={() => {
            setShopOpen(false)
            setMemOpen(true)
          }}
          initialTab={shopTab}
          boardTheme={boardTheme}
          setBoardTheme={setBoardTheme}
          boardThemes={boardThemeList}
          onBuyItem={handleBuy}
          framesSlot={
            <FrameShop
              coins={user.coins ?? 0}
              unlocks={user.unlocks ?? []}
              currentFrame={user.avatar_frame ?? null}
              avatar={profile.avatar ?? null}
              name={profile.nickname}
              onBuy={handleBuy}
              onEquip={handleEquipFrame}
            />
          }
          onClose={() => {
            setShopOpen(false)
            setShopTab('coins') // sonraki normal acilis coin sekmesinden baslasin
          }}
        />
      )}
      {frameGalleryOpen && (
        <FrameGallery
          avatar={profile.avatar ?? null}
          name={profile.nickname}
          onClose={() => setFrameGalleryOpen(false)}
        />
      )}
      {tournOpen && (
        <Tournaments
          myId={user?.id ?? null}
          onPlayMatch={handlePlayTournamentMatch}
          detailId={tournDetailId}
          onOpenDetail={setTournDetailId}
          onClose={() => {
            setTournOpen(false)
            setTournDetailId(null)
          }}
        />
      )}
      {soloOpen && (
        <SoloStakes
          coins={user?.coins ?? 0}
          board={(() => {
            const bt = ALL_THEMES.find((x) => x.id === boardTheme) ?? BOARD_THEMES[0]
            return { panel: bt.panel ?? bt.b, a: bt.a, b: bt.b, checker: bt.checker }
          })()}
          onChangeBoard={() => setBoardPickerOpen(true)}
          onPick={startSoloStake}
          onClose={() => setSoloOpen(false)}
        />
      )}
      {blunderOpen && user && premium && <ErrorJournal onClose={() => setBlunderOpen(false)} />}
      {matchHistOpen && user && (
        <MatchAnalytics
          myName={profile.nickname}
          myAvatar={profile.avatar ?? null}
          onClose={() => setMatchHistOpen(false)}
        />
      )}
      {frameAnimOpen && (
        <Suspense fallback={null}>
          <CerceveAnim onClose={() => setFrameAnimOpen(false)} />
        </Suspense>
      )}
      {gamePreviewOpen && <GamePreview onClose={() => setGamePreviewOpen(false)} />}
      {contentView && (
        <ContentView
          type={contentView}
          onClose={() => setContentView(null)}
          slug={newsSlug}
          onOpenDetail={(s) => setNewsSlug(s)}
          onCloseDetail={() => setNewsSlug(null)}
        />
      )}
      {quizOpen && <QuizPlay onClose={() => setQuizOpen(false)} />}
      {clubsOpen && user && <Clubs onClose={() => setClubsOpen(false)} />}
      {rulesOpen && <Rules onClose={() => setRulesOpen(false)} />}
      {analyzerOpen && (
        <div className="register-overlay modal page" role="dialog" aria-modal="true">
          <PositionAnalyzer
            neuralEval={(s, p, deep) =>
              deep ? neuralRef.current.eval2ply(s, p) : neuralRef.current.evalPosition(s, p)
            }
            neuralAnalyze={(s, deep) =>
              deep ? neuralRef.current.analyzeMoves2ply(s) : neuralRef.current.analyzeMoves(s)
            }
            premium={premium}
            onUpgrade={() => {
              setAnalyzerOpen(false)
              setMemOpen(true)
            }}
            onClose={() => setAnalyzerOpen(false)}
          />
        </div>
      )}
    </>
  )

  // Ortalanmis modallar / yuzen katmanlar (her zaman overlay).
  // Bildirimler (ag hatasi + e-posta dogrulama sonucu) artik birlesik toast
  // sisteminden (ToastProvider portal'i) cikar; burada ayrica render edilmez.
  const menuOverlays = (
    <>
      {inviteBanner}
      {boardPickerOpen && (
        <BoardPickerModal
          current={boardTheme}
          boards={ownedBoards}
          onSelect={setBoardTheme}
          onMore={() => {
            setBoardPickerOpen(false)
            // Tum tahtalar + satin alma artik Magaza'nin Tahta Rengi sekmesinde
            if (user) {
              setShopTab('board')
              setShopOpen(true)
            } else {
              setShowAuth(true)
            }
          }}
          onClose={() => setBoardPickerOpen(false)}
        />
      )}
      {spectate && (
        <Spectate
          code={spectate.code}
          p1={spectate.p1}
          p2={spectate.p2}
          onClose={() => setSpectate(null)}
        />
      )}
      {homeProfileId !== null && (
        <PublicProfile id={homeProfileId} onClose={() => setHomeProfileId(null)} />
      )}
      {memOpen && user && (
        <Membership
          current={(user.plan_active ?? 'free') as PlanId}
          trialUsed={!!user.trial_used}
          onUpgraded={(u) => setUser(u)}
          onClose={() => setMemOpen(false)}
        />
      )}
    </>
  )

  // Mac kurulum ekrani (mod + zorluk + sure + puan + pip + analiz).
  // Diger menu sayfalari gibi: sol menu gorunur kalir, kurulum icerik alaninda acilir.
  if (setup) {
    return (
      <>
        {mobileNav}
        <div className="app lobby">
          {accountBar}
          <SideMenu
            inGame={false}
            {...menuProps}
            active={activeKey}
            mobileOpen={menuOpen}
            onCloseMobile={() => setMenuOpen(false)}
          />
          <main className="main lobby-main has-page">
            <div className="page-host">
              <MatchSetup
                mode={setup}
                targets={TARGETS}
                coins={user?.coins ?? 0}
                initial={{ target: match.target, showPip, showAnalysis, timeControl, difficulty, ranked: rankedMatch }}
                board={(() => {
                  const bt = ALL_THEMES.find((x) => x.id === boardTheme) ?? BOARD_THEMES[0]
                  return { panel: bt.panel ?? bt.b, a: bt.a, b: bt.b, checker: bt.checker }
                })()}
                onChangeBoard={() => setBoardPickerOpen(true)}
                onConfirm={applyMatchSetup}
                onCancel={() => {
                  setSetup(null)
                  if (mode === 'online' && !room) setHome(true)
                }}
              />
            </div>
          </main>
        </div>
        {/* Kurulumda "Tahtayi Degistir" -> BoardPickerModal (menuOverlays); "Daha fazla" Magaza'yi acar */}
        {menuPages}
        {authModal}
        {menuOverlays}
      </>
    )
  }

  // Pozisyon analiz modulu (tam ekran)
  // Lobi (ana menu): solda Yeni Oyun, ortasi bos. Akis burdan baslar.
  if (home) {
    return (
      <>
        {mobileNav}
        {ptrDist > 0 && (
          <div
            className="ptr"
            style={{
              transform: `translateX(-50%) translateY(${ptrDist}px)`,
              opacity: Math.min(ptrDist / 66, 1),
            }}
          >
            <div
              className={`ptr-circle ${ptrDist >= 66 ? 'ready' : ''}`}
              style={{ transform: `rotate(${Math.round(ptrDist * 3)}deg)` }}
            >
              ↻
            </div>
          </div>
        )}
        <div className="app lobby">
          {accountBar}
          <SideMenu
            inGame={false}
            {...menuProps}
            active={activeKey}
            mobileOpen={menuOpen}
            onCloseMobile={() => setMenuOpen(false)}
          />
          <main className={`main lobby-main ${anyPageOpen ? 'has-page' : ''}`}>
            {anyPageOpen ? (
              <div className="page-host">{menuPages}</div>
            ) : (
            <>
            <BannerSlider onOpen={menuProps.onTournamentAd} />
            {activeRooms.length > 0 && (
              <div className="resume-match-bar">
                {activeRooms.map((r) => (
                  <button key={r.code} className="resume-match-btn" onClick={() => rejoinRoom(r)}>
                    <span className="rm-live"><span className="live-dot" /> {t('resume.active')}</span>
                    <span className="rm-opp">
                      vs {r.opp_name || t('mp.title')}
                      {r.score && (
                        <b className="rm-score">
                          {' '}{r.score.white}–{r.score.black}
                        </b>
                      )}
                    </span>
                    <span className="rm-cta"><Icon name="play" size={14} /> {t('resume.return')}</span>
                  </button>
                ))}
              </div>
            )}
            <section className="lobby-hero">
              <div className="hero-copy">
                {!user && (
                  <span className="hero-kicker">
                    <Icon name="dice" size={15} /> {t('home.heroKicker')}
                  </span>
                )}
                {!user && <h1 className="hero-title">{t('home.heroTitle')}</h1>}
                <div className="mode-grid">
                  <button type="button" className="mode-card" onClick={menuProps.onSolo}>
                    <span className="mode-card-ic"><Icon name="coins" size={26} /></span>
                    <span className="mode-card-title">{t('menu.solo')}</span>
                    <span className="mode-card-desc">{t('home.soloNote')}</span>
                    <span className="mode-card-cta">
                      {t('home.startCta')} <Icon name="arrow-right" size={15} />
                    </span>
                  </button>
                  <button type="button" className="mode-card" onClick={menuProps.onNewGame}>
                    <span className="mode-card-ic"><Icon name="ranking" size={26} /></span>
                    <span className="mode-card-title">{t('menu.match')}</span>
                    <span className="mode-card-desc">{t('home.matchNote')}</span>
                    <span className="mode-card-cta">
                      {t('home.startCta')} <Icon name="arrow-right" size={15} />
                    </span>
                  </button>
                  <button type="button" className="mode-card" onClick={menuProps.onAiGame}>
                    <span className="mode-card-ic"><Icon name="robot" size={26} /></span>
                    <span className="mode-card-title">{t('menu.aiGame')}</span>
                    <span className="mode-card-desc">{t('home.aiNote')}</span>
                    <span className="mode-card-cta">
                      {t('home.startCta')} <Icon name="arrow-right" size={15} />
                    </span>
                  </button>
                </div>
              </div>
            </section>
            {user && (
              <HomeDashboard
                rating={user.rating ?? 0}
                coins={user.coins ?? 0}
                wins={user.wins ?? 0}
                games={user.games_played ?? 0}
                showStats={false}
                daily={{
                  ready: rewardReady,
                  countdown: fmtCountdown(rewardSecs),
                  onClaim: handleDaily,
                }}
              />
            )}
            {hasActiveGame && (
              <div className="lobby-welcome">
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => setHome(false)}
                >
                  <Icon name="live" /> {t('menu.resumeGame')}
                </Button>
              </div>
            )}
            <div className="home-panels">
              <TournamentsPanel tourns={lobbyTourns} onOpen={menuProps.onTournaments} />
              <LiveMatchesPanel
                onSpectate={(code, p1, p2) => setSpectate({ code, p1, p2 })}
              />
              <RankingPanel
                currentName={profile.nickname}
                onProfile={(id) => setHomeProfileId(id)}
                onOpen={menuProps.onLeaderboard}
              />
            </div>
            {!user && <HomeFeatures onPlay={menuProps.onAiGame} />}
            </>
            )}
          </main>
        </div>
        {authModal}
        {menuOverlays}
      </>
    )
  }

  // Online mod: oyun baslamadiysa lobi (oda olustur/katil/bekle).
  // ÖNEMLİ: Maç BİTTİYSE (matchOver) lobiye DÜŞME — oda 'finished' olsa bile oyun
  // görünümünü koru ki MatchResult (sonuç + Analiz + Rövanş) gösterilebilsin. Aksi
  // halde maç biter bitmez oyuncular arama/lobi sayfasına atılır (kritik bug).
  if (mode === 'online' && !matchOver && (!room || room.status !== 'playing')) {
    return (
      <>
        {accountBar}
        <Lobby
          room={room}
          busy={roomBusy}
          error={roomError}
          myAvatar={profile.avatar}
          onCreate={() => handleCreateRoom(onlineTargetRef.current)}
          onJoin={handleJoinRoom}
          onMatchmake={handleMatchmake}
          onCancelMatch={handleCancelMatch}
          onLeave={handleLeaveRoom}
        />
      </>
    )
  }

  const showHintUI =
    mode === 'pvb' && interactive && diceRolled && !gameWon && remainingDice.length > 0

  const activeBank = turnStart.turn === 'white' ? clock.white : clock.black
  const inFinalCountdown =
    clockOn &&
    !gameEnd &&
    !matchOver &&
    !opening &&
    clock.delay === 0 &&
    activeBank <= FINAL_STAGE &&
    activeBank > 0

  return (
    <div className="app game-view">
      {accountBar}
      {/* Menu sayfasi (turnuvalar vb.) acikken oyunun geri sayim overlay'i arkadan sizmasin */}
      {inFinalCountdown && !anyPageOpen && (
        <div className="final-countdown" aria-live="assertive">
          <div className="fc-num">{activeBank}</div>
          <div className="fc-label">{t('clock.finalWarn')}</div>
        </div>
      )}
      {portraitMobile && (
        <div className="rotate-hint">
          <div className="rotate-icon">📱↻</div>
          <div className="rotate-text">{t('mobile.rotate')}</div>
        </div>
      )}
      <button
        className="fs-toggle"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? t('menu.fsExit') : t('menu.fsEnter')}
        title={isFullscreen ? t('menu.fsExit') : t('menu.fsEnter')}
      >
        <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={16} />
      </button>
      {showHintUI && (learnMode || hintShown) && curBest && (
        <div className={`hint-box ${learnMode ? 'learn' : ''}`}>
          <div className="hint-head">
            <span className="hint-title">
              {learnMode ? <Icon name="graduation" size={16} /> : <Icon name="bulb" size={16} />}{' '}
              {learnMode ? t('hint.learnTitle') : t('hint.title')}
            </span>
            {!learnMode && (
              <Button variant="ghost" size="icon" onClick={() => setHintShown(false)} aria-label={t('common.close')}>
                <Icon name="x" size={14} />
              </Button>
            )}
          </div>
          <div className="hint-move">{curBest.notation}</div>
          <ul className="hint-reasons">
            {curBest.reasons.map((r, i) => (
              <li key={i}>{t(r.key, r.params)}</li>
            ))}
          </ul>
        </div>
      )}
      {showHintUI && !learnMode && !hintShown && (
        <Button variant="default" className="fixed left-4 bottom-4 z-[55]" aria-label={t('hint.button')} onClick={() => setHintShown(true)}>
          <Icon name="bulb" size={16} /> {t('hint.button')}
        </Button>
      )}
      {/* Hamburger butonu .game-area içinde board'un sağ kenarına taşındı (aşağı) */}
      <GameMenu
        open={gameMenuOpen}
        showPip={showPip}
        setShowPip={setShowPip}
        showAnalysis={showAnalysis}
        setShowAnalysis={setShowAnalysis}
        learnMode={learnMode}
        setLearnMode={setLearnMode}
        autoRoll={autoRoll}
        setAutoRoll={setAutoRoll}
        animOn={animOn}
        toggleAnim={() => setAnimOn((v) => !v)}
        canAnalyze={mode === 'pvb'}
        canResign={!matchOver && (mode === 'pvb' || online)}
        loggedIn={!!user}
        onTournaments={online && !matchOver ? undefined : menuProps.onTournaments}
        onFriends={online && !matchOver ? undefined : menuProps.onFriends}
        onShop={online && !matchOver ? undefined : menuProps.onShop}
        onLobby={() => (online ? handleLeaveRoom() : setHome(true))}
        onResign={() => setResignOpen(true)}
        onClose={() => setGameMenuOpen(false)}
      />

      <main className="main game-scene">
      <div className="game-area">
        {/* Board flip'lendiginde (yerel oyuncu siyah) kartlar da cevrilir: SEN hep altta */}
        <Sidebar top={flipBoard ? bottomInfo : topInfo} bottom={flipBoard ? topInfo : bottomInfo} />
        {clockOn && (
          <ClockStack
            active={gameWon || gameEnd || opening ? null : turnStart.turn}
            delay={clock.delay}
            white={clock.white}
            black={clock.black}
            final={FINAL_STAGE}
            topOff={working.off.black}
            bottomOff={working.off.white}
          />
        )}
        <Board
          state={working}
          selectableFroms={selectableFroms}
          targets={targets}
          selectedFrom={selectedFrom}
          onSelectFrom={handleSelectFrom}
          onSelectTarget={handleSelectTarget}
          onDragFrom={handleDragFrom}
          pipTop={pipTop}
          pipBottom={pipBottom}
          cube={match.cube}
          centerLeft={centerLeft}
          centerRight={centerRight}
          centerMain={centerMain}
          flip={flipBoard}
          showPip={showPip}
          watermark={ALL_THEMES.find((x) => x.id === boardTheme)?.watermark}
        />
        {showAnalysis && mode === 'pvb' && (
          <AnalysisPanel
            loading={analysisLoading}
            currentProbs={currentProbs}
            ranked={ranked}
            player={turnStart.turn}
            lastError={lastError}
            boardState={analysisBoard}
          />
        )}
        {noMoveFlash && (
          <div className="board-nomove" role="status" aria-live="polite">
            <Icon name="warning-circle" size={18} />
            {t('msg.noMovePass', { name: noMoveFlash })}
          </div>
        )}
        {/* AFK son-15sn uyarisi (sunucu-otoriter): yalniz sirasi gelen YEREL oyuncuya */}
        {online && afkLeft != null && srvActive === myColor && !gameEnd && !matchOver && (
          <div className="afk-warn" role="alert" aria-live="assertive">
            <Icon name="warning-circle" size={22} />
            <span>{t('afk.warn', { n: afkLeft })}</span>
          </div>
        )}
        {/* Oyun menüsü hamburger — board'un sağ kenarına bitişik (flex öğesi) */}
        <button
          className="game-ham"
          onClick={() => setGameMenuOpen((v) => !v)}
          aria-label={t('gm.title')}
          title={t('gm.title')}
        >
          <Icon name="menu" size={30} />
        </button>
      </div>

      <div className="status">
        {match.isCrawford && !gameEnd && <span className="crawford">{t('status.crawford')}</span>}
        {online && (
          <span className="room-tag">
            {t('mp.enterCode')}: {room?.code} ·{' '}
          </span>
        )}
        <span>
          {online && onlineReady && !myTurn && !gameEnd && !opening
            ? t('mp.oppTurn')
            : // Yapay zekaya karsi oyunda "Beyaz oynuyor / Zarlar / dusunuyor" gibi
              // anlatim yazilarini gosterme (board zaten zar+sirayi gorsel veriyor).
              mode === 'pvb'
              ? null
              : message}
        </span>
      </div>
      </main>

      {online && room && (
        <Chat
          messages={chat}
          mySlot={room.slot}
          onSend={handleSendChat}
          canText={premium}
          onUpgrade={() => setMemOpen(true)}
        />
      )}
      {authModal}
      {menuPages}
      {menuOverlays}

      {gameEnd && matchOver && mWinner && (
        <MatchResult
          winnerName={mWinner === 'white' ? whiteName : blackName}
          loserName={mWinner === 'white' ? blackName : whiteName}
          winnerAvatar={mWinner === 'white' ? bottomInfo.avatarUrl : topInfo.avatarUrl}
          loserAvatar={mWinner === 'white' ? topInfo.avatarUrl : bottomInfo.avatarUrl}
          winnerColor={mWinner}
          loserColor={opponent(mWinner)}
          winnerScore={match.score[mWinner]}
          loserScore={match.score[opponent(mWinner)]}
          winnerPr={prOf(mWinner)}
          loserPr={prOf(opponent(mWinner))}
          winnerBand={t(prBand(prOf(mWinner)))}
          loserBand={t(prBand(prOf(opponent(mWinner))))}
          winnerLuck={luckOf(mWinner)}
          loserLuck={luckOf(opponent(mWinner))}
          coinAmount={coinDelta == null ? null : Math.abs(coinDelta)}
          ratingBefore={ratingChange?.before ?? null}
          ratingAfter={ratingChange?.after ?? null}
          ratingIsWinner={prHumanColor === mWinner}
          oppRating={mode === 'pvb' ? 900 + difficulty * 100 : (room?.oppRating ?? null)}
          onRematch={() => {
            if (online) {
              // Havuza OTOMATIK atma yok: odadan cik, Mac Oyunu kurulumuna don ->
              // oyuncu ne oynayacagini KENDISI secsin (eslesme / arkadas daveti).
              handleLeaveRoom()
              setHome(false)
              setSetup('online')
            } else {
              handleNewMatch(match.target, mode)
            }
          }}
          onNewMatch={() => setSetup('pvb')}
          onHome={() => (online ? handleLeaveRoom() : setHome(true))}
          hasReport={matchLog.length > 0}
          onStats={() => setResultView('stats')}
          onAnalysis={() => setResultView('analysis')}
        />
      )}

      {resultView && (
        <MatchReport
          mode={resultView}
          log={matchLog}
          pr={prOf(prHumanColor)}
          humanColor={prHumanColor}
          matchLength={match.target}
          whiteName={whiteName}
          blackName={blackName}
          onClose={() => setResultView(null)}
        />
      )}

      {resignOpen && (
        <div className="register-overlay modal" role="dialog" aria-modal="true">
          <div className="register-card resign-card">
            <h2><Icon name="flag" size={20} /> {t('resign.title')}</h2>
            {(() => {
              const loser: Player = online ? myColor : 'white'
              const mult = resignMultiplier(working, loser)
              const pts = match.cube.value * mult
              const typeKey =
                mult === 3 ? 'resign.tBackgammon' : mult === 2 ? 'resign.tGammon' : 'resign.tSingle'
              return (
                <>
                  <p className="register-sub">{t('resign.autoHelp')}</p>
                  <div className="resign-auto">
                    {t(typeKey)} — <b>{t('resign.losePts', { n: pts })}</b>
                  </div>
                  <Button variant="destructive" onClick={handleResign}>
                    <Icon name="flag" /> {t('resign.confirm')}
                  </Button>
                </>
              )
            })()}
            <Button
              variant="secondary"
              onClick={() => {
                setResignOpen(false)
                if (online) handleLeaveRoom()
                else {
                  tournMatchRef.current = null
                  setHome(true)
                }
              }}
            >
              <Icon name="home" /> {t('resign.toHome')}
            </Button>
            <Button variant="secondary" onClick={() => setResignOpen(false)}>
              {t('reg.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
