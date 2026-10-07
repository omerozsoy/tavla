// Rakibin CANLI hamle önizlemesi (cosmetic). Hamle otoritesi (roll/move/update) ile İLGİSİ YOK;
// bu yalnız "rakip oynarken/geri alırken adım adım göster" için. Saf + test edilebilir tutulur ki
// animasyon delta mantığı (yeni adım vs geri-alma) senkron kodundan bağımsız doğrulanabilsin.
import type { Step } from '../engine/types'

export interface LiveDelta {
  animate: Step[] // turnStart+shown üstüne oynatılacak YENİ adımlar (FLIP animasyonu)
  reset: boolean // true -> önce turnStart'a dön, sonra incoming'in tamamını uygula (geri alma/sapma)
}

function stepEq(a: Step, b: Step): boolean {
  return a.from === b.from && a.to === b.to && a.die === b.die
}

/**
 * Gösterilen adımlar (shown) ile mover'dan gelen güncel adımlar (incoming) arasındaki fark.
 *  - incoming, shown'un uzantısıysa (aynı prefiks + daha uzun/eşit) -> yalnız YENİ adımları animate et.
 *  - değilse (kısaldı = geri alma, veya prefiks tutmadı = farklı dizi) -> reset: caller turnStart'tan
 *    incoming'in tamamını (animate) yeniden uygular.
 */
export function liveMoveDelta(shown: Step[], incoming: Step[]): LiveDelta {
  const isPrefix = incoming.length >= shown.length && shown.every((s, i) => stepEq(s, incoming[i]))
  if (isPrefix) return { animate: incoming.slice(shown.length), reset: false }
  return { animate: incoming.slice(), reset: true }
}

/**
 * ONAYLI rakip hamlesini (otoriter delta'dan reconstruct edilen `full` adımlar) adım adım oynatırken
 * KAÇINCI adımdan başlanacağını döndürür. `shown` = canlı önizlemenin (room.live) o tura dek zaten
 * gösterdiği adımlar. Amaç: önizleme bir kısmını zaten oynattıysa oradan DEVAM et (çift oynatma yok);
 * hiç oynatmadıysa baştan; tamamını oynattıysa `full.length` (çağıran atlar).
 *
 *  - shown, full'un temiz bir PREFİKSİyse -> eşleşen uzunluk (tamamı eşleşmişse full.length = atla).
 *  - shown full ile SAPTIYSA (farklı adım) -> 0 (baştan tam oynat; yarım/yanlış kalıntı atılır).
 */
export function replayStartIndex(shown: Step[], full: Step[]): number {
  let i = 0
  while (i < shown.length && i < full.length && stepEq(shown[i], full[i])) i++
  if (i < shown.length) return 0 // sapma: shown'da full'a uymayan adım var -> baştan
  return i
}
