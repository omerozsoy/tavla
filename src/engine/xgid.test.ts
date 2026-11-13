import { describe, it, expect } from 'vitest'
import { parseXgid } from './xgid'
import { initialState } from './board'

describe('parseXgid', () => {
  it('standart acilis XGID -> initialState board', () => {
    const r = parseXgid('XGID=-b----E-C---eE---c-e----B-:0:0:1:00:0:0:0:0:10')
    expect(r).not.toBeNull()
    expect(r!.state.points).toEqual(initialState().points)
    expect(r!.state.bar).toEqual({ white: 0, black: 0 })
    expect(r!.dice).toBeNull() // 00 -> zar yok (acilis kup pozisyonu)
  })

  it('zar alani cozulur (41 -> [4,1])', () => {
    const r = parseXgid('XGID=-b----E-C---eE---c-e----B-:0:0:1:41:0:0:0:0:10')
    expect(r!.dice).toEqual([4, 1])
    expect(r!.state.dice).toEqual([4, 1])
  })

  it('cesitli unlu XGID pozisyonlari 15/15 legal cozulur', () => {
    const ids = [
      'XGID=-ABCaBC-----bB-a--Bcbacb--:1:-1:1:41:0:0:0:7:10',
      'XGID=-CFCA--a-B----a----abcbcb-:0:0:1:42:6:3:1:7:10',
      'XGID=-FBEa--A--A--------cbbcbb-:0:0:1:42:0:0:0:1:10',
    ]
    for (const id of ids) {
      const r = parseXgid(id)
      expect(r, id).not.toBeNull()
      const s = r!.state
      const w = s.bar.white + s.off.white + s.points.reduce((a, x) => a + (x > 0 ? x : 0), 0)
      const b = s.bar.black + s.off.black + s.points.reduce((a, x) => a + (x < 0 ? -x : 0), 0)
      expect(w, id).toBe(15)
      expect(b, id).toBe(15)
    }
  })
})
