import type { IconName } from './ui/Icon'

// ---- Basarim rozetleri (backend ile ayni id'ler) ----
export interface BadgeDef {
  id: string
  icon: IconName
  key: string // i18n anahtari
}

export const BADGES: BadgeDef[] = [
  { id: 'first_win', icon: 'medal', key: 'badge.firstWin' },
  { id: 'games_10', icon: 'medal', key: 'badge.games10' },
  { id: 'games_50', icon: 'medal', key: 'badge.games50' },
  { id: 'games_100', icon: 'medal', key: 'badge.games100' },
  { id: 'games_500', icon: 'medal', key: 'badge.games500' },
  { id: 'wins_10', icon: 'trophy', key: 'badge.wins10' },
  { id: 'wins_50', icon: 'trophy', key: 'badge.wins50' },
  { id: 'wins_100', icon: 'trophy', key: 'badge.wins100' },
  { id: 'rating_1600', icon: 'crown', key: 'badge.usta' },
  { id: 'rating_1800', icon: 'crown', key: 'badge.master' },
  { id: 'rating_2000', icon: 'crown', key: 'badge.gm' },
  { id: 'rating_2200', icon: 'crown', key: 'badge.legend' },
]

export const BADGE_MAP: Record<string, BadgeDef> = Object.fromEntries(
  BADGES.map((b) => [b.id, b]),
)

// ---- Lig / division (rating'e gore) ----
export interface Division {
  min: number
  key: string
  icon: IconName
  color: string
}

// Dusukten yuksege; divisionOf en yuksek uyani secer
export const DIVISIONS: Division[] = [
  { min: 0, key: 'div.bronze', icon: 'medal', color: '#a1663a' },
  { min: 1300, key: 'div.silver', icon: 'medal', color: '#9aa3ab' },
  { min: 1500, key: 'div.gold', icon: 'medal', color: '#e6b422' },
  { min: 1700, key: 'div.platinum', icon: 'crown', color: '#3fb6a8' },
  { min: 1900, key: 'div.diamond', icon: 'crown', color: '#7b6fd4' },
  { min: 2100, key: 'div.legend', icon: 'crown', color: '#c9563f' },
]

export function divisionOf(rating: number): Division {
  let d = DIVISIONS[0]
  for (const x of DIVISIONS) if (rating >= x.min) d = x
  return d
}
