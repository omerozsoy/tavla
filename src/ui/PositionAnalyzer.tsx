import { useEffect, useRef, useState } from 'react'
import type {
  PointerEvent as RPointerEvent,
  MouseEvent as RMouseEvent,
  ChangeEvent as RChangeEvent,
} from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import type { GameState, Player } from '../engine/types'
import { initialState } from '../engine/game'
import { pipCount } from '../engine/evaluate'
import { equityFrom } from '../engine/encoding'
import { moveNotation } from '../engine/notation'
import type { RankedMove } from '../engine/neuralBot'
import Board from './Board'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { analyzeBoardImage } from '../api'
import BoardPhotoWarp from './BoardPhotoWarp'

interface Props {
  neuralEval: (state: GameState, onRoll: Player, deep: boolean) => Promise<number[]>
  neuralAnalyze: (state: GameState, deep: boolean) => Promise<RankedMove[]>
  premium?: boolean // 2-ply (derin) analiz premium
  onUpgrade?: () => void
  onClose: () => void
}

const emptyPoints = () => new Array(24).fill(0)

// Dizilen pozisyonu kalici tut: analyzer kapanip acilinca / sayfa yenilenince
// pullar KAYBOLMASIN. localStorage'a board dizilimi (nokta/bar/off/sira/kup) yazilir.
const PA_STORE_KEY = 'pa-position-v1'
type SavedPos = {
  pts: number[]
  bar: { white: number; black: number }
  off: { white: number; black: number }
  turn: Player
  cube: { value: number; owner: Player | null }
}
function loadSavedPos(): SavedPos | null {
  try {
    const raw = localStorage.getItem(PA_STORE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!Array.isArray(s?.pts) || s.pts.length !== 24) return null
    return s as SavedPos
  } catch {
    return null
  }
}

// Board'un gercek pul rengiyle kucuk yuvarlak isaret (⚪/⚫ emojisi yerine).
// Tema degisince (kiremit=sari/kirmizi, galaxy=krem/lacivert...) otomatik uyar.
function Swatch({ color }: { color: Player }) {
  return (
    <span
      className="pa-swatch"
      style={{ background: color === 'white' ? 'var(--cream)' : 'var(--navy)' }}
      aria-hidden
    />
  )
}

