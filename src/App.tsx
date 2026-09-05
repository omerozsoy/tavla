import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './App.css'
// Cerceve animasyon secim demosu: gizli /cerceve-anim, tum sade animasyonlar isimli.
const CerceveAnim = lazy(() => import('./ui/CerceveAnim'))
import type { GameState, Move, Player, Step } from './engine/types'
import { cloneState, gameOutcome, opponent, winner } from './engine/board'
import { applyStep, boardKey, generateMoves, hasNoMove } from './engine/moves'
import { checkerDecision, onePointFactor } from './analysis/pr'
import { offerLoss, takeLoss } from './engine/cubeEquity'
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
import { isOnlineReady, openingStateFromMatch, serverMatchToLocal, shouldApplyServerState } from './online/authSync'
import { liveMoveDelta } from './online/liveMoves'
import { randomBotPr } from './botPr'
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
  tournamentNoShow,
  listTournaments,
  type Tournament,
  buyItem,
  selectFrame,
  claimDaily,
  ping,
  markNotificationsRead,
  deleteNotifications,
  inviteFriend,
  requestFriendById,
  respondInvite,
  type GameInvite as GameInviteT,
  type AppNotification,
  type TournNotice as TournNoticeT,
  showRoom,
  updateRoom,
  serverRoll,
  serverMove,
  serverCubeOffer,
  serverCubeRespond,
  serverResign,
  postLive,
  type ServerMatch,
  myActiveRooms,
  type ActiveRoom,
  sendChat,
  reportRating,
  fetchUnseenAchievements,
  type UnlockedAchievement,
  resendVerification,
  ApiError as ApiErr,
  type Slot,
  type ChatMsg,
  submitGameLog,
  type GameLogTurn,
} from './api'
import Chat from './ui/Chat'
import ClockStack from './ui/ClockStack'
import BoardPickerModal from './ui/BoardPickerModal'
import { sourceRect, destEl, flyChecker, type MoveStyle } from './ui/moveAnim'
import PositionAnalyzer from './ui/PositionAnalyzer'
import SideMenu, { type NavItem } from './ui/SideMenu'
import Footer, { type FooterItem } from './ui/Footer'
import { PAGES, PAGE_BY_KEY, type MenuGroup } from './pages'
import { Icon } from './ui/Icon'
import GameMenu from './ui/GameMenu'
import Leaderboard from './ui/Leaderboard'
import RankInfo from './ui/RankInfo'
import FairnessModal from './ui/FairnessModal'
import Friends from './ui/Friends'
import Messages from './ui/Messages'
import Lessons from './ui/Lessons'
import Tournaments from './ui/Tournaments'
import BannerSlider from './ui/BannerSlider'
import { AdStrip } from './ui/AdStrip'
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
import Achievements from './ui/Achievements'
import AchievementUnlock from './ui/AchievementUnlock'
import FriendGameSetup from './ui/FriendGameSetup'
import LangMenu from './ui/LangMenu'
import type { ContentType } from './api'
import Shop from './ui/Shop'
import Cart, { type CartItem } from './ui/Cart'
import Checkout from './ui/Checkout'
import FrameShop from './ui/FrameShop'
import ProfileOverview from './ui/ProfileOverview'
import { AVATAR_FRAMES } from './ui/avatarFrames'
import FrameGallery from './ui/FrameGallery'
import AvatarFrame from './ui/AvatarFrame'
import { Flag } from './ui/Flag'
import MatchResult from './ui/MatchResult'
import MatchReport from './ui/MatchReport'
import { LiveMatchesPanel, OnlinePlayersPanel, RankingPanel, HomeFeatures, HomeDashboard, TournamentsPanel, CalendarPanel, NewsPanel } from './ui/HomePanels'
import Spectate from './ui/Spectate'
import PublicProfile from './ui/PublicProfile'
import Membership from './ui/Membership'
import type { PlanId } from './plans'
import ResetPassword from './ui/ResetPassword'
import MatchSetup, { type MatchOptions, type SetupMode } from './ui/MatchSetup'
import {
  loadGame,
  loadProfile,
  saveGame,
  saveProfile,
  savePendingReport,
  loadPendingReport,
  clearPendingReport,
  savePendingSettle,
  loadPendingSettle,
  clearPendingSettle,
  type Profile,
  type SavedGame,
  type MoveLogEntry,
} from './storage'
import { useT, LANGS } from './i18n'
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
  getMenuConfig,
  buyCoins,
  messagesUnread,
  matchPr,
  type MenuOverride,
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

