// Makale (yazi) içindeki tahta şemalarını GERÇEK oyun tahtasıyla (Pozisyon Analizi'ndeki
// Board bileşeni) render eder. Makale gövdesindeki eski statik SVG <figure class="board-figure">
// blokları istemcide ayrıştırılıp (parseBoardFigure) konuma çevrilir; sonra buradaki ArticleBoard
// aynı konumu canlı Board + kibar hamle okları (MoveArrows) ile çizer. Etkileşim YOK (salt görsel).
import { useMemo } from 'react'
import Board from './Board'
import { MoveArrows } from './MatReview'
import { pipCount } from '../engine/evaluate'
import type { GameState, Step } from '../engine/types'

const EMPTY_FROMS: Set<number | 'bar'> = new Set()
const EMPTY_TARGETS: Set<number | 'off'> = new Set()
const noop = () => {}

// ---- SVG şema koordinatları -> hane numarası (1..24) eşlemesi ----
// Üretilen board-figure SVG'lerinin sabit geometrisi (720×455 iç alan): her hanenin
// yatay merkezi (cx) sabittir; üst/alt yarım cy ile ayrılır; bar merkez (~379).
const BOTTOM: [number, number][] = [
  [680, 1], [626, 2], [572, 3], [518, 4], [464, 5], [410, 6],
  [318, 7], [264, 8], [210, 9], [156, 10], [102, 11], [48, 12],
]
const TOP: [number, number][] = [
  [48, 13], [102, 14], [156, 15], [210, 16], [264, 17], [318, 18],
  [410, 19], [464, 20], [518, 21], [572, 22], [626, 23], [680, 24],
]
const Y_MID = 228 // board iç alanı y 20..435 -> orta ~227

// (x,y) -> hane numarası (1..24), bar ise 'bar', eşleşme yoksa null.
function pointNumberAt(x: number, y: number): number | 'bar' | null {
  if (x >= 360 && x <= 398) return 'bar' // merkez bar sütunu
  const row = y < Y_MID ? TOP : BOTTOM
  let best: number | null = null
  let bestD = 28 // yarım sütun toleransı (~27px)
  for (const [cx, num] of row) {
    const d = Math.abs(cx - x)
    if (d < bestD) {
      bestD = d
      best = num
    }
  }
  return best
}

// #rrggbb dolgusundan taş rengi: açık = beyaz oyuncu, koyu = siyah.
function colorOf(fill: string): 'white' | 'black' {
  const m = /#?([0-9a-f]{6})/i.exec(fill.trim())
  if (!m) return 'white'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 140 ? 'white' : 'black'
}

export interface ParsedBoard {
  state: GameState
  steps: Step[]
  caption: string | null
}

// Eski <figure class="board-figure"> ögesini (içindeki SVG) konuma + hamle oklarına çevirir.
// Taş bulunamazsa null döner (çağıran orijinal HTML'e düşer).
export function parseBoardFigure(figure: Element): ParsedBoard | null {
  const svg = figure.querySelector('svg')
  if (!svg) return null
  const points = new Array<number>(24).fill(0)
  const bar: Record<'white' | 'black', number> = { white: 0, black: 0 }
  let any = false
  for (const c of Array.from(svg.querySelectorAll('circle'))) {
    const cx = parseFloat(c.getAttribute('cx') || '')
    const cy = parseFloat(c.getAttribute('cy') || '')
    if (!isFinite(cx) || !isFinite(cy)) continue
    const where = pointNumberAt(cx, cy)
    if (where == null) continue
    const color = colorOf(c.getAttribute('fill') || '')
    if (where === 'bar') bar[color] += 1
    else {
      points[where - 1] += color === 'white' ? 1 : -1
    }
    any = true
  }
  if (!any) return null

  // Hamle okları: <path ... marker-end> d="M x1 y1 Q .. x2 y2"
  const steps: Step[] = []
  for (const p of Array.from(svg.querySelectorAll('path[marker-end]'))) {
    const nums = (p.getAttribute('d') || '').match(/-?[\d.]+/g)
    if (!nums || nums.length < 4) continue
    const x1 = parseFloat(nums[0])
    const y1 = parseFloat(nums[1])
    const x2 = parseFloat(nums[nums.length - 2])
    const y2 = parseFloat(nums[nums.length - 1])
    const a = pointNumberAt(x1, y1)
    const b = pointNumberAt(x2, y2)
    const from: number | 'bar' = a === 'bar' ? 'bar' : a != null ? a - 1 : NaN
    let to: number | 'off'
    if (b != null && b !== 'bar') to = b - 1
    else if (x2 < 24 || x2 > 700) to = 'off'
    else continue
    if (typeof from === 'number' && Number.isNaN(from)) continue
    steps.push({ from, to, die: 0 })
  }

  const cap = figure.querySelector('figcaption')?.textContent?.trim() || null
  return {
    state: { points, bar, off: { white: 0, black: 0 }, turn: 'white', dice: [], diceUsed: [] },
    steps,
    caption: cap,
  }
}

// Canlı tahta + (varsa) hamle okları. analysis-detail ile aynı container-query ölçekleme
// (.article-board container-type:inline-size + .article-board-stage --board-h override) App.css'te.
export default function ArticleBoard({ state, steps, caption }: ParsedBoard) {
  const dep = useMemo(
    () => steps.map((s) => `${s.from}>${s.to}`).join(','),
    [steps],
  )
  return (
    <figure className="article-board">
      <div className="article-board-stage an-board-stage">
        <Board
          state={state}
          selectableFroms={EMPTY_FROMS}
          targets={EMPTY_TARGETS}
          selectedFrom={null}
          onSelectFrom={noop}
          onSelectTarget={noop}
          onDragFrom={noop}
          pipTop={pipCount(state, 'black')}
          pipBottom={pipCount(state, 'white')}
          cube={{ value: 1, owner: null }}
          showPip={false}
        />
        {steps.length > 0 && <MoveArrows steps={steps} dep={dep} />}
      </div>
      {caption && <figcaption className="article-board-caption">{caption}</figcaption>}
    </figure>
  )
}
