// Animasyonlu avatar cerceveleri registry. Gorsel/animasyon tanimlari AvatarFrame.css'te
// [data-frame="slug"] ile. Burada yalnizca meta: id/slug, ad, nadirlik ve galeri grubu.
// Nadirlik yukseldikce gorsel karmasiklik + animasyon kalitesi artar.

import type { SoberMotion } from './SoberFrame'

export type FrameRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
export type FrameGroup = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'prestige' | 'tavla' | 'achievement'

export interface AvatarFrameDef {
  id: string
  name: string
  rarity: FrameRarity // 5 kademe: Standart<Nadir<Epik<Efsanevi<Mitik
  group: FrameGroup // galeri gruplamasi
  /** SoberFrame animasyon anahtari (AvatarFrame -> SoberFrame ile cizer) */
  motion: SoberMotion
  /** halka rengi (hex) */
  accent: string
  /** Magazadan satin alinamaz; basari/turnuva ile kazanilir */
  earned?: boolean
}

// 5 kademe rarity renkleri: Standart gumus, Nadir safir, Epik ametist, Efsanevi altin, Mitik yakut
export const FRAME_RARITY_COLOR: Record<FrameRarity, string> = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
  mythic: '#EF4444',
}

// Rarity coin fiyatlari (backend ShopController RARITY_PRICE ile birebir ayni olmali)
export const FRAME_RARITY_PRICE: Record<FrameRarity, number> = {
  common: 250,
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
  common: 'rarity.common',
  rare: 'rarity.rare',
  epic: 'rarity.epic',
  legendary: 'rarity.legendary',
  mythic: 'rarity.mythic',
  prestige: 'frames.groupPrestige',
  tavla: 'frames.groupTavla',
  achievement: 'frames.groupAchievement',
}
export const FRAME_GROUP_ORDER: FrameGroup[] = [
  'common', 'rare', 'epic', 'legendary', 'mythic', 'prestige', 'tavla', 'achievement',
]

// Sade SoberFrame cerceveleri: 42 animasyon x 5 renk = 210 cerceve (generate).
// Eski 24 cerceve + PremiumFrame sistemi kaldirildi.
type AnimDef = { motion: SoberMotion; name: string; rarity: FrameRarity }
const ANIMS: AnimDef[] = [
  // --- Standart (250): en sade olcek/nabiz ---
  { motion: 'pulse', name: 'Nabız', rarity: 'common' },
  { motion: 'heartbeat', name: 'Kalp Atışı', rarity: 'common' },
  { motion: 'pulseFast', name: 'Hızlı Nabız', rarity: 'common' },
  { motion: 'heartScale', name: 'Kalp Ölçek', rarity: 'common' },
  { motion: 'vibrate', name: 'Titreşim', rarity: 'common' },
  { motion: 'jelly', name: 'Jöle', rarity: 'common' },
  { motion: 'gelatine', name: 'Jelatin', rarity: 'common' },
  { motion: 'bounce', name: 'Zıplama', rarity: 'common' },
  { motion: 'pop', name: 'Pop', rarity: 'common' },
  // --- Nadir (500): hafif hareket/salinim ---
  { motion: 'levitate', name: 'Havalanma', rarity: 'rare' },
  { motion: 'sway', name: 'Sallanma', rarity: 'rare' },
  { motion: 'wobble', name: 'Yalpa', rarity: 'rare' },
  { motion: 'rock', name: 'Beşik', rarity: 'rare' },
  { motion: 'glowPulse', name: 'Glow Nabız', rarity: 'rare' },
  { motion: 'tada', name: 'Tada', rarity: 'rare' },
  { motion: 'circleMove', name: 'Daire Gezinme', rarity: 'rare' },
  { motion: 'pendulum', name: 'Sarkaç', rarity: 'rare' },
  { motion: 'swing', name: 'Salınım', rarity: 'rare' },
  // --- Epik (1000): belirgin isik/sweep ---
  { motion: 'expand', name: 'Genişleme', rarity: 'epic' },
  { motion: 'seesaw', name: 'Tahterevalli', rarity: 'epic' },
  { motion: 'sweep', name: 'Işık Turu', rarity: 'epic' },
  { motion: 'sweepFast', name: 'Hızlı Tur', rarity: 'epic' },
  { motion: 'glint', name: 'Işıltı', rarity: 'epic' },
  { motion: 'bright', name: 'Parlaklık', rarity: 'epic' },
  { motion: 'shineOnce', name: 'Parlama', rarity: 'epic' },
  { motion: 'gradSpin', name: 'Dönen Gradient', rarity: 'epic' },
  // --- Efsanevi (2000): cok katmanli/renk/3D ---
  { motion: 'ripple', name: 'Dalga', rarity: 'legendary' },
  { motion: 'radar', name: 'Radar', rarity: 'legendary' },
  { motion: 'auraPulse', name: 'Aura Nabız', rarity: 'legendary' },
  { motion: 'flip3d', name: '3D Çevirme', rarity: 'legendary' },
  { motion: 'hueCycle', name: 'Renk Döngüsü', rarity: 'legendary' },
  { motion: 'invert', name: 'Ters', rarity: 'legendary' },
  { motion: 'dualSweep', name: 'Çift Tur', rarity: 'legendary' },
  { motion: 'pulseHalo', name: 'Hale Nabız', rarity: 'legendary' },
  // --- Mitik (4000): en gosterisli/gokkusagi/yorunge/partikul ---
  { motion: 'rainbow', name: 'Gökkuşağı', rarity: 'mythic' },
  { motion: 'conicRainbow', name: 'Konik Gökkuşağı', rarity: 'mythic' },
  { motion: 'rain', name: 'Parıltı Yağmuru', rarity: 'mythic' },
  { motion: 'sparkleBurst', name: 'Parıltı Patlaması', rarity: 'mythic' },
  { motion: 'dualOrbit', name: 'Çift Yörünge', rarity: 'mythic' },
  { motion: 'dualRipple', name: 'Çift Dalga', rarity: 'mythic' },
  { motion: 'neonPulse', name: 'Neon Nabız', rarity: 'mythic' },
  { motion: 'sonar', name: 'Sonar', rarity: 'mythic' },
]
// 5 renk (id anahtari + gorunen ad + hex). Backend id'leri ile birebir ayni: 'frame.<motion>-<key>'.
export const FRAME_COLORS: { key: string; name: string; hex: string }[] = [
  { key: 'rose', name: 'Rose', hex: '#B76E79' },
  { key: 'sapphire', name: 'Safir', hex: '#2563EB' },
  { key: 'emerald', name: 'Zümrüt', hex: '#059669' },
  { key: 'gold', name: 'Altın', hex: '#B8862B' },
  { key: 'amethyst', name: 'Menekşe', hex: '#8B5CF6' },
]
export const AVATAR_FRAMES: AvatarFrameDef[] = ANIMS.flatMap((a) =>
  FRAME_COLORS.map((c) => ({
    id: `${a.motion}-${c.key}`,
    name: `${a.name} · ${c.name}`,
    rarity: a.rarity,
    group: a.rarity as FrameGroup,
    motion: a.motion,
    accent: c.hex,
  })),
)

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
