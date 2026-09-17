// Maç Özeti (Match Summary) — GNU Backgammon "Match Summary" mantığında, TAMAMLANMIŞ bir
// analizden (LogEntry[]) per-oyuncu performans/hata/küp/şans istatistiklerini AGGREGATE eder.
//
// İLKELER (kullanıcı direktifi):
//  - Yeni analiz ÇALIŞTIRMAZ; yalnız mevcut hamle-hamle analiz log'undan (LogEntry[]) türetir.
//  - Aynı LogEntry[] hem normal maç analizi (MatchReport) hem MAT analizi (MatReview) için gelir
//    -> TEK model, TEK hesaplama, iki ekran.
//  - PR agregasyonu ORTALAMA DEĞİL havuzlamadır (pr.ts §13): PR = (Σloss / Σkarar) × 500.
//    Checker ve cube AYRI havuzlanır; overall = ikisi birlikte havuzlanır. Tüm oyunlar (game)
//    tek log'ta olduğundan havuzlama otomatik maç-seviyesindedir (1/3/5/7… puanlık maçta aynı).
//  - Güvenilir hesaplanamayan metrikler null döner -> UI '—' gösterir (asla 0/uydurma).

import type { LogEntry } from '../ui/MatchReport'
import { prValue } from './pr'

// Hata eşikleri — kod tabanındaki mevcut band eşikleriyle AYNI (MatReview.band / MatchReport.band):
// inaccuracy ≥0.02 (gösterilen "hata"), blunder ≥0.08. Tek yerde tut.
export const MS_ERROR_MIN = 0.02
export const MS_BLUNDER_MIN = 0.08

export interface PlayerMatchSummary {
  name: string
  color: 'white' | 'black'

  // GENEL
  performanceRating: number | null // overall PR (havuzlanmış)
  checkerPlay: number | null // checker PR
  cubePlay: number | null // cube PR
  luck: number | null // şans (MWC%) — dışarıdan verilir; yoksa null ('—')
  decisions: number // toplam sayılan karar (checker + cube)

  // TOTAL ERRORS
  totalErrors: number
  totalBlunders: number
  totalEquityCost: number

  // CHECKER ERRORS
  checkerErrors: number
  checkerBlunders: number
  checkerEquityCost: number
  unforcedMoves: number // sayılan checker kararı (zorlanmamış = pos'lu, '(no move)' hariç)

  // DOUBLES (double / no-double = teklif tarafı)
  doubles: number // double-tarafı hata sayısı (cost ≥ MS_ERROR_MIN)
  doubleBlunders: number
  doubleEquityCost: number
  wrongDoublesCost: number
  missedDoublesCost: number
  cubeDecisions: number // teklif kararı sayısı (double + no-double)

  // TAKES (take / drop = yanıt tarafı)
  takes: number
  takeBlunders: number
  takeEquityCost: number
  wrongTakesCost: number
  wrongPassesCost: number
  takeDecisions: number // yanıt kararı sayısı (take + drop)

  // LUCK / DICE
  jokers: number | null // güvenilir üretilmiyor -> null ('—')
  luckCost: number | null // per-hamle şans equity'si log'da yok -> null ('—')
  rolls: number // atılan zar sayısı (checker/no-move tur sayısı)
  luckBasedRating: number | null // -> null ('—')
  luckBasedElo: number | null // -> null ('—')
}

export interface MatchSummaryData {
  white: PlayerMatchSummary
  black: PlayerMatchSummary
  matchLength: number | null
}

const sum = (arr: LogEntry[], f: (e: LogEntry) => number): number => arr.reduce((s, e) => s + f(e), 0)
// Küp kararının equity kaybı (pozitif). cube.loss yoksa 0.
const cubeCost = (e: LogEntry): number => Math.max(0, e.cube?.loss ?? 0)

