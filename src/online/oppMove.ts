// Otoriter (server-authoritative) online modda RAKIBIN hamlesini durum gecisinden geri uret.
//
// Neden gerekli: otoriter modda istemci applyOnlineState'i CALISTIRMAZ; rakibin hamlelerini
// matchLog'a katan tek yer orasiydi (snap.moves birlestirmesi). Sonucta matchLog tek tarafli
// kaliyor -> disa aktarilan .mat'te rakip sutunu bombos oluyor ve XG "The game contains some
// invalid moves" diyor; gnubg luck/PR de eksik hesaplaniyor.
//
// Otoriter gecis rakibin hamlesini TEK ANLAMLI belirler: rakibin tur-basi durumu (zarlariyla)
// bilinir, hamle sonrasi tahta sunucudan gelir. Motorun legal + maksimal terminalleri icinde
// ayni tahtaya goturen tek bir sonuc vardir (farkli adim SIRALARI ayni tahtayi verir; .mat
// icin tahta esitligi yeterlidir). Dance (oynanamayan tur) da adimsiz terminal olarak doner.
import { cloneState } from '../engine/board'
import { maximalTerminals, boardKey } from '../engine/moves'
import type { GameState, Step } from '../engine/types'

/**
 * @param prev Rakibin tur-basi durumu (turn = rakip, dice dolu)
 * @param next Hamle sonrasi otoriter tahta (sunucudan)
 * @returns Oynanan adimlar (dance ise bos dizi), cozulemezse null
 */
export function reconstructOppMove(prev: GameState | null, next: GameState): Step[] | null {
  if (!prev || !prev.dice?.length) return null
  if (next.turn === prev.turn) return null // tur devretmemis -> hamle tamamlanmamis
  const from: GameState = { ...cloneState(prev), diceUsed: prev.dice.map(() => false) }
  const key = boardKey(next)
  const hit = maximalTerminals(from).find((t) => boardKey(t.state) === key)
  return hit ? hit.steps : null
}
