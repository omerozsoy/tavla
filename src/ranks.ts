/**
 * TavlaTv oyuncu rütbe (rank) sistemi — TEK KONFİG KAYNAĞI.
 *
 * 20 kademe, 6 aile. Rating eşikleri `badges.ts` DIVISIONS'tan gelir (tek gerçek
 * kaynak; burada tekrar hard-code EDİLMEZ). Bu dosya her kademeye tasarım
 * meta'sını bağlar: aile, alt-seviye kodu (I3/A1/M2/G0/S1), aile içi güç (tier),
 * Tabler ikonu + çizgi kalınlığı (stroke). Renkler CSS token'larındadır (--rank-*),
 * bileşen yalnızca `data-family/-tier/-special/-apex` yazar.
 *
 * İKON SETİ: SADECE @tabler/icons-react. Rütbe yükseldikçe görsel ağırlık artar:
 * taban tier'lar OUTLINE (stroke 2→2.4), en güçlü/elit tier'lar DOLU (Filled)
 * varyant. İkonlar Icon.tsx sarmalayıcı (sabit görünüm) yerine doğrudan buradan
 * import edilir (rütbeye özel stroke/dolu ayarı için).
 *
 * NOT — duotone→Filled: Phosphor'daki iki-tonlu (duotone) kademeler Tabler'da
 * DOLU (Filled) varyanta çevrildi; G0 `Certificate` (LaurelWreath paket'te yok).
 */

import {
  IconUserCircle,
  IconLeaf,
  IconPlant2,
  IconTrendingUp,
  IconShield,
  IconShieldChevron,
  IconShieldFilled,
  IconMedal,
  IconMedal2,
  IconRosetteDiscountCheckFilled,
  IconStar,
  IconSparkles,
  IconRosetteFilled,
  IconTrophy,
  IconTrophyFilled,
  IconCertificate,
  IconCrown,
  IconCrownFilled,
  type Icon as TablerIcon,
} from '@tabler/icons-react'
import { DIVISIONS } from './badges'

export type RankFamily =
  | 'rookie'
  | 'novice'
  | 'beginner'
  | 'developing'
  | 'intermediate'
  | 'advanced'
  | 'master'
  | 'grandmaster'
  | 'superGrandmaster'

export interface RankTier {
  divKey: string // badges.ts DIVISIONS anahtarı (benzersiz id), ör. 'div.m2'
  family: RankFamily
  familyKey: string // aile adının i18n anahtarı, ör. 'div.master' → "Master"
  code: string | null // alt-seviye kodu: 'M2' | 'A1' | 'G0' | 'S1' | null (taban rütbeler)
  tier: 1 | 2 | 3 // aile içi güç (3=giriş, 1=en güçlü) → kontrast/weight sürücüsü
  special: boolean // Grandmaster G0: ailenin elit tier'ı
  apex: boolean // Super Grandmaster S1: sistemin mutlak zirvesi
  min: number // rating alt eşiği (DIVISIONS'tan)
  Icon: TablerIcon
  iconName: string // kodda açık: kullanılan gerçek Tabler export adı
  stroke: number // Tabler çizgi kalınlığı (rütbeyle artar; Filled ikonlarda yok sayılır)
}

// divKey → (family, code, tier, special/apex, icon, weight).
// Rating eşiği (min) DIVISIONS'tan otomatik bağlanır; burada tekrar yazılmaz.
type Meta = Omit<RankTier, 'min' | 'divKey' | 'familyKey'> & { familyKey: string }

