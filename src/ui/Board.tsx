import { memo, type ReactNode } from 'react'
import type { GameState, Player } from '../engine/types'
import { TavlaTvLogo } from './TavlaTvLogo'
import { useT } from '../i18n'

// Ucgen index dizilimleri (index = ucgen numarasi - 1)
// normal = beyazin bakisi (kendi evi sag-alt). flipped = siyahin bakisi (180 cevrilmis).
const LAYOUT = {
  normal: {
    TL: [12, 13, 14, 15, 16, 17],
    TR: [18, 19, 20, 21, 22, 23],
    BL: [11, 10, 9, 8, 7, 6],
    BR: [5, 4, 3, 2, 1, 0],
    topNums: [
      [13, 14, 15, 16, 17, 18],
      [19, 20, 21, 22, 23, 24],
    ],
    botNums: [
      [12, 11, 10, 9, 8, 7],
      [6, 5, 4, 3, 2, 1],
    ],
  },
  flipped: {
    TL: [11, 10, 9, 8, 7, 6],
    TR: [5, 4, 3, 2, 1, 0],
    BL: [12, 13, 14, 15, 16, 17],
    BR: [18, 19, 20, 21, 22, 23],
    topNums: [
      [12, 11, 10, 9, 8, 7],
      [6, 5, 4, 3, 2, 1],
    ],
    botNums: [
      [13, 14, 15, 16, 17, 18],
      [19, 20, 21, 22, 23, 24],
    ],
  },
} as const

interface BoardProps {
  state: GameState
  selectableFroms: Set<number | 'bar'>
  targets: Set<number | 'off'>
  selectedFrom: number | 'bar' | null
  onSelectFrom: (from: number | 'bar') => void
  onSelectTarget: (to: number | 'off') => void
  onDragFrom: (from: number | 'bar') => void
  pipTop: number
  pipBottom: number
  cube: { value: number; owner: Player | null }
  centerLeft?: ReactNode
  centerRight?: ReactNode
  centerMain?: ReactNode
  flip?: boolean // true: siyah oyuncunun bakisi (tahta 180 cevrilir)
  showPip?: boolean // pip sayilari gorunur mu
  watermark?: string // kulup temalarinda board ortasindaki cok soluk takim adi
}

function checkersOf(state: GameState, index: number): { player: Player; count: number } | null {
  const v = state.points[index]
  if (v === 0) return null
  return { player: v > 0 ? 'white' : 'black', count: Math.abs(v) }
}

function Checker({
  player,
  draggable,
  onDragStart,
  label,
}: {
  player: Player
  draggable?: boolean
  onDragStart?: () => void
  label?: number // 5'ten fazla tasta ustteki tasa toplam sayi yazilir
}) {
  return (
    <div
      className={`checker ${player} ${draggable ? 'draggable' : ''}`}
      draggable={draggable}
      onDragStart={
        onDragStart
          ? (e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', 'checker')
              onDragStart()
            }
          : undefined
      }
    >
      {label != null && <span className="checker-count">{label}</span>}
    </div>
  )
}

function Point({
  index,
  top,
  state,
  selectable,
  isTarget,
  selected,
  onSelectFrom,
  onSelectTarget,
  onDragFrom,
}: {
  index: number
  top: boolean
  state: GameState
  selectable: boolean
  isTarget: boolean
  selected: boolean
  onSelectFrom: (from: number) => void
  onSelectTarget: (to: number) => void
  onDragFrom: (from: number) => void
}) {
  const stack = checkersOf(state, index)
  const shade = index % 2 === 0 ? 'a' : 'b'
  const classes = [
    'point',
    top ? 'top' : 'bottom',
    `shade-${shade}`,
    selectable ? 'selectable' : '',
    isTarget ? 'target' : '',
    selected ? 'selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleClick = () => {
    if (isTarget) onSelectTarget(index)
    else if (selectable) onSelectFrom(index)
  }

  const visible = stack ? Math.min(stack.count, 5) : 0
  return (
    <div
      className={classes}
      data-point={index}
      onClick={handleClick}
      onDragOver={isTarget ? (e) => e.preventDefault() : undefined}
      onDrop={isTarget ? () => onSelectTarget(index) : undefined}
    >
      <div className="checkers">
        {Array.from({ length: visible }).map((_, i) => (
          <Checker
            key={i}
            player={stack!.player}
            draggable={selectable}
            onDragStart={selectable ? () => onDragFrom(index) : undefined}
            label={stack!.count > 5 && i === visible - 1 ? stack!.count : undefined}
          />
        ))}
      </div>
    </div>
  )
}

