// Animasyonlu avatar cerceveleri registry. Gorsel/animasyon tanimlari AvatarFrame.css'te
// [data-frame="slug"] ile. Burada yalnizca meta: id/slug, ad, nadirlik ve galeri grubu.
// Nadirlik yukseldikce gorsel karmasiklik + animasyon kalitesi artar.

export type FrameRarity = 'rare' | 'epic' | 'legendary' | 'mythic'
export type FrameGroup = 'rare' | 'epic' | 'legendary' | 'mythic' | 'prestige' | 'tavla' | 'achievement'

export interface AvatarFrameDef {
  id: string
  name: string
  rarity: FrameRarity // renk aksani (gri yok; en dusuk rare)
  group: FrameGroup // galeri gruplamasi
  /** Magazadan satin alinamaz; basari/turnuva ile kazanilir */
  earned?: boolean
}

// Nadirlik renkleri (BoardSettings ile ayni dil): rare mavi, epic mor, legendary altin, mythic kirmizi
export const FRAME_RARITY_COLOR: Record<FrameRarity, string> = {
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
  mythic: '#EF4444',
}

// Rarity coin fiyatlari (backend ShopController CATALOG ile birebir ayni olmali)
export const FRAME_RARITY_PRICE: Record<FrameRarity, number> = {
  rare: 500,
  epic: 1000,
  legendary: 2000,
  mythic: 4000,
}
// Satin alma fiyati; 'earned' cerceveler magazadan alinamaz (undefined)
export function framePrice(f: AvatarFrameDef): number | undefined {
  return f.earned ? undefined : FRAME_RARITY_PRICE[f.rarity]
}

export const FRAME_GROUP_LABEL: Record<FrameGroup, string> = {
  rare: 'rarity.rare',
  epic: 'rarity.epic',
  legendary: 'rarity.legendary',
  mythic: 'rarity.mythic',
  prestige: 'frames.groupPrestige',
  tavla: 'frames.groupTavla',
  achievement: 'frames.groupAchievement',
}
export const FRAME_GROUP_ORDER: FrameGroup[] = [
  'rare', 'epic', 'legendary', 'mythic', 'prestige', 'tavla', 'achievement',
]

export const AVATAR_FRAMES: AvatarFrameDef[] = [
  // --- Nadir ---
  { id: 'neon-pulse', name: 'Neon Pulse', rarity: 'rare', group: 'rare' },
  // --- Epik ---
  { id: 'purple-vortex', name: 'Purple Vortex', rarity: 'epic', group: 'epic' },
  { id: 'ice-crown', name: 'Ice Crown', rarity: 'epic', group: 'epic' },
  { id: 'electric', name: 'Electric', rarity: 'epic', group: 'epic' },
  { id: 'cyberpunk', name: 'Cyberpunk', rarity: 'epic', group: 'epic' },
  // --- Efsanevi ---
  { id: 'royal-gold', name: 'Royal Gold', rarity: 'legendary', group: 'legendary' },
  { id: 'inferno', name: 'Inferno', rarity: 'legendary', group: 'legendary' },
  { id: 'diamond', name: 'Diamond', rarity: 'legendary', group: 'legendary' },
  { id: 'emerald', name: 'Emerald', rarity: 'legendary', group: 'legendary' },
  { id: 'ruby', name: 'Ruby', rarity: 'legendary', group: 'legendary' },
  // --- Mitik ---
  { id: 'black-hole', name: 'Black Hole', rarity: 'mythic', group: 'mythic' },
  { id: 'galaxy', name: 'Galaxy', rarity: 'mythic', group: 'mythic' },
  { id: 'phoenix', name: 'Phoenix', rarity: 'mythic', group: 'mythic' },
  { id: 'dragon', name: 'Dragon', rarity: 'mythic', group: 'mythic' },
  { id: 'thunder-god', name: 'Thunder God', rarity: 'mythic', group: 'mythic' },
  // --- Prestij / Ozel ---
  { id: 'vip', name: 'VIP', rarity: 'legendary', group: 'prestige' },
  { id: 'champion', name: 'Champion', rarity: 'legendary', group: 'prestige', earned: true },
  { id: 'grandmaster', name: 'Grandmaster', rarity: 'mythic', group: 'prestige' },
  // --- Tavlaya Ozel ---
  { id: 'dice-master', name: 'Dice Master', rarity: 'epic', group: 'tavla' },
  { id: 'backgammon-king', name: 'Backgammon King', rarity: 'legendary', group: 'tavla' },
  // --- Basari (kazanilir) ---
  { id: 'tournament-champion', name: 'Tournament Champion', rarity: 'mythic', group: 'achievement', earned: true },
  { id: 'top-100', name: 'Top 100', rarity: 'legendary', group: 'achievement', earned: true },
  { id: '1000-wins', name: '1000 Wins', rarity: 'legendary', group: 'achievement', earned: true },
  { id: 'season-champion', name: 'Season Champion', rarity: 'mythic', group: 'achievement', earned: true },
]

export const FRAME_BY_ID: Record<string, AvatarFrameDef> = Object.fromEntries(
  AVATAR_FRAMES.map((f) => [f.id, f]),
)