const META: Record<string, Meta> = {
  // ---- Taban rütbeler (alt-seviye yok) — sade, nötr, growth metaforu ----
  'div.rookie':     { family: 'rookie',     familyKey: 'div.rookie',     code: null, tier: 1, special: false, apex: false, Icon: IconUserCircle, iconName: 'IconUserCircle', stroke: 2 },
  'div.novice':     { family: 'novice',     familyKey: 'div.novice',     code: null, tier: 1, special: false, apex: false, Icon: IconLeaf,       iconName: 'IconLeaf',       stroke: 2 },
  'div.beginner':   { family: 'beginner',   familyKey: 'div.beginner',   code: null, tier: 1, special: false, apex: false, Icon: IconPlant2,     iconName: 'IconPlant2',     stroke: 2 },
  'div.developing': { family: 'developing', familyKey: 'div.developing', code: null, tier: 1, special: false, apex: false, Icon: IconTrendingUp, iconName: 'IconTrendingUp', stroke: 2 },

  // ---- Intermediate (Shield ailesi) — soğuk çelik ----
  'div.i3': { family: 'intermediate', familyKey: 'div.intermediate', code: 'I3', tier: 3, special: false, apex: false, Icon: IconShield,        iconName: 'IconShield',        stroke: 2 },
  'div.i2': { family: 'intermediate', familyKey: 'div.intermediate', code: 'I2', tier: 2, special: false, apex: false, Icon: IconShieldChevron, iconName: 'IconShieldChevron', stroke: 2.4 },
  'div.i1': { family: 'intermediate', familyKey: 'div.intermediate', code: 'I1', tier: 1, special: false, apex: false, Icon: IconShieldFilled,  iconName: 'IconShieldFilled',  stroke: 2 },

  // ---- Advanced (Medal/Seal ailesi) — royal blue ----
  'div.a3': { family: 'advanced', familyKey: 'div.advanced', code: 'A3', tier: 3, special: false, apex: false, Icon: IconMedal,                       iconName: 'IconMedal',                       stroke: 2 },
  'div.a2': { family: 'advanced', familyKey: 'div.advanced', code: 'A2', tier: 2, special: false, apex: false, Icon: IconMedal2,                      iconName: 'IconMedal2',                      stroke: 2.4 },
  'div.a1': { family: 'advanced', familyKey: 'div.advanced', code: 'A1', tier: 1, special: false, apex: false, Icon: IconRosetteDiscountCheckFilled, iconName: 'IconRosetteDiscountCheckFilled', stroke: 2 },

  // ---- Master (Star/Seal ailesi) — violet ----
  'div.m3': { family: 'master', familyKey: 'div.master', code: 'M3', tier: 3, special: false, apex: false, Icon: IconStar,          iconName: 'IconStar',          stroke: 2.4 },
  'div.m2': { family: 'master', familyKey: 'div.master', code: 'M2', tier: 2, special: false, apex: false, Icon: IconSparkles,      iconName: 'IconSparkles',      stroke: 2.4 },
  'div.m1': { family: 'master', familyKey: 'div.master', code: 'M1', tier: 1, special: false, apex: false, Icon: IconRosetteFilled, iconName: 'IconRosetteFilled', stroke: 2 },

  // ---- Grandmaster (Trophy ailesi) — muted premium gold; G0 elit ----
  'div.g3': { family: 'grandmaster', familyKey: 'div.grandmaster', code: 'G3', tier: 3, special: false, apex: false, Icon: IconTrophy,       iconName: 'IconTrophy',       stroke: 2.4 },
  'div.g2': { family: 'grandmaster', familyKey: 'div.grandmaster', code: 'G2', tier: 2, special: false, apex: false, Icon: IconTrophyFilled, iconName: 'IconTrophyFilled', stroke: 2 },
  'div.g1': { family: 'grandmaster', familyKey: 'div.grandmaster', code: 'G1', tier: 1, special: false, apex: false, Icon: IconTrophyFilled, iconName: 'IconTrophyFilled', stroke: 2 },
  'div.g0': { family: 'grandmaster', familyKey: 'div.grandmaster', code: 'G0', tier: 1, special: true,  apex: false, Icon: IconCertificate,  iconName: 'IconCertificate',  stroke: 2.2 },

  // ---- Super Grandmaster (Crown ailesi) — deep crimson + gold accent; S1 zirve ----
  'div.sgm3': { family: 'superGrandmaster', familyKey: 'div.superGrandmaster', code: 'S3', tier: 3, special: false, apex: false, Icon: IconCrown,       iconName: 'IconCrown',       stroke: 2.4 },
  'div.sgm2': { family: 'superGrandmaster', familyKey: 'div.superGrandmaster', code: 'S2', tier: 2, special: false, apex: false, Icon: IconCrownFilled, iconName: 'IconCrownFilled', stroke: 2 },
  'div.sgm1': { family: 'superGrandmaster', familyKey: 'div.superGrandmaster', code: 'S1', tier: 1, special: false, apex: true,  Icon: IconCrownFilled, iconName: 'IconCrownFilled', stroke: 2 },
}

