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

// Dışarıdan (gnubg) verilen gerçek şans verisi (per oyuncu). Hepsi opsiyonel -> yoksa '—'.
export interface LuckInfo {
  mwc?: number | null // MWC% (şans yüzdesi)
  cost?: number | null // luck EMG (equity cost)
  jokers?: number | null // joker sayısı (very lucky + very unlucky)
}

// TEK-KAYNAK PR: sunucu-otoriter (gnubg) PR değerleri (per oyuncu). Verilirse Maç Özeti'ndeki
// Performans/Pul Oyunu/Küp Oyunu PR bu değerlerle GÖSTERİLİR (log'dan yeniden hesaplanmaz) ->
// sonuç kartı + analiz + istatistik HER YERDE aynı tek doğru PR görünür. null alanlar hesaplanana düşer.
export interface AuthPr {
  pr?: number | null // overall (gnubg_pr)
  checker?: number | null // gnubg_checker_pr
  cube?: number | null // gnubg_cube_pr
}

const sum = (arr: LogEntry[], f: (e: LogEntry) => number): number => arr.reduce((s, e) => s + f(e), 0)
// Elo lojistiğinde 0/1 olasılık ±sonsuz Elo verir -> [0.02, 0.98] aralığına kırp (±~680 Elo tavan).
const clamp01 = (p: number): number => Math.min(0.98, Math.max(0.02, p))
// Şans işareti: mwc (lehte/aleyhte) BİLİNİYORSA ona göre (+ = şanslı); yoksa luck EMG işaretine düş.
const luckSign = (mwc: number | null, emg: number): number =>
  (mwc != null ? mwc >= 0 : emg >= 0) ? 1 : -1
// Küp kararının equity kaybı (pozitif). ÖNEMLİ: gnubg review girdileri cube.loss taşır AMA
// istemci (wildbg canlı) küp girdileri kaybı ÜST DÜZEY e.loss'ta tutar (cube.loss YOK). İkisini
// de destekle: cube.loss -> e.loss -> 0. (Aksi halde istemci-loglu maçlarda küp maliyeti hep 0.)
const cubeCost = (e: LogEntry): number => Math.max(0, e.cube?.loss ?? e.loss ?? 0)

