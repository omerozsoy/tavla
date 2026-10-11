// DIJITAL CHECKER (pul) MATERYALLERI — gerçek fiziksel tavla pulu estetiği (parlak reçine,
// sedef/mermer damar, cam kubbe, metalik parıltı). Prosedürel SVG (src/ui/checkerSvg.ts) ile
// çizilir; motor/hareket/board koduna DOKUNMAZ — yalnız checker render katmanı.
//
// Ücretli kozmetik: board temaları gibi rarity-fiyatlı, coin ile alınır (unlocks: 'checker.<id>'),
// backend ShopController CHECKER_RARITY ile BIREBIR senkron. Seçim users.checker kolonunda.
//
// Her skin bir MATERYAL AİLESİ + birincil renk (dark = oyuncu tarafı) + ivory eş (light = rakip
// tarafı). Böylece tek seçim iki-renk eşleşmiş takım verir (gerçek ürün color+white çiftleri gibi).

export type CheckerFamily =
  | 'pearl'
  | 'marble'
  | 'crystal'
  | 'resin'
  | 'metallic'
  | 'wood'
  | 'ceramic'
  | 'brushed-metal'
  | 'leather'
  | 'glass'
  | 'carbon'
  | 'mother-of-pearl'
export type CheckerRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'

export interface CheckerSkin {
  id: string // 'pearl-purple' -> unlock id 'checker.pearl-purple'
  name: string
  family: CheckerFamily
  rarity: CheckerRarity
  dark: string // birincil renk (oyuncunun pulları); adaptive'te SADECE önizleme/fallback rengi
  light: string // eş açık renk (rakip pulları); adaptive'te SADECE önizleme/fallback rengi
  adaptive?: boolean // true: renk seçtirmez; oyunda AKTİF TAHTANIN pul renklerine (--cream/--navy) uyar
}

// rarity -> coin fiyatı (backend RARITY_PRICE ile aynı; frame'lerle ortak kademe)
export const CHECKER_RARITY_PRICE: Record<CheckerRarity, number> = {
  common: 180,
  rare: 360,
  epic: 720,
  legendary: 1080,
  mythic: 1500,
}

// Aile başına açık (ivory) eş renk — rakip tarafı; aile finish'i aynı kalır.
const IVORY: Record<CheckerFamily, string> = {
  pearl: '#efe7d6',
  marble: '#efe9dd',
  crystal: '#eef1f4',
  resin: '#ece2d0',
  metallic: '#e7e2d6',
  wood: '#eadfc9',
  ceramic: '#f0eee8',
  'brushed-metal': '#e5e8e8',
  leather: '#e7d8c6',
  glass: '#e6f2f1',
  carbon: '#d9e0e2',
  'mother-of-pearl': '#efe9e5',
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

// ---- FINISH'LER (renk seçtirmez; aktif tahtanın pul rengine uyar) — SATILAN ürünler ----
// Kullanıcı yalnız MALZEME/tarz seçer; renk sabit değil, oyunda kullandığı tahtanın kendi
// pul renklerine (açık/koyu taş) uygulanır. dark/light burada SADECE mağaza önizleme rengidir.
function finish(id: string, name: string, family: CheckerFamily, rarity: CheckerRarity, dark: string): CheckerSkin {
  return { id, name, family, rarity, dark, light: IVORY[family], adaptive: true }
}

export const CHECKER_FINISHES: CheckerSkin[] = [
  finish('finish-pearl', 'İnci', 'pearl', 'rare', '#6d5bd0'),
  finish('finish-marble', 'Mermer', 'marble', 'epic', '#37506b'),
  finish('finish-crystal', 'Kristal', 'crystal', 'epic', '#2b6fe0'),
  finish('finish-resin', 'Premium Reçine', 'resin', 'rare', '#7a3b28'),
  finish('finish-metallic', 'Metalik İnci', 'metallic', 'legendary', '#c9a34a'),
  finish('finish-wood', 'Ahşap', 'wood', 'rare', '#8f5d38'),
  finish('finish-ceramic', 'Mat Seramik', 'ceramic', 'rare', '#73818a'),
  finish('finish-brushed-metal', 'Fırçalanmış Metal', 'brushed-metal', 'legendary', '#74808a'),
  finish('finish-leather', 'Deri', 'leather', 'rare', '#704733'),
  finish('finish-glass', 'Cam', 'glass', 'epic', '#4f8e9e'),
  finish('finish-carbon', 'Karbon', 'carbon', 'epic', '#38434b'),
  finish('finish-mother-of-pearl', 'Sedef', 'mother-of-pearl', 'legendary', '#b76f9d'),
]

// CHECKER_BY_ID: finish'ler + eski 30 sabit-renkli skin (geriye dönük uyum: satın alınmış olabilir).
export const CHECKER_BY_ID: Record<string, CheckerSkin> = Object.fromEntries(
  [...CHECKER_FINISHES, ...CHECKER_SKINS].map((s) => [s.id, s]),
)
export const CHECKER_FAMILIES: { key: CheckerFamily; label: string }[] = [
  { key: 'pearl', label: 'İnci' },
  { key: 'marble', label: 'Mermer' },
  { key: 'crystal', label: 'Kristal' },
  { key: 'resin', label: 'Premium Reçine' },
  { key: 'metallic', label: 'Metalik İnci' },
  { key: 'wood', label: 'Ahşap' },
  { key: 'ceramic', label: 'Mat Seramik' },
  { key: 'brushed-metal', label: 'Fırçalanmış Metal' },
  { key: 'leather', label: 'Deri' },
  { key: 'glass', label: 'Cam' },
  { key: 'carbon', label: 'Karbon' },
  { key: 'mother-of-pearl', label: 'Sedef' },
]

// Admin "Pul Tasarımı" ayarı: id -> sabit fiyat / satışta mı (grup skin.rarity'ye yazılır).
const CHECKER_OVERRIDES = new Map<string, { price?: number; active: boolean }>()
const CHECKER_BASE_RARITY = new Map(Object.values(CHECKER_BY_ID).map((s) => [s.id, s.rarity]))
const CHECKER_RARITIES = Object.keys(CHECKER_RARITY_PRICE) as CheckerRarity[]

export function checkerPrice(s: CheckerSkin): number {
  return CHECKER_OVERRIDES.get(s.id)?.price ?? CHECKER_RARITY_PRICE[s.rarity]
}
export function checkerOnSale(id: string): boolean {
  return CHECKER_OVERRIDES.get(id)?.active !== false
}
// Sunucu ayarlarını uygula (idempotent).
export function applyCheckerOverrides(rows: { id: string; group?: string; price?: number | null; active?: boolean }[]): void {
  CHECKER_OVERRIDES.clear()
  for (const s of Object.values(CHECKER_BY_ID)) s.rarity = CHECKER_BASE_RARITY.get(s.id)!
  for (const r of rows) {
    const s = CHECKER_BY_ID[r.id]
    if (!s) continue
    CHECKER_OVERRIDES.set(r.id, { price: typeof r.price === 'number' && r.price > 0 ? r.price : undefined, active: r.active !== false })
    const g = CHECKER_RARITIES.find((x) => x === r.group)
    if (g) s.rarity = g
  }
}
