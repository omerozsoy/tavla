// DIJITAL CHECKER (pul) MATERYALLERI — gerçek fiziksel tavla pulu estetiği (parlak reçine,
// sedef/mermer damar, cam kubbe, metalik parıltı). Prosedürel SVG (src/ui/checkerSvg.ts) ile
// çizilir; motor/hareket/board koduna DOKUNMAZ — yalnız checker render katmanı.
//
// Ücretli kozmetik: board temaları gibi rarity-fiyatlı, coin ile alınır (unlocks: 'checker.<id>'),
// backend ShopController CHECKER_RARITY ile BIREBIR senkron. Seçim users.checker kolonunda.
//
// Her skin bir MATERYAL AİLESİ + birincil renk (dark = oyuncu tarafı) + ivory eş (light = rakip
// tarafı). Böylece tek seçim iki-renk eşleşmiş takım verir (gerçek ürün color+white çiftleri gibi).

export type CheckerFamily = 'pearl' | 'marble' | 'crystal' | 'resin' | 'metallic'
export type CheckerRarity = 'rare' | 'epic' | 'legendary'

export interface CheckerSkin {
  id: string // 'pearl-purple' -> unlock id 'checker.pearl-purple'
  name: string
  family: CheckerFamily
  rarity: CheckerRarity
  dark: string // birincil renk (oyuncunun pulları)
  light: string // eş açık renk (rakip pulları) — aile finish'i korunur
}

// rarity -> coin fiyatı (backend RARITY_PRICE ile aynı; frame'lerle ortak kademe)
export const CHECKER_RARITY_PRICE: Record<CheckerRarity, number> = {
  rare: 60,
  epic: 120,
  legendary: 180,
}

// Aile başına açık (ivory) eş renk — rakip tarafı; aile finish'i aynı kalır.
const IVORY: Record<CheckerFamily, string> = {
  pearl: '#efe7d6',
  marble: '#efe9dd',
  crystal: '#eef1f4',
  resin: '#ece2d0',
  metallic: '#e7e2d6',
}

function skin(id: string, name: string, family: CheckerFamily, rarity: CheckerRarity, dark: string, light?: string): CheckerSkin {
  return { id, name, family, rarity, dark, light: light ?? IVORY[family] }
}

export const CHECKER_SKINS: CheckerSkin[] = [
  // ---- PEARL (yumuşak sedef shimmer) — rare ----
  skin('pearl-purple', 'Purple Pearl', 'pearl', 'rare', '#6d28d9'),
  skin('pearl-blue', 'Blue Pearl', 'pearl', 'rare', '#245fb0'),
  skin('pearl-emerald', 'Emerald Pearl', 'pearl', 'rare', '#1f8f5f'),
  skin('pearl-rose', 'Rose Pearl', 'pearl', 'rare', '#c0396b'),
  skin('pearl-gold', 'Gold Pearl', 'pearl', 'rare', '#b8860f'),
  skin('pearl-black', 'Black Pearl', 'pearl', 'rare', '#2b2630'),

  // ---- MARBLE (keskin damar) — epic ----
  skin('marble-graphite', 'Graphite Marble', 'marble', 'epic', '#3a3f47'),
  skin('marble-green', 'Green Marble', 'marble', 'epic', '#2f7d5e'),
  skin('marble-blue', 'Blue Marble', 'marble', 'epic', '#2b5fa8'),
  skin('marble-rose', 'Rose Marble', 'marble', 'epic', '#b5546e'),
  skin('marble-amber', 'Amber Marble', 'marble', 'epic', '#b9772a'),
  skin('marble-wine', 'Wine Marble', 'marble', 'epic', '#7a233b'),

  // ---- CRYSTAL (cam kubbe altında düz renk, çok parlak) — epic ----
  skin('crystal-blue', 'Blue Crystal', 'crystal', 'epic', '#2b6fe0'),
  skin('crystal-red', 'Red Crystal', 'crystal', 'epic', '#d93a3a'),
  skin('crystal-amber', 'Amber Crystal', 'crystal', 'epic', '#e0a92e'),
  skin('crystal-emerald', 'Emerald Crystal', 'crystal', 'epic', '#1fa06a'),
  skin('crystal-violet', 'Violet Crystal', 'crystal', 'epic', '#7b3fd0'),
  skin('crystal-aqua', 'Aqua Crystal', 'crystal', 'epic', '#1f9fbf'),

  // ---- PREMIUM RESIN (fingerdish: kalın rim + iç swirl) — rare ----
  skin('resin-brown', 'Brown Resin', 'resin', 'rare', '#7a3b28'),
  skin('resin-red', 'Red Resin', 'resin', 'rare', '#c0342e'),
  skin('resin-blue', 'Blue Resin', 'resin', 'rare', '#2c5aa6'),
  skin('resin-orange', 'Orange Resin', 'resin', 'rare', '#d47a1e'),
  skin('resin-teal', 'Teal Resin', 'resin', 'rare', '#1f8a86'),
  skin('resin-plum', 'Plum Resin', 'resin', 'rare', '#7a2f5e'),

  // ---- METALLIC PEARL (yoğun metalik parıltı) — legendary ----
  skin('metallic-silver', 'Silver Metallic', 'metallic', 'legendary', '#aab2bb'),
  skin('metallic-gold', 'Gold Metallic', 'metallic', 'legendary', '#d3a836'),
  skin('metallic-bronze', 'Bronze Metallic', 'metallic', 'legendary', '#a6702f'),
  skin('metallic-gunmetal', 'Gunmetal Metallic', 'metallic', 'legendary', '#4b525c'),
  skin('metallic-rosegold', 'Rose Gold Metallic', 'metallic', 'legendary', '#c58a76'),
  skin('metallic-sapphire', 'Sapphire Metallic', 'metallic', 'legendary', '#2f5fb0'),
]

export const CHECKER_BY_ID: Record<string, CheckerSkin> = Object.fromEntries(CHECKER_SKINS.map((s) => [s.id, s]))
export const CHECKER_FAMILIES: { key: CheckerFamily; label: string }[] = [
  { key: 'pearl', label: 'Pearl' },
  { key: 'marble', label: 'Marble' },
  { key: 'crystal', label: 'Crystal' },
  { key: 'resin', label: 'Premium Resin' },
  { key: 'metallic', label: 'Metallic Pearl' },
]

export function checkerPrice(s: CheckerSkin): number {
  return CHECKER_RARITY_PRICE[s.rarity]
}
