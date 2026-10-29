import { describe, it, expect } from 'vitest'
import { gameStartScores } from './matExport'
import type { MoveLogEntry } from './storage'
import type { Player } from './engine/types'

// 3 oyunluk log (her oyunda white/black 2'şer hamle, seq her oyun başında 0'a döner -> splitGames
// 3 oyuna böler). Sonuçlar otoriter `results` ile verilir (canlı maç yolu) -> oyun başı skorları
// birikimli olmalı. Not: boş notasyon -> tahta-tekrarı sonuç veremez, authoritative devreye girer.
const mk = (player: Player, seq: number): MoveLogEntry =>
  ({ notation: '', best: '', loss: 0, player, seq, dice: [3, 1] } as unknown as MoveLogEntry)
const log: MoveLogEntry[] = [
  mk('white', 0), mk('black', 0), mk('white', 1), mk('black', 1), // oyun 0
  mk('white', 0), mk('black', 0), mk('white', 1), mk('black', 1), // oyun 1
  mk('white', 0), mk('black', 0), mk('white', 1), mk('black', 1), // oyun 2
]

describe('gameStartScores', () => {
  it('otoriter results ile oyun başı skorları birikimli', () => {
    const results = [
      { winner: 'white' as Player, points: 1 }, // oyun 0 -> 1-0
      { winner: 'black' as Player, points: 2 }, // oyun 1 (gammon) -> 1-2
      { winner: 'white' as Player, points: 1 }, // oyun 2
    ]
    const s = gameStartScores(log, 5, results)
    expect(s).toEqual([
      { white: 0, black: 0 },
      { white: 1, black: 0 },
      { white: 1, black: 2 },
    ])
  })

  it('sonuç türetilemezse skor ilerlemez (best-effort 0-0)', () => {
    const s = gameStartScores(log, 5)
    expect(s).toEqual([
      { white: 0, black: 0 },
      { white: 0, black: 0 },
      { white: 0, black: 0 },
    ])
  })
})
