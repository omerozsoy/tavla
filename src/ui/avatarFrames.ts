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

// SoberFrame cerceveleri: kuratorlu set: 62 cerceve, 5 kademe (44 anim cikarildi).
// Her cerceve tek renk (halka = kademe rengi). motion key'leri ASLA degismez (sahiplik korunur).
// Kademe yukseldikce gorsel etki/karmasiklik/premium his artar.
type AnimDef = { motion: SoberMotion; name: string; rarity: FrameRarity }
const ANIMS: AnimDef[] = [
  // ===== Standart (250) — 6 =====
  { motion: 'pulse', name: 'Nabız', rarity: 'common' },
  { motion: 'heartScale', name: 'Kalp Ölçek', rarity: 'common' },
  { motion: 'static', name: 'Sabit', rarity: 'common' },
  { motion: 'grayscale', name: 'Gri Ton', rarity: 'common' },
  { motion: 'sepia', name: 'Sepya', rarity: 'common' },
  { motion: 'floatSide', name: 'Yana Süzülme', rarity: 'common' },
  // ===== Nadir (500) — 16 =====
  { motion: 'float', name: 'Süzülme', rarity: 'rare' },
  { motion: 'pulseFast', name: 'Hızlı Nabız', rarity: 'rare' },
  { motion: 'levitate', name: 'Havalanma', rarity: 'rare' },
  { motion: 'wobble', name: 'Yalpa', rarity: 'rare' },
  { motion: 'expand', name: 'Genişleme', rarity: 'rare' },
  { motion: 'seesaw', name: 'Tahterevalli', rarity: 'rare' },
  { motion: 'sweep', name: 'Işık Turu', rarity: 'rare' },
  { motion: 'glint', name: 'Işıltı', rarity: 'rare' },
  { motion: 'bright', name: 'Parlaklık', rarity: 'rare' },
  { motion: 'shineOnce', name: 'Parlama', rarity: 'rare' },
  { motion: 'ripple', name: 'Dalga', rarity: 'rare' },
  { motion: 'invert', name: 'Ters', rarity: 'rare' },
  { motion: 'flicker', name: 'Titrek', rarity: 'rare' },
  { motion: 'ember', name: 'Kor', rarity: 'rare' },
  { motion: 'sheen', name: 'Cila', rarity: 'rare' },
  { motion: 'blur', name: 'Bulanıklık', rarity: 'rare' },
  // ===== Epik (1000) — 14 =====
  { motion: 'tilt', name: 'Eğim', rarity: 'epic' },
  { motion: 'glowPulse', name: 'Glow Nabız', rarity: 'epic' },
  { motion: 'sweepFast', name: 'Hızlı Tur', rarity: 'epic' },
  { motion: 'radar', name: 'Radar', rarity: 'epic' },
  { motion: 'auraPulse', name: 'Aura Nabız', rarity: 'epic' },
  { motion: 'hueCycle', name: 'Renk Döngüsü', rarity: 'epic' },
  { motion: 'pulseHalo', name: 'Hale Nabız', rarity: 'epic' },
  { motion: 'sweepRev', name: 'Ters Tur', rarity: 'epic' },
  { motion: 'orbit', name: 'Yörünge', rarity: 'epic' },
  { motion: 'hueWobble', name: 'Renk Sarsıntısı', rarity: 'epic' },
  { motion: 'ringPulse', name: 'Halka Nabzı', rarity: 'epic' },
  { motion: 'bloom', name: 'Çiçeklenme', rarity: 'epic' },
  { motion: 'conicRainbow', name: 'Konik Gökkuşağı', rarity: 'epic' },
  { motion: 'duotone', name: 'İki Ton', rarity: 'epic' },
  // ===== Efsanevi (2000) — 20 =====
  { motion: 'sway', name: 'Sallanma', rarity: 'legendary' },
  { motion: 'gradSpin', name: 'Dönen Gradient', rarity: 'legendary' },
  { motion: 'dualSweep', name: 'Çift Tur', rarity: 'legendary' },
  { motion: 'gradPulse', name: 'Gradient Nabız', rarity: 'legendary' },
  { motion: 'blob', name: 'Damla', rarity: 'legendary' },
  { motion: 'rainbow', name: 'Gökkuşağı', rarity: 'legendary' },
  { motion: 'rain', name: 'Parıltı Yağmuru', rarity: 'legendary' },
  { motion: 'sparkleBurst', name: 'Parıltı Patlaması', rarity: 'legendary' },
  { motion: 'dualOrbit', name: 'Çift Yörünge', rarity: 'legendary' },
  { motion: 'dualRipple', name: 'Çift Dalga', rarity: 'legendary' },
  { motion: 'neonPulse', name: 'Neon Nabız', rarity: 'legendary' },
  { motion: 'sonar', name: 'Sonar', rarity: 'legendary' },
  { motion: 'twinkle', name: 'Pırıltı', rarity: 'legendary' },
  { motion: 'comet', name: 'Kuyruklu Yıldız', rarity: 'legendary' },
  { motion: 'aura', name: 'Aura', rarity: 'legendary' },
  { motion: 'barrelRoll', name: 'Fıçı Dönüşü', rarity: 'legendary' },
  { motion: 'dropGlow', name: 'Işık Gölgesi', rarity: 'legendary' },
  { motion: 'pulseSweep', name: 'Nabızlı Tur', rarity: 'legendary' },
  { motion: 'haloSpin', name: 'Hale Dönüşü', rarity: 'legendary' },
  { motion: 'glowSpread', name: 'Işık Yayılımı', rarity: 'legendary' },
  // ===== Mitik (4000) — 6 =====
  { motion: 'vibrate', name: 'Titreşim', rarity: 'mythic' },
  { motion: 'pop', name: 'Pop', rarity: 'mythic' },
  { motion: 'tada', name: 'Tada', rarity: 'mythic' },
  { motion: 'loading', name: 'Yükleniyor', rarity: 'mythic' },
  { motion: 'rising', name: 'Yükseliş', rarity: 'mythic' },
  { motion: 'gradWave', name: 'Gradient Dalga', rarity: 'mythic' },
]
// Her animasyon TEK cerceve; halka rengi grubun rarity rengi (renk secenegi yok).
// Backend id'leri ile birebir ayni: 'frame.<motion>'.
export const AVATAR_FRAMES: AvatarFrameDef[] = ANIMS.map((a) => ({
  id: a.motion,
  name: a.name,
  rarity: a.rarity,
  group: a.rarity as FrameGroup,
  motion: a.motion,
  accent: FRAME_RARITY_COLOR[a.rarity],
}))

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