function perPlayer(
  log: LogEntry[],
  color: 'white' | 'black',
  name: string,
  luckPct: number | null,
): PlayerMatchSummary {
  const mine = log.filter((e) => e.player === color)

  // ---- Checker kararları: pos'lu, küp DEĞİL, gerçek hamle ('(no move)' zorunlu -> sayılmaz) ----
  const checker = mine.filter((e) => !e.cube && e.pos && e.notation !== '(no move)')
  const checkerDecisions = checker.length
  const checkerEquityCost = sum(checker, (e) => Math.max(0, e.loss || 0))
  const checkerErrors = checker.filter((e) => (e.loss || 0) >= MS_ERROR_MIN).length
  const checkerBlunders = checker.filter((e) => (e.loss || 0) >= MS_BLUNDER_MIN).length

  // ---- Zar sayısı: her checker/no-move turu bir zar (küp kararları zar tüketmez) ----
  const rolls = mine.filter((e) => !e.cube && Array.isArray(e.dice) && e.dice.length === 2).length

  // ---- Küp kararları: teklif (double/no-double) vs yanıt (take/drop) ----
  const cubes = mine.filter((e) => !!e.cube)
  const offerer = cubes.filter((e) => e.cube!.chosen === 'double' || e.cube!.chosen === 'no-double')
  const responder = cubes.filter((e) => e.cube!.chosen === 'take' || e.cube!.chosen === 'drop')

  const doubleEquityCost = sum(offerer, cubeCost)
  const wrongDoublesCost = sum(
    offerer.filter((e) => e.cube!.chosen === 'double' && e.cube!.recommended !== 'double'),
    cubeCost,
  )
  const missedDoublesCost = sum(
    offerer.filter((e) => e.cube!.chosen === 'no-double' && e.cube!.recommended === 'double'),
    cubeCost,
  )
  const doubles = offerer.filter((e) => cubeCost(e) >= MS_ERROR_MIN).length
  const doubleBlunders = offerer.filter((e) => cubeCost(e) >= MS_BLUNDER_MIN).length

  const takeEquityCost = sum(responder, cubeCost)
  const wrongTakesCost = sum(
    responder.filter((e) => e.cube!.chosen === 'take' && e.cube!.recommended === 'drop'),
    cubeCost,
  )
  const wrongPassesCost = sum(
    responder.filter((e) => e.cube!.chosen === 'drop' && e.cube!.recommended === 'take'),
    cubeCost,
  )
  const takes = responder.filter((e) => cubeCost(e) >= MS_ERROR_MIN).length
  const takeBlunders = responder.filter((e) => cubeCost(e) >= MS_BLUNDER_MIN).length

  const cubeDecisions = offerer.length
  const takeDecisions = responder.length
  const cubeCostTotal = doubleEquityCost + takeEquityCost
  const cubeCount = cubeDecisions + takeDecisions

  // ---- PR: pr.ts havuzlama (Σloss/Σkarar × 500); karar yoksa null (asla 0) ----
  const checkerPlay = prValue(checkerEquityCost, checkerDecisions)
  const cubePlay = prValue(cubeCostTotal, cubeCount)
  const performanceRating = prValue(checkerEquityCost + cubeCostTotal, checkerDecisions + cubeCount)

  const totalEquityCost = checkerEquityCost + cubeCostTotal
  const totalErrors = checkerErrors + doubles + takes
  const totalBlunders = checkerBlunders + doubleBlunders + takeBlunders
  const decisions = checkerDecisions + cubeCount

  return {
    name,
    color,
    performanceRating,
    checkerPlay,
    cubePlay,
    luck: luckPct != null && Number.isFinite(luckPct) ? luckPct : null,
    decisions,
    totalErrors,
    totalBlunders,
    totalEquityCost,
    checkerErrors,
    checkerBlunders,
    checkerEquityCost,
    unforcedMoves: checkerDecisions,
    doubles,
    doubleBlunders,
    doubleEquityCost,
    wrongDoublesCost,
    missedDoublesCost,
    cubeDecisions,
    takes,
    takeBlunders,
    takeEquityCost,
    wrongTakesCost,
    wrongPassesCost,
    takeDecisions,
    jokers: null, // güvenilir üretilmiyor -> '—'
    luckCost: null, // per-hamle şans equity'si yok -> '—'
    rolls,
    luckBasedRating: null, // -> '—'
    luckBasedElo: null, // -> '—'
  }
}

// LogEntry[]'ten iki oyunculu Maç Özeti üretir. names=[beyaz, siyah] (gnubg player0/player1).
// luck: opsiyonel MWC% şans (white/black) — verilmezse '—'. Boş/eksik veri crash etmez.
export function computeMatchSummary(
  log: LogEntry[] | null | undefined,
  names: string[] | null,
  luck?: { white: number | null; black: number | null },
  matchLength: number | null = null,
): MatchSummaryData {
  const safe = Array.isArray(log) ? log : []
  return {
    white: perPlayer(safe, 'white', names?.[0] || 'White', luck?.white ?? null),
    black: perPlayer(safe, 'black', names?.[1] || 'Black', luck?.black ?? null),
    matchLength,
  }
}
