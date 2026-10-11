import { describe, expect, it } from 'vitest'
import { CHECKER_FINISHES } from './checkers'
import { checkerSvgUri } from './ui/checkerRaster'
import { buildCheckerSvg } from './ui/checkerSvg'

describe('pul malzemeleri', () => {
  it('yeni malzemeleri adaptif aileler olarak kataloglar', () => {
    expect(CHECKER_FINISHES.map((s) => s.id)).toEqual([
      'finish-pearl', 'finish-marble', 'finish-crystal', 'finish-resin', 'finish-metallic',
      'finish-wood', 'finish-ceramic', 'finish-brushed-metal', 'finish-leather', 'finish-glass',
      'finish-carbon', 'finish-mother-of-pearl', 'profile-classic-ring', 'profile-double-ring',
      'profile-flat-matte', 'profile-domed', 'profile-engraved', 'profile-thin-frame',
      'profile-tavlatv-emblem', 'profile-nostalgic',
    ])
    expect(CHECKER_FINISHES.every((s) => s.adaptive)).toBe(true)
  })

  it('her malzeme aynı tema rengini koruyarak farklı görsel katman üretir', () => {
    const svgs = CHECKER_FINISHES.map((s) => buildCheckerSvg({ family: s.family, profile: s.profile, color: '#2f6f63', id: `test-${s.id}` }))
    const alternateColorSvgs = CHECKER_FINISHES.map((s) => buildCheckerSvg({ family: s.family, profile: s.profile, color: '#b85c3b', id: `test-${s.id}` }))
    expect(new Set(svgs).size).toBe(CHECKER_FINISHES.length)
    for (let i = 0; i < svgs.length; i++) {
      expect(svgs[i]).not.toBe(alternateColorSvgs[i])
      expect(svgs[i]).toContain('viewBox="0 0 120 120"')
    }
  })

  it('aynı açık/koyu profil assetini paylaşır, profiller birbirine karışmaz', () => {
    const dark = checkerSvgUri('ceramic', '#263b36', 'classic-ring')
    const darkAgain = checkerSvgUri('ceramic', '#263b36', 'classic-ring')
    const light = checkerSvgUri('ceramic', '#ece8dc', 'classic-ring')
    const otherProfile = checkerSvgUri('ceramic', '#263b36', 'flat-matte')
    expect(darkAgain).toBe(dark)
    expect(light).not.toBe(dark)
    expect(otherProfile).not.toBe(dark)
  })
})
