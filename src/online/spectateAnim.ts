// İzleme (spectate) canlı-animasyon yardımcıları — SAF (test edilebilir) mantık.
// Otoriter tahta tek doğruluk kaynağıdır; `live` adımları YALNIZ o tahtada yasalsa oynatılır
// (bayat/uyumsuz live adımlarının hayalet oynatılmasını engeller -> asla ghost/kilit).
import { cloneState } from '../engine/board'
import { applyStep, singleDieSteps } from '../engine/moves'
import type { GameState, Step } from '../engine/types'

// Tahta imzası (taş/bar/off + sıra + zar): değişince "yeni tur başı" -> canlı önizleme sıfırlanır.
export const boardSig = (b: GameState): string =>
  `${b.turn}|${(b.dice ?? []).join(',')}|${b.points.join(',')}|${b.bar.white},${b.bar.black}|${b.off.white},${b.off.black}`

// `live` adımların, verilen tahtada sırayla YASAL olan en uzun ön ekini döndürür.
// `die` gelmeyebilir (backend nullable) -> tüm zar değerleri denenir. Yasal step bulunamazsa durur.
export function validLivePrefix(base: GameState, steps: Step[]): Step[] {
  const s = cloneState(base)
  const out: Step[] = []
  for (const st of steps) {
    const dice = st.die ? [st.die] : [1, 2, 3, 4, 5, 6]
    const match = dice
      .flatMap((die) => singleDieSteps(s, base.turn, die))
      .find((x) => x.from === st.from && x.to === st.to)
    if (!match) break
    applyStep(s, match, base.turn)
    out.push(match)
  }
  return out
}
