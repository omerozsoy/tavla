import { describe, expect, it } from 'vitest'
import { initialState, WHITE, BLACK } from './board'
import { pipCount } from './evaluate'
import { generateMoves } from './moves'
import { HeuristicBot } from './engine'

describe('pip sayimi', () => {
  it('acilista her oyuncu 167 pip', () => {
    const s = initialState()
    expect(pipCount(s, WHITE)).toBe(167)
    expect(pipCount(s, BLACK)).toBe(167)
  })
})

describe('HeuristicBot', () => {
  it('legal bir hamle secer', () => {
    const s = initialState()
    s.dice = [3, 1]
    const bot = new HeuristicBot()
    const move = bot.chooseMove(s)
    const legal = generateMoves(s)
    // Botun sectigi hamle legal hamleler arasinda olmali
    expect(legal.some((m) => m.resultKey === move.resultKey)).toBe(true)
  })

  it('3-1 acilisinda 5-kapisini yapar (klasik en iyi hamle)', () => {
    // Beyaz icin 3-1: 8/5, 6/5 -> 5. ucgende kapi (index 4'te 2 tas)
    const s = initialState()
    s.dice = [3, 1]
    const bot = new HeuristicBot()
    const move = bot.chooseMove(s)
    // Sonuc tahtasinda index 4'te beyazin 2 tasi olmali
    // resultKey'den kontrol: points dizisinin 5. elemani (index 4) = 2
    const points = move.resultKey.split('|')[0].split(',').map(Number)
    expect(points[4]).toBe(2)
  })
})
