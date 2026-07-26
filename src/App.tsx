import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type { GameState, Move, Player, Step } from './engine/types'
import { cloneState, gameOutcome, opponent, winner } from './engine/board'
import { applyStep, boardKey, generateMoves, hasNoMove } from './engine/moves'
import { initialState, legalNextSteps, newTurn, reachableFromChecker, rollDice } from './engine/game'
import { HeuristicBot } from './engine/engine'
import { NeuralBot, type RankedMove } from './engine/neuralBot'
import { moveNotation } from './engine/notation'
import { pipCount } from './engine/evaluate'
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
import DiceRow from './ui/Dice'
import Auth from './ui/Auth'
import AnalysisPanel, { type MoveError } from './ui/AnalysisPanel'
import { loadGame, loadProfile, saveGame, saveProfile, type Profile, type SavedGame } from './storage'
import { useT, type Lang } from './i18n'
import {
  getToken,
  loadServerGame,
  logout as apiLogout,
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

type Mode = 'pvp' | 'pvb'
type Difficulty = 'neural' | 'heuristic'
const BOT_PLAYER: Player = 'black'
const TARGETS = [1, 3, 5, 7]

// Board renk temalari (panel zemin, acik ucgen, koyu ucgen)
interface BoardTheme {
  id: string
  name: string
  panel: string
  a: string
  b: string
}
const BOARD_THEMES: BoardTheme[] = [
  { id: 'blue', name: 'Mavi', panel: '#3f5fd4', a: '#6f92f5', b: '#3856c4' },
  { id: 'green', name: 'Yeşil', panel: '#2f7d4f', a: '#56b37a', b: '#22633e' },
  { id: 'wood', name: 'Ahşap', panel: '#9c6b3f', a: '#c89b6a', b: '#744826' },
  { id: 'purple', name: 'Mor', panel: '#7a4fb0', a: '#a77ad0', b: '#5a3a8c' },
  { id: 'gray', name: 'Gri', panel: '#5a6478', a: '#8b95a8', b: '#434c5e' },
  { id: 'red', name: 'Kırmızı', panel: '#a83a3a', a: '#cc6a6a', b: '#7a2a2a' },
  { id: 'teal', name: 'Turkuaz', panel: '#2a8a8a', a: '#4fb3b3', b: '#1e6666' },
  { id: 'night', name: 'Gece', panel: '#2a3560', a: '#4a5a9a', b: '#1c2444' },
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

interface GameEnd {
  winner: Player
  points: number
  mult: number
  dropped: boolean
}

export default function App() {
  const { t, lang, setLang } = useT()
  const pName = (p: Player) => t(p === 'white' ? 'player.white' : 'player.black')
  const [saved] = useState(() => loadGame())
  const [user, setUser] = useState<ServerUser | null>(null)
  const [guestProfile, setGuestProfile] = useState<Profile | null>(() => loadProfile())
  const [authChecked, setAuthChecked] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const profile: Profile | null = user ? toProfile(user) : guestProfile
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
  const [gameEnd, setGameEnd] = useState<GameEnd | null>(null)
  const [botAnim, setBotAnim] = useState<BotAnim | null>(null) // bot tas-tas oynatma
  const [turnsPlayed, setTurnsPlayed] = useState(saved?.turnsPlayed ?? 0) // ilk elde kup yok
  const [message, setMessage] = useState(() => t('msg.roll'))
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [currentProbs, setCurrentProbs] = useState<number[] | null>(null)
  const [ranked, setRanked] = useState<RankedMove[] | null>(null)
  const [lastError, setLastError] = useState<MoveError | null>(null)
  const heuristicRef = useRef(new HeuristicBot())
  const neuralRef = useRef(new NeuralBot())
  const engine = difficulty === 'neural' ? neuralRef.current : heuristicRef.current

  // Oyunu yerel kaydet (offline/misafir icin)
  useEffect(() => {
    saveGame({ mode, difficulty, match, starter, turnsPlayed, turnStart, played })
  }, [mode, difficulty, match, starter, turnsPlayed, turnStart, played])

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
    setGameEnd(null)
    setBotAnim(null)
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
  const interactive =
    !isBotTurn && !gameWon && gameEnd === null && !matchOver && cubePending === null

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
    if (!showAnalysis || !ranked || ranked.length === 0) return null
    const resultKey = boardKey(applyPlayed(turnStart, finalPlayed))
    const pl = ranked.find((r) => r.move.resultKey === resultKey)
    if (!pl) return null
    const best = ranked[0]
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
    if (!isBotTurn || gameEnd || matchOver || cubePending || botAnim || played.length > 0) return
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
  }, [isBotTurn, gameEnd, matchOver, cubePending, botAnim, diceRolled, played, turnStart, engine, match, turnsPlayed])

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

  // ---- Analiz ----
  useEffect(() => {
    if (!showAnalysis || !interactive || !diceRolled || played.length > 0) return
    let cancelled = false
    setAnalysisLoading(true)
    ;(async () => {
      try {
        const [r, cp] = await Promise.all([
          neuralRef.current.analyzeMoves(turnStart),
          neuralRef.current.evalPosition(turnStart, turnStart.turn),
        ])
        if (!cancelled) {
          setRanked(r)
          setCurrentProbs(cp)
        }
      } catch {
        /* sessizce gec */
      } finally {
        if (!cancelled) setAnalysisLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAnalysis, interactive, diceRolled, played.length, turnStart])

  // Insan sirasi + hamle yok -> otomatik "hamle yok" deyip gec (Pas butonu yok)
  useEffect(() => {
    if (!interactive || !diceRolled || played.length > 0) return
    const moves = generateMoves(turnStart)
    if (hasNoMove(moves)) {
      setMessage(t('msg.noMovePass', { name: pName(turnStart.turn) }))
      const t = window.setTimeout(() => commitTurn([]), 1600)
      return () => window.clearTimeout(t)
    }
    // Zorunlu tek hamle -> otomatik oyna (gorebilmen icin yavas)
    if (moves.length === 1 && moves[0].steps.length > 0) {
      const only = moves[0]
      setMessage(t('msg.forcedAuto'))
      const t = window.setTimeout(() => commitTurn(only.steps), 1600)
      return () => window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, diceRolled, played.length, turnStart])

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

  function handleUndo() {
    setPlayed([])
    setSelectedFrom(null)
  }

  function handleNewMatch(t = match.target, nextMode = mode) {
    setMode(nextMode)
    setMatch(newMatch(t))
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
  const humanCanDouble = showRoll && turnsPlayed > 0 && canDouble(match, turnStart.turn, false)
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
  if (gameEnd) {
    const multKey =
      gameEnd.mult === 3 ? 'mult.backgammon' : gameEnd.mult === 2 ? 'mult.gammon' : 'mult.normal'
    const title = matchOver
      ? t('result.matchWon', { name: pName(mWinner!) })
      : gameEnd.dropped
        ? t('result.cubeDrop', { name: pName(gameEnd.winner) })
        : t('result.won', { name: pName(gameEnd.winner), type: t(multKey) })
    centerMain = (
      <div className="result-box">
        <div className="result-title">{title}</div>
        <div className="result-points">{t('result.points', { n: gameEnd.points })}</div>
        {matchOver ? (
          <button className="galaxy-btn roll" onClick={() => handleNewMatch()}>
            {t('btn.newMatch')}
          </button>
        ) : (
          <button className="galaxy-btn roll" onClick={nextGame}>
            {t('btn.nextGame')}
          </button>
        )}
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

  // Senin zarin (beyaz) sagda, rakibin (siyah) solda
  const mySideRight = turnStart.turn === 'white'
  const centerRight = mySideRight ? primary : secondary
  const centerLeft = mySideRight ? secondary : primary

  const topInfo = {
    name: mode === 'pvb' ? t('player.bot') : t('player.black'),
    avatar: '🐱',
    sub:
      mode === 'pvb'
        ? difficulty === 'neural'
          ? t('sub.neural')
          : t('sub.heuristic')
        : t('player.p2'),
    off: working.off.black,
    active: turnStart.turn === 'black' && !gameWon && !gameEnd,
    color: 'black' as const,
    score: match.score.black,
    target: match.target,
  }
  const bottomInfo = {
    name: mode === 'pvb' ? (profile?.nickname ?? t('player.you')) : t('player.white'),
    avatar: '🧑‍🚀',
    sub: mode === 'pvb' ? t('player.human') : t('player.p1'),
    off: working.off.white,
    active: turnStart.turn === 'white' && !gameWon && !gameEnd,
    color: 'white' as const,
    score: match.score.white,
    target: match.target,
  }

  // Auth kontrolu bitene kadar bekle
  if (!authChecked) {
    return (
      <div className="register-overlay">
        <div className="register-card">{t('an.loading')}</div>
      </div>
    )
  }

  // Giris/kayit yoksa veya profil duzenleniyorsa Auth ekrani
  if (!profile || editProfile) {
    return (
      <Auth
        editUser={editProfile ? user : null}
        editGuest={editProfile && !user ? guestProfile : null}
        onAuthed={(u) => {
          const wasEditing = editProfile
          setUser(u)
          setGuestProfile(null)
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
        }}
        onCancel={profile ? () => setEditProfile(false) : undefined}
      />
    )
  }

  return (
    <div className="app">
      <aside className="side-menu">
        <div className="brand">
          <span className="brand-badge">{t('brand.short')}</span>
          <span className="brand-full">{t('brand.name')}</span>
        </div>

        <div className="menu-group">
          <div className="menu-label">{t('menu.account')}</div>
          <div className="menu-profile">👤 {profile.nickname}</div>
          <button className="menu-btn" onClick={() => setEditProfile(true)}>
            {t('menu.editProfile')}
          </button>
          {user ? (
            <button className="menu-btn" onClick={handleLogout}>
              {t('auth.logout')}
            </button>
          ) : (
            <button className="menu-btn" onClick={() => setGuestProfile(null)}>
              {t('menu.login')}
            </button>
          )}
        </div>

        <div className="menu-group">
          <div className="menu-label">{t('menu.language')}</div>
          <div className="menu-targets">
            {(['tr', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                className={lang === l ? 'menu-btn active' : 'menu-btn'}
                onClick={() => setLang(l)}
              >
                {l === 'tr' ? '🇹🇷 TR' : '🇬🇧 EN'}
              </button>
            ))}
          </div>
        </div>

        <div className="menu-group">
          <div className="menu-label">{t('menu.theme')}</div>
          <div className="menu-targets">
            <button
              className={theme === 'dark' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setTheme('dark')}
            >
              {t('theme.dark')}
            </button>
            <button
              className={theme === 'light' ? 'menu-btn active' : 'menu-btn'}
              onClick={() => setTheme('light')}
            >
              {t('theme.light')}
            </button>
          </div>
        </div>

        <div className="menu-group">
          <div className="menu-label">{t('menu.board')}</div>
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
          <div className="menu-label">{t('menu.mode')}</div>
          <button
            className={mode === 'pvb' ? 'menu-btn active' : 'menu-btn'}
            onClick={() => handleNewMatch(match.target, 'pvb')}
          >
            {t('menu.vsBot')}
          </button>
          <button
            className={mode === 'pvp' ? 'menu-btn active' : 'menu-btn'}
            onClick={() => handleNewMatch(match.target, 'pvp')}
          >
            {t('menu.twoPlayer')}
          </button>
        </div>

        {mode === 'pvb' && (
          <div className="menu-group">
            <div className="menu-label">{t('menu.botStrength')}</div>
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
        )}

        <div className="menu-group">
          <div className="menu-label">{t('menu.matchLength')}</div>
          <div className="menu-targets">
            {TARGETS.map((n) => (
              <button
                key={n}
                className={match.target === n ? 'menu-btn active' : 'menu-btn'}
                onClick={() => handleNewMatch(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="menu-group">
          <button
            className={showAnalysis ? 'menu-btn active' : 'menu-btn'}
            onClick={() => setShowAnalysis((v) => !v)}
          >
            {t('menu.analysis')}
          </button>
          <button className="menu-btn" onClick={() => handleNewMatch()}>
            {t('menu.newMatch')}
          </button>
        </div>
      </aside>

      <main className="main">
      <div className="game-area">
        <Sidebar top={topInfo} bottom={bottomInfo} />
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
        />
      </div>

      <div className="status">
        {match.isCrawford && !gameEnd && <span className="crawford">{t('status.crawford')}</span>}
        <span>{message}</span>
      </div>

      {showAnalysis && (
        <AnalysisPanel
          loading={analysisLoading}
          currentProbs={currentProbs}
          ranked={ranked}
          player={turnStart.turn}
          lastError={lastError}
        />
      )}
      </main>
    </div>
  )
}
