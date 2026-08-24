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

// ---- Lig / seviye (rating veya PR'ye gore) ----
// Standart tavla seviye tablosu: her seviyenin rating alt esigi (min) ve o seviyeye
// karsilik gelen ust PR esigi (prMax; PR dusuk = iyi). Rookie prMax = sonsuz (>40).
export interface Division {
  min: number // rating alt esigi
  prMax: number // bu seviye icin en yuksek (en kotu) PR degeri
  key: string
  icon: IconName
  color: string
}

// Dusukten yuksege (rating). divisionOf en yuksek uyani secer.
export const DIVISIONS: Division[] = [
  { min: 0, prMax: Infinity, key: 'div.rookie', icon: 'medal', color: '#8a8377' },
  { min: 900, prMax: 40, key: 'div.novice', icon: 'medal', color: '#9aa3ab' },
  { min: 1100, prMax: 30, key: 'div.beginner', icon: 'medal', color: '#a1663a' },
  { min: 1300, prMax: 22, key: 'div.developing', icon: 'trophy', color: '#cd7f32' },
  { min: 1500, prMax: 16, key: 'div.intermediate', icon: 'trophy', color: '#e6b422' },
  { min: 1750, prMax: 10, key: 'div.advanced', icon: 'trophy', color: '#3fb6a8' },
  { min: 2000, prMax: 6.5, key: 'div.master', icon: 'crown', color: '#7b6fd4' },
  { min: 2250, prMax: 4.0, key: 'div.grandmaster', icon: 'crown', color: '#c9563f' },
  { min: 2500, prMax: 2.5, key: 'div.superGrandmaster', icon: 'crown', color: '#ffcf40' },
]

// Rating -> seviye: rating'in ulastigi en yuksek kademe.
export function divisionOf(rating: number): Division {
  let d = DIVISIONS[0]
  for (const x of DIVISIONS) if (rating >= x.min) d = x
  return d
}

// PR -> seviye: PR dusuk = iyi. PR'nin girdigi ilk (en iyi) bracket.
export function divisionOfPR(pr: number): Division {
  const byPr = [...DIVISIONS].sort((a, b) => a.prMax - b.prMax)
  for (const d of byPr) if (pr <= d.prMax) return d
  return DIVISIONS[0]
}
