/**
 * TavlaTv oyuncu rütbe (rank) sistemi — TEK KONFİG KAYNAĞI.
 *
 * 20 kademe, 6 aile. Rating eşikleri `badges.ts` DIVISIONS'tan gelir (tek gerçek
 * kaynak; burada tekrar hard-code EDİLMEZ). Bu dosya her kademeye tasarım
 * meta'sını bağlar: aile, alt-seviye kodu (I3/A1/M2/G0/S1), aile içi güç (tier),
 * Phosphor ikonu + weight. Renkler CSS token'larındadır (--rank-*), bileşen
 * yalnızca `data-family/-tier/-special/-apex` yazar.
 *
 * İKON SETİ: SADECE @phosphor-icons/react. Weight (regular→bold→duotone→fill)
 * bilinçli olarak rütbeyle birlikte artar; bu yüzden ikonlar Icon.tsx sarmalayıcı
 * (sabit weight="regular") yerine doğrudan buradan import edilir.
 *
 * NOT — LaurelWreath: brief'te Grandmaster G0 için istenen `LaurelWreath` ikonu
 * @phosphor-icons/react pakedinde YOKTUR. En yakın semantik karşılık olarak
 * `Certificate` (tevcih edilmiş onur/paye; Trophy ile Crown aileleri arasında
 * görsel olarak ayrık) kullanıldı.
 */

import {
  UserCircle,
  Leaf,
  Plant,
  TrendUp,
  Shield,
  ShieldChevron,
  ShieldStar,
  Medal,
  MedalMilitary,
  SealCheck,
  Star,
  StarFour,
  Seal,
  Trophy,
  Certificate, // LaurelWreath yerine (paket'te LaurelWreath yok)
  CrownSimple,
  Crown,
  type Icon as PhosphorIcon,
  type IconWeight,
} from '@phosphor-icons/react'
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
  Icon: PhosphorIcon
  iconName: string // kodda açık: kullanılan gerçek Phosphor export adı
  weight: IconWeight // Phosphor weight (rütbeyle birlikte kontrollü artar)
}

// divKey → (family, code, tier, special/apex, icon, weight).
// Rating eşiği (min) DIVISIONS'tan otomatik bağlanır; burada tekrar yazılmaz.
type Meta = Omit<RankTier, 'min' | 'divKey' | 'familyKey'> & { familyKey: string }

const META: Record<string, Meta> = {
  // ---- Taban rütbeler (alt-seviye yok) — sade, nötr, growth metaforu ----
  'div.rookie':     { family: 'rookie',     familyKey: 'div.rookie',     code: null, tier: 1, special: false, apex: false, Icon: UserCircle, iconName: 'UserCircle', weight: 'regular' },
  'div.novice':     { family: 'novice',     familyKey: 'div.novice',     code: null, tier: 1, special: false, apex: false, Icon: Leaf,       iconName: 'Leaf',       weight: 'regular' },
  'div.beginner':   { family: 'beginner',   familyKey: 'div.beginner',   code: null, tier: 1, special: false, apex: false, Icon: Plant,      iconName: 'Plant',      weight: 'regular' },
  'div.developing': { family: 'developing', familyKey: 'div.developing', code: null, tier: 1, special: false, apex: false, Icon: TrendUp,    iconName: 'TrendUp',    weight: 'regular' },

  // ---- Intermediate (Shield ailesi) — soğuk çelik ----
  'div.i3': { family: 'intermediate', familyKey: 'div.intermediate', code: 'I3', tier: 3, special: false, apex: false, Icon: Shield,        iconName: 'Shield',        weight: 'regular' },
  'div.i2': { family: 'intermediate', familyKey: 'div.intermediate', code: 'I2', tier: 2, special: false, apex: false, Icon: ShieldChevron, iconName: 'ShieldChevron', weight: 'bold' },
  'div.i1': { family: 'intermediate', familyKey: 'div.intermediate', code: 'I1', tier: 1, special: false, apex: false, Icon: ShieldStar,    iconName: 'ShieldStar',    weight: 'duotone' },

  // ---- Advanced (Medal/Seal ailesi) — royal blue ----
  'div.a3': { family: 'advanced', familyKey: 'div.advanced', code: 'A3', tier: 3, special: false, apex: false, Icon: Medal,         iconName: 'Medal',         weight: 'regular' },
  'div.a2': { family: 'advanced', familyKey: 'div.advanced', code: 'A2', tier: 2, special: false, apex: false, Icon: MedalMilitary, iconName: 'MedalMilitary', weight: 'bold' },
  'div.a1': { family: 'advanced', familyKey: 'div.advanced', code: 'A1', tier: 1, special: false, apex: false, Icon: SealCheck,     iconName: 'SealCheck',     weight: 'duotone' },

  // ---- Master (Star/Seal ailesi) — violet ----
  'div.m3': { family: 'master', familyKey: 'div.master', code: 'M3', tier: 3, special: false, apex: false, Icon: Star,     iconName: 'Star',     weight: 'bold' },
  'div.m2': { family: 'master', familyKey: 'div.master', code: 'M2', tier: 2, special: false, apex: false, Icon: StarFour, iconName: 'StarFour', weight: 'bold' },
  'div.m1': { family: 'master', familyKey: 'div.master', code: 'M1', tier: 1, special: false, apex: false, Icon: Seal,     iconName: 'Seal',     weight: 'duotone' },

  // ---- Grandmaster (Trophy ailesi) — muted premium gold; G0 elit ----
  'div.g3': { family: 'grandmaster', familyKey: 'div.grandmaster', code: 'G3', tier: 3, special: false, apex: false, Icon: Trophy,      iconName: 'Trophy',      weight: 'bold' },
  'div.g2': { family: 'grandmaster', familyKey: 'div.grandmaster', code: 'G2', tier: 2, special: false, apex: false, Icon: Trophy,      iconName: 'Trophy',      weight: 'duotone' },
  'div.g1': { family: 'grandmaster', familyKey: 'div.grandmaster', code: 'G1', tier: 1, special: false, apex: false, Icon: Trophy,      iconName: 'Trophy',      weight: 'duotone' },
  'div.g0': { family: 'grandmaster', familyKey: 'div.grandmaster', code: 'G0', tier: 1, special: true,  apex: false, Icon: Certificate, iconName: 'Certificate', weight: 'fill' },

  // ---- Super Grandmaster (Crown ailesi) — deep crimson + gold accent; S1 zirve ----
  'div.sgm3': { family: 'superGrandmaster', familyKey: 'div.superGrandmaster', code: 'S3', tier: 3, special: false, apex: false, Icon: CrownSimple, iconName: 'CrownSimple', weight: 'duotone' },
  'div.sgm2': { family: 'superGrandmaster', familyKey: 'div.superGrandmaster', code: 'S2', tier: 2, special: false, apex: false, Icon: Crown,       iconName: 'Crown',       weight: 'duotone' },
  'div.sgm1': { family: 'superGrandmaster', familyKey: 'div.superGrandmaster', code: 'S1', tier: 1, special: false, apex: true,  Icon: Crown,       iconName: 'Crown',       weight: 'fill' },
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