// 20 kademe, düşükten yükseğe. Eşik (min) DIVISIONS'tan; meta META'dan.
export const RANKS: RankTier[] = DIVISIONS.map((d) => {
  const m = META[d.key]
  return { divKey: d.key, min: d.min, ...m }
})

const BY_DIVKEY: Record<string, RankTier> = Object.fromEntries(RANKS.map((r) => [r.divKey, r]))
const BY_CODE: Record<string, RankTier> = Object.fromEntries(
  RANKS.filter((r) => r.code).map((r) => [r.code as string, r]),
)

/** Rating → oyuncunun ulaştığı en yüksek kademe. */
export function rankOf(rating: number): RankTier {
  let r = RANKS[0]
  for (const x of RANKS) if (rating >= x.min) r = x
  return r
}

/** Alt-seviye kodundan (ör. 'M2', 'S1') kademe. */
export function rankByCode(code: string): RankTier | undefined {
  return BY_CODE[code]
}

/** Aile + kod ile kademe (kod yoksa ailenin taban kademesi). */
export function rankByFamily(family: RankFamily, code?: string | null): RankTier | undefined {
  if (code) return BY_CODE[code]
  return RANKS.find((r) => r.family === family && !r.code)
}

/** badges.ts division anahtarından kademe (DivisionChip köprüsü). */
export function rankByDivKey(key: string): RankTier | undefined {
  return BY_DIVKEY[key]
}

/** Bir kademenin bir üstü (yoksa undefined → zirve). */
export function nextRank(tier: RankTier): RankTier | undefined {
  const i = RANKS.findIndex((r) => r.divKey === tier.divKey)
  return i >= 0 ? RANKS[i + 1] : undefined
}

/** Kademenin RANKS içindeki sırası (0-tabanlı). */
export function rankIndex(tier: RankTier): number {
  return RANKS.findIndex((r) => r.divKey === tier.divKey)
}

// ---- Görsel aileler (progression gruplaması) ----
// 6 grup: entry (Rookie/Novice/Beginner/Developing tek çatı) + 5 alt-seviyeli aile.
export type RankGroup =
  | 'entry'
  | 'intermediate'
  | 'advanced'
  | 'master'
  | 'grandmaster'
  | 'superGrandmaster'

const ENTRY_FAMILIES: RankFamily[] = ['rookie', 'novice', 'beginner', 'developing']

/** Aile → görsel grup. */
export function groupOf(family: RankFamily): RankGroup {
  return ENTRY_FAMILIES.includes(family) ? 'entry' : (family as RankGroup)
}

/** Grup → i18n etiket anahtarı (entry için 'div.entry', diğerleri aile adı). */
export function groupLabelKey(group: RankGroup): string {
  return group === 'entry' ? 'div.entry' : `div.${group}`
}

export interface RankGroupBlock {
  group: RankGroup
  labelKey: string
  ranks: RankTier[]
}

// RANKS'ı sıralı gruplara böler (progression bileşeni bunu render eder).
export const RANK_GROUPS: RankGroupBlock[] = RANKS.reduce<RankGroupBlock[]>((acc, r) => {
  const g = groupOf(r.family)
  const last = acc[acc.length - 1]
  if (last && last.group === g) last.ranks.push(r)
  else acc.push({ group: g, labelKey: groupLabelKey(g), ranks: [r] })
  return acc
}, [])
