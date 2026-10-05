import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyShopDesigns } from './shopDesigns'
import { ALL_THEMES, CUSTOM_THEMES, boardPrice, boardRarityOf, boardOnSale, FREE_BOARDS, safeImgUrl, safeFit } from './boardThemes'
import { AVATAR_FRAMES, FRAME_BY_ID, framePrice, frameOnSale } from './ui/avatarFrames'
import { CHECKER_BY_ID, CHECKER_FINISHES, checkerPrice, checkerOnSale } from './checkers'

const custom = {
  id: 'ozel-abc12345', group: 'epic', price: 777, active: true, custom: true, name: 'Gece Mavisi',
  colors: { panel: '#112233', frame: '#000000', a: '#aa0000', b: '#00aa00', checker: '#101010', light: '#fafafa' },
  surface: 'wood', checker_style: 'gloss',
}

afterEach(() => applyShopDesigns({ designs: [], items: [] }))

describe('admin tasarım ayarları (Tavla/Avatar/Pul Tasarımı)', () => {
  it('özel tahta eklenir, fiyat/grup uygulanır; tekrar uygulamak çoğaltmaz', () => {
    const n = ALL_THEMES.length
    applyShopDesigns({ designs: [custom], items: [] })
    applyShopDesigns({ designs: [custom], items: [] })
    expect(ALL_THEMES.length).toBe(n + 1)
    expect(CUSTOM_THEMES).toHaveLength(1)
    const t = ALL_THEMES.find((x) => x.id === custom.id)!
    expect([t.name, t.panel, t.surface, t.checkerStyle]).toEqual(['Gece Mavisi', '#112233', 'wood', 'gloss'])
    expect(boardRarityOf(t)).toBe('epic')
    expect(boardPrice(t)).toBe(777)
    applyShopDesigns({ designs: [], items: [] })
    expect(ALL_THEMES.length).toBe(n)
  })

  it('hane resimleri: güvenli URL kabul, CSS kıran/yabancı şema reddedilir', () => {
    applyShopDesigns({ designs: [{ ...custom, images: { odd: '/uploads/tahta/a.png', even: 'javascript:alert(1)' } }], items: [] })
    const t = ALL_THEMES.find((x) => x.id === custom.id)!
    expect([t.pointImgA, t.pointImgB]).toEqual(['/uploads/tahta/a.png', undefined])
    expect(safeImgUrl('https://cdn.example.com/x.webp')).toBe('https://cdn.example.com/x.webp')
    for (const bad of ['http://x.com/a.png', '/uploads/a.png") ; background:red', '/uploads/a b.png', 'data:image/png;base64,AA', '/etc/x.png', 42]) {
      expect(safeImgUrl(bad)).toBeUndefined()
    }
  })

  it('hane resmi yerleşimi: değerler sınırlanır, eksik alan varsayılan', () => {
    expect(safeFit({ x: 62, y: 50, zoom: 180, aspect: 2.5 })).toEqual({ x: 62, y: 50, zoom: 180, aspect: 2.5 })
    expect(safeFit({ x: 900, y: -5, zoom: 9999, aspect: 'x' })).toEqual({ x: 100, y: 0, zoom: 400 })
    expect(safeFit(null)).toEqual({ x: 50, y: 50, zoom: 100 })
    applyShopDesigns({ designs: [{ ...custom, images: { odd: '/uploads/tahta/a.png', fit: { odd: { x: 10, zoom: 150, aspect: 0.5 } } } }], items: [] })
    expect(ALL_THEMES.find((x) => x.id === custom.id)!.pointFitA).toEqual({ x: 10, y: 50, zoom: 150, aspect: 0.5 })
  })

  it('bozuk renkli özel tahta atlanır', () => {
    applyShopDesigns({ designs: [{ ...custom, colors: { ...custom.colors, panel: 'red' } }], items: [] })
    expect(CUSTOM_THEMES).toHaveLength(0)
  })

  it('yerleşik tahtanın grubu/fiyatı/satışı değişir; standart ücretsiz kalır', () => {
    const sahara = ALL_THEMES.find((x) => x.id === 'sahara')!
    const std = ALL_THEMES.find((x) => x.id === 'standart')!
    applyShopDesigns({
      designs: [
        { id: 'sahara', group: 'mythic', price: null, active: false, custom: false },
        { id: 'standart', group: 'mythic', price: 500, active: true, custom: false },
      ],
      items: [],
    })
    expect(boardRarityOf(sahara)).toBe('mythic')
    expect(boardPrice(sahara)).toBe(1200)
    expect(boardOnSale(sahara)).toBe(false)
    expect(FREE_BOARDS.has('standart') && boardPrice(std)).toBe(undefined)
  })

  it('çerçeve + pul fiyat/grup/satış ayarları uygulanır ve geri alınır', () => {
    const pulse = FRAME_BY_ID['pulse']
    const pearl = CHECKER_BY_ID['finish-pearl']
    applyShopDesigns({
      designs: [],
      items: [
        { kind: 'frame', id: 'pulse', group: 'mythic', price: null, active: false },
        { kind: 'checker', id: 'finish-pearl', group: 'rare', price: 42, active: true },
      ],
    })
    expect([pulse.rarity, pulse.group, framePrice(pulse), frameOnSale('pulse')]).toEqual(['mythic', 'mythic', 750, false])
    expect([checkerPrice(pearl), checkerOnSale('finish-pearl')]).toEqual([42, true])
    applyShopDesigns({ designs: [], items: [] })
    expect([pulse.rarity, framePrice(pulse), frameOnSale('pulse')]).toEqual(['rare', 180, true])
    expect(checkerPrice(pearl)).toBe(180)
  })

  it('backend JSON (scripts/export-board-themes.mjs) koddaki listeyle senkron', () => {
    const boards = JSON.parse(readFileSync('backend/database/data/board_themes.json', 'utf8')) as { id: string; group: string }[]
    expect(boards.map((b) => b.id)).toEqual(ALL_THEMES.map((t) => t.id))
    expect(boards.map((b) => b.group)).toEqual(ALL_THEMES.map((t) => boardRarityOf(t)))
    const items = JSON.parse(readFileSync('backend/database/data/cosmetics.json', 'utf8')) as { kind: string; id: string }[]
    expect(items.filter((i) => i.kind === 'frame').map((i) => i.id)).toEqual(AVATAR_FRAMES.filter((f) => !f.earned).map((f) => f.id))
    expect(items.filter((i) => i.kind === 'checker').map((i) => i.id)).toEqual(CHECKER_FINISHES.map((c) => c.id))
  })
})