function Board({
  state,
  selectableFroms,
  targets,
  selectedFrom,
  onSelectFrom,
  onSelectTarget,
  onDragFrom,
  pipTop,
  pipBottom,
  cube,
  centerLeft,
  centerRight,
  centerMain,
  flip = false,
  showPip = true,
  watermark,
}: BoardProps) {
  const { t } = useT()
  const L = flip ? LAYOUT.flipped : LAYOUT.normal

  const renderPoint = (index: number, top: boolean) => (
    <Point
      key={index}
      index={index}
      top={top}
      state={state}
      selectable={selectableFroms.has(index)}
      isTarget={targets.has(index)}
      selected={selectedFrom === index}
      onSelectFrom={onSelectFrom}
      onSelectTarget={onSelectTarget}
      onDragFrom={onDragFrom}
    />
  )

  const barSelectable = selectableFroms.has('bar')
  const offTarget = targets.has('off')

  // Cevrilince ust/alt taraflar yer degistirir (kendi taslarin hep altta)
  const topPip = flip ? pipBottom : pipTop
  const bottomPip = flip ? pipTop : pipBottom
  const topBarPlayer: Player = flip ? 'white' : 'black'
  const bottomBarPlayer: Player = flip ? 'black' : 'white'
  const topBarCount = flip ? state.bar.white : state.bar.black
  const bottomBarCount = flip ? state.bar.black : state.bar.white
  const topOffPlayer: Player = flip ? 'white' : 'black'
  const topOffCount = flip ? state.off.white : state.off.black
  const bottomOffPlayer: Player = flip ? 'black' : 'white'
  const bottomOffCount = flip ? state.off.black : state.off.white

  return (
    <div className="board">
      {/* Ust ucgen numaralari */}
      <div className="pt-numbers top">
        {L.topNums[0].map((n) => (
          <span key={n}>{n}</span>
        ))}
        <span className="num-gap" />
        {L.topNums[1].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>

      <div className="board-inner">
        {/* TavlaTV watermark: her yarinin merkezinde, taslarin/zarin/kupun ALTINDA,
            pointlerin USTUNDE. Logo/arma DEGIL; sadece yazi. Kulup temasinda takim adi. */}
        <div className="board-watermark" aria-hidden="true">
          <div className="wm-cell">
            <TavlaTvLogo color="var(--wm-color)" size="calc(var(--col) * 0.62)" className="wm-logo" />
            {watermark && <span className="wm-team">{watermark}</span>}
          </div>
          <div className="wm-cell">
            <TavlaTvLogo color="var(--wm-color)" size="calc(var(--col) * 0.62)" className="wm-logo" />
            {watermark && <span className="wm-team">{watermark}</span>}
          </div>
        </div>

        {/* Sol yari */}
        <div className="half">
          <div className="quadrant top">{L.TL.map((i) => renderPoint(i, true))}</div>
          <div className="quadrant bottom">{L.BL.map((i) => renderPoint(i, false))}</div>
        </div>

        {/* Orta bar: pip sayilari + cube + bar taslari */}
        <div
          className={`bar ${barSelectable ? 'selectable' : ''} ${selectedFrom === 'bar' ? 'selected' : ''}`}
          data-slot="bar"
          onClick={() => barSelectable && onSelectFrom('bar')}
        >
          {showPip && <div className="pip pip-top">{topPip}</div>}
          <div className="bar-checkers top">
            {Array.from({ length: topBarCount }).map((_, i) => (
              <Checker
                key={i}
                player={topBarPlayer}
                draggable={barSelectable}
                onDragStart={barSelectable ? () => onDragFrom('bar') : undefined}
              />
            ))}
          </div>
          <div className={`cube owner-${cube.owner ?? 'center'}`} title={t('board.cube')}>
            {cube.value === 1 ? 64 : cube.value}
          </div>
          <div className="bar-checkers bottom">
            {Array.from({ length: bottomBarCount }).map((_, i) => (
              <Checker
                key={i}
                player={bottomBarPlayer}
                draggable={barSelectable}
                onDragStart={barSelectable ? () => onDragFrom('bar') : undefined}
              />
            ))}
          </div>
          {showPip && <div className="pip pip-bottom">{bottomPip}</div>}
        </div>

        {/* Sag yari */}
        <div className="half">
          <div className="quadrant top">{L.TR.map((i) => renderPoint(i, true))}</div>
          <div className="quadrant bottom">{L.BR.map((i) => renderPoint(i, false))}</div>
        </div>

        {/* Merkez overlay (Double / Roll / zar / kup / oyun sonu) */}
        {centerMain ? (
          <div className="center-overlay main">{centerMain}</div>
        ) : (
          <>
            {centerLeft && <div className="center-overlay left">{centerLeft}</div>}
            {centerRight && <div className="center-overlay right">{centerRight}</div>}
          </>
        )}
      </div>

      {/* Alt ucgen numaralari */}
      <div className="pt-numbers bottom">
        {L.botNums[0].map((n) => (
          <span key={n}>{n}</span>
        ))}
        <span className="num-gap" />
        {L.botNums[1].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>

      {/* Sag bear-off tepsisi (off hedefi) */}
      <div
        className={`bearoff ${offTarget ? 'target' : ''}`}
        data-slot="off"
        onClick={() => offTarget && onSelectTarget('off')}
        onDragOver={offTarget ? (e) => e.preventDefault() : undefined}
        onDrop={offTarget ? () => onSelectTarget('off') : undefined}
      >
        <div className="bearoff-slot top">
          {topOffCount > 0 && (
            <span className={`bearoff-count ${topOffPlayer}`}>{topOffCount}</span>
          )}
          {Array.from({ length: topOffCount }).map((_, i) => (
            <span key={i} className={`off-checker ${topOffPlayer}`} />
          ))}
        </div>
        <div className="bearoff-slot bottom">
          {Array.from({ length: bottomOffCount }).map((_, i) => (
            <span key={i} className={`off-checker ${bottomOffPlayer}`} />
          ))}
          {bottomOffCount > 0 && (
            <span className={`bearoff-count ${bottomOffPlayer}`}>{bottomOffCount}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// React.memo: ust bileşen ayni prop'larla yeniden render olursa Board atlanir.
// Tam fayda icin App.tsx handler'lari useCallback'e alinmali (App bolme faziyla).
export default memo(Board)
