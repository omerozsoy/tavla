// DEV harness: GERCEK GameHud bilesenlerini (production) mock veriyle render eder -> portrait
// layout dogrulama. Production'a DOKUNMAZ (ayri html entry). npm run dev -> /boardshot.html
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import { LangProvider } from './i18n'
import { Icon } from './ui/Icon'
import Board from './ui/Board'
import { GameHudHeader, GameHudRow } from './ui/GameHud'
import { initialState } from './engine/board'
import type { GameState } from './engine/types'

function mockState(): GameState {
  const s = initialState()
  s.off = { white: 6, black: 4 }
  s.dice = [3, 5]
  s.diceUsed = [false, false]
  return s
}

const noop = () => {}
const emptyNum = new Set<number | 'bar'>()
const emptyTo = new Set<number | 'off'>()

function Harness() {
  const state = mockState()
  const dice = (
    <div className="dice-wrap" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
      <div className="die">⚂</div>
      <div className="die">⚄</div>
    </div>
  )
  return (
    <div className="app game-view">
      <main className="main game-scene">
        <div className="game-area gb-redesign">
          <div className="gb-topctl">
            <span className="gb-matchid">#AMDXJ</span>
            <span className="gb-ham"><Icon name="menu" size={18} /></span>
          </div>
          <GameHudHeader
            self={{ name: 'Zknkyc', rating: 1455 }}
            opp={{ name: 'Neural AI', isBot: true, rating: 2750, sub: 'Seviye 10' }}
            selfCoins={29600}
            target={5}
            selfScore={0}
            oppScore={0}
            selfColor="white"
          />
          {/* UST oyuncu (rakip, siyah) */}
          <GameHudRow score={0} bankSecs={593} moveSecs={null} active={false} low={false}
            trayColor="black" trayCount={4} cubeValue={null} />
          <Board
            state={state} selectableFroms={emptyNum} targets={emptyTo} selectedFrom={null}
            onSelectFrom={noop} onSelectTarget={noop} onDragFrom={noop}
            pipTop={120} pipBottom={115} cube={{ value: 2, owner: null }} centerMain={dice} flip={false} showPip
          />
          {/* ALT oyuncu (self, beyaz) — kup alinmis: skor yaninda "2" */}
          <GameHudRow score={0} bankSecs={600} moveSecs={12} active low
            trayColor="white" trayCount={6} cubeValue={2} />
        </div>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <Harness />
    </LangProvider>
  </StrictMode>,
)
