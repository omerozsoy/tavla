// Admin panel tasarım ayarları (GET /api/board-designs): Tavla Tasarımı (grup/fiyat/satış + özel
// tahtalar), Avatar Tasarımı ve Pul Tasarımı (grup/fiyat/satış). Son yanıt localStorage'da tutulur
// ve açılışta hemen uygulanır (özel tahta seçili oyuncu standarda düşmesin, fiyatlar titremesin).
import { applyBoardDesigns, type BoardDesignRow } from './boardThemes'
import { applyFrameOverrides } from './ui/avatarFrames'
import { applyCheckerOverrides } from './checkers'

export interface CosmeticRow {
  kind: 'frame' | 'checker'
  id: string
  group: string
  price: number | null
  active: boolean
}
export interface ShopDesigns {
  designs: BoardDesignRow[]
  items: CosmeticRow[]
}

const CACHE_KEY = 'tavla.shopDesigns'

export function applyShopDesigns(d: Partial<ShopDesigns> | null | undefined): void {
  const items = Array.isArray(d?.items) ? d.items.filter((x) => x && typeof x.id === 'string') : []
  applyBoardDesigns(Array.isArray(d?.designs) ? d.designs : [])
  applyFrameOverrides(items.filter((x) => x.kind === 'frame'))
  applyCheckerOverrides(items.filter((x) => x.kind === 'checker'))
}

export function applyCachedShopDesigns(): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) applyShopDesigns(JSON.parse(raw))
  } catch {
    /* depolama yok/bozuk: koddaki varsayılanlarla devam */
  }
}

export function storeShopDesigns(d: ShopDesigns): void {
  applyShopDesigns(d)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(d))
  } catch {
    /* sessiz */
  }
}
