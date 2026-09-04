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