// Basarim sinyali: bir pozisyonda oyuncunun kurdugu yapiyi tespit et.
//  prime6  = 6 ardisik nokta, her birinde >=2 tas ("Kapici")
//  closeout= tum ev bolgesi (6 nokta) kapali VE rakip barda tas tutuyor ("Cikabilirsen Cik")
function achBoardFeats(pos: GameState, player: Player): { prime6: boolean; closeout: boolean } {
  const pts = pos.points
  const cnt = (i: number) => (player === 'white' ? Math.max(0, pts[i]) : Math.max(0, -pts[i]))
  let prime6 = false
  for (let i = 0; i <= 18 && !prime6; i++) {
    let ok = true
    for (let k = 0; k < 6; k++) if (cnt(i + k) < 2) { ok = false; break }
    if (ok) prime6 = true
  }
  const home = player === 'white' ? [0, 1, 2, 3, 4, 5] : [18, 19, 20, 21, 22, 23]
  const opp: Player = player === 'white' ? 'black' : 'white'
  const closeout = home.every((i) => cnt(i) >= 2) && (pos.bar?.[opp] ?? 0) > 0
  return { prime6, closeout }
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
// ---- Maç kaydı (hamle+zar logu) yardımcıları ----
// Offline (pvb/pvp) maçlar için kısa, okunur maç kimliği üretir (regex [A-Za-z0-9]).
function genLocalUid(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // karışan harfler (I,O,0,1) atlandı
  const arr = new Uint8Array(7)
  ;(globalThis.crypto ?? window.crypto).getRandomValues(arr)
  let out = 'L'
  for (const b of arr) out += abc[b % abc.length]
  return out
}
// Step[] -> notasyon ("24/18 13/8" / "pas"). moveNotation yalnız .steps okur.
function turnNotation(steps: Step[], player: Player): string {
  return moveNotation({ steps, resultKey: '' }, player)
}

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
  // Sunucu-otoriter mod (para maçı güvenliği Faz 2c). true iken istemci zar/hamleyi
  // SUNUCUDAN alır (serverRoll/serverMove). Şu an hiçbir oda için true değil (gated).
  authoritative?: boolean
  // BAĞIMSIZ Faz 1: true iken yalnız ZAR sunucudan (serverRoll); hamle/tahta/küp LEGACY kalır.
  // Bahisli (para) eşleşme odalarında açılır. authoritative'den AYRIDIR.
  dice_authority?: boolean
  // CANLI hamle önizlemesi (cosmetic): sıradaki oyuncunun o an oynadığı/geri aldığı adımlar.
  live?: { slot: Slot; steps: Step[]; turn?: Player | null; seq?: number } | null
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
  const { t, lang, setLang } = useT()
  const pName = (p: Player) => t(p === 'white' ? 'player.white' : 'player.black')
  const [saved] = useState(() => loadGame())
  const [user, setUser] = useState<ServerUser | null>(null)
  // Sol menu override'lari (admin panelden: sira/ad/gorunurluk). Anahtar -> override.
  const [menuOverrides, setMenuOverrides] = useState<Record<string, MenuOverride>>({})
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
  // CANLI rakip önizlemesi (cosmetic): rakibin o an oynadığı adımlar; ekranda adım adım gösterilir.
  const [oppLive, setOppLive] = useState<Step[]>([])
  const oppLiveShownRef = useRef<Step[]>([]) // ekranda gösterilen rakip adımları (delta hesabı)
  const pendingOppFlightRef = useRef<{ to: number | 'off'; srcRect: DOMRect } | null>(null)
  const liveSentRef = useRef<string>('') // gönderilen son canlı-önizleme imzası (spam/echo önleme)
  const [selectedFrom, setSelectedFrom] = useState<number | 'bar' | null>(null)
  const [cubePending, setCubePending] = useState<Player | null>(null) // teklif eden
  // Kup danismani (insan icin): roll-oncesi teklif tavsiyesi veya take/drop tavsiyesi
  const [cubeHint, setCubeHint] = useState<CubeHint | null>(null)
  const cubeHintRef = useRef<CubeHint | null>(null) // karar aninda loglamak icin
  const [gameEnd, setGameEnd] = useState<GameEnd | null>(saved?.gameEnd ?? null)
  const [botAnim, setBotAnim] = useState<BotAnim | null>(null) // bot tas-tas oynatma
  const [botDance, setBotDance] = useState(false) // bot "hamle yok" -> popup 2sn gorunur, sonra gecer
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
  const [infoTab, setInfoTab] = useState<'about' | 'ranks' | 'fair' | 'services' | 'badges'>('about') // footer'dan sekme
  const [achOpen, setAchOpen] = useState(false) // Basarimlar (rozet galerisi)
  const [friendSetupOpen, setFriendSetupOpen] = useState(false) // "Ozel Oyun Olustur" (arkadasinla oyna)
  const [achUnlocked, setAchUnlocked] = useState<UnlockedAchievement[]>([]) // mac sonu unlock kuyrugu
  // Giris/acilista: turnuva/backfill gibi mac-disi kanallardan gelen GORULMEMIS unlock'lari
  // kuyruga al (bir kez animasyon; backend cagride notified=true isaretler).
  useEffect(() => {
    if (!user) return
    let alive = true
    fetchUnseenAchievements()
      .then((r) => {
        if (alive && r.items.length) setAchUnlocked((q) => (q.length ? q : r.items))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])
  const [statsOpen, setStatsOpen] = useState(false) // istatistiklerim modali
  const [fairOpen, setFairOpen] = useState(false) // adil zar modali
  const [friendsOpen, setFriendsOpen] = useState(false) // arkadaslar modali
  const [messagesOpen, setMessagesOpen] = useState(false) // ozel mesajlar (DM) modali
  const [messagesFocusId, setMessagesFocusId] = useState<number | null>(null) // acilirken odaklanilacak arkadas
  const [dmUnread, setDmUnread] = useState(0) // okunmamis ozel mesaj sayisi (menu rozeti)
  const [lessonsOpen, setLessonsOpen] = useState(false) // dersler modali
  const [tournOpen, setTournOpen] = useState(false) // turnuvalar modali
  const [tournDetailId, setTournDetailId] = useState<number | null>(null) // acik turnuva detayi (fetch id)
  const [tournDetailSlug, setTournDetailSlug] = useState<string | null>(null) // SEO URL slug (/online-turnuvalar/isim-{id})
  const [soloOpen, setSoloOpen] = useState(false) // Tek Oyun bahis gridi
  const [blunderOpen, setBlunderOpen] = useState(false) // hata gunlugu
  const [matchHistOpen, setMatchHistOpen] = useState(false) // mac analizleri (gecmis maclar)
  const [matchHistInitialId, setMatchHistInitialId] = useState<number | null>(null) // acilista otomatik acilacak mac
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
  const stakeRef = useRef(0) // aktif bahisli online oyunun tutari (0 = bahissiz); coklu secimde anlasilan
  const stakesRef = useRef<number[] | null>(null) // Tek Oyun: kabul edilen coklu bahis (null = tek/Mac Oyunu)
  // Arkadaslik (davet kodu) maci mi? true -> NE puan NE coin (dostluk). Davet=friendly,
  // eslesme havuzu/solo=ranked. Mac-sonu raporu + coin settle bunu okur.
  const friendlyRef = useRef(false)
  const minRatingRef = useRef(0) // Mac Oyunu: rakip min puan filtresi
  const betPctRef = useRef(0) // Mac Oyunu: bahis = bakiyenin %'si (0 = pct bahis yok)
  const mmOriginRef = useRef<'match' | 'solo'>('match') // eslesme hangi kurulumdan basladi (iptalde geri don)
  const [shopOpen, setShopOpen] = useState(false) // magaza modali
  const [cartOpen, setCartOpen] = useState(false) // sepet (coin paketleri) modali
  // Uygulama-ici odeme sayfasi (kredi karti). buyCoins'ten donen imzali submitUrl + tutar.
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutData, setCheckoutData] = useState<{
    submitUrl: string
    amount: number
    coins: number
    items: CartItem[]
    demo?: boolean
  } | null>(null)
  // Sepet: coin paketleri. localStorage'da tutulur (yenilemede/odeme donusunde korunur).
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem('cart')
      return raw ? (JSON.parse(raw) as CartItem[]) : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cartItems))
    } catch {
      /* yoksay */
    }
  }, [cartItems])
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
        ? 'online-turnuvalar/' + (tournDetailSlug || tournDetailId)
        : 'online-turnuvalar'
      : checkoutOpen
        ? 'odeme'
      : cartOpen
        ? 'sepet'
      : shopOpen
        ? 'magaza'
        : frameGalleryOpen
          ? 'cerceveler'
        : statsOpen
          ? 'istatistiklerim'
          : friendsOpen
            ? 'arkadaslar'
            : messagesOpen
              ? 'mesajlar'
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
                                      : achOpen
                                        ? 'basarimlar'
                                      : friendSetupOpen
                                        ? 'arkadasinla-oyna'
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

  // Sol menu yapilandirmasini (admin panelden sira/ad/gorunurluk) acilista bir kez cek.
  useEffect(() => {
    let alive = true
    getMenuConfig().then((items) => {
      if (!alive) return
      setMenuOverrides(Object.fromEntries(items.map((it) => [it.key, it])))
    })
    return () => {
      alive = false
    }
  }, [])

  // DAYANIKLILIK: önceki maçta ağ hatasıyla başarısız olan reportRating/settle'ı açılışta ve
  // yeniden-bağlanınca tekrar dene. Backend idempotent (oda+kullanıcı tek satır; settle atomik)
  // -> çift-sayma yok. Düşen istemcinin rating + analiz satırı + coin'i kaybolmaz (ekran görüntüsü
  // bug'ı: bir taraf "bağlantı hatası" alıp maç analizinde görünmüyordu). Yalnız user hazırken.
  useEffect(() => {
    if (!user) return
    let alive = true
    const flush = async () => {
      const pr = loadPendingReport()
      if (pr) {
        try {
          const rr = await reportRating(...(pr.args as Parameters<typeof reportRating>))
          if (alive) setUser((u) => (u ? { ...u, rating: rr.rating } : u))
          clearPendingReport()
        } catch {
          /* sonraki açılışta yine denenir */
        }
      }
      const ps = loadPendingSettle()
      if (ps) {
        try {
          const sr = await settleRoomConfirmed(ps.code, ps.won)
          if (sr.ok || !sr.pending) {
            if (alive && typeof sr.coins === 'number') setUser((u) => (u ? { ...u, coins: sr.coins } : u))
            clearPendingSettle()
          }
        } catch {
          /* sonra */
        }
      }
    }
    flush()
    const onOnline = () => flush()
    window.addEventListener('online', onOnline)
    return () => {
      alive = false
      window.removeEventListener('online', onOnline)
    }
  }, [user?.id]) // stabil kimlik -> döngü yok (bkz heartbeat-ping-kacak-dongu)

  // popstate closure'i icin GUNCEL "aktif oyun var mi" (hasActiveGame render-sonrasi
  // hesaplaniyor; ref ile son degeri applyFromPath'e tasiyoruz).
  const hasActiveGameRef = useRef(false)

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
      // URL navigasyonu (geri/ileri/link) HER ZAMAN lobi baglamidir — oyunun kendi URL
      // slug'i YOK. Aktif oyun yoksa bayat online/oyun state'ini temizle ki GERI tusunda
      // ekrana eski/bitmis board gelmesin (kullanici sikayeti). setHome(true) -> sayfa
      // home dalinda (sol menu + logo) acilir. (Aktif oyun varsa dokunma: resume korunur.)
      if (!hasActiveGameRef.current) {
        setMode('pvb')
        setRoom(null)
      }
      setHome(true)
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
        case 'online-turnuvalar':
        case 'turnuvalar': { // eski slug -> geriye donuk uyum
          setTournOpen(true)
          // /online-turnuvalar/{isim-slug}-{id} veya eski /online-turnuvalar/{id}: son '-' parcasi id
          const s1 = seg[1] || ''
          const last = s1.split('-').pop() || ''
          const tid = /^\d+$/.test(last) ? parseInt(last, 10) : null
          setTournDetailId(tid)
          setTournDetailSlug(tid != null ? s1 : null)
          break
        }
        case 'magaza':
          setShopOpen(true)
          break
        case 'sepet':
          setCartOpen(true)
          break
        case 'odeme':
          // Odeme adimi gecici (imzali submitUrl bellekte); dogrudan/yenileme ile gelince sepete don.
          setCartOpen(true)
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
        case 'mesajlar':
          setMessagesOpen(true)
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
        case 'basarimlar':
          setAchOpen(true)
          break
        case 'arkadasinla-oyna':
          setFriendSetupOpen(true)
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
  const seenNotifRef = useRef<Set<number>>(new Set()) // toast'landi mi (yeni bildirim tespiti)
  const notifPrimedRef = useRef(false) // ilk ping'te eski bildirimleri toast'lama
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
  // Sunucu-otoriter mod (Faz 2c): true iken legacy PUT/lokal-zar DEVRE DISI (serverRoll/Move).
  const authoritativeRef = useRef(false)
  // BAGIMSIZ Faz 1: true iken yalniz ZAR sunucudan (serverRoll); hamle/tahta/PUT LEGACY kalir.
  // authoritative'den AYRI: doRoll serverRoll'a gider ama commitTurn/PUT sync degismez.
  const diceAuthorityRef = useRef(false)
  const rollInFlightRef = useRef(false) // serverRoll uçuşta -> üst üste/döngüsel çağrıyı engelle
  const moveInFlightRef = useRef(false) // serverMove uçuşta -> mükerrer commit engelle
  const appliedServerVersionRef = useRef(-1) // uygulanan son server_state versiyonu
  // Poll (stale-closure) icin guncel tur/oynanan ref'leri: server_state'i mid-move'u ezmeden uygula.
  const srvTurnStartRef = useRef<GameState | null>(null)
  const srvPlayedRef = useRef<Step[]>([])
  // Bitmis mac restore edildiyse puan tekrar bildirilmesin (refresh koruma)
  const ratingReportedRef = useRef(!!(saved && (saved.gameEnd || matchWinner(saved.match))))
  const turnRankedRef = useRef<RankedMove[] | null>(null) // tur basi tam siralama (hata tespiti)
  // ---- Maç kaydı (hamle+zar logu): TÜM maçları logla (bkz. submitGameLog) ----
  // NOT: mevcut `matchLogRef` (analiz logu) ile KARISTIRMA — bu ayri bir kayit.
  const gameRecordRef = useRef<{
    uid: string
    online: boolean
    slot: Slot
    mode: 'pvb' | 'online' | 'local'
    target: number
    gameNo: number
    events: GameLogTurn[]
    done: boolean
  } | null>(null)
  const [recordUid, setRecordUid] = useState<string | null>(null) // sol üst HUD'da gösterilen maç ID
  const prevGameEndRef = useRef(false) // gameEnd null->deger gecisini yakala (oyun-sonu flush)
  const turnsPlayedRef = useRef(0) // commitTurn anindaki ortak sira (iki istemci ayni deger)
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
  // loss/decisions = STRICT XG (obvious+forced hariç, PR'ın kendisi). cubeLoss/cubeDecisions =
  // yalnız küp (kırılım). allLoss/allDecisions = TÜM kaydedilen kararlar (obvious dahil) -> strict
  // 0 çıkarsa PR "—" olmasın diye GARANTİ yedeği. Opsiyonel -> reset {loss,decisions} yeter.
  const [prStats, setPrStats] = useState<{
    white: { loss: number; decisions: number; cubeLoss?: number; cubeDecisions?: number; allLoss?: number; allDecisions?: number }
    black: { loss: number; decisions: number; cubeLoss?: number; cubeDecisions?: number; allLoss?: number; allDecisions?: number }
  }>({ white: { loss: 0, decisions: 0 }, black: { loss: 0, decisions: 0 } })
  // PR'in EN GUNCEL degeri: mac-sonu raporu (async recordPR'lar report closure'undan
  // SONRA bittigi icin) stale prStats yerine bu ref'ten okur -> kendi PR'im null dusmez.
  const prStatsRef = useRef(prStats)
  prStatsRef.current = prStats
  // Sans (luck): oyuncu-basi birikmis equity sansi (zarlarin sanslilik toplami)
  const [prLuck, setPrLuck] = useState<{ white: number; black: number }>({ white: 0, black: 0 })
  // Luck'in EN GUNCEL degeri (mac-sonu flush'i stale closure yerine buradan okur)
  const prLuckRef = useRef(prLuck)
  prLuckRef.current = prLuck
  const luckSigRef = useRef('') // ayni turda sansi iki kez saymayi engelle
  const [coinDelta, setCoinDelta] = useState<number | null>(null) // bahisli macta kazanan coin transferi
  const [ratingChange, setRatingChange] = useState<{ before: number; after: number } | null>(null)
  // Sunucu-otoriter PR (mac-sonu): kendi + rakip PR'i backend'de her oyuncunun KENDI
  // log'undan hesaplanir -> iki oyuncu AYNI degerleri gorur. null ise lokal prOf'a duser.
  const [serverPr, setServerPr] = useState<{ self: number | null; opp: number | null } | null>(null)
  // Sunucu-otoriter SANS (luck): iki oyuncu da backend'den AYNI beyaz+siyah HAM luck çiftini
  // okur (her biri kendi renginin ham luck'ını raporlar) -> net (kazanan−kaybeden) TUTARLI.
  // Renk-anahtarlı (peer snapshot'a güvenmez). null iken lokal prLuck'a düşer.
  const [serverLuck, setServerLuck] = useState<{ white: number | null; black: number | null } | null>(null)
  // Gecici bildirim: birlesik toast sistemi (src/ui/Toast). Ag hatalari + e-posta
  // dogrulama sonucu buradan gecer; eski yerel ".verify-toast" render'i kaldirildi.
  const notify = useToast()
  // Mac gunlugu (insanin kararlari): rapor/istatistik icin
  const [matchLog, setMatchLog] = useState<MoveLogEntry[]>([])
  // En guncel log (mac-sonu kaydi async analizler bittikten sonra bunu okur)
  const matchLogRef = useRef<MoveLogEntry[]>([])
  matchLogRef.current = matchLog
  // Basarim sinyalleri (mac boyunca birikir; reportRating'te okunur + sifirlanir).
  // Bunlar log'da guvenilir olmadigi icin frontend'den payload ile gonderilir.
  const achGammonRef = useRef(0) // bu macta insanin mars (gammon) galibiyeti
  const achBgRef = useRef(0) // katmerli mars (backgammon) galibiyeti
  const achMinWpRef = useRef(101) // insanin gordugu en dusuk kazanma % (101 = yok)
  const achPrime6Ref = useRef(false)
  const achCloseoutRef = useRef(false)
  const resetAchSignals = () => {
    achGammonRef.current = 0
    achBgRef.current = 0
    achMinWpRef.current = 101
    achPrime6Ref.current = false
    achCloseoutRef.current = false
  }
  // reportRating payload'i icin sinyalleri topla + sifirla (bir sonraki mac temiz baslar).
  const buildAchExtra = () => {
    const minWp = achMinWpRef.current <= 100 ? achMinWpRef.current : null
    const flags: string[] = []
    if (achPrime6Ref.current) flags.push('prime6')
    if (achCloseoutRef.current) flags.push('closeout')
    const extra = {
      gammons: achGammonRef.current,
      backgammons: achBgRef.current,
      min_win_prob: minWp,
      ach_flags: flags,
    }
    resetAchSignals()
    return extra
  }
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
  // Hazırlık gate'i saf isOnlineReady'de (authSync); testli. p2 authoritative bug'ı orada belgeli.
  const onlineReady = isOnlineReady({
    online,
    status: room?.status,
    slot: room?.slot,
    oppStarted,
    authoritative: room?.authoritative,
  })
  const myTurn = online ? turnStart.turn === myColor : !isBotTurn
  const interactive =
    onlineReady &&
    myTurn &&
    !gameWon &&
    gameEnd === null &&
    !matchOver &&
    cubePending === null &&
    !opening
  // Tahtada gösterilecek durum: kendi turumda `working`; RAKİP turunda canlı önizleme varsa
  // turnStart + rakip adımları (adım adım animasyonla dolar) -> rakip oynarken/geri alırken görürsün.
  const boardDisplay = online && !myTurn && oppLive.length > 0 ? applyPlayed(turnStart, oppLive) : working

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
    setServerPr(null) // yeni mac -> onceki sunucu-PR'i gosterme
    setServerLuck(null) // yeni mac -> onceki sunucu-sansini gosterme
  }

  // PR: bu hamlede wildbg'ye gore kaybedilen equity'yi kaydet (senkron; tur basi analizini kullanir)
  function recordPR(before: GameState, steps: Step[]) {
    if (steps.length === 0) return
    const mover = before.turn
    const moves = generateMoves(before)
    if (moves.length <= 1) return // zorunlu/tek hamle -> karar sayilmaz
    const seq = turnsPlayed // bu turun sirasi (async bot kaydinda korunur)
    // Money (coin) oyunu -> 1-puanlik maç ×1.5 faktörü UYGULANMAZ (yalniz gerçek 1-puanlik MAÇ).
    const isMoney = stakeRef.current > 0
    // Bot (pvb'de siyah): secilen hamlenin gercek equity kaybi (XG-style, analiz .then icinde)
    if (mode === 'pvb' && mover === BOT_PLAYER) {
      // Botun (rakip) hamlesini de analize kaydet: siralamayi arka planda hesapla
      const playedKey = boardKey(applyPlayed(before, steps))
      neuralRef.current
        .analyzeMoves(before)
        .then((ranks) => {
          if (ranks.length === 0) return
          const pl = ranks.find((r) => r.move.resultKey === playedKey) ?? ranks[0]
          // XG-style: obvious eleme + 1pt faktoru; PR yalniz sayilan kararlardan.
          const dec = checkerDecision(
            ranks[0].equity,
            pl.equity,
            ranks[ranks.length - 1].equity,
            moves.length,
            match.target,
            isMoney,
          )
          setPrStats((s) => ({
            ...s,
            black: {
              ...s.black,
              loss: s.black.loss + (dec.countsForPR ? dec.prAdjustedEquityLoss : 0),
              decisions: s.black.decisions + (dec.countsForPR ? 1 : 0),
              allLoss: (s.black.allLoss ?? 0) + dec.prAdjustedEquityLoss,
              allDecisions: (s.black.allDecisions ?? 0) + 1,
            },
          }))
          // Bot luck (sans): aktuel en iyi equity - 21 zarin beklenen en iyisi (tur basi bir kez).
          // Eskiden bot luck HIC hesaplanmiyordu -> ŞANS pvb'de hep 0 kaliyordu.
          const luckKey = `${mover}:${seq}`
          if (luckKey !== luckSigRef.current) {
            luckSigRef.current = luckKey
            const actualBest = ranks[0].equity
            neuralRef.current
              .expectedBestEquity(before, mover)
              .then((expEq) => setPrLuck((s) => ({ ...s, [mover]: s[mover] + (actualBest - expEq) })))
              .catch(() => {})
          }
          if ((ranks[0].probs?.length ?? 0) < 6) return // matchLog detayi icin probs sart
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
              loss: dec.normalizedEquityLoss,
              pos: before,
              steps: ranks[0].move.steps,
              playedSteps: pl.move.steps,
              player: mover,
              dice: [...before.dice],
              cands,
              probs: pl.probs,
              seq,
              countsForPR: dec.countsForPR,
              prAdjustedEquityLoss: dec.prAdjustedEquityLoss,
              mctx: {
                score: match.score,
                cube: match.cube.value,
                cubeOwner: match.cube.owner,
                crawford: match.isCrawford,
                matchLen: match.target,
              },
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
      // PR/luck icin equity YETERLIDIR; probs (kazanma%) sadece basarim/rapor detayi.
      // Eskiden probs<6 ise TUM kayit dusuyordu -> analiz eksikse PR "—", luck 0 kaliyordu.
      if (ranks.length === 0) return
      const pl = ranks.find((r) => r.move.resultKey === playedKey) ?? ranks[0]
      // XG-style karar: best/worst spread -> obvious eleme, 1pt ×1.5 (src/analysis/pr TEK KAYNAK).
      const dec = checkerDecision(
        ranks[0].equity,
        pl.equity,
        ranks[ranks.length - 1].equity,
        moves.length,
        match.target,
        isMoney,
      )
      const loss = dec.normalizedEquityLoss // log/error-journal ham (1pt faktörsüz) equity kaybı
      // PR yalnız SAYILAN kararlardan (zorunlu/obvious hariç); loss = prAdjusted (1pt faktörlü).
      // STRICT (countsForPR) PR'a girer; ANCAK her non-forced karar all*'a girer (PR "—" olmasın
      // diye garanti yedeği: strict 0 çıkarsa loose kullanılır).
      setPrStats((s) => ({
        ...s,
        [mover]: {
          ...s[mover],
          loss: s[mover].loss + (dec.countsForPR ? dec.prAdjustedEquityLoss : 0),
          decisions: s[mover].decisions + (dec.countsForPR ? 1 : 0),
          allLoss: (s[mover].allLoss ?? 0) + dec.prAdjustedEquityLoss,
          allDecisions: (s[mover].allDecisions ?? 0) + 1,
        },
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
      // Basarim: insanin gordugu en dusuk kazanma % (oynanan hamle sonrasi) + kurdugu yapi.
      // Kazanma% yalnizca probs varsa anlamli -> analiz eksikse basarim sinyalini bozma.
      if ((pl.probs?.length ?? 0) >= 1) {
        const wp = (pl.probs![0] ?? 1) * 100
        if (wp < achMinWpRef.current) achMinWpRef.current = wp
      }
      const feats = achBoardFeats(applyPlayed(before, steps), humanColor)
      if (feats.prime6) achPrime6Ref.current = true
      if (feats.closeout) achCloseoutRef.current = true
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
          // XG-style PR denetim alanları (backend prFromLog bunları toplar; yoksa eski loss'a düşer).
          countsForPR: dec.countsForPR,
          prAdjustedEquityLoss: dec.prAdjustedEquityLoss,
          // Karar anındaki maç bağlamı (match-aware EMG PR için — gnubg orchestrator kullanır).
          mctx: {
            score: match.score,
            cube: match.cube.value,
            cubeOwner: match.cube.owner,
            crawford: match.isCrawford,
            matchLen: match.target,
          },
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
      ;(async () => {
        // Gecici olarak analyzeMoves BOS ([]) donebilir: (a) sinir agi henuz yuklenmemis
        // (ozellikle macin ilk hamleleri), (b) tek seferlik WASM hatasi. Eskiden bu insan
        // kararini TAMAMEN dusururdu (record 1229'da return) -> kisa macta decisions=0 ->
        // PR "—". Cozum: kisa gecikmelerle birkac kez YENIDEN dene (mac-sonu flush'i
        // pendingAnalysisRef'i bekler; ag yuklenince retry basarili). Karar ASLA dusmez.
        let ranks: RankedMove[] = []
        for (let i = 0; i < 5 && ranks.length === 0; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 300))
          try {
            ranks = await neuralRef.current.analyzeMoves(before)
          } catch {
            ranks = []
          }
        }
        if (ranks.length === 0) {
          // Son care (nadir): klasik (heuristik) degerlendirme. Pip-olcegini nöral equity
          // olcegine (~[-3,3]) tanh ile SIKIStIR ki PR sisip absurd olmasin.
          ranks = generateMoves(before)
            .map((move) => ({
              move,
              equity: Math.tanh(evaluatePosition(applyPlayed(before, move.steps), mover) / 50),
              probs: [] as number[],
            }))
            .sort((a, b) => b.equity - a.equity)
        }
        record(ranks)
      })()
        .catch(() => {})
        .finally(() => {
          pendingAnalysisRef.current = Math.max(0, pendingAnalysisRef.current - 1)
        })
    }
  }

  function commitTurn(finalPlayed: Step[]) {
    // Her oyuncunun hamlesini PR'a ekle (online'da sadece kendi hamlelerim gecer)
    void recordPR(turnStart, finalPlayed)
    // Maç kaydı: bu turu (zar + hamle) logla (turnStart = hamle ONCESI durum).
    recordMatchTurn(turnStart, finalPlayed)

    // ---- OTORİTER (Faz 2): SUNUCU = tek gerçek kaynak ----
    // Hamleyi sunucuya gönder; DÖNEN otoriter durumu (turn devri + skor + küp) uygula.
    // Optimistik yerel flip YOK -> istemci sunucudan sapmaz (desync/kilit önlenir). Sunucu
    // reddederse (yasadışı/erişimsiz) gerçek sebebi göster + poll ile otoriter duruma dön.
    if (online && authoritativeRef.current && room?.code) {
      if (moveInFlightRef.current) return // mükerrer commit yok
      moveInFlightRef.current = true
      setSelectedFrom(null)
      setRanked(null)
      setCurrentProbs(null)
      serverMove(room.code, finalPlayed)
        .then((r) => {
          if (r?.state) {
            appliedServerVersionRef.current = r.version
            applyServerBoard(r.state as GameState, r.match ?? null)
          }
        })
        .catch((e) => {
          notify.error(srvErr(e))
          appliedServerVersionRef.current = -1 // reddedildi -> poll otoriter durumu geri yükler
        })
        .finally(() => {
          moveInFlightRef.current = false
        })
      return
    }

    // ---- LEGACY / pvb / Faz 1: optimistik yerel uygula (legacy PUT sync effect'te gider) ----
    const s = applyPlayed(turnStart, finalPlayed)
    s.turn = opponent(s.turn)
    s.dice = []
    s.diceUsed = []
    setTurnStart(s)
    setPlayed([])
    setSelectedFrom(null)
    fullyForcedRef.current = false
    setRanked(null)
    setCurrentProbs(null)
    setTurnsPlayed((n) => n + 1)
    if (!winner(s)) setMessage(t('msg.turnOf', { name: pName(s.turn) }))
  }

  // ---- Maç kaydı (hamle+zar logu) ----
  // Bir turu kaydeder. Online'da SADECE kendi rengimin turlarini yazarim (rakip kendi
  // istemcisinde kendi turunu yazar; admin gorunumu seq'e gore birlestirir). pvb/pvp'de
  // tek istemci her iki rengi de yazar.
  function recordMatchTurn(before: GameState, steps: Step[]) {
    const log = gameRecordRef.current
    if (!log) return
    if (log.online && before.turn !== myColor) return
    log.events.push({
      g: log.gameNo,
      s: turnsPlayedRef.current,
      p: before.turn === 'white' ? 'W' : 'B',
      d: (before.dice ?? []).join('-'),
      m: turnNotation(steps, before.turn),
    })
  }

  // Kup (double) kararını kaydeder: katla / kabul / pas. Aktör oyuncu (player) yazar; her
  // istemci yalnız KENDİ kup eylemini kaydeder (online'da rakibinki kendi istemcisinde).
  // o<0 -> aynı seq'te ilgili hamleden ÖNCE sıralanır.
  function recordCubeEvent(player: Player, chosen: 'double' | 'take' | 'drop') {
    const log = gameRecordRef.current
    if (!log) return
    if (log.online && player !== myColor) return
    const m =
      chosen === 'double'
        ? `Katla → ${match.cube.value * 2}`
        : chosen === 'take'
          ? `Kabul (${match.cube.value * 2})`
          : 'Pas (çekildi)'
    log.events.push({
      g: log.gameNo,
      s: turnsPlayedRef.current,
      o: chosen === 'double' ? -3 : -2,
      k: 'cube',
      p: player === 'white' ? 'W' : 'B',
      d: '',
      m,
    })
  }

  // Oyun sonu özeti (kazanan · tür · puan). Her iki istemci de yazabilir; birleştirmede
  // oyun başına tekilleştirilir (bkz. GameLog::mergedTurns).
  function recordEndEvent(ge: GameEnd) {
    const log = gameRecordRef.current
    if (!log) return
    const type = ge.resigned
      ? 'Terk'
      : ge.timeout
        ? 'Süre doldu'
        : ge.dropped
          ? 'Kup pas'
          : ge.mult === 3
            ? 'Çifte mars'
            : ge.mult === 2
              ? 'Mars'
              : 'Normal'
    log.events.push({
      g: log.gameNo,
      s: turnsPlayedRef.current,
      o: 9,
      k: 'end',
      p: ge.winner === 'white' ? 'W' : 'B',
      d: '',
      m: `${ge.winner === 'white' ? 'Beyaz' : 'Siyah'} · ${type} · ${ge.points}p`,
    })
  }

  // Kaydı sunucuya gönderir (en iyi çaba). final=true → maç sonu: kazanan + skor + 'finished'.
  function flushMatchLog(final: boolean) {
    const log = gameRecordRef.current
    if (!log) return
    let p1: string | null
    let p2: string | null
    if (log.online) {
      const me = profile?.nickname ?? t('auth.guestNick')
      const opp = room?.oppName ?? null
      if (log.slot === 'p1') {
        p1 = me
        p2 = opp
      } else {
        p1 = opp
        p2 = me
      }
    } else if (log.mode === 'pvb') {
      p1 = profile?.nickname ?? t('auth.guestNick')
      p2 = AI_LEVELS[difficulty - 1] ?? 'AI'
    } else {
      p1 = pName('white')
      p2 = pName('black')
    }
    const mW = matchWinner(match)
    void submitGameLog({
      uid: log.uid,
      slot: log.slot,
      mode: log.mode,
      target: log.target,
      p1_name: p1,
      p2_name: p2,
      status: final ? 'finished' : 'playing',
      winner: final ? (mW === 'white' || mW === 'black' ? mW : null) : null,
      score: final ? { white: match.score.white, black: match.score.black } : null,
      events: log.events,
    })
  }

  // turnsPlayed'i ref'e yansit (commitTurn aninda ortak sira degeri icin).
  useEffect(() => {
    turnsPlayedRef.current = turnsPlayed
  }, [turnsPlayed])

  // Maç kaydı yaşam döngüsü: aktif bir maç başladığında yeni kayıt aç (uid üret / oda kodu).
  useEffect(() => {
    if (home) {
      gameRecordRef.current = null
      setRecordUid(null)
      return
    }
    if (online) {
      const code = room?.code
      if (!code || room?.status !== 'playing') return
      if (gameRecordRef.current?.uid !== code) {
        gameRecordRef.current = {
          uid: code,
          online: true,
          slot: room!.slot,
          mode: 'online',
          target: match.target,
          gameNo: 1,
          events: [],
          done: false,
        }
        prevGameEndRef.current = false
        setRecordUid(code)
      }
    } else if (mode === 'pvb' || mode === 'pvp') {
      // Yerel maç: taze maç (0-0, tur yok) ise yeni uid; bitmiş kayıttan sonra rovans -> rotasyon.
      const fresh = turnsPlayed === 0 && !gameEnd && match.score.white === 0 && match.score.black === 0
      const cur = gameRecordRef.current
      if (!cur || cur.online || (cur.done && fresh)) {
        const uid = genLocalUid()
        gameRecordRef.current = {
          uid,
          online: false,
          slot: 'p1',
          mode: mode === 'pvp' ? 'local' : 'pvb',
          target: match.target,
          gameNo: 1,
          events: [],
          done: false,
        }
        prevGameEndRef.current = false
        setRecordUid(uid)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, online, room?.code, room?.status, mode, turnsPlayed, gameEnd, match])

  // Oyun sonu: kısmi kaydı gönder (disconnect'e karşı) + sonraki oyun için gameNo artır.
  useEffect(() => {
    const has = !!gameEnd
    if (has && !prevGameEndRef.current && gameRecordRef.current) {
      if (gameEnd) recordEndEvent(gameEnd)
      flushMatchLog(false)
      gameRecordRef.current.gameNo += 1
    }
    prevGameEndRef.current = has
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameEnd])

  // Maç sonu: kesin kaydı (kazanan + skor) gönder ve kilitle.
  useEffect(() => {
    if (matchOver && gameRecordRef.current && !gameRecordRef.current.done) {
      gameRecordRef.current.done = true
      flushMatchLog(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchOver])

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

  // Sunucu-otoriter zar (Faz 2c DRAFT): zar SUNUCUDAN alinir (serverRoll), istemci secemez.
  // authoritative oda + online iken doRoll bunu cagirir. CANLIDA TEST EDILMEDEN ACMA.
  async function doRollAuthoritative() {
    const code = room?.code
    if (!code) return
    if (rollInFlightRef.current) return // önceki serverRoll bitmeden yeni çağrı YOK (döngü kalkanı)
    rollInFlightRef.current = true
    if (cubeHintRef.current?.kind === 'offer') {
      cubeHintRef.current = null
      recordCubePR(myColor, 'offer', 'no-double')
    }
    try {
      const r = await serverRoll(code)
      // AÇILIŞ (Faz 2): sunucu adil açılışı yaptı -> başlayan + iki zar geldi. Taze tahta kur.
      if (r.opening && (r.starter === 'white' || r.starter === 'black')) {
        const starter = r.starter
        const s = freshBoard(starter)
        s.dice = r.dice
        s.diceUsed = [false, false]
        Sound.dice()
        setStarter(starter)
        setTurnStart(s)
        setPlayed([])
        setSelectedFrom(null)
        setLastError(null)
        setRanked(null)
        setCurrentProbs(null)
        setOpening(null) // reveal ekranını atla — sunucu başlayanı belirledi
        const moves = generateMoves(s)
        setMessage(
          hasNoMove(moves)
            ? t('msg.noMovePass', { name: pName(starter) })
            : t('msg.playing', { name: pName(starter), dice: r.dice.join(', ') }),
        )
        return
      }
      // reused (sunucuda zaten verilmiş el): YEREL uygulama YAPMA. newTurn yerel turn'ü korur;
      // açılışta gerçek BAŞLAYAN ikinci çağıran olduğunda reused starter taşımadığı için tahta
      // YANLIŞ turn'de kalır -> "oynayamıyorum". Bunun yerine poll'a bırak: applyServerBoard
      // doğru turn+zar+opened'i getirir. Döngü YOK: açılışta autoRoll !opening ile gated, normal
      // turda diceRolled ile gated; poll opening overlay'ini kaldırır + rollInFlightRef korur.
      if (r.reused) return
      // Sunucu zari kanonik: 2 zar ise buyuk-once goster; cift ise 4 hane oldugu gibi.
      const dice = r.dice.length === 2 ? orderDice(r.dice) : r.dice
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
    } catch (e) {
      // Açılış/sıra yarışı: başlayan-olmayan taraf 409 alır -> SESSİZ (poll açılışı getirir).
      const err = e as { status?: number; message?: string }
      if (err?.status !== 409) {
        notify.error(err?.status ? err.message || t('mp.connError') : t('mp.connError'))
      }
    } finally {
      rollInFlightRef.current = false // uçuş kilidi her durumda serbest bırakılır
    }
  }

  function doRoll() {
    // Sunucu-otoriter oda (tam Faz 2c) VEYA BAGIMSIZ Faz 1 (yalniz zar): zari SUNUCUDAN al
    // (async), lokal zar URETME. Ikisinde de doRollAuthoritative zari serverRoll'dan ceker;
    // fark move tarafinda (Faz 1'de commitTurn LEGACY PUT kullanir, serverMove'a gitmez).
    if (online && (authoritativeRef.current || diceAuthorityRef.current)) {
      void doRollAuthoritative()
      return
    }
    // Roll oncesi kup teklif tavsiyesi varsa: insan katlamak yerine zar atti ->
    // "no-double" karari olarak PR'a isle (guclu tavsiyeyi kacirdiysa equity kaybi sayilir).
    if (cubeHintRef.current?.kind === 'offer') {
      cubeHintRef.current = null
      recordCubePR(online ? myColor : 'white', 'offer', 'no-double')
    }
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
  // Küp kararı PR + kayıt (XG-style). Karar anındaki pozisyonu (turnStart) sinir ağıyla değerlendirir
  // -> cubeEquity ile aksiyon equity KAYBI (en iyi − seçilen). prStats'a (overall PR'a cube dahil)
  // ekler + matchLog'a TEK cube girdisi yazar (hem .mat hem backend PR: countsForPR+prAdjusted).
  // Online: yalnız KENDİ kararım (rakibinki kendi istemcisinde). authoritative dalı handler'da
  // erken döner -> burası legacy/pvb/pvp; motor tarayıcıda mevcut (checker PR gibi).
  function recordCubePR(player: Player, kind: 'offer' | 'take', chosen: 'double' | 'no-double' | 'take' | 'drop') {
    if (online && player !== myColor) return // online: sadece kendi kararım
    const pos = turnStart
    const seq = turnsPlayed
    const isMoney = stakeRef.current > 0
    neuralRef.current
      .evalPosition(pos, player)
      .then((probs) => {
        if (!probs || probs.length < 6) return
        const res =
          kind === 'offer'
            ? offerLoss(probs, chosen === 'double' ? 'double' : 'no-double')
            : takeLoss(probs, chosen === 'take' ? 'take' : 'pass')
        const loss = res.normalizedEquityLoss
        const prAdjusted = loss * onePointFactor(match.target, isMoney)
        setPrStats((s) => ({
          ...s,
          [player]: {
            ...s[player],
            loss: s[player].loss + (res.countsForPR ? prAdjusted : 0),
            decisions: s[player].decisions + (res.countsForPR ? 1 : 0),
            cubeLoss: (s[player].cubeLoss ?? 0) + (res.countsForPR ? prAdjusted : 0),
            cubeDecisions: (s[player].cubeDecisions ?? 0) + (res.countsForPR ? 1 : 0),
            allLoss: (s[player].allLoss ?? 0) + prAdjusted,
            allDecisions: (s[player].allDecisions ?? 0) + 1,
          },
        }))
        const win = (probs[0] + probs[1] + probs[2]) * 100
        const equity = probs[0] - probs[3] + 2 * (probs[1] - probs[4]) + 3 * (probs[2] - probs[5])
        setMatchLog((log) => [
          ...log,
          {
            notation: '',
            best: '',
            loss,
            player,
            pos,
            seq,
            cube: { win, equity, recommended: res.bestAction, chosen, correct: loss < 0.001 },
            countsForPR: res.countsForPR,
            prAdjustedEquityLoss: prAdjusted,
            mctx: {
              score: match.score,
              cube: match.cube.value,
              cubeOwner: match.cube.owner,
              crawford: match.isCrawford,
              matchLen: match.target,
            },
          },
        ])
      })
      .catch(() => {})
  }

  // Sunucu (authoritative) çağrısı hatasını okunur mesaja çevir: HTTP hatasında sunucunun
  // gerçek mesajını (ör. "Crawford oyununda küp kullanılamaz"), ağ kopukluğunda genel uyarı.
  function srvErr(e: unknown): string {
    const err = e as { status?: number; message?: string }
    return err?.status ? err.message || t('mp.connError') : t('mp.connError')
  }

  function handleDouble(player: Player) {
    if (diceRolled || !canDouble(match, player, cubePending !== null)) return
    // OTORİTER (Faz 2): küp teklifi SUNUCUYA (kurallar sunucuda: sıra/sahiplik/Crawford).
    // Yerel mutasyon YOK -> poll server_match ile cubePending'i senkronlar (forge yok).
    if (online && authoritativeRef.current) {
      if (room?.code) void serverCubeOffer(room.code).catch((e) => notify.error(srvErr(e)))
      return
    }
    recordCubePR(player, 'offer', 'double') // XG cube PR + .mat kaydı
    recordCubeEvent(player, 'double') // maç kaydı (okunur)
    setCubePending(player)
    setMessage(t('msg.doubled', { name: pName(player), value: match.cube.value * 2 }))
  }
  function handleTake() {
    if (!cubePending) return
    if (online && authoritativeRef.current) {
      if (room?.code) void serverCubeRespond(room.code, 'take').catch((e) => notify.error(srvErr(e)))
      return
    }
    const doubler = cubePending
    const taker = opponent(doubler)
    recordCubePR(taker, 'take', 'take') // XG cube PR + .mat kaydı
    recordCubeEvent(taker, 'take') // maç kaydı (okunur)
    setMatch((m) => ({ ...m, cube: { value: m.cube.value * 2, owner: taker } }))
    setCubePending(null)
    setMessage(t('msg.took', { name: pName(taker), doubler: pName(doubler) }))
  }
  function handleDrop() {
    if (!cubePending) return
    if (online && authoritativeRef.current) {
      if (room?.code) void serverCubeRespond(room.code, 'drop').catch((e) => notify.error(srvErr(e)))
      return
    }
    const doubler = cubePending
    recordCubePR(opponent(doubler), 'take', 'drop') // XG cube PR + .mat kaydı
    recordCubeEvent(opponent(doubler), 'drop') // maç kaydı (okunur)
    const points = match.cube.value
    setMatch((m) => scoreGame(m, doubler, points))
    setGameEnd({ winner: doubler, points, mult: 1, dropped: true })
    setCubePending(null)
  }

  // ---- Pes etme / cekilme ----
  // NOT: Konuma gore otomatik "adil" carpan kurali kaldirildi (bastan yazilacak).
  // Simdilik teslim = tek oyun (kup degerince) kaybi.
  function handleResign() {
    setResignOpen(false)
    // OTORİTER (Faz 2): pes SUNUCUYA -> rakip mevcut küp değerinde kazanır; poll senkronlar.
    if (online && authoritativeRef.current) {
      if (room?.code) void serverResign(room.code).catch((e) => notify.error(srvErr(e)))
      return
    }
    const loser: Player = online ? myColor : 'white' // pvb'de insan beyaz
    const w = opponent(loser)
    const mult = 1
    const points = match.cube.value * mult
    setMatch((m) => scoreGame(m, w, m.cube.value * mult))
    setGameEnd({ winner: w, points, mult, dropped: false, resigned: true })
  }

  // ---- Oyun sonu (bear off) cozumleme ----
  useEffect(() => {
    // OTORİTER (Faz 2): oyun-sonu puanını SUNUCU hesaplar (move() → server_match); yerelde
    // SKORLAMA -> çifte sayım olur. Skoru poll (applyServerBoard) server_match'ten alır.
    if (online && authoritativeRef.current) return
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
              recordCubePR(BOT_PLAYER, 'offer', 'double') // XG cube PR + .mat kaydı
              recordCubeEvent(BOT_PLAYER, 'double') // maç kaydı
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
    const timer = window.setTimeout(() => {
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
    // Kup danismani SADECE bota karsi (pvb): online/pvp'de gostermek hile olur.
    const onRollCanDouble =
      mode === 'pvb' &&
      interactive &&
      !diceRolled &&
      !gameWon &&
      turnsPlayed > 0 &&
      cubePending === null &&
      turnStart.turn === humanColor &&
      canDouble(match, humanColor, false)
    const facingDouble =
      mode === 'pvb' &&
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
  }, [mode, interactive, diceRolled, gameWon, turnsPlayed, cubePending, turnStart, match, online, myColor])

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

  // Tur bastan sona zorunlu mu oynandi (oyuncu hic secim yapmadi)? -> otomatik onay.
  const fullyForcedRef = useRef(false)
  // Insan sirasi: hamle yok -> otomatik gec; ZORUNLU adim (baska alternatifi olmayan
  // zar) -> otomatik oyna (YAVAS, gorunur). Adim adim ilerler: sonraki adim da
  // zorunluysa o da oynanir. Secim varsa durur (oyuncu oynar).
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
      const timer = window.setTimeout(() => {
        commitTurn([])
      }, 2100) // "hamle yok" dark panel ~2sn ekranda kalsin
      return () => window.clearTimeout(timer)
    }
    // Yavas oto-oyna temposu: kullanici hamleyi net gorsun.
    const AUTO_STEP_MS = 1000
    // Pozisyon TAMAMEN zorunlu (moves.length === 1, hicbir alternatif yok) ->
    // sonraki tek adimi yavas + gorunur oynat. Effect kalan adim(lar) icin tekrar
    // calisir; boylece adim adim ilerler. Bir secim cikarsa durur (oyuncu oynar).
    if (moves.length === 1 && moves[0].steps.length > 0) {
      if (played.length === 0) fullyForcedRef.current = true
      setMessage(t('msg.forcedAuto'))
      const timer = window.setTimeout(() => playSteps([moves[0].steps[0]]), AUTO_STEP_MS)
      return () => window.clearTimeout(timer)
    }
    // Oyuncuya secim birakan bir pozisyon -> tur artik "tamamen zorunlu" degil.
    if (moves.length > 1) fullyForcedRef.current = false
    // Tur bastan sona zorunlu oynandiysa (oyuncu hic secim yapmadi) ve tum zarlar
    // bittiyse -> otomatik onayla (sirayi rakibe ver).
    if (fullyForcedRef.current && played.length > 0 && remainingDice.length === 0) {
      const timer = window.setTimeout(() => {
        fullyForcedRef.current = false
        handleConfirm()
      }, AUTO_STEP_MS)
      return () => window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, diceRolled, played.length, turnStart, working, remainingDice])

  // ---- Tur OTOMATIK tamamla: KAZANILDI ya da elde oynanamayan zar kaldi (baska hamle yok) ----
  // KRITIK: gameWon iken `interactive` FALSE olur -> yukaridaki oto-oyna effect'i calismaz; ayrica
  // oynanamayan zar kalinca (5-5 gelip 2 tas kalmasi gibi) o effect "Onayla"yi bekler. Iki durumda
  // da oyuncunun yapacagi baska sey yok -> el biter bitmez OTOMATIK onayla. Aksi halde oyuncu
  // "Onayla"yi beklerken sunucu saati biter ve KAZANDIGI eli HAKSIZ kaybeder (yasanan bug).
  useEffect(() => {
    if (!diceRolled || played.length === 0 || opening || cubePending || gameEnd || matchOver) return
    if (!myTurn) return
    const stuckLeftover = nextSteps.length === 0 && remainingDice.length > 0
    if (!gameWon && !stuckLeftover) return
    const timer = window.setTimeout(() => handleConfirm(), 900) // el net gorunsun, sonra kapat
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameWon, diceRolled, played.length, nextSteps.length, remainingDice.length, myTurn, opening, cubePending, gameEnd, matchOver])

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
      if (online && room && authoritativeRef.current) {
        // Faz 2: açılışı SUNUCU yapar (adil, deterministik). serverRoll opening+starter döner;
        // doRollAuthoritative taze tahtayı kurar. Sıra-değil hatası olursa (diğer taraf tetikledi)
        // poll server_state ile senkron gelir -> sessiz geç.
        void doRollAuthoritative()
      } else if (online && room) {
        // Faz 1/legacy: oyun no = maçta toplanan puan (iki istemci deterministik aynı açılış).
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

  // ---- Turnuva maci: rakip 1dk icinde GELMEZSE hukmen (walkover) kazan ----
  // Yalniz bekleyen (status='waiting') turnuva macinda calisir; opponent odaya girince
  // status 'playing' olur -> effect cleanup timer'i iptal eder. Sunucu 60sn esigini +
  // rakibin gercekten girmedigini (slot token bos) DOGRULAR (istemci saati otoriter degil).
  useEffect(() => {
    const tm = tournMatchRef.current
    if (!online || !tm || room?.status !== 'waiting' || !room?.code) return
    const id = window.setTimeout(() => {
      tournamentNoShow(tm.tid, tm.matchKey)
        .then(() => {
          notify.success(t('tourn.walkover'))
          handleLeaveRoom()
        })
        .catch(() => {
          // rakip bu arada girdi / sure dolmadi -> sessizce beklemeye devam
        })
    }, 65000) // 60sn sunucu esigi + ag payi
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.status, room?.code])

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
      const achExtra = buildAchExtra()
      const doReport = () =>
        reportRating(
          won,
          oppRating,
          match.target,
          prRef(myColor),
          prLuck[myColor], // HAM kendi-renk luck -> sunucu iki oyuncunun hamını saklar, net'i istemci hesaplar (tutarlı)
          match.score[myColor],
          match.score[opponent(myColor)],
          room?.oppName ?? null,
          prRef(opponent(myColor)),
          JSON.stringify({ hc: myColor, log: matchLogRef.current.slice(-250) }),
          !friendlyRef.current, // ranked: eslesme/solo puanli; ARKADASLIK maci puansiz
          stakeRef.current > 0 ? 'coin' : 'match', // Jeton (duz coin bahsi) vs N-puanlik mac
          room?.code ?? null, // oda kodu -> backend friendly odayi kesin puansiz yapar
          achExtra, // basarim sinyalleri (mars/katmerli, min WP, prime6/closeout)
        )
      // Gecici ag/sunucu hatasi tek denemede "puanin kaydedilemedi" gostermesin -> 3 kez dene.
      let r: Awaited<ReturnType<typeof reportRating>> | null = null
      for (let attempt = 1; attempt <= 3 && !r; attempt++) {
        try {
          r = await doReport()
        } catch {
          if (attempt < 3) await new Promise((res) => setTimeout(res, 800 * attempt))
        }
      }
      if (!r) {
        // 3 denemede de olmadi -> kullaniciyi uyar + KURTARMA: raporu sakla, sonra (açılış/yeniden-
        // bağlanma) tekrar dene. Backend idempotent (oda+kullanıcı tek satır) -> düşen istemcinin
        // rating + analiz satırı + coin'i kaybolmaz. Log otoriter (sunucu skoru/PR'ı yeniden hesaplar).
        notify.error(t('net.ratingFailed'))
        savePendingReport([
          won,
          oppRating,
          match.target,
          prRef(myColor),
          prLuck[myColor], // HAM kendi-renk luck (bkz doReport) — pending retry de aynı semantik
          match.score[myColor],
          match.score[opponent(myColor)],
          room?.oppName ?? null,
          prRef(opponent(myColor)),
          JSON.stringify({ hc: myColor, log: matchLogRef.current.slice(-250) }),
          !friendlyRef.current,
          stakeRef.current > 0 ? 'coin' : 'match',
          room?.code ?? null,
          achExtra,
        ])
      } else {
        setRatingChange({ before, after: r.rating })
        setUser((u) => (u ? { ...u, rating: r!.rating } : u))
        if (r.achievements?.length) setAchUnlocked(r.achievements)
        // Sunucu-otoriter PR (iki oyuncuda AYNI). Rakip henuz raporlamadiysa poll et.
        const code = room?.code ?? null
        let oppPr = r.pr_opponent ?? null
        setServerPr({ self: r.pr_self ?? null, opp: oppPr })
        // Sunucu-otoriter SANS: self/opp HAM luck'ı renge (white/black) eşle -> iki istemci
        // AYNI çifti tutar -> net TUTARLI. Gelmeyen (null) değeri önceki değeri korur (merge).
        const setLuckPair = (selfL?: number | null, oppL?: number | null) =>
          setServerLuck((prev) => {
            const next = { white: prev?.white ?? null, black: prev?.black ?? null }
            if (selfL != null) next[myColor] = selfL
            if (oppL != null) next[opponent(myColor)] = oppL
            return next
          })
        setLuckPair(r.luck_self, r.luck_opp)
        let oppLuckDone = r.luck_opp != null
        if ((oppPr == null || !oppLuckDone) && code) {
          for (let i = 0; i < 8 && (oppPr == null || !oppLuckDone); i++) {
            await new Promise((res) => setTimeout(res, 1500))
            const pair = await matchPr(code)
            if (pair.opponent != null) {
              oppPr = pair.opponent
              setServerPr({ self: pair.self ?? r!.pr_self ?? null, opp: pair.opponent })
            }
            if (pair.luck_opp != null || pair.luck_self != null) {
              setLuckPair(pair.luck_self, pair.luck_opp)
              if (pair.luck_opp != null) oppLuckDone = true
            }
          }
        }
      }
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
          // KURTARMA: settle'ı sakla, açılış/yeniden-bağlanmada tekrar dene (settle atomik+idempotent).
          if (room?.code) savePendingSettle(room.code, won)
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

  // pvb: bot rakibin PR'ini seviyeye uygun SABIT-RASTGELE goster. NeuralBot neredeyse-optimal
  // oynadigi icin olculen bot PR'i ~0.0 cikar ve "0.0" itici gorunur. Mac bitince bir kez
  // hesaplanir (useMemo -> render icinde stabil); hem sonuc ekraninda hem reportRating kaydinda
  // AYNI deger kullanilir. bkz src/botPr.ts
  const botMatchDone = mode === 'pvb' && !!matchWinner(match)
  const botPr = useMemo(
    () => (botMatchDone ? randomBotPr(difficulty) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [botMatchDone, difficulty],
  )
  const botPrRef = useRef<number | null>(null)
  botPrRef.current = botPr

  // Bota karsi mac bitince de puan islensin (bot puani zorluga gore).
  // Casual (rankedMatch=false) macta puana/lig'e etki yok; PR + hata gunlugu kalir.
  useEffect(() => {
    if (mode !== 'pvb' || !user || ratingReportedRef.current) return
    const mW = matchWinner(match)
    if (!mW) return
    ratingReportedRef.current = true
    // Giris yapmis kullanicinin AI maci HER ZAMAN kaydedilir (misafir haric).
    // Casual'da rating degismez: ranked=false -> backend Elo/lig islemez, delta=0 kaydeder.
    const botRating = 900 + difficulty * 100 // seviye 1 -> 1000, seviye 10 -> 1900
    const won = mW === 'white' // pvb'de insan beyaz
    const before = user.rating ?? 1500
    void (async () => {
      // Bekleyen (async) hamle analizleri bitene kadar bekle (max ~3s) -> PR/luck/log TAM
      // olsun; sonra stale closure yerine EN GUNCEL ref'lerden oku. (Online tarafiyla ayni.)
      for (let i = 0; i < 30 && pendingAnalysisRef.current > 0; i++) {
        await new Promise((res) => setTimeout(res, 100))
      }
      await new Promise((res) => setTimeout(res, 200)) // son setPrStats/setPrLuck flush'i
      const prRef = (c: Player): number | null => {
        const s = prStatsRef.current[c]
        return s.decisions > 0 ? (s.loss / s.decisions) * 500 : null
      }
      const logNow = matchLogRef.current
      reportRating(
        won,
        botRating,
        match.target,
        prRef('white'),
        prLuckRef.current.white - prLuckRef.current.black, // goreceli sans (zero-sum)
        match.score.white,
        match.score.black,
        `${AI_LEVELS[difficulty - 1]}`,
        botPrRef.current ?? prRef('black'), // bot PR: seviyeye uygun sabit-rastgele (bkz botPr.ts)
        JSON.stringify({ hc: 'white', log: logNow.slice(-250) }),
        rankedMatch,
        'match', // match_type (pvb her zaman N-puanlik)
        null, // room_code yok
        buildAchExtra(), // basarim sinyalleri (mars/katmerli, min WP, prime6/closeout)
      )
        .then((r) => {
          setRatingChange({ before, after: r.rating })
          setUser((u) => (u ? { ...u, rating: r.rating } : u))
          if (r.achievements?.length) setAchUnlocked(r.achievements)
          // pvb: kendi PR sunucudan (log'dan); rakip = bot (lokal prOf gosterilir)
          setServerPr({ self: r.pr_self ?? null, opp: null })
        })
        .catch(() => {})

      // Hata gunlugu: bu macin en kotu hamlelerini kaydet (yalnizca insan; bot degil)
      const ctx = {
        opp: null,
        ai_level: difficulty,
        score_me: match.score.white,
        score_opp: match.score.black,
        won: mW === 'white',
      }
      const bl = logNow
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
    })()
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

  // Sunucu-otoriter durumu (server_state + server_match) uygula (Faz 2). Yalniz TUR SINIRINDA
  // cagirilir (mid-move'u ezmemek icin poll'da korunur). Otorite SUNUCU: tahta + skor + KUP +
  // Crawford + mac-bitti hepsi sunucudan gelir; istemci yalniz yansitir (forge edemez).
  function applyServerBoard(gs: GameState, sm?: ServerMatch | null) {
    syncEnabledRef.current = true
    setTurnStart(gs)
    setPlayed([])
    setSelectedFrom(null)
    setRanked(null)
    setCurrentProbs(null)
    if (sm) {
      // Skor + KÜP (değer/sahip/bekleyen) SAF reduce'la (src/online/authSync + 2-istemci sim testi).
      const lm = serverMatchToLocal(sm, match.target)
      setMatch((m) => ({
        ...m,
        target: lm.target,
        score: lm.score,
        cube: { value: lm.cubeValue, owner: lm.cubeOwner },
      }))
      setCubePending(lm.cubePending)
      // Açılış overlay kararı da saf: opened=false->'roll' (yeni oyun), true->null (kaldır), done->keep.
      const os = openingStateFromMatch(sm)
      if (os === 'keep') {
        // MAÇ BİTTİ (sunucu). KRİTİK: authoritative modda yerel oyun-sonu effect'i (winner(working))
        // ATLANIR -> gameEnd'i burada SUNUCU sonucundan kurmazsak MatchResult ekranı HİÇ açılmaz;
        // skor güncellenip matchOver true olur ama sonuç görünmez ("oyun bitmedi" + sadece hata
        // toast'i yaşanan bug). Yalnız bir kez yaz (mevcut null ise).
        if (sm.done && sm.winner) {
          const w = sm.winner
          setGameEnd((g) => g ?? { winner: w, points: lm.cubeValue, mult: 1, dropped: false })
        }
      } else {
        setGameEnd(null) // yeni oyun -> önceki oyun-sonu ekranını temizle
        setOpening(os)
      }
    }
    if (!winner(gs)) setMessage(t('msg.turnOf', { name: pName(gs.turn) }))
  }

  // Poll (stale-closure) icin guncel tur/oynanan + authoritative ref'lerini tazele.
  useEffect(() => {
    srvTurnStartRef.current = turnStart
  }, [turnStart])
  useEffect(() => {
    srvPlayedRef.current = played
  }, [played])
  useEffect(() => {
    authoritativeRef.current = !!room?.authoritative
  }, [room?.authoritative])
  useEffect(() => {
    diceAuthorityRef.current = !!room?.dice_authority
  }, [room?.dice_authority])

  // Online: yerel degisikligi odaya gonder (senkron)
  // ONEMLI: bagimliliklarda tum `room` nesnesi YOK -> her yoklamada (oppName/status
  // yenilenince) tekrar gondermeyi onler. Ayrica imza ayni ise (echo) gondermez;
  // aksi halde iki istemci birbirinin eski durumunu yeniden uygulayip hamleyi siler.
  const roomCode = room?.code
  const roomStatus = room?.status
  useEffect(() => {
    if (!online || !roomCode || roomStatus !== 'playing' || !syncEnabledRef.current) return
    // Sunucu-otoriter oda: tum-state PUT ETME. Otorite server_state'te; roll/move ucları
    // gunceller, poll geri okur. (Legacy istemci-state sync yalniz authoritative=false'ta.)
    if (authoritativeRef.current) return
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
                authoritative: rv.authoritative ?? r.authoritative,
                dice_authority: rv.dice_authority ?? r.dice_authority,
                live: rv.live ?? null, // canlı rakip önizlemesi (cosmetic)
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
          // Coklu bahis: bekleyen oyuncu eslesince sunucunun anlastigi tutari uygula.
          if (rv.stake != null && rv.stake > 0) stakeRef.current = rv.stake
        }
        // Sunucu-otoriter mod (Faz 2c DRAFT): bayragi yakala; server_state'i YALNIZ tur
        // sinirinda uygula (kendi zarim/hamlem elimdeyken ezme). Legacy state sync atlanir.
        authoritativeRef.current = rv.authoritative ?? authoritativeRef.current
        // BAGIMSIZ Faz 1: zar-otorite bayragini yakala (doRoll serverRoll'a gitsin). Legacy
        // PUT/move akisi degismez; yalniz zar kaynagi sunucu olur.
        diceAuthorityRef.current = rv.dice_authority ?? diceAuthorityRef.current
        // Poll-apply kararı SAF fonksiyonda (src/online/authSync + test). midMove yalnız KENDİ
        // turumda geçerli; rakip turundaysak daima senkronla (açılış desync fix — bkz authSync).
        if (
          shouldApplyServerState(
            {
              turn: srvTurnStartRef.current?.turn ?? 'white',
              diceCount: srvTurnStartRef.current?.dice?.length ?? 0,
              playedCount: srvPlayedRef.current.length,
              appliedServerVersion: appliedServerVersionRef.current,
            },
            rv,
            myColor,
          )
        ) {
          appliedServerVersionRef.current = rv.server_version ?? 0
          applyServerBoard(rv.server_state as GameState, rv.server_match) // tahta + skor + kup + Crawford
        } else if (!rv.authoritative && rv.version > appliedVersionRef.current && rv.state) {
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
    if (gameEnd.winner === humanColor) {
      Sound.win()
      // Basarim: bu oyunu insan mars/katmerli marsla mi kazandi (kup drop'u haric).
      if (!gameEnd.dropped) {
        if (gameEnd.mult === 3) achBgRef.current += 1
        else if (gameEnd.mult === 2) achGammonRef.current += 1
      }
    } else Sound.lose()
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
      setDmUnread(0)
      seenNotifRef.current.clear()
      notifPrimedRef.current = false
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
            const notifs = r.notifications ?? []
            // Yeni (daha once gorulmemis) bildirimleri toast ile aktif uyar.
            // Ilk ping'te (primed=false) eski okunmamislari toast'lama, sadece kaydet.
            const fresh = notifs.filter((n) => !seenNotifRef.current.has(n.id))
            notifs.forEach((n) => seenNotifRef.current.add(n.id))
            if (notifPrimedRef.current && fresh.length > 0) {
              notify.info(fresh[0].title) // notifs newest-first -> fresh[0] en yeni
            }
            notifPrimedRef.current = true
            setNotifications(notifs)
            setUnreadNotif(r.unread ?? 0)
            setDmUnread(r.dm_unread ?? 0)
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
    // KRİTİK: yalnız [user?.id] — coins güncellemesi (beat içindeki setUser) `user` kimliğini
    // değiştirip bu effect'i yeniden kurmasın; aksi halde her ping ANINDA yeni ping tetikler ->
    // KAÇAK DÖNGÜ (binlerce request). user?.id sadece giriş/çıkışta değişir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

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
  // Sag ust hesap dropdown'u: ada tiklayinca acilir; profil + tum bar kontrolleri icinde.
  // Panel position:fixed (ust bar overflow'una takilmasin) -> koordinat tetikten hesaplanir.
  const [acctMenuOpen, setAcctMenuOpen] = useState(false)
  const [acctMenuPos, setAcctMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const acctMenuRef = useRef<HTMLDivElement>(null)
  function toggleAcctMenu() {
    setAcctMenuOpen((o) => {
      if (!o && acctMenuRef.current) {
        const r = acctMenuRef.current.getBoundingClientRect()
        setAcctMenuPos({ top: Math.round(r.bottom + 8), right: Math.round(Math.max(8, window.innerWidth - r.right)) })
      }
      return !o
    })
  }
  useEffect(() => {
    if (!acctMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (acctMenuRef.current && !acctMenuRef.current.contains(e.target as Node)) setAcctMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setAcctMenuOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [acctMenuOpen])
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

  // ---- CANLI hamle önizlemesi: GÖNDER (kendi turum) ----
  // Kendi turumda her adım/geri-almada güncel `played`'i odaya yaz -> rakip adım adım görür.
  // Cosmetic; otoriteye dokunmaz. 120ms debounce (hızlı çok-adımı topla) + imza (echo/spam önle).
  useEffect(() => {
    if (!online || !room?.code || room.status !== 'playing' || !myTurn) return
    const sig = `${myColor}:${turnsPlayed}:${played.map((s) => `${s.from}>${s.to}/${s.die}`).join('|')}`
    if (sig === liveSentRef.current) return
    liveSentRef.current = sig
    const code = room.code
    const snapshot = played.slice()
    const t = window.setTimeout(() => void postLive(code, snapshot, myColor, turnsPlayed), 120)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, room?.code, room?.status, myTurn, myColor, turnsPlayed, played])

  // ---- CANLI hamle önizlemesi: AL + ANİMASYON (rakip turu) ----
  // Rakibin `live` adımlarını oku; delta'yı (yeni adım vs geri-alma) hesaplayıp adım adım oynat.
  useEffect(() => {
    if (!online || myTurn) {
      // Kendi turum / offline -> önizlemeyi temizle (bir sonraki rakip turuna hazır).
      if (oppLiveShownRef.current.length) {
        oppLiveShownRef.current = []
        setOppLive([])
      }
      return
    }
    const live = room?.live
    if (!live || !Array.isArray(live.steps) || live.slot === room?.slot) return
    if (live.turn && live.turn !== turnStart.turn) return // bu turun/rengin önizlemesi değil
    const incoming = live.steps as Step[]
    const delta = liveMoveDelta(oppLiveShownRef.current, incoming)
    if (delta.reset) {
      // Geri alma / farklı dizi -> anında turnStart+incoming'e sıçra (geri-almayı net göster).
      oppLiveShownRef.current = incoming.slice()
      setOppLive(incoming.slice())
      return
    }
    if (delta.animate.length === 0) return
    const base = oppLiveShownRef.current.slice()
    const flip =
      moveStyle !== 'off' && animOn && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers: number[] = []
    delta.animate.forEach((st, i) => {
      timers.push(
        window.setTimeout(() => {
          if (flip) {
            const r = sourceRect(st.from) // güncel gösterilen tahtada kaynağı yakala
            if (r) pendingOppFlightRef.current = { to: st.to, srcRect: r }
          }
          base.push(st)
          oppLiveShownRef.current = base.slice()
          setOppLive(base.slice())
        }, i * 450), // adımlar arası görünür gecikme (rakip tek tek oynuyor gibi)
      )
    })
    return () => timers.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, myTurn, room?.live, room?.slot, turnStart, moveStyle, animOn])

  // Rakip önizleme adımı eklendikten sonra hedef taşı kaynaktan uçur (playSteps FLIP'inin eşi).
  useLayoutEffect(() => {
    const f = pendingOppFlightRef.current
    if (!f || moveStyle === 'off') {
      pendingOppFlightRef.current = null
      return
    }
    pendingOppFlightRef.current = null
    const el = destEl(f.to)
    if (el) flyChecker(el, f.srcRect, moveStyle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppLive])

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

  // (Kaldirildi) Ozel "asagi cek-yenile" (pull-to-refresh): overlay'lerde (analiz vb.) kazara
  // reload tetikleyip sayfayi/dizilimi sifirliyordu. Tamamen kaldirildi; kullanici tarayicidan yeniler.

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

  async function handleCreateRoom(target = 1, tc?: TimeControl) {
    setRoomBusy(true)
    setRoomError('')
    // Onceki BITMIS oyunu HEMEN temizle (matchOver true kalirsa oda kurma agi beklerken
    // game-view eski board'u FLASH ediyordu) -> spinner sorunsuz gorunur.
    setGameEnd(null)
    setTurnsPlayed(0)
    setMatch(newMatch(target))
    try {
      friendlyRef.current = true // davet ile kurulan oda = arkadaslik maci (puan/coin YOK)
      stakeRef.current = 0
      betPctRef.current = 0
      const tcUse = tc ?? timeControl // FriendGameSetup'tan gelen saat (state stale olmasin)
      const res = await createRoom(profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar, tcUse)
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
      // Hata: bayat online durumda TAKILMA -> arkadas kurulum ekranina don + toast.
      notify.error(t('mp.connError'))
      setRoom(null)
      setHome(false)
      setFriendSetupOpen(true)
    } finally {
      setRoomBusy(false)
    }
  }

  // Tek Oyun: bir veya BIRDEN COK bahis sec -> kesisen tutarli rakiple eslesir (tek oyun).
  // Anlasilan tutar sunucuda kesinlesir (ortak tutarlardan en yuksegi); stakeRef gecici max.
  function startSoloStake(stakes: number[], target = 1) {
    const list = stakes.filter((s) => s > 0)
    if (list.length === 0) return
    stakesRef.current = list
    stakeRef.current = Math.max(...list) // gecici gosterim; eslesmede room.stake ile guncellenir
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
    // Onceki BITMIS oyunu HEMEN (await'ten once) temizle: matchOver true kalirsa arama
    // agi beklerken 4691 (!matchOver) atlanip game-view ESKI board'u FLASH ediyordu.
    setGameEnd(null)
    setTurnsPlayed(0)
    setMatch(newMatch(onlineTargetRef.current))
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
        stakesRef.current ?? undefined,
      )
      // Eslesme olduysa sunucu ortak uzunlugu (target) verir; olmadiysa gecici (max).
      matchTargetSyncedRef.current = res.room.target != null
      if (res.room.target != null) onlineTargetRef.current = res.room.target
      // Eslesme aninda anlasilan bahis (coklu secim) kesinlesti -> gercek tutari uygula.
      if (res.matched && res.room.stake != null && res.room.stake > 0) stakeRef.current = res.room.stake
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
        // KRİTİK: authoritative'i İLK POLL'U BEKLEMEDEN kur. Eşleşen oyuncu (p2) status='playing'
        // ile hemen açılışa girer; authoritativeRef henüz false ise açılış seededOpening'e (legacy)
        // düşer -> server_state'e zar YAZILMAZ -> ilk serverMove "Önce zar at" (409) -> sıra geçmez.
        authoritative: res.room.authoritative,
        // BAGIMSIZ Faz 1: bahisli oda -> zar sunucudan (serverRoll). Aynı erken-gate mantığı.
        dice_authority: res.room.dice_authority,
      })
    } catch (err) {
      // ApiError (status var) -> sunucunun gercek mesajini goster; yoksa ag hatasi
      const e = err as { status?: number; errors?: Record<string, string[]>; message?: string }
      const msg = e?.status
        ? (e.errors ? Object.values(e.errors)[0]?.[0] : undefined) || e.message || t('mp.connError')
        : t('mp.connError')
      // Hata: bayat online durumda TAKILMA (bos board/secim ekrani) -> lobi baglaminda
      // origine don + toast.
      notify.error(msg)
      setRoom(null)
      setMode('pvb')
      setHome(true)
      if (mmOriginRef.current === 'solo') setSoloOpen(true)
      else setSetup('online')
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
    // LOBI baglamina don (sol menu + logo ile). online'dan cik ki game-view'a dusmesin
    // (solo iptalde SoloStakes sidebar'siz aciliyordu). solo -> home dalinda SoloStakes,
    // mac -> setup dali (kendi sidebar'i var).
    setMode('pvb')
    setHome(true)
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
      // Kod GECERLI -> simdi online oyuna gec (kurulum ekranindan gelindiyse). Room ile
      // ayni tik'te ayarlanir (React batch) -> araya bogus board render'i girmez.
      setFriendSetupOpen(false)
      setMode('online')
      setHome(false)
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
      const msg =
        e instanceof ApiErr && e.status === 404
          ? t('mp.roomNotFound')
          : e instanceof ApiErr && e.status === 409
            ? t('mp.roomFull')
            : t('mp.connError')
      setRoomError(msg)
      notify.error(msg) // kurulum ekraninda Lobby yoksa da gorunur ("boyle bir oda yok")
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

  // Okunmamis mesaj rozetini aninda tazele (ping'i beklemeden; or. konusma acilinca)
  function refreshDmUnread() {
    messagesUnread()
      .then((r) => setDmUnread(r.unread ?? 0))
      .catch(() => {})
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
  // Cevrimici oyuncu panelinden "Arkadas ol": id ile istek + toast.
  async function handleAddFriend(userId: number) {
    try {
      const r = await requestFriendById(userId)
      notify.success(
        r.status === 'accepted'
          ? t('online.friendMutual')
          : r.status === 'pending'
            ? t('online.friendSent')
            : t('online.friendExists'),
      )
    } catch {
      notify.error(t('online.friendFail'))
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
      stakesRef.current = null // Tek Oyun coklu-bahis'i sizdirma (Mac Oyunu % bahis)
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
  // "hamle yok" popup: kendi siramda VEYA bot dans ederken VEYA online RAKİP dans ederken goster
  // (rakip zar atip hamlesi yoksa yerel oyuncu da ~2sn "Hamle Yok" panelini gorur -> adam anlar).
  const noMove =
    diceRolled &&
    hasNoMove(generateMoves(turnStart)) &&
    (interactive || botDance || (online && !myTurn && !gameEnd && !matchOver))
  const showRoll = interactive && !diceRolled
  // Tum oynanabilir zarlar oynandi -> onay bekleniyor
  const turnComplete =
    interactive && diceRolled && played.length > 0 && nextSteps.length === 0
  const humanCanDouble =
    showRoll && turnsPlayed > 0 && canDouble(match, turnStart.turn, false)
  // Kup teklifine yanit: pvp (ayni ekran), bota karsi, veya online'da rakip teklif ettiyse
  const humanRespond =
    cubePending !== null &&
    (mode === 'pvp' ||
      (mode === 'pvb' && cubePending === BOT_PLAYER) ||
      (online && cubePending !== myColor))
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
  const pipTop = pipCount(boardDisplay, 'black')
  const pipBottom = pipCount(boardDisplay, 'white')

  // PR (Performans Reytingi): karar basina ortalama equity kaybi x 500 (dusuk = iyi)
  const prOf = (c: Player): number | null =>
    prStats[c].decisions > 0 ? (prStats[c].loss / prStats[c].decisions) * 500 : null
  // Kırılım: küp-yalnız ve checker (= overall − küp). decisions 0 -> null (0.00 değil).
  const prCubeOf = (c: Player): number | null => {
    const cd = prStats[c].cubeDecisions ?? 0
    return cd > 0 ? ((prStats[c].cubeLoss ?? 0) / cd) * 500 : null
  }
  const prCheckerOf = (c: Player): number | null => {
    const cd = prStats[c].cubeDecisions ?? 0
    const chkDec = prStats[c].decisions - cd
    const chkLoss = prStats[c].loss - (prStats[c].cubeLoss ?? 0)
    return chkDec > 0 ? (chkLoss / chkDec) * 500 : null
  }
  // PR -> seviye unvani (9 kademeli standart tavla tablosu; badges.ts)
  const prBand = (p: number | null): string => (p == null ? '' : divisionOfPR(p).key)
  const prHumanColor: Player = online ? myColor : 'white'
  const prValue = prOf(prHumanColor)
  const prBandKey = prBand(prValue)
  // GARANTİ: sonuç ekranında PR ASLA "—" olmasın (kullanıcı direktifi). Öncelik: SUNUCU-otoriter
  // (iki oyuncuda tutarlı) -> STRICT lokal XG -> LOOSE (obvious dahil tüm non-forced) -> 0.00.
  // 0'a düşme yalnızca hiç ölçülebilir karar yoksa (ör. hamlesiz timeout) olur.
  const prLooseOf = (c: Player): number | null => {
    const ad = prStats[c].allDecisions ?? 0
    return ad > 0 ? ((prStats[c].allLoss ?? 0) / ad) * 500 : null
  }
  const prShown = (c: Player): number => {
    // pvb: bot rakibin PR'i seviyeye uygun sabit-rastgele deger (gercek olculen ~0.0 itici).
    if (!online && botPr != null && c !== prHumanColor) return botPr
    if (serverPr) {
      const v = c === prHumanColor ? serverPr.self : serverPr.opp
      if (v != null) return v
    }
    return prOf(c) ?? prLooseOf(c) ?? 0
  }
  // Sans: kendi rengim lokal (mutlak); online'da rakip hesaplanmadıysa null (MatchResult
  // negatifiyle sıfır-toplam gösterir). NOT: MatchResult zaten net = kazanan−kaybeden ile
  // sıfır-toplam yapar; burada MUTLAK değer döndür (relative döndürünce ×2 çift-sayım oluyordu).
  // ÇAPRAZ-İSTEMCİ TUTARLILIK: sunucu-otoriter ham renk-luck varsa onu kullan (iki oyuncu da
  // backend'den AYNI white+black çiftini okur -> MatchResult net'i özdeş). Yoksa lokal prLuck'a
  // düş (online'da rakip henüz hesaplanmadıysa null -> MatchResult negatifiyle sıfır-toplam).
  const luckOf = (c: Player): number | null => {
    if (serverLuck && serverLuck[c] != null) return serverLuck[c]
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
        {learnMode && cubeHint?.kind === 'respond' && (
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
            <Button variant="default" onClick={() => handleDouble(turnStart.turn)}>
              {t('btn.double')}
            </Button>
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
    isBot: !online && mode === 'pvb', // PvB'de siyah/ust oyuncu = YZ -> robot ikonu
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

  // Auth kontrolu bitene kadar bekle (uygulama aciliyor -> "Yukleniyor", analiz DEGIL)
  if (!authChecked) {
    return (
      <div className="register-overlay">
        <div className="register-card">{t('common.loading')}</div>
      </div>
    )
  }

  // Ortak Auth handler'lari (giris/kayit modali + profil duzenleme sayfasi paylasir)
  const authProps = {
    onAuthed: (u: ServerUser, isNew?: boolean) => {
      const wasEditing = editProfile
      // Misafir (user==null) iken devam eden/biten HERHANGI bir oyun giris/kayit
      // sonrasi YENI hesaba YAZILMASIN. Eskiden yalniz matchWinner varsa engelleniyordu;
      // ama oyun uyelik aninda henuz bitmemisse (bot son hamleyi hemen sonra yapip kaybi
      // raporluyor) "uye oldum direkt maglubiyet" olusuyordu. Misafirden gecen tum bekleyen
      // maci blokla. (loadServerGame local guest oyununu zaten sifirlar; uyelik sonrasi
      // BASLATILAN gercek mac flag'i satir ~1158'de tekrar acar.) Profil duzenlemede
      // (user zaten dolu) DOKUNMA -> devam eden mesru mac raporlanabilsin.
      if (!user) ratingReportedRef.current = true
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
        onOpenMatchHistory={(matchId) => {
          setMatchHistInitialId(matchId ?? null)
          setEditProfile(false)
          setMatchHistOpen(true)
        }}
        onOpenAchievements={() => {
          setEditProfile(false)
          goPage(() => setAchOpen(true))
        }}
        onOpenShop={(shopTab) => {
          setEditProfile(false)
          goPage(() => {
            setShopTab(shopTab)
            setShopOpen(true)
          })
        }}
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
        {/* Genis ekranda wordmark + altinda slogan (tek satir, tam logo genisligi);
            mobilde kompakt sembol (yer acar). */}
        <span className="ab-logo-full">
          <span className="ab-brandlock">
            <TavlaTvLogo size={38} className="ab-wordmark" />
            {/* Slogan: duz HTML metin (SVG textLength=%100 hack'i Firefox'ta stretch/
                bozulma yapiyordu — fit-content ebeveyn icinde %100 min-width dairesel). */}
            <span className="ab-tag">{t('foot.tag')}</span>
          </span>
        </span>
        <span className="ab-logo-mark">
          <TavlaTvMark size={40} />
        </span>
      </button>
      {user ? (
        <>
        {/* DESKTOP (>=901px): eski satir ici bar (avatar+ad, coin, puan, odul, bildirim,
            Magaza, tema, dil). Mobilde gizli -> orada dropdown kullanilir. */}
        <div className="acct-desktop">
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
            {user.rating != null && (
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
          {rewardReady ? (
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
          )}
          {/* Mesajlar: bildirim zili gibi ust barda chat ikonu + okunmamis rozeti */}
          <Button
            variant="ghost"
            size="icon"
            className="relative [&_svg]:size-[24px]!"
            onClick={() => goPage(() => { setMessagesFocusId(null); setMessagesOpen(true) })}
            title={t('dm.title')}
            aria-label={t('dm.title')}
          >
            <Icon name="chat" size={24} />
            {dmUnread > 0 && <span className="notif-badge">{dmUnread > 9 ? '9+' : dmUnread}</span>}
          </Button>
          <NotificationBell
            items={notifications}
            unread={unreadNotif}
            onOpen={() => {
              setUnreadNotif(0)
              setNotifications((ns) => ns.map((n) => ({ ...n, read: true })))
              markNotificationsRead().catch(() => {})
            }}
            onDelete={handleDeleteNotification}
            onDeleteAll={handleDeleteAllNotifications}
          />
          <Button variant="outline" className="account-shop-btn" onClick={() => goPage(() => setShopOpen(true))}>
            <Icon name="shop" size={15} /> {t('shop.title')}
          </Button>
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
        {/* MOBIL (<=900px): SADECE avatar + ad. Tiklayinca dropdown. Desktopta gizli. */}
        <div className="account-menu acct-mobile" ref={acctMenuRef}>
          <button
            type="button"
            className={`acct-trigger ${acctMenuOpen ? 'open' : ''}`}
            onClick={toggleAcctMenu}
            aria-expanded={acctMenuOpen}
            aria-haspopup="menu"
            title={profile.nickname}
          >
            {/* Ad SOLDA; avatar (menu) en sagda kosede. */}
            <span className="acct-trigger-name">{profile.nickname}</span>
            {rewardReady && <span className="acct-trigger-dot" aria-hidden="true" />}
            <Icon name="chevron" size={16} className="acct-chev" />
            <AvatarFrame
              src={profile.avatar}
              frame={user?.avatar_frame}
              size={28}
              name={profile.nickname}
              className="account-avf"
            />
          </button>
          {acctMenuOpen && (
            <div className="acct-pop" role="menu" style={{ position: 'fixed', top: acctMenuPos.top, right: acctMenuPos.right }}>
              {/* Profilini Gor */}
              <button
                type="button"
                className="acct-row"
                role="menuitem"
                onClick={() => {
                  setAcctMenuOpen(false)
                  goPage(() => {
                    setProfileEditMode(false)
                    setEditProfile(true)
                  })
                }}
              >
                <Icon name="user" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('menu.viewProfile')}</span>
              </button>

              <div className="acct-div" />

              {/* Coin -> Magaza */}
              <button
                type="button"
                className="acct-row"
                role="menuitem"
                onClick={() => {
                  setAcctMenuOpen(false)
                  goPage(() => setShopOpen(true))
                }}
              >
                <Icon name="coin" size={18} className="acct-row-ic acct-ic-coin" />
                <span className="acct-row-l">{t('home.dash.coins')}</span>
                <b className="acct-row-v">{(user.coins ?? 0).toLocaleString('tr-TR')}</b>
              </button>

              {/* Rating (bilgi) */}
              {user.rating != null && (
                <div className="acct-row acct-row-static">
                  <Icon name="star" size={18} className="acct-row-ic acct-ic-rating" />
                  <span className="acct-row-l">{t('lb.rating')}</span>
                  <b className="acct-row-v">{user.rating.toLocaleString('tr-TR')}</b>
                </div>
              )}

              {/* Gunluk odul */}
              <button
                type="button"
                className={`acct-row ${rewardReady ? 'acct-row-hot' : ''}`}
                role="menuitem"
                disabled={!rewardReady}
                onClick={() => {
                  setAcctMenuOpen(false)
                  handleCoinClick()
                }}
              >
                <Icon name="gift" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('home.dash.daily')}</span>
                <span className="acct-row-v">
                  {rewardReady ? t('home.dash.claim') : fmtCountdown(rewardSecs)}
                </span>
              </button>

              {/* Mesajlar (sag ust chat ikonunun mobil karsiligi) */}
              <button
                type="button"
                className="acct-row"
                onClick={() => {
                  setAcctMenuOpen(false)
                  goPage(() => { setMessagesFocusId(null); setMessagesOpen(true) })
                }}
              >
                <Icon name="chat" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('dm.title')}</span>
                {dmUnread > 0 && <span className="acct-row-v">{dmUnread > 9 ? '9+' : dmUnread}</span>}
              </button>

              {/* Bildirimler (mevcut bell bileseni gomulu) */}
              <div className="acct-row acct-row-embed">
                <Icon name="bell" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('notif.title')}</span>
                <span className="acct-row-embed-c">
                  <NotificationBell
                    items={notifications}
                    unread={unreadNotif}
                    onOpen={() => {
                      // Okundu = SADECE okundu isaretle (silme YOK). Rozet 0'a duser;
                      // bildirimler kalir -> panelden veya Profilim > Bildirimler'den silinebilir.
                      setUnreadNotif(0)
                      setNotifications((ns) => ns.map((n) => ({ ...n, read: true })))
                      markNotificationsRead().catch(() => {})
                    }}
                    onDelete={handleDeleteNotification}
                    onDeleteAll={handleDeleteAllNotifications}
                  />
                </span>
              </div>

              {/* Magaza */}
              <button
                type="button"
                className="acct-row"
                role="menuitem"
                onClick={() => {
                  setAcctMenuOpen(false)
                  goPage(() => setShopOpen(true))
                }}
              >
                <Icon name="shop" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('shop.title')}</span>
              </button>

              <div className="acct-div" />

              {/* Tema */}
              <button
                type="button"
                className="acct-row"
                role="menuitem"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('menu.theme')}</span>
                <span className="acct-row-v">
                  {theme === 'dark' ? t('theme.light') : t('theme.dark')}
                </span>
              </button>

              {/* Dil (satir ici bayraklar) */}
              <div className="acct-row acct-row-lang">
                <Icon name="globe" size={18} className="acct-row-ic" />
                <span className="acct-row-l">{t('menu.language')}</span>
                <span className="acct-langs">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      className={`acct-lang ${l.code === lang ? 'on' : ''}`}
                      onClick={() => setLang(l.code)}
                      title={l.label}
                      aria-label={l.label}
                    >
                      <Flag code={l.code} size={20} />
                    </button>
                  ))}
                </span>
              </div>
            </div>
          )}
        </div>
        </>
      ) : (
        /* Misafir: Giris + tema + dil (dropdown yok) */
        <>
          <Button variant="default" onClick={() => setShowAuth(true)}>
            {t('account.auth')}
          </Button>
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
        </>
      )}
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
        <Icon name="menu" size={30} />
      </button>
      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}
    </>
  )

  // Yarim kalan (bitmemis) mac var mi -> menude "Aktif Oyunlar"
  const hasActiveGame = !matchOver && (turnsPlayed > 0 || !!gameEnd)
  hasActiveGameRef.current = hasActiveGame // popstate/URL navigasyonu guncel degeri okusun

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
    setAchOpen(false)
    setFriendSetupOpen(false)
    setTournOpen(false)
    setTournDetailId(null)
    setTournDetailSlug(null)
    setShopOpen(false)
    setCartOpen(false)
    setCheckoutOpen(false)
    setFrameGalleryOpen(false)
    setStatsOpen(false)
    setFriendsOpen(false)
    setMessagesOpen(false)
    setMessagesFocusId(null)
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
    // LOBI baglamina gec: sayfa home dalinda (sol menu + logo ile) acilsin. Aksi halde
    // bayat mode==='online'/bitmis oyun kaldiysa sayfa game-view'da (sidebar'siz, yuzen
    // hamburger ile) aciliyordu. Aktif oyun yoksa online oda/state'i de temizle.
    if (!hasActiveGame) {
      setMode('pvb')
      setRoom(null)
    }
    setHome(true)
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
    // Arkadasinla Oyna: once "Ozel Oyun Olustur" ekrani (Tek oyun/Maç + Saat + Uzunluk),
    // onaylayinca davet-kodlu oda olusturulur. Matchmaking'e (rastgele rakip) sokMAZ.
    onPlayFriend: () => {
      closeAllPages()
      setFriendSetupOpen(true)
    },
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
    onAchievements: () => goPage(() => setAchOpen(true)),
    onTournaments: () =>
      goPage(() => {
        setTournDetailId(null) // menuden liste (varsa eski detay kapansin)
        setTournDetailSlug(null)
        setTournOpen(true)
      }),
    // Ana sayfa reklamindan: dogrudan ilgili turnuvanin detayini ac (slug detay yuklenince yukselir)
    onTournamentAd: (id: number) =>
      goPage(() => {
        setTournDetailId(id)
        setTournDetailSlug(String(id))
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
    onMessages: () => goPage(() => { setMessagesFocusId(null); setMessagesOpen(true) }),
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
    // Belirli bir haberin detayini ac (/haberler/<slug>): liste yerine dogrudan detay.
    onOpenNews: (slug: string) => goPage(() => { setContentView('news'); setNewsSlug(slug) }),
    onMagazine: () => goPage(() => setContentView('magazine')),
    onQuiz: () => goPage(() => setQuizOpen(true)),
  }

  // Sol menu ogeleri MERKEZI SAYFA KAYDINDAN (pages.ts) turetilir. Handler'lar menuProps'tan
  // eslenir; gorunurluk: inMenu + handler tanimli mi ( or. premium'da onMembership undefined)
  // + gate ('user' -> giris). hideInGame filtresini SideMenu kendi inGame'ine gore uygular.
  const pageHandlers: Record<string, (() => void) | undefined> = {
    solo: menuProps.onSolo,
    match: menuProps.onNewGame,
    aiGame: menuProps.onAiGame,
    playFriend: menuProps.onPlayFriend,
    tournaments: menuProps.onTournaments,
    leaderboard: menuProps.onLeaderboard,
    friends: menuProps.onFriends,
    messages: menuProps.onMessages,
    membership: menuProps.onMembership,
    calendar: menuProps.onCalendar,
    clubs: menuProps.onClubs,
    news: menuProps.onNews,
    magazine: menuProps.onMagazine,
    analyzer: menuProps.onAnalyzer,
    blunders: menuProps.onBlunders,
    matchHistory: menuProps.onMatchHistory,
    info: menuProps.onInfo,
  }
  // Admin panelden (menu_items) override'lar: ozel ad (o dilde), gorunurluk, sira.
  const menuLabel = (key: string): string | undefined => menuOverrides[key]?.labels?.[lang]
  const menuVisible = (key: string): boolean => menuOverrides[key]?.visible !== false
  const menuSort = (key: string, fallback: number): number => menuOverrides[key]?.sort ?? fallback

  // Footer kolonlari — merkezi kayittan (pages.ts). Handler/gate menu ile ayni mantik.
  const footerColumns = [
    { titleKey: 'foot.game', keys: ['solo', 'match', 'aiGame', 'playFriend'] },
    { titleKey: 'foot.community', keys: ['tournaments', 'leaderboard', 'friends', 'calendar', 'clubs'] },
    { titleKey: 'foot.content', keys: ['news', 'magazine'] },
  ].map((col) => ({
    titleKey: col.titleKey,
    items: col.keys
      .map((k) => PAGE_BY_KEY[k])
      .filter((pg) => pg && !!pageHandlers[pg.key] && (pg.gate !== 'user' || !!user) && menuVisible(pg.key))
      .map((pg): FooterItem => ({
        key: pg.key,
        labelKey: pg.labelKey,
        label: menuLabel(pg.key),
        onClick: pageHandlers[pg.key]!,
      })),
  }))
  // 4. kolon: "Bilgi" sayfasinin sekmeleri -> Info'yu ilgili sekmede acar.
  const openInfoTab = (tab: 'about' | 'ranks' | 'fair' | 'services' | 'badges') => {
    setInfoTab(tab)
    goPage(() => setInfoOpen(true))
  }
  footerColumns.push({
    titleKey: 'menu.info',
    items: [
      { key: 'info-about', labelKey: 'info.tab.about', onClick: () => openInfoTab('about') },
      { key: 'info-services', labelKey: 'menu.services', onClick: () => openInfoTab('services') },
      { key: 'info-ranks', labelKey: 'menu.ranks', onClick: () => openInfoTab('ranks') },
      { key: 'info-badges', labelKey: 'ach.title', onClick: () => openInfoTab('badges') },
      { key: 'info-fair', labelKey: 'fair.title', onClick: () => openInfoTab('fair') },
    ],
  })

  // Sol menu: admin sirasi (menu_items.sort) global uygulanir -> pages.ts genelinde tek
  // duz liste sirala, sonra ARDISIK ayni-grup kosularina bol (divider'lar korunur). Ozel
  // ad varsa i18n'i ezer; gorunurlugu kapali ogeler dusurulur. Override yoksa pages.ts sirasi.
  const orderedPages = PAGES.map((pg, i) => ({ pg, i }))
    .filter(
      ({ pg }) =>
        pg.inMenu !== false &&
        !!pageHandlers[pg.key] &&
        (pg.gate !== 'user' || !!user) &&
        menuVisible(pg.key),
    )
    .sort((a, b) => menuSort(a.pg.key, a.i) - menuSort(b.pg.key, b.i))

  const menuGroups: { group: MenuGroup; items: NavItem[] }[] = []
  for (const { pg } of orderedPages) {
    const item: NavItem = {
      key: pg.key,
      labelKey: pg.labelKey,
      label: menuLabel(pg.key),
      icon: pg.icon,
      onClick: pageHandlers[pg.key]!,
      hideInGame: pg.hideInGame,
    }
    const last = menuGroups[menuGroups.length - 1]
    if (last && last.group === pg.group) last.items.push(item)
    else menuGroups.push({ group: pg.group, items: [item] })
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
    cartOpen ||
    checkoutOpen ||
    frameGalleryOpen ||
    statsOpen ||
    friendsOpen ||
    messagesOpen ||
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
    achOpen ||
    friendSetupOpen ||
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
            : messagesOpen
              ? 'messages'
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
                      : friendSetupOpen
                        ? 'playFriend'
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
      {achUnlocked.length > 0 && (
        <AchievementUnlock
          items={achUnlocked}
          onClose={() => setAchUnlocked([])}
          onView={() => {
            setAchUnlocked([])
            goPage(() => setAchOpen(true))
          }}
        />
      )}
      {editProfilePage}
      {friendsOpen && user && (
        <Friends
          onInvite={handleInviteFriend}
          onMessage={(uid) => {
            setFriendsOpen(false)
            setMessagesFocusId(uid)
            setMessagesOpen(true)
          }}
          onClose={() => setFriendsOpen(false)}
        />
      )}
      {messagesOpen && user && (
        <Messages
          focusUserId={messagesFocusId}
          onRead={() => refreshDmUnread()}
          onClose={() => {
            setMessagesOpen(false)
            setMessagesFocusId(null)
          }}
        />
      )}
      {leaderboardOpen && (
        <Leaderboard currentName={profile.nickname} onClose={() => setLeaderboardOpen(false)} />
      )}
      {achOpen && <Achievements loggedIn={!!user} onClose={() => setAchOpen(false)} />}
      {infoOpen && (
        <Info
          onClose={() => setInfoOpen(false)}
          currentRating={user?.rating ?? undefined}
          loggedIn={!!user}
          initialTab={infoTab}
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
            // Coin paketini sepete ekle (varsa adedini arttir) -> sepete yonlendir.
            setCartItems((prev) => {
              const ex = prev.find((c) => c.id === pkgId)
              return ex
                ? prev.map((c) => (c.id === pkgId ? { ...c, qty: c.qty + 1 } : c))
                : [...prev, { id: pkgId, qty: 1 }]
            })
            setShopOpen(false)
            setCartOpen(true)
          }}
          cartCount={cartItems.reduce((s, c) => s + c.qty, 0)}
          onOpenCart={() => {
            setShopOpen(false)
            setCartOpen(true)
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
      {cartOpen && user && (
        <Cart
          items={cartItems}
          setItems={setCartItems}
          onClose={() => setCartOpen(false)}
          onContinue={() => {
            // "Alışverişe devam" -> Mağaza coin sekmesi
            setCartOpen(false)
            setShopTab('coins')
            setShopOpen(true)
          }}
          onCheckout={async (its) => {
            // Odeme kaydi olustur (fiyat sunucuda), imzali submitUrl al -> uygulama-ici odeme sayfasi
            const r = await buyCoins(its)
            setCheckoutData({ submitUrl: r.submitUrl, amount: r.amount, coins: r.coins, items: its, demo: r.demo })
            setCartOpen(false)
            setCheckoutOpen(true)
          }}
        />
      )}
      {checkoutOpen && user && checkoutData && (
        <Checkout
          submitUrl={checkoutData.submitUrl}
          amount={checkoutData.amount}
          coins={checkoutData.coins}
          items={checkoutData.items}
          demo={checkoutData.demo}
          onBack={() => {
            setCheckoutOpen(false)
            setCartOpen(true)
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
          onOpenDetail={(id, slug) => {
            setTournDetailId(id)
            setTournDetailSlug(id != null ? slug ?? String(id) : null)
          }}
          onClose={() => {
            setTournOpen(false)
            setTournDetailId(null)
            setTournDetailSlug(null)
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
          onPick={startSoloStake}
          onClose={() => setSoloOpen(false)}
        />
      )}
      {blunderOpen && user && premium && <ErrorJournal onClose={() => setBlunderOpen(false)} />}
      {matchHistOpen && user && (
        <MatchAnalytics
          myName={profile.nickname}
          myAvatar={profile.avatar ?? null}
          initialMatchId={matchHistInitialId ?? undefined}
          onClose={() => {
            setMatchHistOpen(false)
            setMatchHistInitialId(null)
          }}
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
          // KURAL: sayfa basligi = menu etiketi. Menude admin yeniden adlandirmissa
          // (override) baslik da onu alsin; override yoksa ContentView i18n'e duser.
          titleOverride={menuLabel(
            ({ event: 'calendar', news: 'news', magazine: 'magazine', club: 'clubs' } as Record<string, string>)[
              contentView
            ] ?? '',
          )}
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
        <PublicProfile
          id={homeProfileId}
          onClose={() => setHomeProfileId(null)}
          onAddFriend={
            user && user.id !== homeProfileId
              ? () => handleAddFriend(homeProfileId)
              : undefined
          }
        />
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
            hasActiveGame={hasActiveGame}
            groups={menuGroups}
            onResume={menuProps.onResume}
            active={activeKey}
            badges={{ messages: dmUnread }}
            mobileOpen={menuOpen}
            onCloseMobile={() => setMenuOpen(false)}
            onHome={menuProps.onHome}
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

  // Arkadasinla oyna kurulum ekrani. YZ ile Oyna (setup) ile AYNI sayfa duzeni:
  // sol menu gorunur, kurulum (setup-split + board onizleme) icerik alaninda acilir.
  if (friendSetupOpen) {
    return (
      <>
        {mobileNav}
        <div className="app lobby">
          {accountBar}
          <SideMenu
            inGame={false}
            hasActiveGame={hasActiveGame}
            groups={menuGroups}
            onResume={menuProps.onResume}
            active={activeKey}
            badges={{ messages: dmUnread }}
            mobileOpen={menuOpen}
            onCloseMobile={() => setMenuOpen(false)}
            onHome={menuProps.onHome}
          />
          <main className="main lobby-main has-page">
            <div className="page-host">
              <FriendGameSetup
                board={(() => {
                  const bt = ALL_THEMES.find((x) => x.id === boardTheme) ?? BOARD_THEMES[0]
                  return { panel: bt.panel ?? bt.b, a: bt.a, b: bt.b, checker: bt.checker }
                })()}
                onChangeBoard={() => setBoardPickerOpen(true)}
                onCancel={() => setFriendSetupOpen(false)}
                onCreate={({ target, timeControl }) => {
                  setFriendSetupOpen(false)
                  setTimeControl(timeControl)
                  clockRef.current = CLOCK_PRESETS[timeControl]
                  onlineTargetRef.current = target
                  targetsRef.current = [target]
                  setMode('online')
                  setHome(false)
                  handleCreateRoom(target, timeControl)
                }}
                onJoin={(code) => {
                  // Arkadasin kodu: navigasyonu ERKEN yapma. Kod gecerliyse handleJoinRoom
                  // online'a gecirir; gecersizse (404) kurulum ekraninda kalip toast ile
                  // "boyle bir oda yok" der (eskiden bogus bir maca dusuyordu).
                  handleJoinRoom(code)
                }}
              />
            </div>
          </main>
        </div>
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
        <div className="app lobby">
          {accountBar}
          <SideMenu
            inGame={false}
            hasActiveGame={hasActiveGame}
            groups={menuGroups}
            onResume={menuProps.onResume}
            active={activeKey}
            badges={{ messages: dmUnread }}
            mobileOpen={menuOpen}
            onCloseMobile={() => setMenuOpen(false)}
            onHome={menuProps.onHome}
          />
          <main className={`main lobby-main ${anyPageOpen ? 'has-page' : ''}`}>
            {anyPageOpen ? (
              <div className="page-host">{menuPages}</div>
            ) : (
            <>
            <BannerSlider onOpen={menuProps.onTournamentAd} />
            {activeRooms.length > 0 && (
              <div className="resume-match-bar">
                {activeRooms.map((r) => {
                  // Skor {white,black}; kendi rengim slot'a bagli (p2=siyah). Bari
                  // "kendi–rakip" gosterecek sekilde kendi skorumu one al.
                  const myScore = r.score ? (r.slot === 'p2' ? r.score.black : r.score.white) : null
                  const oppScore = r.score ? (r.slot === 'p2' ? r.score.white : r.score.black) : null
                  const myName = profile.nickname || t('resume.you')
                  const oppName = r.opp_name || t('mp.title')
                  return (
                    <button key={r.code} className="resume-match-btn" onClick={() => rejoinRoom(r)}>
                      <span className="rm-live"><span className="live-dot" /> {t('resume.active')}</span>
                      <span className="rm-opp">
                        <span className="rm-players">
                          <span className="rm-me">
                            <AvatarFrame src={profile.avatar} frame={user?.avatar_frame} size={26} name={myName} className="rm-avf" />
                            {myName}
                          </span>
                          <span className="rm-vs">vs</span>
                          <span className="rm-you">
                            <AvatarFrame src={r.opp_avatar} size={26} name={oppName} className="rm-avf" />
                            {oppName}
                            {typeof r.opp_rating === 'number' && (
                              <span className="rm-rat"> {r.opp_rating}</span>
                            )}
                          </span>
                        </span>
                        {myScore != null && (
                          <b className="rm-score">{myScore}–{oppScore}</b>
                        )}
                        {r.target ? (
                          <span className="rm-len">{t('resume.point', { n: r.target })}</span>
                        ) : null}
                      </span>
                      <span className="rm-cta"><Icon name="play" size={14} /> {t('resume.return')}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {/* Online devam eden mac varsa (resume-match-bar) tekrar buton cikarma:
                online maçta yalnız "Geri Dön" kalsın, "Oyuna Devam Et" gizli. */}
            {hasActiveGame && activeRooms.length === 0 && (
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
            <AdStrip slot="top" />
            <div className="home-cal-wrap">
              {/* SOL: Online Turnuvalar (ust) + Turnuva Takvimi (alt). SAG: Haberler. */}
              <div className="home-cal-main">
                <TournamentsPanel tourns={lobbyTourns} onOpen={menuProps.onTournaments} />
                <CalendarPanel tourns={lobbyTourns} onOpen={menuProps.onCalendar} title={menuLabel('calendar') ?? t('menu.calendar')} />
              </div>
              {/* SAG kolon: Haberler (ust) + Liderlik Tablosu (Takvim'in yanina) */}
              <div className="home-cal-side">
                <NewsPanel onOpen={menuProps.onNews} onOpenNews={menuProps.onOpenNews} />
                <RankingPanel
                  currentName={profile.nickname}
                  onProfile={(id) => setHomeProfileId(id)}
                  onOpen={menuProps.onLeaderboard}
                />
              </div>
            </div>
            <AdStrip slot="middle" />
            {!user && (
              <section className="lobby-hero">
                <div className="hero-copy">
                  <span className="hero-kicker">
                    <Icon name="dice" size={15} /> {t('home.heroKicker')}
                  </span>
                  <h1 className="hero-title">{t('home.heroTitle')}</h1>
                </div>
              </section>
            )}
            <div className="home-panels">
              <LiveMatchesPanel
                onSpectate={(code, p1, p2) => setSpectate({ code, p1, p2 })}
              />
              <OnlinePlayersPanel
                currentName={profile.nickname}
                onProfile={(id) => setHomeProfileId(id)}
                onInvite={user ? handleInviteFriend : undefined}
              />
            </div>
            {!user && <HomeFeatures onPlay={menuProps.onAiGame} />}
            <AdStrip slot="bottom" />
            </>
            )}
          </main>
          {/* Footer TUM lobi sayfalarinda (home + menu sayfalari). .app.lobby kaydirma
              konteyneri (100dvh) oldugu icin ICINDE kalir; CSS ile iki kolonu birden
              kapsar (grid-column: 1/-1) -> TAM GENISLIK, en altta. */}
          <Footer columns={footerColumns} />
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
  // YALNIZCA gercek bir oda VAR ya da eslesme/oda-kurma SURUYOR (roomBusy) iken bu dala
  // gir. Aksi halde (bayat mode==='online' + room=null, orn. iptal/hata sonrasi) burasi
  // devreye girip KULLANILMAYAN "Online Oyun" secim ekranini gosteriyordu (sorunlarin
  // koku). Artik o ekran hicbir akista gorunmez; setup/solo/home dallari devralir.
  if (mode === 'online' && !matchOver && (room !== null || roomBusy) && (!room || room.status !== 'playing')) {
    // Oda olustur/bekle/arama: FIXED tam-ekran overlay YERINE lobi kabugu (logo + sol
    // menu) icinde GOMULU goster -> menu/logo/sayfa kaybolmaz (kullanici geri bildirimi).
    return (
      <>
        {mobileNav}
        <div className="app lobby">
          {accountBar}
          <SideMenu
            inGame={false}
            hasActiveGame={hasActiveGame}
            groups={menuGroups}
            onResume={menuProps.onResume}
            active={activeKey}
            badges={{ messages: dmUnread }}
            mobileOpen={menuOpen}
            onCloseMobile={() => setMenuOpen(false)}
            onHome={menuProps.onHome}
          />
          <main className="main lobby-main">
            <Lobby
              embedded
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
          </main>
          <Footer columns={footerColumns} />
        </div>
        {authModal}
        {menuOverlays}
      </>
    )
  }

  // GÜVENLİK AĞI (board FLASH fix): online modda GERÇEK oyun yoksa (oda 'playing' değil + maç
  // bitmedi) game-view'ı (board) RENDER ETME. "Tek Oyun Başla → bir an board görünüp arama
  // ekranına geçme" bug'ı: Start geçişinde roomBusy daha true olmadan (veya bayat mode='online'
  // + room=null iken) bu dala düşüp VARSAYILAN board'u (opening='roll') bir kare gösteriyordu.
  // Aranırken/bekleme odasında roomBusy/oda dalı (yukarıda) zaten arama ekranını gösterir; buraya
  // yalnız geçiş/bayat kare düşer -> board YERİNE boş bırak (bir sonraki render arama/home devralır).
  // NOT: room===null'a daralt -> 'waiting'/'playing'/'finished' odalar (arama dalı + sonuç ekranı)
  // ETKİLENMEZ; yalnız oda YOKKEN (Start geçişi / bayat online) board flash'ı engellenir.
  if (mode === 'online' && !matchOver && room === null) {
    return <div className="app game-view" aria-hidden />
  }

  const showHintUI =
    mode === 'pvb' && interactive && diceRolled && !gameWon && remainingDice.length > 0

  return (
    <div className="app game-view">
      {accountBar}
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
      {/* Kup danismani: SADECE ogrenme modunda ve ogrenme mesajinin ciktigi sol-alt konumda */}
      {learnMode && humanCanDouble && cubeHint?.kind === 'offer' && (
        <div className="cube-hint-fixed">
          <div
            className={`cube-advice ${cubeHint.action === 'no-double' ? 'muted' : 'ok'}`}
          >
            <Icon name="bulb" size={14} />
            {t(`cube.adv.${cubeHint.action}`)} · {t('cube.win')}{' '}
            {cubeHint.winPct.toFixed(0)}%
          </div>
        </div>
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
        {/* Maç ID (sol üst): oynanan maçın kimliği — admin panelde bu ID ile bulunur */}
        {recordUid && (
          <div className="match-id-hud" title={t('log.matchId')}>
            <span className="match-id-hud__label">{t('log.matchId')}</span>
            <span className="match-id-hud__code">#{recordUid}</span>
          </div>
        )}
        {/* Board flip'lendiginde (yerel oyuncu siyah) kartlar da cevrilir: SEN hep altta */}
        <Sidebar
          top={flipBoard ? bottomInfo : topInfo}
          bottom={flipBoard ? topInfo : bottomInfo}
          length={match.target}
          stake={stakeRef.current}
        />
        {clockOn && (
          <ClockStack
            active={gameWon || gameEnd || opening ? null : turnStart.turn}
            delay={clock.delay}
            white={clock.white}
            black={clock.black}
            final={FINAL_STAGE}
            flip={flipBoard}
            topScore={flipBoard ? match.score.white : match.score.black}
            bottomScore={flipBoard ? match.score.black : match.score.white}
          />
        )}
        <Board
          state={boardDisplay}
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
        {/* Oda kodu alttan kaldırıldı: MAÇ ID zaten sol üst HUD'da gösteriliyor (tekrar). */}
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
          winnerPr={prShown(mWinner)}
          loserPr={prShown(opponent(mWinner))}
          winnerCheckerPr={prCheckerOf(mWinner)}
          winnerCubePr={prCubeOf(mWinner)}
          loserCheckerPr={prCheckerOf(opponent(mWinner))}
          loserCubePr={prCubeOf(opponent(mWinner))}
          winnerBand={t(prBand(prShown(mWinner)))}
          loserBand={t(prBand(prShown(opponent(mWinner))))}
          winnerLuck={luckOf(mWinner)}
          loserLuck={luckOf(opponent(mWinner))}
          coinAmount={coinDelta == null ? null : Math.abs(coinDelta)}
          ratingBefore={ratingChange?.before ?? null}
          ratingAfter={ratingChange?.after ?? null}
          ratingIsWinner={prHumanColor === mWinner}
          oppRating={mode === 'pvb' ? 900 + difficulty * 100 : (room?.oppRating ?? null)}
          // Rakip rating değişimi: online PUANLI maçta Elo sıfır-toplamlı -> -(kendi delta). pvb
          // (AI kalıcı rating yok) veya puansız -> null. Her iki ekranda TUTARLI (deterministik).
          oppRatingDelta={
            mode !== 'pvb' && !friendlyRef.current && ratingChange
              ? -Math.round(ratingChange.after - ratingChange.before)
              : null
          }
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
            <div className="resign-auto">
              <b>{t('resign.losePts', { n: match.cube.value })}</b>
            </div>
            <Button variant="destructive" onClick={handleResign}>
              <Icon name="flag" /> {t('resign.confirm')}
            </Button>
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
