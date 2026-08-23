import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
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
import { FRAMES, frameStyle } from './cosmetics'
import { Sound, isMuted, setMuted } from './sound'
import { evaluatePosition, pipCount } from './engine/evaluate'
import {
  canDouble,
  matchWinner,
  newMatch,
  scoreGame,
  setupNextGame,
  type MatchState,
} from './engine/match'
import { cubeAdvice, takeDecision, type CubeAction, type TakeAction } from './engine/cube'
import Board from './ui/Board'
import Sidebar from './ui/Sidebar'
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
  inviteFriend,
  respondInvite,
  type GameInvite as GameInviteT,
  type AppNotification,
  type TournNotice as TournNoticeT,
  showRoom,
  updateRoom,
  sendChat,
  reportRating,
  ApiError as ApiErr,
  type Slot,
  type ChatMsg,
} from './api'
import Chat from './ui/Chat'
import ClockStack from './ui/ClockStack'
import BoardSettings from './ui/BoardSettings'
import PositionAnalyzer from './ui/PositionAnalyzer'
import SideMenu from './ui/SideMenu'
import { Icon } from './ui/Icon'
import GameMenu from './ui/GameMenu'
import Leaderboard from './ui/Leaderboard'
import ProfileStats from './ui/ProfileStats'
import FairnessModal from './ui/FairnessModal'
import Friends from './ui/Friends'
import Lessons from './ui/Lessons'
import Tournaments from './ui/Tournaments'
import SoloStakes from './ui/SoloStakes'
import BlunderLog from './ui/BlunderLog'
import ContentView from './ui/ContentView'
import QuizPlay from './ui/QuizPlay'
import Clubs from './ui/Clubs'
import Rules from './ui/Rules'
import NotificationBell from './ui/NotificationBell'
import type { ContentType } from './api'
import Shop from './ui/Shop'
import MatchResult from './ui/MatchResult'
import MatchReport from './ui/MatchReport'
import { LiveMatchesPanel, RankingPanel } from './ui/HomePanels'
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
  type Profile,
  type SavedGame,
  type MoveLogEntry,
} from './storage'
import { useT, LANGS } from './i18n'
import {
  getToken,
  loadServerGame,
  logout as apiLogout,
  deleteAccount as apiDeleteAccount,
  me as apiMe,
  saveServerGame,
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
  status: 'waiting' | 'mm_waiting' | 'playing' | 'finished'
}
const BOT_PLAYER: Player = 'black'
const TARGETS = [1, 3, 5, 7, 9, 11, 13, 15, 21, 25] // Galaxy: 1-25 puanlik maclar

// Board renk temalari (panel zemin, acik ucgen, koyu ucgen, koyu pul)
interface BoardTheme {
  id: string
  name: string
  panel: string
  a: string
  b: string
  checker: string // koyu pul rengi (temaya uyar)
  price?: number // coin ile acilan premium tema (yoksa ucretsiz)
}
// UI/UX Pro Max renk paletlerinden 20 tahta. Isimler paletlerden alindi.
// id 'tavla' varsayilan capa olarak kalir (eski kayitlar/geri uyumluluk).
const BOARD_THEMES: BoardTheme[] = [
  { id: 'tavla', name: 'Latte', panel: '#e6e9ef', a: '#dd7878', b: '#ccd0da', checker: '#4c4f69' },
  { id: 'nord', name: 'Nord', panel: '#3b4252', a: '#88c0d0', b: '#2e3440', checker: '#4c566a' },
  { id: 'dracula', name: 'Dracula', panel: '#282a36', a: '#bd93f9', b: '#44475a', checker: '#6272a4' },
  { id: 'gruvbox', name: 'Gruvbox', panel: '#3c3836', a: '#d79921', b: '#282828', checker: '#504945' },
  { id: 'solarized', name: 'Solarized', panel: '#073642', a: '#b58900', b: '#002b36', checker: '#586e75' },
  { id: 'tokyonight', name: 'Tokyo Night', panel: '#24283b', a: '#7aa2f7', b: '#1a1b26', checker: '#414868' },
  { id: 'rosepine', name: 'Rosé Pine', panel: '#26233a', a: '#ebbcba', b: '#1f1d2e', checker: '#6e6a86' },
  { id: 'mocha', name: 'Mocha', panel: '#313244', a: '#f5c2e7', b: '#1e1e2e', checker: '#585b70' },
  { id: 'monokai', name: 'Monokai', panel: '#3e3d32', a: '#a6e22e', b: '#272822', checker: '#75715e' },
  { id: 'everforest', name: 'Everforest', panel: '#374145', a: '#a7c080', b: '#2b3339', checker: '#4f5b58' },
  { id: 'ayu', name: 'Ayu', panel: '#1f2430', a: '#ffcc66', b: '#171b24', checker: '#444a55' },
  { id: 'onedark', name: 'One Dark', panel: '#3a3f4b', a: '#61afef', b: '#282c34', checker: '#4b5263' },
  { id: 'nightowl', name: 'Night Owl', panel: '#1d3b53', a: '#82aaff', b: '#011627', checker: '#365069' },
  { id: 'synthwave', name: 'Synthwave', panel: '#2b213a', a: '#ff7edb', b: '#1a1526', checker: '#5a4b7c' },
  { id: 'horizon', name: 'Horizon', panel: '#2e303e', a: '#e95678', b: '#1c1e26', checker: '#4d4f5c' },
  { id: 'palenight', name: 'Palenight', panel: '#292d3e', a: '#c792ea', b: '#1c1f2b', checker: '#4a4f66' },
  { id: 'oceanic', name: 'Oceanic', panel: '#263238', a: '#6699cc', b: '#1b2b34', checker: '#405860' },
  { id: 'gruvlight', name: 'Gruvbox Light', panel: '#ebdbb2', a: '#d79921', b: '#bdae93', checker: '#504945' },
  { id: 'sollight', name: 'Solarized Light', panel: '#eee8d5', a: '#268bd2', b: '#93a1a1', checker: '#586e75' },
  { id: 'dawn', name: 'Dawn', panel: '#faf4ed', a: '#d7827e', b: '#dfdad9', checker: '#575279' },
]
// Premium tahta temalari (coin ile acilir). id 'gold' -> magaza 'theme.gold'
const PREMIUM_THEMES: BoardTheme[] = [
  { id: 'ocean', name: 'Okyanus', panel: '#1f6f8b', a: '#3fa9c9', b: '#144f63', checker: '#0e5a70', price: 300 },
  { id: 'gold', name: 'Altın', panel: '#b8912f', a: '#e8c14a', b: '#8a6a1a', checker: '#7a5f14', price: 500 },
  { id: 'sunset', name: 'Gün Batımı', panel: '#c25a3a', a: '#f0894f', b: '#8f3a22', checker: '#a3401f', price: 600 },
  { id: 'neon', name: 'Neon', panel: '#2a2a4a', a: '#18e0c0', b: '#7a1fb0', checker: '#00b0ff', price: 800 },
]
const ALL_THEMES: BoardTheme[] = [...BOARD_THEMES, ...PREMIUM_THEMES]

