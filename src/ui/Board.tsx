import type { ReactNode } from 'react'
import type { GameState, Player } from '../engine/types'

// Ucgen index dizilimleri (index = ucgen numarasi - 1)
const TOP_LEFT = [12, 13, 14, 15, 16, 17]
const TOP_RIGHT = [18, 19, 20, 21, 22, 23]
const BOTTOM_LEFT = [11, 10, 9, 8, 7, 6]
const BOTTOM_RIGHT = [5, 4, 3, 2, 1, 0]

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
}: {
  player: Player
  draggable?: boolean
  onDragStart?: () => void
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
    />
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
          />
        ))}
        {stack && stack.count > 5 && <div className="overflow">{stack.count}</div>}
      </div>
    </div>
  )
}

export default function Board({
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
}: BoardProps) {
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

  return (
    <div className="board">
      {/* Ust ucgen numaralari */}
      <div className="pt-numbers top">
        {[13, 14, 15, 16, 17, 18].map((n) => (
          <span key={n}>{n}</span>
        ))}
        <span className="num-gap" />
        {[19, 20, 21, 22, 23, 24].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>

      <div className="board-inner">
        {/* Sol yari */}
        <div className="half">
          <div className="quadrant top">{TOP_LEFT.map((i) => renderPoint(i, true))}</div>
          <div className="quadrant bottom">{BOTTOM_LEFT.map((i) => renderPoint(i, false))}</div>
        </div>

        {/* Orta bar: pip sayilari + cube + bar taslari */}
        <div
          className={`bar ${barSelectable ? 'selectable' : ''} ${selectedFrom === 'bar' ? 'selected' : ''}`}
          onClick={() => barSelectable && onSelectFrom('bar')}
        >
          <div className="pip pip-top">{pipTop}</div>
          <div className="bar-checkers top">
            {Array.from({ length: state.bar.black }).map((_, i) => (
              <Checker
                key={i}
                player="black"
                draggable={barSelectable}
                onDragStart={barSelectable ? () => onDragFrom('bar') : undefined}
              />
            ))}
          </div>
          <div className={`cube owner-${cube.owner ?? 'center'}`} title="Küp">
            {cube.value === 1 ? 64 : cube.value}
          </div>
          <div className="bar-checkers bottom">
            {Array.from({ length: state.bar.white }).map((_, i) => (
              <Checker
                key={i}
                player="white"
                draggable={barSelectable}
                onDragStart={barSelectable ? () => onDragFrom('bar') : undefined}
              />
            ))}
          </div>
          <div className="pip pip-bottom">{pipBottom}</div>
        </div>

        {/* Sag yari */}
        <div className="half">
          <div className="quadrant top">{TOP_RIGHT.map((i) => renderPoint(i, true))}</div>
          <div className="quadrant bottom">{BOTTOM_RIGHT.map((i) => renderPoint(i, false))}</div>
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
        {[12, 11, 10, 9, 8, 7].map((n) => (
          <span key={n}>{n}</span>
        ))}
        <span className="num-gap" />
        {[6, 5, 4, 3, 2, 1].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>

      {/* Sag bear-off tepsisi (off hedefi) */}
      <div
        className={`bearoff ${offTarget ? 'target' : ''}`}
        onClick={() => offTarget && onSelectTarget('off')}
        onDragOver={offTarget ? (e) => e.preventDefault() : undefined}
        onDrop={offTarget ? () => onSelectTarget('off') : undefined}
      >
        <div className="bearoff-slot top">
          {Array.from({ length: state.off.black }).map((_, i) => (
            <span key={i} className="off-checker black" />
          ))}
        </div>
        <div className="bearoff-slot bottom">
          {Array.from({ length: state.off.white }).map((_, i) => (
            <span key={i} className="off-checker white" />
          ))}
        </div>
      </div>
    </div>
  )
}
