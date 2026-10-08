import { describe, it, expect } from 'vitest'
import { parseMatScores } from './matScores'

describe('parseMatScores', () => {
  it('her oyunun BAŞINDAKİ maç skorunu çıkarır (gnubg/XG .mat başlığı)', () => {
    const mat = [
      '7 point match',
      '',
      ' Game 1',
      ' omerdgn : 0                         mansorox : 0',
      '  1) 31: 8/5 6/5                      31: 24/21 13/11',
      '      Wins 2 points',
      '',
      ' Game 2',
      ' omerdgn : 0                         mansorox : 2',
      '  1) 65: 24/18 13/8                   ...',
      '      Wins 1 point',
      '',
      ' Game 3',
      ' omerdgn : 1                         mansorox : 2',
      '  1) 52: 24/22 13/8                   ...',
    ].join('\n')

    const s = parseMatScores(mat)
    expect(s).toHaveLength(3)
    expect(s[0]).toEqual({ white: 0, black: 0 }) // Oyun 1 başı
    expect(s[1]).toEqual({ white: 0, black: 2 }) // Oyun 2 başı
    expect(s[2]).toEqual({ white: 1, black: 2 }) // Oyun 3 başı (resimdeki senaryo)
  })

  it('başlık yoksa boş döner', () => {
    expect(parseMatScores('selam dünya')).toEqual([])
  })
})
