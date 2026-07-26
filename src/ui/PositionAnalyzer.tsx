import { useState } from 'react'
import type { GameState, Player } from '../engine/types'
import { initialState } from '../engine/game'
import { pipCount } from '../engine/evaluate'
import { equityFrom } from '../engine/encoding'
import { moveNotation } from '../engine/notation'
import type { RankedMove } from '../engine/neuralBot'
import Board from './Board'
import { useT } from '../i18n'

interface Props {
  neuralEval: (state: GameState, onRoll: Player) => Promise<number[]>
  neuralAnalyze: (state: GameState) => Promise<RankedMove[]>
  onClose: () => void
}

const emptyPoints = () => new Array(24).fill(0)

export default function PositionAnalyzer({ neuralEval, neuralAnalyze, onClose }: Props) {
  const { t } = useT()
  const [pts, setPts] = useState<number[]>(() => initialState().points)
  const [bar, setBar] = useState<{ white: number; black: number }>({ white: 0, black: 0 })
  const [off, setOff] = useState<{ white: number; black: number }>({ white: 0, black: 0 })
  const [turn, setTurn] = useState<Player>('white')
  const [cube, setCube] = useState<{ value: number; owner: Player | null }>({
    value: 1,
    owner: null,
  })
  const [placeColor, setPlaceColor] = useState<Player>('white')
  const [editMode, setEditMode] = useState<'add' | 'remove'>('add')
  const [d1, setD1] = useState(0) // 0 = zar yok
  const [d2, setD2] = useState(0)
  const [result, setResult] = useState<number[] | null>(null)
  const [moveRanked, setMoveRanked] = useState<RankedMove[] | null>(null)
  const [busy, setBusy] = useState(false)

  const state: GameState = { points: pts, bar, off, turn, dice: [], diceUsed: [] }

  const allFroms = new Set<number | 'bar'>([...Array(24).keys(), 'bar'])

  function editPoint(idx: number) {
    setResult(null)
    setPts((p) => {
      const n = p.slice()
      const cur = n[idx]
      if (editMode === 'remove') {
        n[idx] = cur > 0 ? cur - 1 : cur < 0 ? cur + 1 : 0
      } else if (placeColor === 'white') {
        n[idx] = cur >= 0 ? Math.min(cur + 1, 15) : 1
      } else {
        n[idx] = cur <= 0 ? Math.max(cur - 1, -15) : -1
      }
      return n
    })
  }

  function editBar() {
    setResult(null)
    setBar((b) => {
      const key = placeColor
      const d = editMode === 'remove' ? -1 : 1
      return { ...b, [key]: Math.max(0, Math.min(15, b[key] + d)) }
    })
  }

  function handleFrom(from: number | 'bar') {
    if (from === 'bar') editBar()
    else editPoint(from)
  }

  async function analyze() {
    setBusy(true)
    setResult(null)
    setMoveRanked(null)
    try {
      if (d1 && d2) {
        // Zar verildi -> en iyi hamle(ler)
        const dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2]
        const st: GameState = { ...state, dice, diceUsed: dice.map(() => false) }
        setMoveRanked(await neuralAnalyze(st))
      } else {
        // Zarsiz -> pozisyonun genel kazanma sansi
        setResult(await neuralEval(state, turn))
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

  return (
    <div className="analyzer">
      <div className="analyzer-head">
        <h2>🔬 {t('pa.title')}</h2>
        <button className="menu-btn" onClick={onClose}>
          ✕ {t('pa.close')}
        </button>
      </div>

      <div className="analyzer-body">
        <div className="analyzer-board">
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
              <button
                className={placeColor === 'white' && editMode === 'add' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => {
                  setPlaceColor('white')
                  setEditMode('add')
                }}
              >
                ⚪ {t('pa.white')}
              </button>
              <button
                className={placeColor === 'black' && editMode === 'add' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => {
                  setPlaceColor('black')
                  setEditMode('add')
                }}
              >
                ⚫ {t('pa.black')}
              </button>
              <button
                className={editMode === 'remove' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => setEditMode('remove')}
              >
                ➖ {t('pa.remove')}
              </button>
            </div>
          </div>

          <div className="setup-row">
            <div className="setup-label">{t('pa.turn')}</div>
            <div className="menu-targets">
              <button
                className={turn === 'white' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => {
                  setTurn('white')
                  setResult(null)
                }}
              >
                ⚪ {t('pa.white')}
              </button>
              <button
                className={turn === 'black' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => {
                  setTurn('black')
                  setResult(null)
                }}
              >
                ⚫ {t('pa.black')}
              </button>
            </div>
          </div>

          <div className="setup-row">
            <div className="setup-label">{t('pa.cube')}</div>
            <div className="menu-targets">
              {[1, 2, 4, 8, 16, 32, 64].map((v) => (
                <button
                  key={v}
                  className={cube.value === v ? 'menu-btn active' : 'menu-btn'}
                  onClick={() => setCube((c) => ({ ...c, value: v }))}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-row">
            <div className="setup-label">{t('pa.cubeOwner')}</div>
            <div className="menu-targets">
              <button
                className={cube.owner === 'white' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => setCube((c) => ({ ...c, owner: 'white' }))}
              >
                ⚪
              </button>
              <button
                className={cube.owner === null ? 'menu-btn active' : 'menu-btn'}
                onClick={() => setCube((c) => ({ ...c, owner: null }))}
              >
                {t('pa.center')}
              </button>
              <button
                className={cube.owner === 'black' ? 'menu-btn active' : 'menu-btn'}
                onClick={() => setCube((c) => ({ ...c, owner: 'black' }))}
              >
                ⚫
              </button>
            </div>
          </div>

          <div className="setup-row">
            <div className="setup-label">{t('pa.dice')}</div>
            <div className="menu-targets pa-dice">
              <button
                className={d1 === 0 && d2 === 0 ? 'menu-btn active' : 'menu-btn'}
                onClick={() => {
                  setD1(0)
                  setD2(0)
                  setMoveRanked(null)
                }}
              >
                {t('pa.noDice')}
              </button>
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
            <div className="menu-targets">
              <button
                className="menu-btn"
                onClick={() => {
                  setPts(initialState().points)
                  setBar({ white: 0, black: 0 })
                  setOff({ white: 0, black: 0 })
                  setResult(null)
                }}
              >
                {t('pa.standard')}
              </button>
              <button
                className="menu-btn"
                onClick={() => {
                  setPts(emptyPoints())
                  setBar({ white: 0, black: 0 })
                  setOff({ white: 0, black: 0 })
                  setResult(null)
                }}
              >
                {t('pa.clear')}
              </button>
            </div>
          </div>

          <button className="galaxy-btn roll pa-analyze" disabled={busy} onClick={analyze}>
            {busy ? t('an.loading') : `🔍 ${t('pa.analyze')}`}
          </button>

          {result && (
            <div className="pa-result">
              <div className="pa-win">
                {t('pa.winChance', { name: turn === 'white' ? t('pa.white') : t('pa.black') })}
                <b> {win.toFixed(1)}%</b>
              </div>
              <div className="prob-sub">
                {t('an.gammon')} {gammon.toFixed(1)}% · {t('an.bg')} {bg.toFixed(1)}%
              </div>
              <div className="prob-sub">
                {t('an.equity')}: {equityFrom(result).toFixed(3)}
              </div>
            </div>
          )}

          {moveRanked && moveRanked.length > 0 && (
            <div className="pa-result">
              <div className="pa-win">
                {t('pa.bestMove')}: <b>{moveNotation(moveRanked[0].move, turn)}</b>
              </div>
              <div className="prob-sub">
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
  )
}