function perPlayer(
  log: LogEntry[],
  color: 'white' | 'black',
  name: string,
  luckInfo: LuckInfo | null,
  authPr: AuthPr | null = null,
): PlayerMatchSummary {
  const luckPct = luckInfo?.mwc != null && Number.isFinite(luckInfo.mwc) ? luckInfo.mwc : null
  const luckCost = luckInfo?.cost != null && Number.isFinite(luckInfo.cost) ? luckInfo.cost : null
  const jokers = luckInfo?.jokers != null && Number.isFinite(luckInfo.jokers) ? Math.round(luckInfo.jokers) : null
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
  // HATA TÜRÜNÜ `recommended` string'inden DEĞİL, SEÇİLEN aksiyon + hata olup olmadığından
  // türet (gnubg mantığı). `recommended` değerleri değişken olabilir ('double-take',
  // 'too-good', 'pass' vb.) -> string eşleşmesi kırılgandı; maliyet-tabanlı sınıf sağlam:
  //   double + hata      -> yanlış double (doublelamamalıydı)
  //   no-double + hata   -> kaçırılan double (doublelamalıydı)
  //   take + hata        -> yanlış take (pass etmeliydi)
  //   drop + hata        -> yanlış pass (take etmeliydi)
  const cubes = mine.filter((e) => !!e.cube)
  const isErr = (e: LogEntry) => cubeCost(e) >= MS_ERROR_MIN
  const isBlunder = (e: LogEntry) => cubeCost(e) >= MS_BLUNDER_MIN
  const offerer = cubes.filter((e) => e.cube!.chosen === 'double' || e.cube!.chosen === 'no-double')
  const responder = cubes.filter((e) => e.cube!.chosen === 'take' || e.cube!.chosen === 'drop')

  const doubleEquityCost = sum(offerer, cubeCost)
  const wrongDoublesCost = sum(offerer.filter((e) => e.cube!.chosen === 'double' && isErr(e)), cubeCost)
  const missedDoublesCost = sum(offerer.filter((e) => e.cube!.chosen === 'no-double' && isErr(e)), cubeCost)
  const doubles = offerer.filter(isErr).length
  const doubleBlunders = offerer.filter(isBlunder).length

  const takeEquityCost = sum(responder, cubeCost)
  const wrongTakesCost = sum(responder.filter((e) => e.cube!.chosen === 'take' && isErr(e)), cubeCost)
  const wrongPassesCost = sum(responder.filter((e) => e.cube!.chosen === 'drop' && isErr(e)), cubeCost)
  const takes = responder.filter(isErr).length
  const takeBlunders = responder.filter(isBlunder).length

  const cubeDecisions = offerer.length
  const takeDecisions = responder.length
  const cubeCostTotal = doubleEquityCost + takeEquityCost
  const cubeCount = cubeDecisions + takeDecisions

  // ---- PR: TEK-KAYNAK. Sunucu-otoriter (gnubg) değer verilmişse ONU göster; yoksa pr.ts havuzlama
  // (Σloss/Σkarar × 500; karar yoksa null, asla 0). Böylece istatistik paneli sonuç kartı/analizle
  // AYNI tek doğru PR'ı gösterir (log'dan yeniden-hesap sapması ortadan kalkar). ----
  const authFin = (n: number | null | undefined): n is number => n != null && Number.isFinite(n)
  const checkerCalc = prValue(checkerEquityCost, checkerDecisions)
  const cubeCalc = prValue(cubeCostTotal, cubeCount)
  const overallCalc = prValue(checkerEquityCost + cubeCostTotal, checkerDecisions + cubeCount)
  const checkerPlay = authFin(authPr?.checker) ? authPr!.checker! : checkerCalc
  const cubePlay = authFin(authPr?.cube) ? authPr!.cube! : cubeCalc
  const performanceRating = authFin(authPr?.pr) ? authPr!.pr! : overallCalc

  const totalEquityCost = checkerEquityCost + cubeCostTotal
  const totalErrors = checkerErrors + doubles + takes
  const totalBlunders = checkerBlunders + doubleBlunders + takeBlunders
  const decisions = checkerDecisions + cubeCount

  // ---- ŞANS BAZLI metrikler (gnubg şans verisi varsa; yoksa null -> '—') ----
  // Şans Bazlı Elo: zar şansının MAÇ KAZANMA ŞANSINA (MWC%) katkısının Elo karşılığı. Lojistik
  // (Elo) dönüşümü: nötr %50'den mwc% sapma -> "şans kaç Elo'luk rakip-gücü farkına denk?".
  // + = şans lehte. Örn. +5% MWC ≈ +35 Elo. mwc yoksa null.
  const luckBasedElo =
    luckPct == null
      ? null
      : Math.round(400 * Math.log10(clamp01(0.5 + luckPct / 100) / (1 - clamp01(0.5 + luckPct / 100))))
  // Şans Bazlı Puan: zar başına şans yoğunluğu, PR ile AYNI ölçekte (|luck EMG| / zar × 500),
  // işareti mwc yönüne hizalı (+ = şanslı). PR'ın kardeşi: PR skoru hatayı ölçer, bu şansı ölçer.
  // Maç uzunluğundan bağımsız kıyaslanabilir. luck EMG veya zar yoksa null.
  const luckBasedRating =
    luckCost == null || rolls <= 0
      ? null
      : Math.round((Math.abs(luckCost) / rolls) * 500 * luckSign(luckPct, luckCost) * 100) / 100

  return {
    name,
    color,
    performanceRating,
    checkerPlay,
    cubePlay,
    luck: luckPct,
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
    jokers, // gnubg joker sayısı (verilmişse) -> yoksa '—'
    luckCost, // gnubg luck EMG (equity) (verilmişse) -> yoksa '—'
    rolls,
    luckBasedRating, // (|luck EMG|/zar × 500), işaret mwc yönünde -> yoksa '—'
    luckBasedElo, // şansın MWC% -> Elo karşılığı -> yoksa '—'
  }
}

// LogEntry[]'ten iki oyunculu Maç Özeti üretir. names=[beyaz, siyah] (gnubg player0/player1).
// luck: opsiyonel MWC% şans (white/black) — verilmezse '—'. Boş/eksik veri crash etmez.
export function computeMatchSummary(
  log: LogEntry[] | null | undefined,
  names: string[] | null,
  luck?: { white: LuckInfo | null; black: LuckInfo | null },
  matchLength: number | null = null,
  authPr?: { white: AuthPr | null; black: AuthPr | null },
): MatchSummaryData {
  const safe = Array.isArray(log) ? log : []
  return {
    white: perPlayer(safe, 'white', names?.[0] || 'White', luck?.white ?? null, authPr?.white ?? null),
    black: perPlayer(safe, 'black', names?.[1] || 'Black', luck?.black ?? null, authPr?.black ?? null),
    matchLength,
  }
}
