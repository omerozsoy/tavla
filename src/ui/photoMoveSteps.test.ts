import { describe, it, expect } from 'vitest'
import { moveToSteps } from './photoMoveSteps'

// Index sözleşmesi (gnubg_service ile birebir): beyaz p-1, siyah 24-p; bar/25=bar, off/0=off.
describe('moveToSteps', () => {
  it('beyaz basit çift hamle', () => {
    expect(moveToSteps('white', '8/5 6/5')).toEqual([
      { from: 7, to: 4, die: 0 },
      { from: 5, to: 4, die: 0 },
    ])
  })
  it('bar girişi + vuruş yıldızı atılır', () => {
    expect(moveToSteps('white', 'bar/20*')).toEqual([{ from: 'bar', to: 19, die: 0 }])
  })
  it('toplama (off)', () => {
    expect(moveToSteps('white', '6/off')).toEqual([{ from: 5, to: 'off', die: 0 }])
  })
  it('(n) çoğaltma -> n ayrı adım', () => {
    expect(moveToSteps('white', '24/18(2)')).toEqual([
      { from: 23, to: 17, die: 0 },
      { from: 23, to: 17, die: 0 },
    ])
  })
  it('zincir a/b/c -> a->b, b->c', () => {
    expect(moveToSteps('white', '13/7*/2')).toEqual([
      { from: 12, to: 6, die: 0 },
      { from: 6, to: 1, die: 0 },
    ])
  })
  it('siyah perspektifi (24-p)', () => {
    expect(moveToSteps('black', '8/5')).toEqual([{ from: 16, to: 19, die: 0 }])
  })
  it('boş', () => {
    expect(moveToSteps('white', undefined)).toEqual([])
  })
})
