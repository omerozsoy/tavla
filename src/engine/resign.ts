import type { GameState, Player } from './types'
import { WHITE, opponent, lossMultiplier } from './board'

// ============================================================================
// RESIGN / PES ETME — KESİN ve DEĞİŞMEZ kural. TEK KAYNAK (frontend + MAT + testler).
//
// Pes AYRI bir oyun aksiyonudur: oyuncu SINGLE / GAMMON / BACKGAMMON SEÇER.
// Sonuç tahtadaki konumdan TAHMİN EDİLMEZ (bar'da taş, rakip evinde taş, hiç toplamamış
// olmak vb. resign puanını DEĞİŞTİRMEZ). Normal bear-off gammon/backgammon tespitiyle
// KARIŞTIRILMAZ (o tahtaya bakar; bu SEÇİLEN türe bakar).
//
// PUAN = cubeValue × multiplier
//   SINGLE      = cubeValue × 1
//   GAMMON      = cubeValue × 2
//   BACKGAMMON  = cubeValue × 3
// ============================================================================

// enum yerine const-nesne + tip (proje 'erasableSyntaxOnly' -> enum yasak). API aynı:
// ResignationType.SINGLE (değer) + ResignationType (tip) her ikisi de çalışır.
export const ResignationType = {
  SINGLE: 'single',
  GAMMON: 'gammon',
  BACKGAMMON: 'backgammon',
} as const
export type ResignationType = (typeof ResignationType)[keyof typeof ResignationType]

// Çarpanlar TEK yerde — kodun başka yerinde 1/2/3 magic number YAZILMAZ.
export const RESIGN_MULTIPLIER: Readonly<Record<ResignationType, 1 | 2 | 3>> = {
  [ResignationType.SINGLE]: 1,
  [ResignationType.GAMMON]: 2,
  [ResignationType.BACKGAMMON]: 3,
}

// Seçilebilir türler — sabit sıra (UI + iterasyon için).
export const RESIGNATION_TYPES: readonly ResignationType[] = [
  ResignationType.SINGLE,
  ResignationType.GAMMON,
  ResignationType.BACKGAMMON,
]

export function isResignationType(v: unknown): v is ResignationType {
  return (
    v === ResignationType.SINGLE || v === ResignationType.GAMMON || v === ResignationType.BACKGAMMON
  )
}

/** Resign türünün çarpanı (SINGLE=1, GAMMON=2, BACKGAMMON=3). Geçersiz tür -> hata. */
export function resignMultiplier(type: ResignationType): 1 | 2 | 3 {
  const m = RESIGN_MULTIPLIER[type]
  if (m === undefined) {
    throw new Error(`Geçersiz resign türü: ${String(type)}`)
  }
  return m
}

/**
 * MERKEZİ RESIGN PUANI: pointsWon = cubeValue × resignMultiplier(type).
 * cubeValue tam sayı ve >= 1 olmalı (küp değeri 1,2,4,8,...). Aksi -> hata (sessiz yanlış puan yok).
 */
export function calculateResignationPoints(type: ResignationType, cubeValue: number): number {
  if (!Number.isInteger(cubeValue) || cubeValue < 1) {
    throw new Error(`Geçersiz cube değeri: ${String(cubeValue)}`)
  }
  return cubeValue * resignMultiplier(type)
}

// Kazanan bear-off (toplama) evresinde mi? off>0 VEYA tüm taşları evinde (bar'da yok). Bu evre
// gammon/backgammon'un GERÇEKLEŞTİĞİ karar aşamasıdır; öncesinde (açılış/erken) HAYALET yok.
function inBearingPhase(state: GameState, winner: Player): boolean {
  if (state.off[winner] > 0) return true
  if (state.bar[winner] > 0) return false
  const [hs, he] = winner === WHITE ? [0, 6] : [18, 24]
  for (let i = 0; i < 24; i++) {
    const v = state.points[i]
    const cnt = winner === WHITE ? Math.max(0, v) : Math.max(0, -v)
    if (cnt > 0 && (i < hs || i >= he)) return false // ev dışında taş var -> henüz bear-off değil
  }
  return true
}

/**
 * SİSTEM-belirlenen pes değeri (1/2/3): kaybedenin (pes eden) ŞU ANKİ konumundan. Kullanıcı
 * 1/2/3 SEÇMEZ — sistem gösterir (kullanıcı kuralı). lossMultiplier standart kuralı verir; ANCAK
 * gammon/backgammon YALNIZ oyun KARARA bağlandığında (kazanan bear-off evresinde) raporlanır ->
 * açılış/erken konumda HAYALET backgammon OLMAZ (rule #1: normal/erken kayıp = single).
 */
export function resignationValue(state: GameState, loser: Player): 1 | 2 | 3 {
  const base = lossMultiplier(state, loser)
  if (base === 1) return 1
  return inBearingPhase(state, opponent(loser)) ? base : 1
}

// Değer (1/2/3) -> tür (MAT/kayıt + calculateResignationPoints için).
export function resignationTypeForValue(value: 1 | 2 | 3): ResignationType {
  return value === 3
    ? ResignationType.BACKGAMMON
    : value === 2
      ? ResignationType.GAMMON
      : ResignationType.SINGLE
}