export default function PositionAnalyzer({
  neuralEval,
  neuralAnalyze,
  premium = true,
  onUpgrade,
  onClose,
}: Props) {
  const { t } = useT()
  useEscape(onClose)
  // NOT: Eski touchmove pull-to-refresh guard'i KALDIRILDI — .analyzer gercek scroller
  // olmadigi durumda 'atTop'u hep dogru sanip YUKARI kaydirmayi engelliyordu (alta inince
  // yukari cikilamiyordu). Pull-to-refresh korumasi zaten App.css'te .register-overlay.page
  // uzerinde overscroll-behavior-y: contain ile saglaniyor.
  // Baslangicta kayitli dizilim varsa onu yukle (yoksa standart baslangic).
  const saved0 = loadSavedPos()
  const [pts, setPts] = useState<number[]>(() => saved0?.pts ?? initialState().points)
  const [bar, setBar] = useState<{ white: number; black: number }>(
    () => saved0?.bar ?? { white: 0, black: 0 },
  )
  const [off, setOff] = useState<{ white: number; black: number }>(
    () => saved0?.off ?? { white: 0, black: 0 },
  )
  const [turn, setTurn] = useState<Player>(() => saved0?.turn ?? 'white')
  const [cube, setCube] = useState<{ value: number; owner: Player | null }>(
    () => saved0?.cube ?? { value: 1, owner: null },
  )
  const [placeColor, setPlaceColor] = useState<Player>('white')
  const [editMode, setEditMode] = useState<'add' | 'remove'>('add')
  const [d1, setD1] = useState(0) // 0 = zar yok
  const [d2, setD2] = useState(0)
  const [matchLen, setMatchLen] = useState(0) // 0 = para oyunu; 1,3,5,7,9,11
  const [scoreW, setScoreW] = useState(0)
  const [scoreB, setScoreB] = useState(0)
  const [result, setResult] = useState<number[] | null>(null)
  const [moveRanked, setMoveRanked] = useState<RankedMove[] | null>(null)
  const [ply, setPly] = useState<1 | 2>(1) // analiz derinligi
  const [busy, setBusy] = useState(false)
  const [limitMsg, setLimitMsg] = useState(false) // "15 tas limiti" kibar uyarisi gorunur mu
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Fotograftan diz (vision)
  const [visionBusy, setVisionBusy] = useState(false)
  const [visionMsg, setVisionMsg] = useState('')
  const [warpFile, setWarpFile] = useState<File | null>(null) // kose-duzeltme adimi
  const fileRef = useRef<HTMLInputElement | null>(null)

  // Foto secilince once KOSE-DUZELTME adimi (acili foto -> tepeden-duz), sonra Opus.
  function onPickPhoto(e: RChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // ayni dosya tekrar secilebilsin
    if (!file) return
    setVisionMsg('')
    setWarpFile(file)
  }

  async function uploadWarped(file: File) {
    setWarpFile(null)
    setVisionBusy(true)
    setVisionMsg('')
    try {
      const r = await analyzeBoardImage(file)
      setPts(r.points.slice(0, 24))
      setBar({ white: r.bar?.white ?? 0, black: r.bar?.black ?? 0 })
      setOff({ white: r.off?.white ?? 0, black: r.off?.black ?? 0 })
      setResult(null)
      setMoveRanked(null)
      // Model dusuk guven bildirirse kullaniciyi kontrole cagir (foto zor okundu).
      setVisionMsg(r.confidence != null && r.confidence < 0.7 ? t('pa.photoLowConf') : t('pa.photoDone'))
    } catch {
      setVisionMsg(t('pa.photoFail'))
    } finally {
      setVisionBusy(false)
    }
  }

  const state: GameState = { points: pts, bar, off, turn, dice: [], diceUsed: [] }

  // Dizilim degistikce kalici kaydet (analyzer kapanip acilinca / yenilenince korunur).
  useEffect(() => {
    try {
      localStorage.setItem(PA_STORE_KEY, JSON.stringify({ pts, bar, off, turn, cube }))
    } catch {
      /* kota/private-mode: yoksay */
    }
  }, [pts, bar, off, turn, cube])

  const allFroms = new Set<number | 'bar'>([...Array(24).keys(), 'bar'])

  // Standart tavla: her renk toplam 15 pul. Tahtadaki (nokta + bar + toplanan) toplam.
  const MAX_CHECKERS = 15
  const whiteCount =
    bar.white + off.white + pts.reduce((s, v) => s + (v > 0 ? v : 0), 0)
  const blackCount =
    bar.black + off.black + pts.reduce((s, v) => s + (v < 0 ? -v : 0), 0)
  const atLimit = (color: Player) => (color === 'white' ? whiteCount : blackCount) >= MAX_CHECKERS

  // 15 tas limitine ulasinca kibar, gecici uyari goster (2.6sn sonra kaybolur)
  function warnLimit() {
    setLimitMsg(true)
    if (limitTimer.current) clearTimeout(limitTimer.current)
    limitTimer.current = setTimeout(() => setLimitMsg(false), 2600)
  }

  function editPoint(idx: number) {
    if (editMode === 'add' && atLimit(placeColor)) return warnLimit() // 15 pul siniri
    setResult(null)
    setPts((p) => {
      const n = p.slice()
      const cur = n[idx]
      if (editMode === 'remove') {
        n[idx] = cur > 0 ? cur - 1 : cur < 0 ? cur + 1 : 0
      } else if (placeColor === 'white') {
        n[idx] = cur >= 0 ? cur + 1 : 1
      } else {
        n[idx] = cur <= 0 ? cur - 1 : -1
      }
      return n
    })
  }

  function editBar() {
    if (editMode === 'add' && atLimit(placeColor)) return warnLimit() // 15 pul siniri
    setResult(null)
    setBar((b) => {
      const key = placeColor
      if (editMode === 'remove') return { ...b, [key]: Math.max(0, b[key] - 1) }
      return { ...b, [key]: b[key] + 1 }
    })
  }

  function handleFrom(from: number | 'bar') {
    if (from === 'bar') editBar()
    else editPoint(from)
  }

  // ----- Surukle-birak (fare + dokunma): mevcut pulu bir noktadan digerine tasi -----
  type DragFrom = { type: 'point'; idx: number } | { type: 'bar' }
  type DropLoc = DragFrom | { type: 'off' } | null
  const dragRef = useRef<{ color: Player; from: DragFrom; ghost: HTMLDivElement | null; moved: boolean; x0: number; y0: number } | null>(null)
  const justDraggedRef = useRef(false)

  const locFromPoint = (x: number, y: number): DropLoc => {
    const el = document.elementFromPoint(x, y)
    if (!el) return null
    const pt = el.closest('[data-point]') as HTMLElement | null
    if (pt) return { type: 'point', idx: Number(pt.dataset.point) }
    const slot = el.closest('[data-slot]') as HTMLElement | null
    if (slot?.dataset.slot === 'bar') return { type: 'bar' }
    if (slot?.dataset.slot === 'off') return { type: 'off' }
    return null
  }

  function performMove(color: Player, from: DragFrom, to: DropLoc) {
    if (!to) return
    if (from.type === 'point' && to.type === 'point' && from.idx === to.idx) return
    if (from.type === 'bar' && to.type === 'bar') return
    const sign = color === 'white' ? 1 : -1
    // Hedef nokta ters renk ile doluysa tasima yapma
    if (to.type === 'point') {
      const tv = pts[to.idx]
      if ((sign > 0 && tv < 0) || (sign < 0 && tv > 0)) return
    }
    const np = pts.slice()
    const nb = { ...bar }
    const no = { ...off }
    if (from.type === 'point') np[from.idx] -= sign
    else nb[color] = Math.max(0, nb[color] - 1)
    if (to.type === 'point') np[to.idx] += sign
    else if (to.type === 'bar') nb[color] += 1
    else no[color] += 1
    setPts(np)
    setBar(nb)
    setOff(no)
    setResult(null)
  }

  function onBoardPointerDown(e: RPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const target = e.target as HTMLElement
    const checkerEl = target.closest('.checker') as HTMLElement | null
    if (!checkerEl) return // surukleme yalnizca pul uzerinden baslar
    const color: Player = checkerEl.classList.contains('white') ? 'white' : 'black'
    const ptEl = target.closest('[data-point]') as HTMLElement | null
    const slotEl = target.closest('[data-slot]') as HTMLElement | null
    let from: DragFrom | null = null
    if (ptEl) from = { type: 'point', idx: Number(ptEl.dataset.point) }
    else if (slotEl?.dataset.slot === 'bar') from = { type: 'bar' }
    if (!from) return
    const rect = checkerEl.getBoundingClientRect()
    dragRef.current = { color, from, ghost: null, moved: false, x0: e.clientX, y0: e.clientY }

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      if (!d.moved && Math.hypot(ev.clientX - d.x0, ev.clientY - d.y0) < 6) return
      if (!d.moved) {
        d.moved = true
        const g = document.createElement('div')
        g.className = `checker ${d.color} pa-drag-ghost`
        g.style.width = `${rect.width}px`
        g.style.height = `${rect.height}px`
        document.body.appendChild(g)
        d.ghost = g
      }
      if (d.ghost) {
        d.ghost.style.left = `${ev.clientX}px`
        d.ghost.style.top = `${ev.clientY}px`
      }
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const d = dragRef.current
      dragRef.current = null
      if (d?.ghost) d.ghost.remove()
      if (d?.moved) {
        justDraggedRef.current = true // sonraki click'i (tas ekleme) bastir
        performMove(d.color, d.from, locFromPoint(ev.clientX, ev.clientY))
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function onBoardClickCapture(e: RMouseEvent<HTMLDivElement>) {
    if (justDraggedRef.current) {
      e.stopPropagation()
      justDraggedRef.current = false
    }
  }

  async function analyze() {
    setBusy(true)
    setResult(null)
    setMoveRanked(null)
    try {
      const deep = ply === 2
      if (d1 && d2) {
        // Zar verildi -> en iyi hamle(ler)
        const dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]
        const st: GameState = { ...state, dice, diceUsed: dice.map(() => false) }
        setMoveRanked(await neuralAnalyze(st, deep))
      } else {
        // Zarsiz -> pozisyonun genel kazanma sansi
        setResult(await neuralEval(state, turn, deep))
      }
    } catch {
      /* sinir agi yok */
    } finally {
      setBusy(false)
    }
  }

  const win = result ? (result[0] + result[1] + result[2]) * 100 : 0
  const gammon = result ? (result[1] + result[2]) * 100 : 0
  const bg = result ? result[2] * 100 : 0
  const winOf = (p: number[]) => (p[0] + p[1] + p[2]) * 100

  // Maç eşitlik tablosu (Kazaross-XG2 tarzı, 15×15). MET[a-1][b-1] = a-away oyuncunun
  // b-away rakibe karşı maç kazanma olasılığı (%). Simetrik: MET[a][b] + MET[b][a] = 100.
  const MET_PCT = [
    [50.0, 69.5, 75.0, 81.6, 84.3, 89.2, 90.8, 93.9, 94.9, 96.4, 97.0, 98.0, 98.3, 98.9, 99.1],
    [30.5, 50.0, 59.4, 66.4, 71.7, 76.4, 79.6, 83.5, 85.4, 88.3, 89.6, 91.6, 92.4, 93.9, 94.5],
    [25.0, 40.6, 50.0, 57.4, 63.6, 68.5, 72.8, 76.6, 79.6, 82.4, 84.6, 86.6, 88.1, 89.6, 90.7],
    [18.4, 33.6, 42.6, 50.0, 57.0, 62.6, 67.3, 71.5, 75.0, 78.2, 80.8, 83.2, 85.0, 86.8, 88.1],
    [15.7, 28.3, 36.4, 43.0, 50.0, 56.4, 61.6, 66.3, 70.2, 73.8, 76.8, 79.5, 81.7, 83.7, 85.3],
    [10.8, 23.6, 31.5, 37.4, 43.6, 50.0, 55.8, 60.9, 65.3, 69.2, 72.6, 75.6, 78.1, 80.4, 82.3],
    [9.2, 20.4, 27.2, 32.7, 38.4, 44.2, 50.0, 55.4, 60.1, 64.4, 68.1, 71.4, 74.2, 76.7, 78.9],
    [6.1, 16.5, 23.4, 28.5, 33.7, 39.1, 44.6, 50.0, 55.0, 59.5, 63.6, 67.2, 70.4, 73.2, 75.7],
    [5.1, 14.6, 20.4, 25.0, 29.8, 34.7, 39.9, 45.0, 50.0, 54.7, 59.0, 62.9, 66.4, 69.5, 72.2],
    [3.9, 11.7, 17.6, 21.8, 26.2, 30.8, 35.6, 40.5, 45.3, 50.0, 54.4, 58.5, 62.2, 65.6, 68.6],
    [3.0, 10.4, 15.4, 19.2, 23.2, 27.4, 31.9, 36.4, 41.0, 45.6, 50.0, 54.2, 58.1, 61.7, 64.9],
    [2.0, 8.4, 13.4, 16.8, 20.5, 24.4, 28.6, 32.8, 37.1, 41.5, 45.8, 50.0, 54.0, 57.7, 61.2],
    [1.7, 7.6, 11.9, 15.0, 18.3, 21.9, 25.8, 29.6, 33.6, 37.8, 41.9, 46.0, 50.0, 53.8, 57.4],
    [1.1, 6.1, 10.4, 13.2, 16.3, 19.6, 23.3, 26.8, 30.5, 34.4, 38.3, 42.3, 46.2, 50.0, 53.7],
    [0.9, 5.5, 9.3, 11.9, 14.7, 17.7, 21.1, 24.3, 27.8, 31.4, 35.1, 38.8, 42.6, 46.3, 50.0],
  ]
  const ME = (a: number, b: number): number => {
    if (a <= 0) return 1
    if (b <= 0) return 0
    return MET_PCT[Math.min(a, 15) - 1][Math.min(b, 15) - 1] / 100
  }

  // Küp kararı: skor girildiyse MET tabanlı (maç), yoksa para oyunu (cubeless)
  function cubeDecision(): { doublerKey: string; takerKey: string } {
    if (!result) return { doublerKey: '', takerKey: '' }
    const p = result
    const V = cube.value
    if (matchLen > 0) {
      const aM = turn === 'white' ? matchLen - scoreW : matchLen - scoreB
      const aO = turn === 'white' ? matchLen - scoreB : matchLen - scoreW
      const outs: [number, number, boolean][] = [
        [p[0] - p[1], 1, true],
        [p[1] - p[2], 2, true],
        [p[2], 3, true],
        [p[3] - p[4], 1, false],
        [p[4] - p[5], 2, false],
        [p[5], 3, false],
      ]
      const meAt = (cv: number) => {
        let m = 0
        for (const [pr, mult, win] of outs) {
          if (pr <= 0) continue
          const pts = cv * mult
          m += pr * (win ? ME(aM - pts, aO) : ME(aM, aO - pts))
        }
        return m
      }
      const meCash = aM - V <= 0 ? 1 : ME(aM - V, aO)
      const nd = meAt(V)
      const dt = meAt(V * 2)
      const opponentTakes = dt < meCash
      const afterDbl = Math.min(dt, meCash)
      if (afterDbl > nd + 0.002) {
        return { doublerKey: 'cube.double', takerKey: opponentTakes ? 'cube.take' : 'cube.pass' }
      }
      if (nd > meCash + 0.005) return { doublerKey: 'cube.tooGood', takerKey: '' }
      return { doublerKey: 'cube.noDouble', takerKey: opponentTakes ? 'cube.take' : 'cube.pass' }
    }
    // Para oyunu
    const eq = equityFrom(p)
    const tooGood = eq >= 0.7 && p[1] >= 0.35
    return {
      doublerKey: eq < 0.3 ? 'cube.noDouble' : tooGood ? 'cube.tooGood' : 'cube.double',
      takerKey: tooGood ? '' : eq < 0.5 ? 'cube.take' : 'cube.pass',
    }
  }
  const { doublerKey, takerKey } = cubeDecision()

  return (
    <>
    <div className="analyzer">
      <div className="analyzer-head">
        <h2><Icon name="search" size={20} /> {t('pa.title')}</h2>
        {/* Kapat dugmesi kaldirildi (kullanici istegi): cikis hamburger menu / ESC ile. */}
      </div>

      <div className="analyzer-body">
        <div
          className="analyzer-board"
          onPointerDown={onBoardPointerDown}
          onClickCapture={onBoardClickCapture}
          onDragStartCapture={(e) => e.preventDefault()}
        >
          {limitMsg && (
            <div className="pa-limit-toast" role="alert">
              <Icon name="alert" size={15} /> {t('pa.limitWarn')}
            </div>
          )}
          <Board
            state={state}
            selectableFroms={allFroms}
            targets={new Set()}
            selectedFrom={null}
            onSelectFrom={handleFrom}
            onSelectTarget={() => {}}
            onDragFrom={() => {}}
            pipTop={pipCount(state, 'black')}
            pipBottom={pipCount(state, 'white')}
            cube={cube}
            showPip
          />
        </div>

        <div className="analyzer-controls">
          <div className="pa-hint">{t('pa.hint')}</div>

          <div className="setup-row">
            <div className="setup-label">{t('pa.place')}</div>
            <div className="menu-targets">
              <Button
                variant={placeColor === 'white' && editMode === 'add' ? 'secondary' : 'ghost'}
                onClick={() => {
                  setPlaceColor('white')
                  setEditMode('add')
                }}
              >
                <Swatch color="white" /> {t('pa.white')}
              </Button>
              <Button
                variant={placeColor === 'black' && editMode === 'add' ? 'secondary' : 'ghost'}
                onClick={() => {
                  setPlaceColor('black')
                  setEditMode('add')
                }}
              >
                <Swatch color="black" /> {t('pa.black')}
              </Button>
              <Button
                variant={editMode === 'remove' ? 'secondary' : 'ghost'}
                onClick={() => setEditMode('remove')}
              >
                ➖ {t('pa.remove')}
              </Button>
            </div>
            <div className="pa-count">
              <span className={whiteCount >= MAX_CHECKERS ? 'full' : ''}>
                <Swatch color="white" /> {whiteCount}/{MAX_CHECKERS}
              </span>
              <span className={blackCount >= MAX_CHECKERS ? 'full' : ''}>
                <Swatch color="black" /> {blackCount}/{MAX_CHECKERS}
              </span>
            </div>
          </div>

          <div className="setup-row">
            <div className="setup-label">{t('pa.turn')}</div>
            <div className="menu-targets">
              <Button
                variant={turn === 'white' ? 'secondary' : 'ghost'}
                onClick={() => {
                  setTurn('white')
                  setResult(null)
                }}
              >
                <Swatch color="white" /> {t('pa.white')}
              </Button>
              <Button
                variant={turn === 'black' ? 'secondary' : 'ghost'}
                onClick={() => {
                  setTurn('black')
                  setResult(null)
                }}
              >
                <Swatch color="black" /> {t('pa.black')}
              </Button>
            </div>
          </div>

          <div className="setup-row">
            <div className="setup-label">{t('pa.cube')}</div>
            <div className="menu-targets">
              {[1, 2, 4, 8, 16, 32, 64].map((v) => (
                <Button
                  key={v}
                  variant={cube.value === v ? 'secondary' : 'ghost'}
                  onClick={() => setCube((c) => ({ ...c, value: v }))}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          <div className="setup-row">
            <div className="setup-label">{t('pa.cubeOwner')}</div>
            <div className="menu-targets">
              <Button
                size="icon"
                variant={cube.owner === 'white' ? 'secondary' : 'ghost'}
                onClick={() => setCube((c) => ({ ...c, owner: 'white' }))}
              >
                <Swatch color="white" />
              </Button>
              <Button
                variant={cube.owner === null ? 'secondary' : 'ghost'}
                onClick={() => setCube((c) => ({ ...c, owner: null }))}
              >
                {t('pa.center')}
              </Button>
              <Button
                size="icon"
                variant={cube.owner === 'black' ? 'secondary' : 'ghost'}
                onClick={() => setCube((c) => ({ ...c, owner: 'black' }))}
              >
                <Swatch color="black" />
              </Button>
            </div>
          </div>

          <div className="setup-row">
            <div className="setup-label">{t('pa.match')}</div>
            <div className="menu-targets">
              {[0, 1, 3, 5, 7, 9, 11, 13, 15, 21].map((n) => (
                <Button
                  key={n}
                  variant={matchLen === n ? 'secondary' : 'ghost'}
                  onClick={() => setMatchLen(n)}
                >
                  {n === 0 ? t('pa.money') : n}
                </Button>
              ))}
            </div>
            {matchLen > 0 && (
              <div className="pa-score">
                <label>
                  <Swatch color="white" />
                  <input
                    type="number"
                    min={0}
                    max={matchLen - 1}
                    value={scoreW}
                    onChange={(e) => setScoreW(Math.max(0, Number(e.target.value)))}
                  />
                </label>
                <label>
                  <Swatch color="black" />
                  <input
                    type="number"
                    min={0}
                    max={matchLen - 1}
                    value={scoreB}
                    onChange={(e) => setScoreB(Math.max(0, Number(e.target.value)))}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="setup-row">
            <div className="setup-label">{t('pa.dice')}</div>
            <div className="menu-targets pa-dice">
              <Button
                variant={d1 === 0 && d2 === 0 ? 'secondary' : 'ghost'}
                onClick={() => {
                  setD1(0)
                  setD2(0)
                  setMoveRanked(null)
                }}
              >
                {t('pa.noDice')}
              </Button>
              <select value={d1} onChange={(e) => setD1(Number(e.target.value))}>
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? '–' : n}
                  </option>
                ))}
              </select>
              <select value={d2} onChange={(e) => setD2(Number(e.target.value))}>
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? '–' : n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="setup-row">
            <div className="setup-label">{t('pa.depth')}</div>
            <div className="menu-targets">
              <Button
                variant={ply === 1 ? 'secondary' : 'ghost'}
                onClick={() => setPly(1)}
              >
                {t('pa.ply1')}
              </Button>
              <Button
                variant={ply === 2 ? 'secondary' : 'ghost'}
                className={premium ? undefined : 'locked'}
                onClick={() => (premium ? setPly(2) : onUpgrade?.())}
              >
                {!premium && <Icon name="crown" size={13} />} {t('pa.ply2')}
              </Button>
            </div>
            <div className="pa-depth-note">{ply === 2 ? t('pa.ply2Note') : t('pa.ply1Note')}</div>
          </div>

          <div className="setup-row">
            <div className="menu-targets">
              <Button
                variant="outline"
                onClick={() => {
                  setPts(initialState().points)
                  setBar({ white: 0, black: 0 })
                  setOff({ white: 0, black: 0 })
                  setResult(null)
                }}
              >
                {t('pa.standard')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPts(emptyPoints())
                  setBar({ white: 0, black: 0 })
                  setOff({ white: 0, black: 0 })
                  setResult(null)
                }}
              >
                {t('pa.clear')}
              </Button>
            </div>
          </div>

          {/* Fotograftan diz: gorseli backend vision'a yollar, pozisyonu dizer. */}
          <div className="setup-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickPhoto}
            />
            <Button
              variant="secondary"
              className="pa-photo"
              disabled={visionBusy}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="camera" size={16} /> {visionBusy ? t('pa.photoBusy') : t('pa.photo')}
            </Button>
            {visionMsg && <span className="pa-photo-msg">{visionMsg}</span>}
          </div>

          <Button variant="default" className="pa-analyze" disabled={busy} onClick={analyze}>
            {busy ? (
              t('an.loading')
            ) : (
              <>
                <Icon name="search" size={16} /> {t('pa.analyze')}
              </>
            )}
          </Button>
        </div>

        <div className="analyzer-results">
          {!result && !moveRanked && <div className="pa-placeholder">{t('pa.resultsPlaceholder')}</div>}

          {result && (
            <div className="pa-result">
              <div className="pa-win">
                <Swatch color={turn} />{' '}
                {t('pa.winChance', { name: turn === 'white' ? t('pa.white') : t('pa.black') })}
                <b> {win.toFixed(1)}%</b>
              </div>
              <div className="prob-sub">
                {t('an.gammon')} {gammon.toFixed(1)}% · {t('an.bg')} {bg.toFixed(1)}%
              </div>
              <div className="prob-sub">
                {t('an.equity')}: {equityFrom(result).toFixed(3)}
              </div>
              <div className="pa-cube">
                <div className="pa-cube-head"><Icon name="dice" size={16} /> {t('cube.title')}</div>
                <div className="pa-cube-row">
                  <span>{t('cube.doublerAction')}</span>
                  <b className={doublerKey === 'cube.noDouble' ? 'muted' : 'good'}>
                    {t(doublerKey)}
                  </b>
                </div>
                {takerKey && (
                  <div className="pa-cube-row">
                    <span>{t('cube.opponentAction')}</span>
                    <b className={takerKey === 'cube.take' ? 'good' : 'bad'}>{t(takerKey)}</b>
                  </div>
                )}
                <div className="pa-cube-note">
                  {matchLen > 0
                    ? t('cube.matchNote', { n: matchLen, sw: scoreW, sb: scoreB })
                    : t('cube.note')}
                </div>
              </div>
            </div>
          )}

          {moveRanked && moveRanked.length > 0 && (
            <div className="pa-result">
              <div className="pa-win">
                {t('pa.bestMove')}: <b>{moveNotation(moveRanked[0].move, turn)}</b>
              </div>
              <div className="prob-sub">
                <Swatch color={turn} />{' '}
                {t('pa.winChance', { name: turn === 'white' ? t('pa.white') : t('pa.black') })}{' '}
                {winOf(moveRanked[0].probs).toFixed(1)}% · {t('an.equity')}:{' '}
                {moveRanked[0].equity.toFixed(3)}
              </div>
              <div className="move-list">
                <div className="move-list-head">{t('an.bestMoves')}</div>
                {moveRanked.slice(0, 5).map((r, i) => (
                  <div key={r.move.resultKey} className={`move-row ${i === 0 ? 'best' : ''}`}>
                    <span className="rank">{i + 1}.</span>
                    <span className="notation">{moveNotation(r.move, turn)}</span>
                    <span className="eq">{r.equity.toFixed(3)}</span>
                    <span className="diff">
                      {i === 0 ? '' : (r.equity - moveRanked[0].equity).toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {warpFile && (
      <BoardPhotoWarp file={warpFile} onResult={uploadWarped} onCancel={() => setWarpFile(null)} />
    )}
    </>
  )
}
