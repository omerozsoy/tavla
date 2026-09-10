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
