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

// 20 kademe. Dusukten yuksege (rating). divisionOf en yuksek uyani secer.
// prMax: o kademeye karsilik gelen en yuksek (yaklasik) PR esigi (PR dusuk = iyi).
export const DIVISIONS: Division[] = [
  { min: 0, prMax: Infinity, key: 'div.rookie', icon: 'medal', color: '#8a8377' },
  { min: 1150, prMax: 40, key: 'div.novice', icon: 'medal', color: '#9aa3ab' },
  { min: 1250, prMax: 30, key: 'div.beginner', icon: 'medal', color: '#a1663a' },
  { min: 1325, prMax: 22, key: 'div.developing', icon: 'trophy', color: '#cd7f32' },
  { min: 1375, prMax: 16.0, key: 'div.i3', icon: 'trophy', color: '#e6b422' },
  { min: 1400, prMax: 14.0, key: 'div.i2', icon: 'trophy', color: '#e6b422' },
  { min: 1425, prMax: 12.0, key: 'div.i1', icon: 'trophy', color: '#e6b422' },
  { min: 1450, prMax: 10.0, key: 'div.a3', icon: 'trophy', color: '#3fb6a8' },
  { min: 1475, prMax: 8.5, key: 'div.a2', icon: 'trophy', color: '#3fb6a8' },
  { min: 1500, prMax: 7.5, key: 'div.a1', icon: 'trophy', color: '#3fb6a8' },
  { min: 1525, prMax: 6.5, key: 'div.m3', icon: 'crown', color: '#7b6fd4' },
  { min: 1550, prMax: 5.5, key: 'div.m2', icon: 'crown', color: '#7b6fd4' },
  { min: 1575, prMax: 4.75, key: 'div.m1', icon: 'crown', color: '#7b6fd4' },
  { min: 1600, prMax: 4.0, key: 'div.g3', icon: 'crown', color: '#c9563f' },
  { min: 1625, prMax: 3.5, key: 'div.g2', icon: 'crown', color: '#c9563f' },
  { min: 1650, prMax: 3.0, key: 'div.g1', icon: 'crown', color: '#c9563f' },
  { min: 1675, prMax: 2.75, key: 'div.g0', icon: 'crown', color: '#c9563f' },
  { min: 1700, prMax: 2.5, key: 'div.sgm3', icon: 'crown', color: '#ffcf40' },
  { min: 1725, prMax: 2.25, key: 'div.sgm2', icon: 'crown', color: '#ffcf40' },
  { min: 1750, prMax: 2.0, key: 'div.sgm1', icon: 'crown', color: '#ffcf40' },
]

// Rating -> seviye: rating'in ulastigi en yuksek kademe.
export function divisionOf(rating: number): Division {
  let d = DIVISIONS[0]
  for (const x of DIVISIONS) if (rating >= x.min) d = x
  return d
}

// Ana rutbeler (alt-tier'lar S1/S2, I1/I2 vb. katlanmis) - Lig sekmesi bunlari kullanir.
export const MAIN_DIVISIONS: Division[] = [
  { min: 0, prMax: Infinity, key: 'div.rookie', icon: 'medal', color: '#8a8377' },
  { min: 1150, prMax: 40, key: 'div.novice', icon: 'medal', color: '#9aa3ab' },
  { min: 1250, prMax: 30, key: 'div.beginner', icon: 'medal', color: '#a1663a' },
  { min: 1325, prMax: 22, key: 'div.developing', icon: 'trophy', color: '#cd7f32' },
  { min: 1375, prMax: 16.0, key: 'div.intermediate', icon: 'trophy', color: '#e6b422' },
  { min: 1450, prMax: 10.0, key: 'div.advanced', icon: 'trophy', color: '#3fb6a8' },
  { min: 1525, prMax: 6.5, key: 'div.master', icon: 'crown', color: '#7b6fd4' },
  { min: 1600, prMax: 4.0, key: 'div.grandmaster', icon: 'crown', color: '#c9563f' },
  { min: 1700, prMax: 2.5, key: 'div.superGrandmaster', icon: 'crown', color: '#ffcf40' },
]

// Rating -> ana rutbe (Lig sekmesi gruplamasi icin).
export function mainDivisionOf(rating: number): Division {
  let d = MAIN_DIVISIONS[0]
  for (const x of MAIN_DIVISIONS) if (rating >= x.min) d = x
  return d
}

// PR -> seviye: PR dusuk = iyi. PR'nin girdigi ilk (en iyi) bracket.
export function divisionOfPR(pr: number): Division {
  const byPr = [...DIVISIONS].sort((a, b) => a.prMax - b.prMax)
  for (const d of byPr) if (pr <= d.prMax) return d
  return DIVISIONS[0]
}
