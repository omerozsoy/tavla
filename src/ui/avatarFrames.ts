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

// ============================================================================
// FX katmani: her cerceveye ozgu animasyon karakteri. AvatarFrame bunu okuyup
// katmanlari (GSAP orkestrasyon + tsParticles + Rive/Lottie) adaptif kurar.
// CSS her zaman temel gorunumu cizer; asagidakiler yalnizca "zengin" modda
// (buyuk boyut + animated + ekranda + reduced-motion kapali) devreye girer.
// ----------------------------------------------------------------------------
// motion: GSAP timeline davranislari (bkz. useFrameFx). Her biri kendine ozgu,
//         ayni animasyonun renk degistirilmis tekrari DEGIL.
// particle: tsParticles preset anahtari (bkz. frameParticles). Yalnizca buyuk
//           tekil baglamlarda (profil/vitrin/oyun) yuklenir; listelerde asla.
// rive/lottie: dosya URL'si verilirse ilgili katman lazy yuklenir. Su an dosya
//              yok; mimari hazir (URL eklenince otomatik devreye girer).
export type FrameMotion =
  | 'orbit' // ters yonde donen ikinci enerji halkasi
  | 'orbitDot' // halka boyunca dolasan parlak nokta
  | 'sweep' // metal yuzeyde gezen isik parlamasi (light sweep)
  | 'strike' // rastgele araliklarla kisa yildirim/ark
  | 'wing' // yanlarda kanat parlamasi/acilma (phoenix)
  | 'dice' // ara ara zar yuvarlama (dice-master)
  | 'float' // hafif suzulme (zar/pul)
  | 'breathe' // yavas kalp atisi / hafif nabiz (ruby)
  | 'burst' // periyodik premium isik patlamasi (sampiyon)
  | 'sparkle' // rastgele kristal parlamalari
  | 'eyes' // ara ara parlayan gozler (dragon)
  | 'smoke' // hafif duman
  | 'glitch' // seyrek kisa glitch (cyberpunk)
  | 'gravity' // merkeze cekilen partikuller (black-hole)
  | 'rays' // donen isik huzmeleri
  | 'aura' // yavas enerji halesi
  | 'flames' // yukselen alevler

export type FrameParticle =
  | 'ember' // koz/kivilcim (ates)
  | 'gold' // altin tozu
  | 'snow' // buz/kar
  | 'spark' // elektrik parcaciklari
  | 'cosmic' // yildiz/kozmik toz
  | 'gravity' // merkeze akan mor parcaciklar
  | 'smoke' // duman

export interface FrameFx {
  motion: FrameMotion[]
  particle?: FrameParticle
  rive?: string // AE/Rive dosyasi eklenince URL; su an bos
  lottie?: string
  /** Zengin katmanlar icin min boyut (px). Varsayilan 44. */
  minRich?: number
  /** Partikul katmani icin min boyut (px). Varsayilan 76. */
  minParticle?: number
}

const RICH = 44
export const FRAME_FX: Record<string, FrameFx> = {
  // --- Nadir: hafif, kontrollu ---
  'neon-pulse': { motion: ['orbitDot', 'breathe'] },
  // --- Epik: belirgin, cok katmanli ---
  'purple-vortex': { motion: ['orbit'] },
  'ice-crown': { motion: ['sparkle'], particle: 'snow' },
  electric: { motion: ['strike'], particle: 'spark' },
  cyberpunk: { motion: ['glitch', 'sweep'] },
  'dice-master': { motion: ['dice', 'float'] },
  // --- Efsanevi: metal + parcacik + mucevher ---
  'royal-gold': { motion: ['sweep'], particle: 'gold' },
  inferno: { motion: ['flames'], particle: 'ember' },
  diamond: { motion: ['sweep', 'sparkle'] },
  emerald: { motion: ['sweep', 'sparkle'] },
  ruby: { motion: ['breathe'] },
  vip: { motion: ['sweep'], particle: 'gold' },
  champion: { motion: ['sweep', 'burst'], particle: 'gold' },
  'backgammon-king': { motion: ['sweep'], particle: 'gold' },
  'top-100': { motion: ['sweep'] },
  '1000-wins': { motion: ['sparkle'], particle: 'gold' },
  // --- Mitik: 2-3 bagimsiz katman; Rive/Lottie'ye hazir ---
  'black-hole': { motion: ['orbit', 'gravity'], particle: 'gravity', rive: '' },
  galaxy: { motion: ['orbit', 'aura'], particle: 'cosmic', rive: '' },
  phoenix: { motion: ['wing', 'burst'], particle: 'ember', rive: '', lottie: '' },
  dragon: { motion: ['eyes', 'smoke'], particle: 'smoke', rive: '' },
  'thunder-god': { motion: ['orbit', 'strike'], particle: 'spark', rive: '' },
  grandmaster: { motion: ['orbit', 'breathe'] },
  'tournament-champion': { motion: ['burst', 'rays'], particle: 'gold', rive: '' },
  'season-champion': { motion: ['burst', 'aura'], particle: 'gold', rive: '', lottie: '' },
}

export function frameFx(id?: string | null): FrameFx | undefined {
  if (!id) return undefined
  return FRAME_FX[id]
}
export const FRAME_MIN_RICH = RICH
