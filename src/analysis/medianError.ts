// Median Error (Medyan Hata) — analiz edilen kararlardaki tipik hata büyüklüğü.
//
// ÖNEMLİ: Bu MEAN/Average DEĞİL, gerçek medyandır. Birkaç büyük blunder medyanı
// average kadar bozmaz. (Örn. errors = [0.001,0.002,0.003,0.004,0.100] →
// average 0.022 ama median 0.003.)
//
// Mevcut analiz motorundan gelen equity verisini kullanır; YENİ motor yazmaz.
// Bir kararın hatası:  error = max(0, bestMoveEquity - playedMoveEquity)
//
// Checker play ve cube decision tavlada FARKLI ölçekte tutulur: checker kararında
// gerçek equity kaybı (loss) vardır; cube kararında sistem yalnız doğru/yanlış
// (correct) + kazanma% saklar, karşılaştırılabilir bir equity kaybı YOKTUR
// (loss=0). Bu yüzden bu fonksiyon medyanı KÖR biçimde karıştırmaz: yalnız
// checker (type !== 'cube') kararları hesaba katar. Cube kararları type:'cube'
// ile işaretlenip hariç bırakılır (median cube error ayrı bir metrik olurdu ama
// bizim veride cube için equity kaybı üretilmediğinden hesaplanamaz).

export interface ErrorDecision {
  /** En iyi hamlenin equity'si (motor). playedEquity ile birlikte verilirse error buradan hesaplanır. */
  bestEquity?: number | null
  /** Oynanan hamlenin equity'si (motor). */
  playedEquity?: number | null
  /** Doğrudan hata değeri (zaten max(0, best-played) ise). bestEquity/playedEquity yoksa kullanılır. */
  error?: number | null
  /** Zorunlu/forced hamle (tek legal hamle) → medyana KATILMAZ, ayrı sayılır. */
  forced?: boolean
  /** 'cube' kararları farklı ölçek → checker medyanına katılmaz. */
  type?: 'checker' | 'cube'
}

export interface MedianErrorResult {
  /** Gerçek medyan hata (full precision). Geçerli karar yoksa null. */
  medianError: number | null
  /** Medyana katılan (geçerli, forced olmayan, checker) karar sayısı. */
  analyzedDecisions: number
  /** Hariç tutulan forced/zorunlu hamle sayısı. */
  excludedForcedMoves: number
}

/** Bir kararın geçerli hata değeri (yoksa/geçersizse null). Negatif → 0. */
function resolveError(d: ErrorDecision): number | null {
  let e: number
  if (typeof d.error === 'number') {
    e = d.error
  } else if (typeof d.bestEquity === 'number' && typeof d.playedEquity === 'number') {
    e = d.bestEquity - d.playedEquity
  } else {
    return null // analiz eksik → geçersiz
  }
  if (!Number.isFinite(e)) return null // NaN / Infinity kabul edilmez
  return e < 0 ? 0 : e // max(0, error)
}

/** Sıralı (küçükten büyüğe) dizinin medyanı. n>0 varsayılır. */
function medianOfSorted(sorted: number[]): number {
  const n = sorted.length
  const mid = Math.floor(n / 2)
  // Tek: ortadaki eleman. Çift: ortadaki iki elemanın aritmetik ortalaması.
  return n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Kararların medyan hatasını hesaplar.
 *  - null/invalid kararlar atlanır (medyana ve forced sayısına GİRMEZ).
 *  - forced hamleler hariç tutulur ve excludedForcedMoves'da sayılır.
 *  - cube kararları (farklı ölçek) medyana katılmaz.
 *  - NaN/Infinity hata değerleri reddedilir.
 *  - Hiç geçerli karar yoksa medianError = null.
 *  - Sonuç full precision (yuvarlanmaz); gösterim için formatMedianError kullan.
 */
export function calculateMedianError(decisions: readonly ErrorDecision[] | null | undefined): MedianErrorResult {
  const errors: number[] = []
  let excludedForcedMoves = 0

  if (Array.isArray(decisions)) {
    for (const d of decisions) {
      if (d === null || typeof d !== 'object') continue // invalid/null analiz
      if (d.type === 'cube') continue // farklı metrik → checker medyanına girmez
      if (d.forced === true) {
        excludedForcedMoves++
        continue // zorunlu hamle → gerçek seçim değil
      }
      const e = resolveError(d)
      if (e === null) continue // geçersiz/NaN/Infinity
      errors.push(e)
    }
  }

  errors.sort((a, b) => a - b)
  const analyzedDecisions = errors.length

  return {
    medianError: analyzedDecisions === 0 ? null : medianOfSorted(errors),
    analyzedDecisions,
    excludedForcedMoves,
  }
}

/** UI gösterimi: medyan hatayı N ondalıkla (varsayılan 3) biçimlendirir. null → '—'. */
export function formatMedianError(value: number | null, digits = 3): string {
  return value === null ? '—' : value.toFixed(digits)
}
