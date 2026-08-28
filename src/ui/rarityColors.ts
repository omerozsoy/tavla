// Merkezi nadirlik (rarity) renk paleti — TEK kaynak.
// Onceden BoardSettings / FrameGallery / Shop / avatarFrames dosyalarinda BIREBIR
// tekrar eden parlak "gaming" tonlariydi; Royal Navy luxury yonu icin rafine,
// MUTED ama ayirt edilebilir tonlara cevrildi (gold premium kademede).
// Semantik: Standart gumus · Nadir safir · Epik ametist · Efsanevi altin · Mitik yakut.
export type RarityKey =
  | 'common'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic'
  | 'club'
  | 'prestige'
  | 'tavla'
  | 'achievement'

export const RARITY_COLORS: Record<RarityKey, string> = {
  common: '#9da7b3', // muted steel/gumus
  rare: '#6e8db8', // soft sapphire
  epic: '#a17fb5', // muted amethyst
  legendary: '#c2a15f', // luxury gold (premium)
  mythic: '#c0616b', // deep rose/garnet - yakut (luks, neon degil)
  club: '#4e9e75', // muted emerald
  prestige: '#d2b36e', // bright antique gold
  tavla: '#4e9e9e', // muted teal
  achievement: '#e0c57a', // soft gold
}
