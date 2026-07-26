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
  rollDice,
  secureDie,
} from './engine/game'
import { HeuristicBot } from './engine/engine'
import { NeuralBot, type RankedMove } from './engine/neuralBot'
import { moveNotation } from './engine/notation'
import { evaluatePosition, pipCount } from './engine/evaluate'
import {
  canDouble,
  matchWinner,
  newMatch,
  scoreGame,
  setupNextGame,
  type MatchState,
} from './engine/match'
import Board from './ui/Board'
import Sidebar from './ui/Sidebar'
import DiceRow, { Die } from './ui/Dice'
import Auth from './ui/Auth'
import Lobby from './ui/Lobby'
import AnalysisPanel, { type MoveError } from './ui/AnalysisPanel'
import {
  createRoom,
  joinRoom,
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
import Home from './ui/Home'
import ResetPassword from './ui/ResetPassword'
import MatchSetup, { type MatchOptions, type SetupMode } from './ui/MatchSetup'
import { loadGame, loadProfile, saveGame, saveProfile, type Profile, type SavedGame } from './storage'
import { useT } from './i18n'
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
type Difficulty = 'neural' | 'heuristic'

interface RoomState {
  code: string
  slot: Slot
  oppName: string | null
  oppRating: number | null
  oppAvatar: string | null
  status: 'waiting' | 'playing' | 'finished'
}
const BOT_PLAYER: Player = 'black'
const TARGETS = [1, 3, 5, 7]

// Board renk temalari (panel zemin, acik ucgen, koyu ucgen, koyu pul)
interface BoardTheme {
  id: string
  name: string
  panel: string
  a: string
  b: string
  checker: string // koyu pul rengi (temaya uyar)
}
const BOARD_THEMES: BoardTheme[] = [
  { id: 'blue', name: 'Mavi', panel: '#3f5fd4', a: '#6f92f5', b: '#3856c4', checker: '#2a2ac0' },
  { id: 'green', name: 'Yeşil', panel: '#2f7d4f', a: '#56b37a', b: '#22633e', checker: '#0e5a30' },
  { id: 'wood', name: 'Ahşap', panel: '#9c6b3f', a: '#c89b6a', b: '#744826', checker: '#4d2e15' },
  { id: 'purple', name: 'Mor', panel: '#7a4fb0', a: '#a77ad0', b: '#5a3a8c', checker: '#4a2d85' },
  { id: 'gray', name: 'Gri', panel: '#5a6478', a: '#8b95a8', b: '#434c5e', checker: '#2e3644' },
  { id: 'red', name: 'Kırmızı', panel: '#a83a3a', a: '#cc6a6a', b: '#7a2a2a', checker: '#7d1f1f' },
  { id: 'teal', name: 'Turkuaz', panel: '#2a8a8a', a: '#4fb3b3', b: '#1e6666', checker: '#0d4d4d' },
  { id: 'night', name: 'Gece', panel: '#2a3560', a: '#4a5a9a', b: '#1c2444', checker: '#26305e' },
]
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

// Oyun saati: her turda 12sn gecikme, tukenince rezervden duser, rezerv biterse kaybeder
const MOVE_DELAY = 12
type TimeControl = 'off' | 'standard' | 'fast'
// Rezerv (sn): kapali=saat yok, standart=6dk, hizli=1dk (gecikme her ikisinde 12sn)
const RESERVE_PRESETS: Record<TimeControl, number> = { off: 0, standard: 6 * 60, fast: 60 }

// Rezerv saniyeyi mm:ss bicimine cevir
function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

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
      return localStorage.getItem('tavla.theme') === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  const [boardTheme, setBoardTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('tavla.board') || 'blue'
    } catch {
      return 'blue'
    }
  })
  const [mode, setMode] = useState<Mode>(saved?.mode ?? 'pvb')
  const [difficulty, setDifficulty] = useState<Difficulty>(saved?.difficulty ?? 'neural')
  const [match, setMatch] = useState<MatchState>(() => saved?.match ?? newMatch(1))
  const [starter, setStarter] = useState<Player>(saved?.starter ?? 'white')
  const [turnStart, setTurnStart] = useState<GameState>(() => saved?.turnStart ?? freshBoard('white'))
  const [played, setPlayed] = useState<Step[]>(saved?.played ?? [])
  const [selectedFrom, setSelectedFrom] = useState<number | 'bar' | null>(null)
  const [cubePending, setCubePending] = useState<Player | null>(null) // teklif eden
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
  const [home, setHome] = useState(!saved) // baslangic ekrani (kayitli oyun yoksa)
  const [timeControl, setTimeControl] = useState<TimeControl>('standard')
  const reserveRef = useRef(RESERVE_PRESETS.standard) // secili rezerv (sn)
  const onlineTargetRef = useRef(1) // online oda kurulunca kullanilacak mac uzunlugu
  // Oyun saati: bu turun gecikmesi (sn) + her oyuncunun rezervi (sn)
  const [clock, setClock] = useState<{ delay: number; white: number; black: number }>({
    delay: MOVE_DELAY,
    white: RESERVE_PRESETS.standard,
    black: RESERVE_PRESETS.standard,
  })
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
  const [lastError, setLastError] = useState<MoveError | null>(null)
  const heuristicRef = useRef(new HeuristicBot())
  const neuralRef = useRef(new NeuralBot())
  const engine = difficulty === 'neural' ? neuralRef.current : heuristicRef.current

  // Oyunu yerel kaydet (offline/misafir icin). gameEnd de kaydedilir ki
  // refresh'te bitmis oyun yeniden "kazanildi" sayilip tekrar puanlanmasin.
  useEffect(() => {
    saveGame({ mode, difficulty, match, starter, turnsPlayed, turnStart, played, gameEnd })
  }, [mode, difficulty, match, starter, turnsPlayed, turnStart, played, gameEnd])

  // Kaydedilmis oyunu state'e uygula (sunucudan yukleme)
  function applySavedGame(g: SavedGame) {
    setMode(g.mode)
    setDifficulty(g.difficulty)
    setMatch(g.match)
    setStarter(g.starter)
    setTurnStart(g.turnStart)
    setPlayed(g.played)
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
    const bt = BOARD_THEMES.find((x) => x.id === boardTheme) ?? BOARD_THEMES[0]
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
  const clockOn = timeControl !== 'off'
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

  function resetGameUi() {
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
    setClock({ delay: MOVE_DELAY, white: reserveRef.current, black: reserveRef.current })
    ratingReportedRef.current = false // yeni mac -> puan tekrar islenebilir
  }

  function commitTurn(finalPlayed: Step[]) {
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
    const dice = rollDice()
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
  function handleDouble(player: Player) {
    if (diceRolled || !canDouble(match, player, cubePending !== null)) return
    setCubePending(player)
    setMessage(t('msg.doubled', { name: pName(player), value: match.cube.value * 2 }))
  }
  function handleTake() {
    if (!cubePending) return
    const doubler = cubePending
    const taker = opponent(doubler)
    setMatch((m) => ({ ...m, cube: { value: m.cube.value * 2, owner: taker } }))
    setCubePending(null)
    setMessage(t('msg.took', { name: pName(taker), doubler: pName(doubler) }))
  }
  function handleDrop() {
    if (!cubePending) return
    const doubler = cubePending
    const points = match.cube.value
    setMatch((m) => scoreGame(m, doubler, points))
    setGameEnd({ winner: doubler, points, mult: 1, dropped: true })
    setCubePending(null)
  }

  // ---- Pes etme / cekilme (1=oyun, 2=gammon, 3=backgammon) ----
  function handleResign(mult: 1 | 2 | 3) {
    setResignOpen(false)
    const loser: Player = online ? myColor : 'white' // pvb'de insan beyaz
    const w = opponent(loser)
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
          if (difficulty === 'neural') setMessage(t('msg.neuralThinking'))
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
    const dice = rollDice()
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
  useEffect(() => {
    if (!showAnalysis || !interactive || !diceRolled || gameWon) return
    if (remainingDice.length === 0) return // tur tamamlandi, analiz yok
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
          setRanked(r)
          setCurrentProbs(cp)
          setAnalysisBoard(analysisState)
          if (played.length === 0) turnRankedRef.current = r // tur basi tam siralamayi sakla
        }
      } catch (e) {
        // Sinir agi yuklenemedi/hata -> hizli (heuristik) siralama ile en azindan hamle listesi
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
          setRanked(ranks)
          setCurrentProbs(null)
          setAnalysisBoard(analysisState)
          if (played.length === 0) turnRankedRef.current = ranks
        }
      } finally {
        if (!cancelled) setAnalysisLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnalysis, interactive, diceRolled, played, turnStart, working, remainingDice, gameWon])

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

  // Acilis atisi: her iki oyuncu birer zar atar, esitse tekrar, yuksek olan baslar.
  function handleOpeningRoll() {
    let w = secureDie()
    let b = secureDie()
    while (w === b) {
      w = secureDie()
      b = secureDie()
    }
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

  // Oyun durumunun imzasi (sadece oyunu ilgilendiren alanlar) -> echo tespiti
  function stateSig(
    m: MatchState,
    st: Player,
    tp: number,
    ts: GameState,
    pl: Step[],
  ): string {
    return JSON.stringify({ match: m, starter: st, turnsPlayed: tp, turnStart: ts, played: pl })
  }

  // ---- Oyun saati ----
  // Yeni tur baslayinca gecikmeyi 12sn'e sifirla
  useEffect(() => {
    setClock((c) => ({ ...c, delay: MOVE_DELAY }))
  }, [turnStart.turn, turnsPlayed])

  // Her saniye: aktif oyuncunun once gecikmesi, o bitince rezervi azalir
  useEffect(() => {
    if (!clockOn || gameEnd || matchOver || opening || cubePending || gameWon) return
    if (online && !onlineReady) return
    const who = turnStart.turn
    const id = window.setInterval(() => {
      setClock((c) => {
        if (c.delay > 0) return { ...c, delay: c.delay - 1 }
        return { ...c, [who]: Math.max(0, c[who] - 1) }
      })
    }, 1000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockOn, gameEnd, matchOver, opening, cubePending, gameWon, turnStart.turn, online, onlineReady])

  // Rezerv bitti -> aktif oyuncu oyunu kaybeder (skora bakilmaksizin)
  useEffect(() => {
    if (!clockOn || gameEnd || matchOver) return
    const who = turnStart.turn
    if (clock[who] > 0) return
    if (online && myColor !== who) return // online'da sadece suresi biten ilan etsin
    const w = opponent(who)
    setMatch((m) => scoreGame(m, w, m.cube.value))
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
    reportRating(won, oppRating)
      .then((r) => setUser((u) => (u ? { ...u, rating: r.rating } : u)))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, user, match, myColor, room])

  // Bota karsi mac bitince de puan islensin (bot puani zorluga gore)
  useEffect(() => {
    if (mode !== 'pvb' || !user || ratingReportedRef.current) return
    const mW = matchWinner(match)
    if (!mW) return
    ratingReportedRef.current = true
    const botRating = difficulty === 'neural' ? 1700 : 1300
    const won = mW === 'white' // pvb'de insan beyaz
    reportRating(won, botRating)
      .then((r) => setUser((u) => (u ? { ...u, rating: r.rating } : u)))
      .catch(() => {})
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
    )
    setMatch(snap.match)
    setStarter(snap.starter)
    setTurnsPlayed(snap.turnsPlayed)
    setTurnStart(snap.turnStart)
    setPlayed(snap.played ?? [])
    // Rakibin gonderdigi rezervleri al (gecikmeyi yeni tur icin 12'ye kur)
    if (snap.clock) setClock((c) => ({ delay: c.delay, white: snap.clock!.white, black: snap.clock!.black }))
    setSelectedFrom(null)
    setCubePending(null)
    setBotAnim(null)
    setOpening(null)
    setOppStarted(true)
    // Sure bitimi/pes etme rakip yerelde goremez (hamle degismez) -> senkronla goster.
    // Normal galibiyetler iki istemcide de yerel algilanir, onlari burda islemeyiz.
    if (snap.gameEnd?.timeout || snap.gameEnd?.resigned) setGameEnd(snap.gameEnd)
  }

  // Online: yerel degisikligi odaya gonder (senkron)
  // ONEMLI: bagimliliklarda tum `room` nesnesi YOK -> her yoklamada (oppName/status
  // yenilenince) tekrar gondermeyi onler. Ayrica imza ayni ise (echo) gondermez;
  // aksi halde iki istemci birbirinin eski durumunu yeniden uygulayip hamleyi siler.
  const roomCode = room?.code
  const roomStatus = room?.status
  useEffect(() => {
    if (!online || !roomCode || roomStatus !== 'playing' || !syncEnabledRef.current) return
    const sig = stateSig(match, starter, turnsPlayed, turnStart, played)
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
        clock: { white: clock.white, black: clock.black },
        gameEnd,
      }
      updateRoom(roomCode, snap)
        .then((r) => {
          appliedVersionRef.current = r.version
        })
        .catch(() => {})
    }, 200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, roomCode, roomStatus, match, starter, turnsPlayed, turnStart, played])

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
      setClock({ delay: MOVE_DELAY, white: reserveRef.current, black: reserveRef.current })
      setMatch(newMatch(target))
      setStarter('white')
      setTurnsPlayed(0)
      setTurnStart(freshBoard('white'))
      setPlayed([])
      setSelectedFrom(null)
      setCubePending(null)
      setGameEnd(null)
      setBotAnim(null)
      setOpening(null)
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

  async function handleJoinRoom(code: string) {
    setRoomBusy(true)
    setRoomError('')
    try {
      const res = await joinRoom(code, profile?.nickname ?? t('auth.guestNick'), user?.rating, profile.avatar)
      appliedVersionRef.current = -1
      lastSyncRef.current = ''
      syncEnabledRef.current = false
      setOppStarted(false)
      setChat([])
      ratingReportedRef.current = false
      setClock({ delay: MOVE_DELAY, white: reserveRef.current, black: reserveRef.current })
      setOpening(null)
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

  function handleLeaveRoom() {
    setRoom(null)
    syncEnabledRef.current = false
    appliedVersionRef.current = -1
    setOppStarted(false)
    setChat([])
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
    reserveRef.current = RESERVE_PRESETS[opts.timeControl]
    if (opts.difficulty) setDifficulty(opts.difficulty)
    setSetup(null)
    setHome(false)
    // Mod modalda secildi: online -> lobiye (oda kur/katil), degilse bota karsi mac
    if (opts.mode === 'online') {
      onlineTargetRef.current = opts.target
      setRoom(null)
      setRoomError('')
      setMode('online')
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
    setMatch(newMatch(target))
    setStarter('white')
    setTurnStart(freshBoard('white'))
    resetGameUi()
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
    resetGameUi()
    setMessage(m2.isCrawford ? t('msg.crawfordGame') : t('msg.nextGame'))
  }

  // ---- Overlay icerikleri ----
  const noMove = interactive && diceRolled && hasNoMove(generateMoves(turnStart))
  const showRoll = interactive && !diceRolled
  // Tum oynanabilir zarlar oynandi -> onay bekleniyor
  const turnComplete =
    interactive && diceRolled && played.length > 0 && nextSteps.length === 0
  const humanCanDouble =
    showRoll && turnsPlayed > 0 && !online && canDouble(match, turnStart.turn, false)
  const humanRespond = cubePending !== null && (mode === 'pvp' || cubePending === BOT_PLAYER)
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

  let centerMain: React.ReactNode = null
  if (opening === 'roll') {
    centerMain = (
      <div className="result-box">
        <div className="result-title">{t('opening.title')}</div>
        <button className="galaxy-btn roll" onClick={handleOpeningRoll}>
          {t('btn.roll')}
        </button>
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
  } else if (gameEnd) {
    const multKey =
      gameEnd.mult === 3 ? 'mult.backgammon' : gameEnd.mult === 2 ? 'mult.gammon' : 'mult.normal'
    const title = matchOver
      ? t('result.matchWon', { name: pName(mWinner!) })
      : gameEnd.timeout
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
            🏠 {t('home.title')}
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
            <button className="galaxy-btn double" onClick={() => handleDouble(turnStart.turn)}>
              {t('btn.double')}
            </button>
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
        ? difficulty === 'neural'
          ? t('sub.neural')
          : t('sub.heuristic')
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
  const accountBar = (
    <div className="account-bar">
      <span className="account-name">
        {profile.avatar ? (
          <img className="account-avatar" src={profile.avatar} alt="" />
        ) : (
          '👤 '
        )}
        {profile.nickname}
        {user?.rating != null && <span className="account-rating">⭐ {user.rating}</span>}
      </span>
      {user ? (
        <>
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
      <button
        className="account-btn icon"
        title={lang === 'tr' ? 'English' : 'Türkçe'}
        onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
      >
        {lang === 'tr' ? '🇬🇧 EN' : '🇹🇷 TR'}
      </button>
      <button
        className="account-btn icon"
        title={theme === 'dark' ? t('theme.light') : t('theme.dark')}
        onClick={() => setTheme((v) => (v === 'dark' ? 'light' : 'dark'))}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </div>
  )

  // Mac kurulum ekrani (mod + zorluk + sure + puan + pip + analiz)
  if (setup) {
    return (
      <MatchSetup
        mode={setup}
        targets={TARGETS}
        initial={{ target: match.target, showPip, showAnalysis, timeControl, difficulty }}
        onConfirm={applyMatchSetup}
        onCancel={() => {
          setSetup(null)
          if (mode === 'online' && !room) setHome(true)
        }}
      />
    )
  }

  // Lobi (ana menu): solda Yeni Oyun, ortasi bos. Akis burdan baslar.
  if (home) {
    return (
      <>
        {accountBar}
        <Home
          playerName={profile.nickname}
          onNewGame={() => setSetup('pvb')}
          boardTheme={boardTheme}
          setBoardTheme={setBoardTheme}
          boardThemes={BOARD_THEMES}
        />
        {authModal}
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
          onCreate={() => handleCreateRoom(onlineTargetRef.current)}
          onJoin={handleJoinRoom}
          onLeave={handleLeaveRoom}
        />
      </>
    )
  }

  return (
    <div className="app">
      {accountBar}
      <aside className="side-menu">
        <div className="brand">
          <span className="brand-badge">{t('brand.short')}</span>
          <span className="brand-full">{t('brand.name')}</span>
        </div>

        <div className="menu-group">
          <div className="menu-label">{t('menu.boardSettings')}</div>
          <div className="board-swatches">
            {BOARD_THEMES.map((bt) => (
              <button
                key={bt.id}
                className={`swatch ${boardTheme === bt.id ? 'active' : ''}`}
                title={bt.name}
                onClick={() => setBoardTheme(bt.id)}
                style={{ background: `linear-gradient(135deg, ${bt.a} 0 50%, ${bt.b} 50% 100%)` }}
              />
            ))}
          </div>
        </div>

        <div className="menu-group">
          <button className="menu-btn" onClick={() => setHome(true)}>
            🏠 {t('home.title')}
          </button>
        </div>

        <div className="menu-group">
          <div className="menu-label">{t('setup.mode')}</div>
          <button
            className="menu-btn"
            onClick={() => setSetup(mode === 'online' ? 'online' : 'pvb')}
          >
            🎮 {t('setup.newGame')}
          </button>
        </div>

        <div className="menu-group">
          <button
            className={showAnalysis ? 'menu-btn active' : 'menu-btn'}
            onClick={() => setShowAnalysis((v) => !v)}
          >
            {t('menu.analysis')}
          </button>
          {!gameEnd && !matchOver && !opening && (mode === 'pvb' || online) && (
            <button className="menu-btn resign-btn" onClick={() => setResignOpen(true)}>
              🏳️ {t('resign.button')}
            </button>
          )}
        </div>
      </aside>

      <main className="main">
      <div className="game-area">
        <Sidebar top={topInfo} bottom={bottomInfo} />
        {clockOn && (
          <ClockStack
            topTime={fmtClock(clock.black)}
            bottomTime={fmtClock(clock.white)}
            delay={clock.delay}
            active={gameWon || gameEnd || opening ? null : turnStart.turn}
            lowTop={clock.black <= 30}
            lowBottom={clock.white <= 30}
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
      </div>
      </main>

      {online && room && (
        <Chat messages={chat} mySlot={room.slot} onSend={handleSendChat} />
      )}
      {authModal}

      {resignOpen && (
        <div className="register-overlay modal" onClick={() => setResignOpen(false)}>
          <div className="register-card resign-card" onClick={(e) => e.stopPropagation()}>
            <h2>🏳️ {t('resign.title')}</h2>
            <p className="register-sub">{t('resign.help')}</p>
            <button className="galaxy-btn double" onClick={() => handleResign(1)}>
              {t('resign.single', { n: match.cube.value })}
            </button>
            <button className="galaxy-btn double" onClick={() => handleResign(2)}>
              {t('resign.gammon', { n: match.cube.value * 2 })}
            </button>
            <button className="galaxy-btn double" onClick={() => handleResign(3)}>
              {t('resign.backgammon', { n: match.cube.value * 3 })}
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