// Bot temposu (ms) - daha yuksek = daha yavas/dogal
const BOT_ROLL_DELAY = 900 // zar atmadan once
const BOT_MOVE_DELAY = 600 // dusunme (ilk tas oynanmadan once)
const BOT_STEP_DELAY = 650 // her tas arasi
const BOT_END_DELAY = 450 // son tastan sonra sira gecmeden once

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
const CLOCK_PRESETS: Record<TimeControl, { move: number; over: number }> = {
  casual: { move: 15, over: 180 }, // Casual: 15sn/hamle + 3dk rezerv
  normal: { move: 10, over: 60 }, // Normal: 10sn/hamle + 1dk rezerv
  speed: { move: 8, over: 20 }, // Speed: 8sn/hamle + 20sn rezerv
}
const FINAL_STAGE = 30 // son asama uyari esigi (sn)
const MOVE_DELAY = CLOCK_PRESETS.normal.move // varsayilan/fallback
const OVER_TOTAL = CLOCK_PRESETS.normal.over

export default function App() {
  const { t, lang, setLang } = useT()
  const pName = (p: Player) => t(p === 'white' ? 'player.white' : 'player.black')
  const [saved] = useState(() => loadGame())
  const [user, setUser] = useState<ServerUser | null>(null)
  const [guestProfile, setGuestProfile] = useState<Profile | null>(() => loadProfile())
  const [authChecked, setAuthChecked] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
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
      // TavlaTv marka birincil kimligi krem/acik tema -> varsayilan 'light'
      return localStorage.getItem('tavla.theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  const [boardTheme, setBoardTheme] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('tavla.board')
      // Rebrand migration: eski varsayilan tahtalari (blue/walnut) bir kez TavlaTv'ye tasi
      if (!localStorage.getItem('tavla.board.rebrand')) {
        localStorage.setItem('tavla.board.rebrand', '1')
        if (!stored || stored === 'blue' || stored === 'walnut') {
          localStorage.setItem('tavla.board', 'tavla')
          return 'tavla'
        }
      }
      return stored || 'tavla'
    } catch {
      return 'tavla'
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
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false) // tahta rengi modali
  const [analyzerOpen, setAnalyzerOpen] = useState(false) // pozisyon analiz modulu
  const [leaderboardOpen, setLeaderboardOpen] = useState(false) // liderlik tablosu modali
  const [statsOpen, setStatsOpen] = useState(false) // istatistiklerim modali
  const [fairOpen, setFairOpen] = useState(false) // adil zar modali
  const [friendsOpen, setFriendsOpen] = useState(false) // arkadaslar modali
  const [lessonsOpen, setLessonsOpen] = useState(false) // dersler modali
  const [tournOpen, setTournOpen] = useState(false) // turnuvalar modali
  const [soloOpen, setSoloOpen] = useState(false) // Tek Oyun bahis gridi
  const [blunderOpen, setBlunderOpen] = useState(false) // hata gunlugu
  const [contentView, setContentView] = useState<ContentType | null>(null) // acik icerik sayfasi
  const [quizOpen, setQuizOpen] = useState(false) // quiz oynanis
  const [clubsOpen, setClubsOpen] = useState(false) // kulupler + lig
  const [rulesOpen, setRulesOpen] = useState(false) // nasil oynanir rehberi
  const [spectate, setSpectate] = useState<{ code: string; p1: string; p2: string } | null>(null)
  const [homeProfileId, setHomeProfileId] = useState<number | null>(null) // lobi siralamasindan profil
  const [memOpen, setMemOpen] = useState(false) // uyelik yukseltme modali
  const stakeRef = useRef(0) // aktif bahisli online oyunun tutari (0 = bahissiz)
  const minRatingRef = useRef(0) // Mac Oyunu: rakip min puan filtresi
  const betPctRef = useRef(0) // Mac Oyunu: bahis = bakiyenin %'si (0 = pct bahis yok)
  const [shopOpen, setShopOpen] = useState(false) // magaza modali
  const [invites, setInvites] = useState<GameInviteT[]>([]) // gelen oyun davetleri
  const [tournNotices, setTournNotices] = useState<TournNoticeT[]>([]) // sirasi gelen turnuva maclari
  const [notifications, setNotifications] = useState<AppNotification[]>([]) // sistem bildirimleri
  const [unreadNotif, setUnreadNotif] = useState(0) // okunmamis bildirim sayisi (can rozeti)
  const [rewardReady, setRewardReady] = useState(false) // 6 saatlik odul hazir mi
  const [rewardSecs, setRewardSecs] = useState(0) // sonraki odule kalan saniye (geri sayim)
  const installPromptRef = useRef<{ prompt: () => void } | null>(null)
  const [canInstall, setCanInstall] = useState(false) // PWA yuklenebilir mi
  // Acilista her zaman ana menu; kayitli oyun varsa menude "Aktif Oyunlar" ile devam edilir
  const [home, setHome] = useState(true)
  const [lobbyTourns, setLobbyTourns] = useState<Tournament[]>([]) // lobide gosterilen aktif turnuvalar
  const [timeControl, setTimeControl] = useState<TimeControl>('normal')
  const [rankedMatch, setRankedMatch] = useState(true) // false = casual (puana etki etmez)
  const clockRef = useRef(CLOCK_PRESETS.normal) // secili saat preseti (delay/over)
  const onlineTargetRef = useRef(1) // online oda kurulunca kullanilacak mac uzunlugu
  // Saat: hamle gecikmesi (delay, her tur sifirlanir) + oyuncu-basi rezerv bankasi
  // (white/black; maca gore kurulur, turlar boyunca tukenir - Galaxy tarzi).
  const [clock, setClock] = useState<{ delay: number; white: number; black: number }>({
    delay: MOVE_DELAY,
    white: OVER_TOTAL,
    black: OVER_TOTAL,
  })
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
  // Sans (luck): oyuncu-basi birikmis equity sansi (zarlarin sanslilik toplami)
  const [prLuck, setPrLuck] = useState<{ white: number; black: number }>({ white: 0, black: 0 })
  const luckSigRef = useRef('') // ayni turda sansi iki kez saymayi engelle
  const [coinDelta, setCoinDelta] = useState<number | null>(null) // bahisli macta kazanan coin transferi
  const [ratingChange, setRatingChange] = useState<{ before: number; after: number } | null>(null)
  // Mac gunlugu (insanin kararlari): rapor/istatistik icin
  const [matchLog, setMatchLog] = useState<MoveLogEntry[]>([])
  const [resultView, setResultView] = useState<null | 'stats' | 'analysis'>(null) // rapor modali
  const [lastError, setLastError] = useState<MoveError | null>(null)
  const heuristicRef = useRef(new HeuristicBot())
  const neuralRef = useRef(new NeuralBot())
  const fairRef = useRef(new FairDice()) // adil (dogrulanabilir) zar ureticisi
  const tournMatchRef = useRef<{ tid: number; matchKey: string; oppId: number } | null>(null)
  neuralRef.current.level = difficulty // AI seviyesini uygula
  const engine = neuralRef.current // tum seviyeler sinir agi (seviyeye gore gurultu)

  // Oyunu yerel kaydet (offline/misafir icin). gameEnd de kaydedilir ki
  // refresh'te bitmis oyun yeniden "kazanildi" sayilip tekrar puanlanmasin.
  useEffect(() => {
    saveGame({ mode, difficulty, match, starter, turnsPlayed, turnStart, played, gameEnd })
  }, [mode, difficulty, match, starter, turnsPlayed, turnStart, played, gameEnd])

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
    // Bitmis mac yeniden yuklendiyse puani tekrar bildirme
    ratingReportedRef.current = !!(g.gameEnd || matchWinner(g.match))
  }

  // Acilista: token varsa kullaniciyi ve sunucudaki oyunu yukle
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setAuthChecked(true)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const u = await apiMe()
        if (cancelled) return
        setUser(u)
        const g = await loadServerGame().catch(() => null)
        if (!cancelled && g) applySavedGame(g as SavedGame)
      } catch {
        await apiLogout() // gecersiz token -> temizle
      } finally {
        if (!cancelled) setAuthChecked(true)
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
    root.setAttribute('data-theme', theme)
    root.setAttribute('data-board', boardTheme)
    const bt = ALL_THEMES.find((x) => x.id === boardTheme) ?? BOARD_THEMES[0]
    root.style.setProperty('--panel', bt.panel)
    root.style.setProperty('--tri-a', bt.a)
    root.style.setProperty('--tri-b', bt.b)
    root.style.setProperty('--navy', bt.checker) // koyu pul temaya uyar
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
      neuralRef.current
        .analyzeMoves(before)
        .then(record)
        .catch(() => {})
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
    if (!showAnalysis || !turnRanked || turnRanked.length === 0) return null
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

  function handleDouble(player: Player) {
    if (diceRolled || !canDouble(match, player, cubePending !== null)) return
    const humanColor: Player = online ? myColor : 'white'
    if (player === humanColor) logCubeDecision('double')
    setCubePending(player)
    setMessage(t('msg.doubled', { name: pName(player), value: match.cube.value * 2 }))
  }
  function handleTake() {
    if (!cubePending) return
    const doubler = cubePending
    const taker = opponent(doubler)
    const humanColor: Player = online ? myColor : 'white'
    if (taker === humanColor) logCubeDecision('take')
    setMatch((m) => ({ ...m, cube: { value: m.cube.value * 2, owner: taker } }))
    setCubePending(null)
    setMessage(t('msg.took', { name: pName(taker), doubler: pName(doubler) }))
  }
  function handleDrop() {
    if (!cubePending) return
    const doubler = cubePending
    const humanColor: Player = online ? myColor : 'white'
    if (opponent(doubler) === humanColor) logCubeDecision('drop')
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
          if (!cancelled) commitTurn([])
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
            // Sans (luck): gercek zarin en iyi equity'si vs TUM 21 zarin beklenen en
            // iyi equity'si. Fark bu turun sansi; oyuncu-basi birikir. Ayni tur bir kez.
            const mover = analysisState.turn
            const luckSig = `${mover}:${turnsPlayed}:${analysisState.dice.join(',')}`
            if (r.length > 0 && luckSig !== luckSigRef.current) {
              luckSigRef.current = luckSig
              const actualBest = r[0].equity
              neuralRef.current
                .expectedBestEquity(analysisState, mover)
                .then((expEq) => {
                  if (!cancelled) {
                    setPrLuck((s) => ({ ...s, [mover]: s[mover] + (actualBest - expEq) }))
                  }
                })
                .catch(() => {})
            }
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

  // Insan sirasi + hamle yok -> otomatik "hamle yok" deyip gec (Pas butonu yok)
  useEffect(() => {
    if (!interactive || !diceRolled || played.length > 0) return
    const moves = generateMoves(turnStart)
    if (hasNoMove(moves)) {
      setMessage(t('msg.noMovePass', { name: pName(turnStart.turn) }))
      const timer = window.setTimeout(() => commitTurn([]), 1600)
      return () => window.clearTimeout(timer)
    }
    // Zorunlu tek hamle -> otomatik oyna (gorebilmen icin yavas)
    if (moves.length === 1 && moves[0].steps.length > 0) {
      const only = moves[0]
      setMessage(t('msg.forcedAuto'))
      const timer = window.setTimeout(() => commitTurn(only.steps), 1600)
      return () => window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, diceRolled, played.length, turnStart])

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

  // Ek sure bitti -> sirasi gelen oyuncu oyunu kaybeder
  useEffect(() => {
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

  // ---- Online mac bitince Elo puanini bildir (sadece giris yapmis kullanici) ----
  useEffect(() => {
    if (!online || !user || ratingReportedRef.current) return
    const mW = matchWinner(match)
    if (!mW) return
    ratingReportedRef.current = true
    const won = mW === myColor
    const oppRating = room?.oppRating ?? 1500
    const before = user.rating ?? 1500
    reportRating(won, oppRating, match.target, prOf(myColor))
      .then((r) => {
        setRatingChange({ before, after: r.rating })
        setUser((u) => (u ? { ...u, rating: r.rating } : u))
      })
      .catch(() => {})
    // Bahisli oyun (Tek Oyun sabit / Mac Oyunu %) -> coin transferi.
    // Sunucu kazanani yetkili belirler; rakip beyani/durum gec gelirse pending doner,
    // settleRoomConfirmed birkac kez deneyip guncel bakiyeyi getirir.
    if ((stakeRef.current > 0 || betPctRef.current > 0) && room?.code) {
      settleRoomConfirmed(room.code, won)
        .then((r) => {
          if (typeof r.coins === 'number') setUser((u) => (u ? { ...u, coins: r.coins } : u))
          // Mac sonu ekraninda gosterilecek coin transferi (kazanan +, kaybeden -)
          if (r.ok && typeof r.stake === 'number') setCoinDelta(won ? r.stake : -r.stake)
        })
        .catch(() => {})
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
    // Puansiz (casual) macta Elo/lig islenmez; PR + hata gunlugu yine calisir.
    if (rankedMatch) {
      const botRating = 900 + difficulty * 100 // seviye 1 -> 1000, seviye 10 -> 1900
      const won = mW === 'white' // pvb'de insan beyaz
      const before = user.rating ?? 1500
      reportRating(won, botRating, match.target, prOf('white'))
        .then((r) => {
          setRatingChange({ before, after: r.rating })
          setUser((u) => (u ? { ...u, rating: r.rating } : u))
        })
        .catch(() => {})
    }
    // Hata gunlugu: bu macin en kotu hamlelerini kaydet (yalnizca insan; bot degil)
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
    // Sure bitimi/pes/kup-pas rakip yerelde goremez (hamle degismez) -> senkronla goster.
    // Normal galibiyetler iki istemcide de yerel algilanir, onlari burda islemeyiz.
    if (snap.gameEnd?.timeout || snap.gameEnd?.resigned || snap.gameEnd?.dropped)
      setGameEnd(snap.gameEnd)
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
      updateRoom(roomCode, snap)
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
                status: rv.status,
              }
            : r,
        )
        if (rv.messages) setChat(rv.messages)
        if (rv.version > appliedVersionRef.current && rv.state) {
          appliedVersionRef.current = rv.version
          syncEnabledRef.current = true
          applyOnlineState(rv.state as SavedGame) // lastSyncRef'i kendi ayarlar (echo yok)
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

  // PWA: yukleme istemini yakala (tarayici destekliyorsa)
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      installPromptRef.current = e as unknown as { prompt: () => void }
      setCanInstall(true)
    }
    const onInstalled = () => {
      installPromptRef.current = null
      setCanInstall(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function handleInstall() {
    installPromptRef.current?.prompt()
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
  const ownedPremiumThemes = PREMIUM_THEMES.filter((th) =>
    (user?.unlocks ?? []).includes('theme.' + th.id),
  )

  // Tam ekran ac/kapat
  const [isFull, setIsFull] = useState(false)
  const [muted, setMutedState] = useState(isMuted())
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

  // Otomatik zar: acikken insanin sirasi gelince zar otomatik atilir (kucuk gecikme)
  useEffect(() => {
    if (!autoRoll) return
    if (!interactive || diceRolled || opening || cubePending || gameWon) return
    const id = window.setTimeout(() => doRoll(), 500)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRoll, interactive, diceRolled, opening, cubePending, gameWon, turnStart])

  // Mobil: kucuk ekran + dikey yon -> oyunda yatay cevirme uyarisi
  const [portraitMobile, setPortraitMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px) and (orientation: portrait)')
    const on = () => setPortraitMobile(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>
      }
      const req = el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.()
      Promise.resolve(req)
        .then(() => {
          // Mobilde tam ekranda yatay kilitle (destekleyen tarayicilarda)
          const orient = screen.orientation as ScreenOrientation & {
            lock?: (o: string) => Promise<void>
          }
          orient?.lock?.('landscape').catch(() => {})
        })
        .catch(() => {})
    } else {
      try {
        ;(screen.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.()
      } catch {
        /* yok */
      }
      document.exitFullscreen?.().catch(() => {})
    }
  }

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
      const res = await createRoom(profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar)
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
        status: res.room.status,
      })
    } catch {
      setRoomError(t('mp.connError'))
    } finally {
      setRoomBusy(false)
    }
  }

  // Tek Oyun: bahis + tema sec -> ayni bahisli online eslesmeye gir (tek oyun)
  function startSoloStake(stake: number, theme: string) {
    stakeRef.current = stake
    betPctRef.current = 0 // Tek Oyun sabit bahis (pct degil)
    minRatingRef.current = 0 // Tek Oyun: puan filtresi yok
    setBoardTheme(theme)
    setSoloOpen(false)
    onlineTargetRef.current = 1
    setMode('online')
    setHome(false)
    handleMatchmake()
  }

  // Hizli eslesme: havuza gir; matched ise hemen basla, degilse mm_waiting'de bekle
  async function handleMatchmake() {
    setRoomBusy(true)
    setRoomError('')
    try {
      const res = await matchmake(
        profile?.nickname ?? t('auth.guestNick'),
        user?.rating,
        profile.avatar,
        stakeRef.current,
        user?.id,
        minRatingRef.current,
        betPctRef.current,
      )
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
    handleLeaveRoom()
  }

  async function handleJoinRoom(code: string) {
    setRoomBusy(true)
    setRoomError('')
    try {
      const res = await joinRoom(code, profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar)
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
      const res = await enterRoom(code, profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar)
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
      const res = await enterRoom(code, profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar)
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
      onlineTargetRef.current = opts.target
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
    setPlayed([...played, ...seq])
    setSelectedFrom(null)
  }

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
  const noMove = interactive && diceRolled && hasNoMove(generateMoves(turnStart))
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
  const prBand = (p: number | null): string =>
    p == null
      ? ''
      : p <= 3
        ? 'pr.worldClass'
        : p <= 6
          ? 'pr.expert'
          : p <= 10
            ? 'pr.strong'
            : p <= 15
              ? 'pr.intermediate'
              : 'pr.beginner'
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
            <button className="galaxy-btn roll" onClick={() => handleNewMatch()}>
              {t('btn.newMatch')}
            </button>
          ) : (
            <button className="galaxy-btn roll" onClick={nextGame}>
              {t('btn.nextGame')}
            </button>
          )}
          <button
            className="menu-btn"
            onClick={() => (online ? handleLeaveRoom() : setHome(true))}
          >
            <Icon name="home" /> {t('home.title')}
          </button>
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
          <button className="galaxy-btn roll" onClick={handleTake}>
            {t('btn.take')}
          </button>
          <button className="galaxy-btn double" onClick={handleDrop}>
            {t('btn.drop')}
          </button>
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
    <button className="galaxy-btn roll" onClick={handleConfirm}>
      {t('btn.confirm')}
    </button>
  ) : showRoll ? (
    <button className="galaxy-btn roll" onClick={doRoll}>
      {t('btn.roll')}
    </button>
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
              <button className="galaxy-btn double" onClick={() => handleDouble(turnStart.turn)}>
                {t('btn.double')}
              </button>
            </div>
          )
        : diceRolled && played.length > 0
          ? (
              <button className="galaxy-btn undo" onClick={handleUndo}>
                {t('btn.undo')}
              </button>
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

  // Giris/kayit/profil modali (tam ekran degil, ustte pencere)
  const authModal =
    showAuth || editProfile ? (
      <Auth
        key={editProfile && user ? `edit-${user.id}` : editProfile ? 'edit-guest' : 'auth'}
        modal
        editUser={editProfile ? user : null}
        editGuest={editProfile && !user ? guestProfile : null}
        onAuthed={(u, isNew) => {
          const wasEditing = editProfile
          setUser(u)
          setGuestProfile(null)
          setShowAuth(false)
          // Yeni Google kullanicisi: takma ismini kendi secsin (profil ekrani acilir)
          if (isNew) {
            setEditProfile(true)
            return
          }
          setEditProfile(false)
          if (!wasEditing) {
            loadServerGame()
              .then((g) => {
                if (g) applySavedGame(g as SavedGame)
              })
              .catch(() => {})
          }
        }}
        onGuest={(p) => {
          saveProfile(p)
          setGuestProfile(p)
          setUser(null)
          setEditProfile(false)
          setShowAuth(false)
        }}
        onCancel={() => {
          setEditProfile(false)
          setShowAuth(false)
        }}
        onDeleteAccount={() => {
          apiDeleteAccount().finally(() => {
            setUser(null)
            setGuestProfile(null)
            setEditProfile(false)
            setShowAuth(false)
            setHome(true)
          })
        }}
      />
    ) : null

  // Sag ust hesap bari (lobi + oyun ekraninda ortak)
  // Oyun ekraninda mi (cekilme butonu bunun icin)
  const inActiveGame =
    !home &&
    !setup &&
    !matchOver &&
    (mode === 'pvb' || (mode === 'online' && !!room && room.status === 'playing'))

  const accountBar = (
    <div className="account-bar">
      {inActiveGame && (
        <button className="account-btn leave" onClick={() => setResignOpen(true)}>
          <Icon name="flag" /> {t('resign.button')}
        </button>
      )}
      <span className="account-name">
        {profile.avatar ? (
          <span
            className="av-frame"
            style={frameStyle(user?.avatar_frame)}
          >
            <img className="account-avatar" src={profile.avatar} alt="" />
          </span>
        ) : (
          <Icon name="user" size={16} />
        )}
        {profile.nickname}
        {user?.rating != null && (
          <span className="account-rating">
            <Icon name="star" size={14} /> {user.rating}
          </span>
        )}
      </span>
      {user && (
        <button
          className="account-coins-btn"
          onClick={() => setShopOpen(true)}
          title={t('shop.title')}
        >
          <Icon name="coin" size={16} /> {user.coins ?? 0}
        </button>
      )}
      {user &&
        (rewardReady ? (
          <button
            className="account-btn account-reward ready"
            onClick={handleCoinClick}
            title={t('reward.claim')}
          >
            <Icon name="gift" size={15} /> 500
          </button>
        ) : (
          <span className="account-reward count" title={t('reward.in')}>
            <Icon name="gift" size={14} /> {fmtCountdown(rewardSecs)}
          </span>
        ))}
      {user && (
        <button className="account-btn account-shop" onClick={() => setShopOpen(true)}>
          <Icon name="shop" size={15} /> {t('shop.title')}
        </button>
      )}
      {user && (
        <NotificationBell
          items={notifications}
          unread={unreadNotif}
          onOpen={() => {
            setUnreadNotif(0)
            setNotifications((ns) => ns.map((n) => ({ ...n, read: true })))
            markNotificationsRead().catch(() => {})
          }}
        />
      )}
      {user ? (
        <>
          {user.is_admin && (
            <button
              className="account-btn account-admin"
              onClick={() =>
                window.open('/panel/enter?token=' + encodeURIComponent(getToken() ?? ''), '_blank')
              }
            >
              <Icon name="crown" size={14} /> {t('menu.admin')}
            </button>
          )}
          <button className="account-btn" onClick={() => setEditProfile(true)}>
            {t('menu.editProfile')}
          </button>
          <button className="account-btn" onClick={handleLogout}>
            {t('auth.logout')}
          </button>
        </>
      ) : (
        <button className="account-btn primary" onClick={() => setShowAuth(true)}>
          {t('account.auth')}
        </button>
      )}
      <span className="account-sep" />
      <select
        className="account-btn icon lang-select"
        title={t('menu.language')}
        value={lang}
        onChange={(e) => setLang(e.target.value as typeof lang)}
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.code.toUpperCase()}
          </option>
        ))}
      </select>
      <button
        className="account-btn icon"
        title={muted ? t('menu.soundOn') : t('menu.soundOff')}
        onClick={() => {
          const nv = !muted
          setMuted(nv)
          setMutedState(nv)
          if (!nv) Sound.move()
        }}
      >
        {muted ? <Icon name="mute" size={18} /> : <Icon name="volume" size={18} />}
      </button>
      <button
        className="account-btn icon"
        title={isFull ? t('menu.exitFull') : t('menu.fullscreen')}
        onClick={toggleFullscreen}
      >
        {isFull ? <Icon name="minimize" size={18} /> : <Icon name="maximize" size={18} />}
      </button>
    </div>
  )

  // Mobil hamburger + arka perde (drawer menu)
  const mobileNav = (
    <>
      <button
        className="hamburger"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Menü"
      >
        <Icon name="menu" size={24} />
      </button>
      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}
    </>
  )

  // Yarim kalan (bitmemis) mac var mi -> menude "Aktif Oyunlar"
  const hasActiveGame = !matchOver && (turnsPlayed > 0 || !!gameEnd)

  // Ucretli plan aktif mi (premium ozellik kilidi)
  const premium = user?.plan_active === 'star' || user?.plan_active === 'starpro'

  // Menuden acilan tum sayfalari kapat (ayni anda tek sayfa acik kalir)
  function closeAllPages() {
    setLeaderboardOpen(false)
    setTournOpen(false)
    setShopOpen(false)
    setStatsOpen(false)
    setFriendsOpen(false)
    setBlunderOpen(false)
    setFairOpen(false)
    setLessonsOpen(false)
    setSoloOpen(false)
    setContentView(null)
    setBoardSettingsOpen(false)
    setQuizOpen(false)
    setClubsOpen(false)
    setRulesOpen(false)
    setSetup(null)
  }
  const goPage = (open: () => void) => {
    closeAllPages()
    open()
  }

  // Ortak menu callback'leri (ana sayfa + oyun ekrani ayni menu)
  const menuProps = {
    loggedIn: !!user,
    canInstall,
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
    onResume: () => setHome(false),
    onHome: () => {
      closeAllPages()
      if (online) handleLeaveRoom()
      else setHome(true)
    },
    onLeaderboard: () => goPage(() => setLeaderboardOpen(true)),
    onTournaments: () => goPage(() => setTournOpen(true)),
    onShop: () => goPage(() => setShopOpen(true)),
    onMembership: () => setMemOpen(true),
    onMyStats: () => goPage(() => setStatsOpen(true)),
    onFriends: () => goPage(() => setFriendsOpen(true)),
    onAnalyzer: () => {
      closeAllPages()
      setAnalyzerOpen(true)
    },
    onBlunders: user
      ? () => (premium ? goPage(() => setBlunderOpen(true)) : setMemOpen(true))
      : undefined,
    onLessons: () => goPage(() => setLessonsOpen(true)),
    onRules: () => goPage(() => setRulesOpen(true)),
    onFairness: () => goPage(() => setFairOpen(true)),
    onBoardSettings: () => goPage(() => setBoardSettingsOpen(true)),
    onInstall: handleInstall,
    isAdmin: !!user?.is_admin,
    onAdmin: () =>
      window.open('/panel/enter?token=' + encodeURIComponent(getToken() ?? ''), '_blank'),
    onCalendar: () => goPage(() => setContentView('event')),
    onClubs: () => goPage(() => setClubsOpen(true)),
    onServices: () => goPage(() => setContentView('service')),
    onBlog: () => goPage(() => setContentView('blog')),
    onNews: () => goPage(() => setContentView('news')),
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
          <button className="invite-acc" onClick={() => handleAcceptInvite(inv)}>
            {t('friends.accept')}
          </button>
          <button className="invite-dec" onClick={() => handleDeclineInvite(inv)}>
            {t('friends.decline')}
          </button>
        </div>
      ))}
      {showTournNotices &&
        tournNotices.map((tn) => (
          <div key={`${tn.tid}-${tn.match}`} className="invite-card tourn-notice">
            <span className="invite-text">
              <Icon name="medal" size={16} /> <b>{tn.tname}</b>:{' '}
              {t('tourn.yourMatch', { name: tn.oppName })}
            </span>
            <button
              className="invite-acc"
              onClick={() => handlePlayTournamentMatch(tn.tid, { key: tn.match }, tn.oppId)}
            >
              {t('tourn.play')}
            </button>
          </div>
        ))}
    </div>
  )

  // Menuden acilan tum modaller (her iki ekranda ortak)
  // Menuden acilan sayfa acik mi (ana sayfada icerik alanina AKIS ICINDE gomulur)
  const anyPageOpen =
    leaderboardOpen ||
    tournOpen ||
    shopOpen ||
    statsOpen ||
    friendsOpen ||
    blunderOpen ||
    fairOpen ||
    lessonsOpen ||
    soloOpen ||
    !!contentView ||
    boardSettingsOpen ||
    quizOpen ||
    clubsOpen ||
    rulesOpen

  // Sayfa-tipi menu icerikleri (ana sayfada in-flow, oyun icinde overlay)
  const menuPages = (
    <>
      {friendsOpen && user && (
        <Friends onInvite={handleInviteFriend} onClose={() => setFriendsOpen(false)} />
      )}
      {leaderboardOpen && (
        <Leaderboard currentName={profile.nickname} onClose={() => setLeaderboardOpen(false)} />
      )}
      {statsOpen && user && (
        <ProfileStats
          name={profile.nickname || profile.firstName}
          avatar={profile.avatar}
          frame={user.avatar_frame}
          onClose={() => setStatsOpen(false)}
        />
      )}
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
          unlocks={user.unlocks ?? []}
          currentFrame={user.avatar_frame ?? null}
          boardTheme={boardTheme}
          themes={PREMIUM_THEMES.map((th) => ({ id: th.id, name: th.name, price: th.price, a: th.a, b: th.b }))}
          frames={FRAMES}
          onBuy={handleBuy}
          onEquip={handleEquipFrame}
          onSelectTheme={setBoardTheme}
          onDaily={handleDaily}
          onClose={() => setShopOpen(false)}
        />
      )}
      {tournOpen && (
        <Tournaments
          myId={user?.id ?? null}
          isAdmin={!!user?.is_admin}
          onPlayMatch={handlePlayTournamentMatch}
          onClose={() => setTournOpen(false)}
        />
      )}
      {soloOpen && (
        <SoloStakes
          coins={user?.coins ?? 0}
          onPick={startSoloStake}
          onClose={() => setSoloOpen(false)}
        />
      )}
      {blunderOpen && user && <BlunderLog onClose={() => setBlunderOpen(false)} />}
      {contentView && <ContentView type={contentView} onClose={() => setContentView(null)} />}
      {quizOpen && <QuizPlay onClose={() => setQuizOpen(false)} />}
      {clubsOpen && user && <Clubs onClose={() => setClubsOpen(false)} />}
      {rulesOpen && <Rules onClose={() => setRulesOpen(false)} />}
      {boardSettingsOpen && (
        <BoardSettings
          boardTheme={boardTheme}
          setBoardTheme={setBoardTheme}
          boardThemes={[...BOARD_THEMES, ...ownedPremiumThemes]}
          freeCount={6}
          premium={premium}
          onUpgrade={() => {
            setBoardSettingsOpen(false)
            setMemOpen(true)
          }}
          theme={theme}
          setTheme={setTheme}
          showPip={showPip}
          setShowPip={setShowPip}
          showAnalysis={showAnalysis}
          setShowAnalysis={setShowAnalysis}
          learnMode={learnMode}
          setLearnMode={setLearnMode}
          onClose={() => setBoardSettingsOpen(false)}
        />
      )}
    </>
  )

  // Ortalanmis modallar / yuzen katmanlar (her zaman overlay)
  const menuOverlays = (
    <>
      {inviteBanner}
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
        {accountBar}
        {mobileNav}
        <div className="app lobby">
          <SideMenu
            inGame={false}
            {...menuProps}
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
                onConfirm={applyMatchSetup}
                onCancel={() => {
                  setSetup(null)
                  if (mode === 'online' && !room) setHome(true)
                }}
              />
            </div>
          </main>
        </div>
        {authModal}
        {menuOverlays}
      </>
    )
  }

  // Pozisyon analiz modulu (tam ekran)
  if (analyzerOpen) {
    return (
      <>
        {accountBar}
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
      </>
    )
  }

  // Lobi (ana menu): solda Yeni Oyun, ortasi bos. Akis burdan baslar.
  if (home) {
    return (
      <>
        {accountBar}
        {mobileNav}
        <div className="app lobby">
          <SideMenu
            inGame={false}
            {...menuProps}
            mobileOpen={menuOpen}
            onCloseMobile={() => setMenuOpen(false)}
          />
          <main className={`main lobby-main ${anyPageOpen ? 'has-page' : ''}`}>
            {anyPageOpen ? (
              <div className="page-host">{menuPages}</div>
            ) : (
            <>
            <div className="lobby-welcome">
              {hasActiveGame && (
                <button
                  className="galaxy-btn roll lobby-resume"
                  onClick={() => setHome(false)}
                >
                  <Icon name="live" /> {t('menu.resumeGame')}
                </button>
              )}
              {lobbyTourns.length > 0 && (
                <div className="lobby-tourns">
                  <div className="lobby-tourns-head">
                    <Icon name="medal" size={16} /> {t('menu.tournaments')}
                  </div>
                  {lobbyTourns.slice(0, 5).map((tr) => (
                    <button
                      key={tr.id}
                      className="lobby-tourn-row"
                      onClick={() => setTournOpen(true)}
                    >
                      <span className="lt-name">{tr.name}</span>
                      <span className="lt-meta">
                        {t(`tourn.status.${tr.status}`)} · {tr.count}/{tr.size}
                        {!!tr.prize_coins && (
                          <>
                            {' '}
                            · <Icon name="coin" size={12} /> {tr.prize_coins}
                          </>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="home-panels">
              <LiveMatchesPanel
                onSpectate={(code, p1, p2) => setSpectate({ code, p1, p2 })}
              />
              <RankingPanel
                currentName={profile.nickname}
                onProfile={(id) => setHomeProfileId(id)}
              />
            </div>
            </>
            )}
          </main>
        </div>
        {authModal}
        {menuOverlays}
      </>
    )
  }

  // Online mod: oyun baslamadiysa lobi (oda olustur/katil/bekle)
  if (mode === 'online' && (!room || room.status !== 'playing')) {
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
      {inFinalCountdown && (
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
      {showHintUI && (learnMode || hintShown) && curBest && (
        <div className={`hint-box ${learnMode ? 'learn' : ''}`}>
          <div className="hint-head">
            <span className="hint-title">
              {learnMode ? <Icon name="graduation" size={16} /> : <Icon name="bulb" size={16} />}{' '}
              {learnMode ? t('hint.learnTitle') : t('hint.title')}
            </span>
            {!learnMode && (
              <button className="hint-close" onClick={() => setHintShown(false)} aria-label="Kapat">
                <Icon name="x" size={14} />
              </button>
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
        <button className="hint-fab" onClick={() => setHintShown(true)}>
          <Icon name="bulb" size={16} /> {t('hint.button')}
        </button>
      )}
      <button
        className="game-ham"
        onClick={() => setGameMenuOpen((v) => !v)}
        aria-label={t('gm.title')}
        title={t('gm.title')}
      >
        <Icon name="menu" size={24} />
      </button>
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
        soundOn={!muted}
        toggleSound={() => {
          const nv = !muted
          setMuted(nv)
          setMutedState(nv)
          if (!nv) Sound.move()
        }}
        animOn={animOn}
        toggleAnim={() => setAnimOn((v) => !v)}
        canResign={!matchOver && (mode === 'pvb' || online)}
        onLobby={() => (online ? handleLeaveRoom() : setHome(true))}
        onResign={() => setResignOpen(true)}
        onClose={() => setGameMenuOpen(false)}
      />

      <main className="main">
      <div className="game-area">
        <Sidebar top={topInfo} bottom={bottomInfo} />
        {clockOn && (
          <ClockStack
            active={gameWon || gameEnd || opening ? null : turnStart.turn}
            delay={clock.delay}
            white={clock.white}
            black={clock.black}
            final={FINAL_STAGE}
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
        />
        {showAnalysis && (
          <AnalysisPanel
            loading={analysisLoading}
            currentProbs={currentProbs}
            ranked={ranked}
            player={turnStart.turn}
            lastError={lastError}
            boardState={analysisBoard}
          />
        )}
      </div>

      <div className="status">
        {match.isCrawford && !gameEnd && <span className="crawford">{t('status.crawford')}</span>}
        {online && (
          <span className="room-tag">
            {t('mp.enterCode')}: {room?.code} ·{' '}
          </span>
        )}
        <span>
          {online && onlineReady && !myTurn && !gameEnd && !opening ? t('mp.oppTurn') : message}
        </span>
        {prValue != null && (
          <span className="pr-chip" title={t('pr.title')}>
            PR {prValue.toFixed(1)}
          </span>
        )}
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
          onRematch={() => handleNewMatch(match.target, mode === 'online' ? 'pvb' : mode)}
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
          onClose={() => setResultView(null)}
        />
      )}

      {resignOpen && (
        <div className="register-overlay modal" onClick={() => setResignOpen(false)}>
          <div className="register-card resign-card" onClick={(e) => e.stopPropagation()}>
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
                  <button className="galaxy-btn double" onClick={handleResign}>
                    <Icon name="flag" /> {t('resign.confirm')}
                  </button>
                </>
              )
            })()}
            <button
              className="menu-btn resign-home"
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
            </button>
            <button className="menu-btn" onClick={() => setResignOpen(false)}>
              {t('reg.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
