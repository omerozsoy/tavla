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
import type { MoveLogEntry } from '../storage'

/**
 * @param prev Rakibin tur-basi durumu (turn = rakip, dice dolu)
 * @param next Hamle sonrasi otoriter tahta (sunucudan)
 * @param gameEnded Bu gecis OYUNU BITIREN hamleyse true. Rakip son tasini toplayip kazandiginda
 *   sunucu SIRAYI DEVRETMEZ (oyun bitti) -> `next.turn === prev.turn` olur ve normalde hamle
 *   "tamamlanmamis" sanilip ATLANIR. Sonuc: rakibin KAZANAN hamlesi loga girmez, .mat sonuc satiri
 *   olmadan kesilir. gameEnded=true iken tur-devri sarti aranmaz (oyun bitti = tur tamam).
 * @returns Oynanan adimlar (dance ise bos dizi), cozulemezse null
 */
export function reconstructOppMove(prev: GameState | null, next: GameState, gameEnded = false): Step[] | null {
  if (!prev || !prev.dice?.length) return null
  if (!gameEnded && next.turn === prev.turn) return null // tur devretmemis -> hamle tamamlanmamis
  const from: GameState = { ...cloneState(prev), diceUsed: prev.dice.map(() => false) }
  const key = boardKey(next)
  const hit = maximalTerminals(from).find((t) => boardKey(t.state) === key)
  return hit ? hit.steps : null
}

// Iki girdi AYNI kaydi mi gosteriyor? Yalniz DEGISMEYEN alanlara bakilir: analiz alanlari
// (loss/cands/probs) rakibin istemcisinde SONRADAN dolabilir, ayni girdi farkli snapshot'ta
// farkli gorunur. player+seq+notasyon+zar+kup karari bir kez yazilir, degismez.
function sameEntry(a: MoveLogEntry, b: MoveLogEntry): boolean {
  return (
    a.player === b.player &&
    (a.seq ?? -1) === (b.seq ?? -1) &&
    a.notation === b.notation &&
    (a.cube?.chosen ?? '') === (b.cube?.chosen ?? '') &&
    (a.dice ?? []).join(',') === (b.dice ?? []).join(',')
  )
}

/**
 * Rakibin analiz logunu KAYIPSIZ birlestir (otoriter OLMAYAN odalar: applyOnlineState).
 *
 * Snapshot'ta `moves: matchLog.slice(-80)` gider; rakip rengine suzuldugunde bu, rakibin kendi
 * logunun bir SONEKI'dir. Eskiden gelen liste elimizdekini KOMPLE EZIYORDU: 80 girdi ~ tek uzun
 * oyun, dolayisiyla cok oyunlu macta rakibin ERKEN OYUNLARI logdan dusuyor, disa aktarilan
 * .mat'te o oyunlarin sag sutunu bos kaliyor ve XG "invalid moves" diyordu.
 *
 * Cozum: elimizdekinin SONU ile gelenin BASI arasindaki EN UZUN ortusmeyi bul; ortusen kismi
 * GELENLE degistir (daha taze — analiz alanlari dolmus olabilir), oncesini KORU.
 *  - gelen bos (rakip yeni baglandi / henuz gondermedi) -> elimizdeki KORUNUR
 *  - elimizdeki bos (ilk senkron) -> gelen aynen alinir
 *  - ortusme yok (80'den uzun bir kopukluk) -> eldekinin ardina eklenir; bosluk kalir ama
 *    DUPLIKASYON olmaz (uydurma satir yazmaktansa eksik birakmak yeglenir)
 */
export function mergeOppLog(prev: MoveLogEntry[], incoming: MoveLogEntry[]): MoveLogEntry[] {
  if (incoming.length === 0) return prev
  if (prev.length === 0) return incoming
  const max = Math.min(prev.length, incoming.length)
  for (let k = max; k > 0; k--) {
    let ok = true
    for (let i = 0; i < k; i++) {
      if (!sameEntry(prev[prev.length - k + i], incoming[i])) {
        ok = false
        break
      }
    }
    if (ok) return [...prev.slice(0, prev.length - k), ...incoming]
  }
  return [...prev, ...incoming]
}
