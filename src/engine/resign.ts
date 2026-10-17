import type { GameState, Player } from './types'
import { allHome, lossMultiplier, opponent } from './board'

// ============================================================================
// RESIGN / PES ETME — KESİN ve DEĞİŞMEZ kural. TEK KAYNAK (frontend + MAT + testler).
//
// Pes değeri SAF KONUMDAN belirlenir (kullanıcı kararı 2026-09-16): pes eden ŞU ANKİ
// tahtada ne kaybediyorsa onu kaybeder — rakibin evinde/barında taşı VARSA backgammon,
// hiç toplamadıysa gammon, en az 1 taş topladıysa single. "Kazanan bear-off evresinde mi"
// ARANMAZ; açılış anchor'ı da rakip evinde sayılır (erken pes = backgammon olabilir).
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

/**
 * SİSTEM-belirlenen pes/timeout değeri (1/2/3): kaybedenin ŞU ANKİ konumundan.
 * TOPLAMA-EVRESİ KAPISI (2026-10-17 geri getirildi, bkz. Galaxy karşılaştırması): mars/backgammon
 * YALNIZ kazanan gerçekten bear-off evresindeyken (tüm pulları evde VEYA en az 1 toplamış) sayılır;
 * aksi halde erken/orta oyunda pes/timeout SAHTE 2/3 üretmesin -> tekli (1). Gerekçe: lossMultiplier
 * bir oyun-SONU sezgisidir (off=0 + rakip evinde taş -> 3); açılışta geri taşlar zaten rakip evinde
 * olduğundan kapısız hesap her erken terki backgammon sayardı (standart kural İHLALİ). Kapı, para
 * maçında gammon-kaçışını da engeller: kazanan gerçekten topluyorsa 2/3 korunur.
 *   kaybeden ≥1 taş topladı                         -> 1 (single)
 *   kazanan topluyor + kaybeden barda/rakip evinde   -> 3 (backgammon)
 *   kazanan topluyor + kaybeden hiç toplamadı        -> 2 (gammon)
 *   kazanan HENÜZ toplamıyor                         -> 1 (erken terk = tekli)
 * NOT: Doğal oyun-sonu puanı (15 taş toplandı) gamePoints/lossMultiplier ile AYRI hesaplanır,
 * bu kapıdan ETKİLENMEZ (orada çarpan zaten doğru). backend Backgammon::resignationValue ile BİREBİR.
 */
export function resignationValue(state: GameState, loser: Player, classic = false): 1 | 2 | 3 {
  const base = lossMultiplier(state, loser, classic)
  if (base === 1) return 1
  const winner = opponent(loser)
  const winnerBearing = state.off[winner] > 0 || allHome(state, winner)
  return winnerBearing ? base : 1
}

// Değer (1/2/3) -> tür (MAT/kayıt + calculateResignationPoints için).
export function resignationTypeForValue(value: 1 | 2 | 3): ResignationType {
  return value === 3
    ? ResignationType.BACKGAMMON
    : value === 2
      ? ResignationType.GAMMON
      : ResignationType.SINGLE
}
