/**
 * Rakip Seviyesi seçicisi (çift-tutamaçlı slider) için saf yardımcılar. React'ten bağımsız ki
 * vitest ile doğrulanabilsin. Seviye adları/eşikleri TavlaTV rütbe tablosundan (RANKS) gelir;
 * eşleşme filtresi RATING bandı üzerinden çalışır (rozet PR+EP ile hesaplanır ama eşleşme yalnız
 * rating'e bakar -> seçici rating-bandıyla tutarlı olmalı). Bkz. backend RoomController matchmaking.
 */
import { RANKS, rankOf } from './ranks'

export interface LevelStop {
  index: number // RANKS içindeki mutlak indeks
  divKey: string // i18n anahtarı (ör. 'div.i1')
  code: string | null // 'I1', 'S1' ... (varsa)
  min: number // bandın alt rating sınırı (rank.min)
  max: number | null // bandın üst sınırı (bir üst rütbenin min−1); null = açık uçlu zirve
}

/**
 * Oyuncunun rating-rütbesini MERKEZ alıp ±span rütbelik pencere döndürür; liste başına/sonuna
 * yakınsa mevcut olanlarla daralır. Varsayılan span=5 (solda 5 alt, sağda 5 üst).
 */
export function levelWindow(rating: number, span = 5): LevelStop[] {
  const selfKey = rankOf(rating).divKey
  const self = RANKS.findIndex((r) => r.divKey === selfKey)
  const lo = Math.max(0, self - span)
  const hi = Math.min(RANKS.length - 1, self + span)
  const stops: LevelStop[] = []
  for (let i = lo; i <= hi; i++) {
    const next = RANKS[i + 1]
    stops.push({
      index: i,
      divKey: RANKS[i].divKey,
      code: RANKS[i].code ?? null,
      min: RANKS[i].min,
      max: next ? next.min - 1 : null, // zirve rütbede üst sınır yok
    })
  }
  return stops
}

/** Pencere içindeki oyuncunun kendi durağının indeksi (merkez işareti için). */
export function selfStopIndex(stops: LevelStop[], rating: number): number {
  const selfKey = rankOf(rating).divKey
  const i = stops.findIndex((s) => s.divKey === selfKey)
  return i < 0 ? 0 : i
}

/**
 * Seçili tutamaç konumlarından (pencere dizisindeki indeksler) eşleşmeye gönderilecek rating
 * aralığı. Alt tutamaç = seçilen en düşük rütbenin ALT puanı; üst tutamaç = en yüksek rütbenin
 * ÜST puanı. Açık uçlu zirve seçildiyse max=null (üst sınır yok).
 */
export function rangeFromStops(
  stops: LevelStop[],
  loIdx: number,
  hiIdx: number,
): { min: number; max: number | null } {
  const a = Math.min(loIdx, hiIdx)
  const b = Math.max(loIdx, hiIdx)
  return { min: stops[a].min, max: stops[b].max }
}

/**
 * Backend payload'ı: min_rating/max_rating. 0 = o yön serbest. Alt tutamaç pencerenin en altında
 * ve o da global taban (min=0) ise alt sınır serbest (0). Üst açık uçlu ise üst serbest (0).
 */
export function payloadFromRange(r: { min: number; max: number | null }): {
  minRating: number
  maxRating: number
} {
  return { minRating: r.min > 0 ? r.min : 0, maxRating: r.max != null ? r.max : 0 }
}
