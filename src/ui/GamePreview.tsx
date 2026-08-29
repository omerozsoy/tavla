import { useState } from 'react'
import Board from './Board'
import Sidebar from './Sidebar'
import ClockStack from './ClockStack'
import { Icon } from './Icon'
import { Button } from '@/components/ui/button'
import { initialState } from '../engine/game'
import { pipCount } from '../engine/evaluate'

// Oyun ekrani ONIZLEME: gercek mac baslatmadan board+panel+saat'i mock veriyle
// tam ekran gosterir. Viewport boyutuna gore (mobil yatay) responsive CSS tetiklenir.
// Amac: layout'u telefon boyutunda gorup referansa gore ayarlamak (Playwright/telefon).
export default function GamePreview({ onClose }: { onClose: () => void }) {
  const [frame, setFrame] = useState<string | null>('galaxy')
  const state = initialState()
  const top = {
    name: 'felix_rabe',
    avatar: '🐱',
    sub: 'Star Member',
    off: 0,
    active: false,
    color: 'black' as const,
    score: 0,
    target: 1,
    rating: 1530,
    avatarUrl: null,
    frame,
  }
  const bottom = {
    name: 'olo76',
    avatar: '🧑‍🚀',
    sub: 'Sen',
    off: 0,
    active: true,
    color: 'white' as const,
    score: 0,
    target: 1,
    rating: 1506,
    avatarUrl: null,
    frame,
  }
  return (
    <div className="app game-view" style={{ position: 'fixed', inset: 0, zIndex: 5000 }}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setFrame((f) => (f ? null : 'galaxy'))}
        title="Cerceve ac/kapa"
        style={{ position: 'fixed', top: '10px', left: 'auto', right: '10px', zIndex: 120 }}
      >
        <Icon name="star" size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="force-landscape-exit"
        onClick={onClose}
        aria-label="Kapat"
        title="Kapat"
      >
        <Icon name="x" size={16} />
      </Button>
      <main className="main game-scene">
        <div className="game-area">
          <Sidebar top={top} bottom={bottom} />
          <ClockStack active="white" delay={12} white={60} black={60} final={30} topOff={0} bottomOff={0} />
          <Board
            state={state}
            selectableFroms={new Set()}
            targets={new Set()}
            selectedFrom={null}
            onSelectFrom={() => {}}
            onSelectTarget={() => {}}
            onDragFrom={() => {}}
            pipTop={pipCount(state, 'black')}
            pipBottom={pipCount(state, 'white')}
            cube={{ value: 1, owner: null }}
            watermark="GALATASARAY"
          />
        </div>
      </main>
    </div>
  )
}
