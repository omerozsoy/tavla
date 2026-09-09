import type { Player } from './types'

// Kup (doubling cube)
export interface Cube {
  value: number // 1, 2, 4, 8, ...
  owner: Player | null // null = ortada (merkez), henuz kimse sahiplenmedi
}

// Mac durumu
export interface MatchState {
  target: number // hedef puan
  score: Record<Player, number>
  cube: Cube
  isCrawford: boolean // su anki oyun Crawford oyunu mu (kup yok)
  crawfordDone: boolean // Crawford oyunu oynandi mi
}

export function newMatch(target: number): MatchState {
  return {
    target,
    score: { white: 0, black: 0 },
    cube: { value: 1, owner: null },
    isCrawford: false,
    crawfordDone: false,
  }
}

// Kup teklif edilemiyorsa GEREKCE kodu (net neden). Backend `cubeAvailability` ile birebir
// ayni kod kumesi -> istemci butonu ile sunucu enforce'u AYNI kurali paylasir.
export type CubeDenyReason =
  | 'DOUBLE_ALREADY_PENDING' // zaten bekleyen bir teklif var (cevap bekleniyor)
  | 'CRAWFORD_GAME' // Crawford oyununda kup yasak
  | 'ONE_POINT_MATCH' // 1 puanlik mac: kup hic yok
  | 'CUBE_AT_MAX' // kup 64 tavanda -> daha fazla katlanamaz
  | 'NOT_CUBE_OWNER' // kup rakibin elinde
  | 'DEAD_CUBE' // olu kup: katlamak teklif edene puan kazandirmaz

export interface CubeAvailability {
  allowed: boolean
  reason?: CubeDenyReason
}

// Bir oyuncu kupu teklif edebilir mi? SONUC = {allowed, reason} (net gerekce).
// OLU KUP TEKLIF EDEN ACISINDAN degerlendirilir (kullanici direktifi): kupun MEVCUT
// degeri, teklif edenin maci bitirmesi icin gereken puani zaten karsiliyorsa katlamak ona
// HICBIR SEY kazandirmaz, yalniz rakibe daha buyuk bir kup verir. Or. 7'lik macta 6-1
// ondeyken rakip katladi (kup 2): bu oyunu kazanmak maci bitiriyor -> 4'e cekmek anlamsiz,
// buton CIKMAZ. Rakip icin (6 puan uzakta) kup hala anlamlidir, ona kapatilmaz.
// Bot da AYNI kurala tabidir (ek kisit YOK) -> insan ve bot birebir ayni kupu kullanir.
// NOT: sira/oyun-bitti/zar-atildi gibi durumlar cagiran tarafta (App handleDouble: diceRolled;
// otoriter online'da backend cubeAvailability) kontrol edilir; burada MAC-DURUMU kurallari.
export function cubeAvailability(
  m: MatchState,
  player: Player,
  awaitingResponse: boolean,
): CubeAvailability {
  if (awaitingResponse) return { allowed: false, reason: 'DOUBLE_ALREADY_PENDING' }
  if (m.isCrawford) return { allowed: false, reason: 'CRAWFORD_GAME' } // Crawford: kup yok
  if (m.target <= 1) return { allowed: false, reason: 'ONE_POINT_MATCH' } // 1 puanlik mac: kup yok
  if (m.cube.value >= 64) return { allowed: false, reason: 'CUBE_AT_MAX' } // 64 tavan
  if (m.cube.owner !== null && m.cube.owner !== player) {
    return { allowed: false, reason: 'NOT_CUBE_OWNER' } // rakip kupu tutuyor
  }
  // OLU KUP (teklif eden icin): kup zaten teklif edenin ihtiyaci olan puani karsiliyorsa
  // katlamanin kazanci YOKTUR (oyunu kazaninca mac zaten bitiyor), riski vardir. Teklif
  // SUNULMAZ -> zar dogrudan atilir (shouldAutoRoll bunu okur).
  if (m.cube.value >= pointsNeeded(m, player)) return { allowed: false, reason: 'DEAD_CUBE' }
  return { allowed: true }
}

// Boolean kisayol (mevcut cagri yerleri icin korunur). cubeAvailability'nin allowed'i.
export function canDouble(m: MatchState, player: Player, awaitingResponse: boolean): boolean {
  return cubeAvailability(m, player, awaitingResponse).allowed
}

// Sira gelen oyuncu icin zar otomatik atilmali mi?
// Kup teklif etme secenegi yoksa (1 puanlik oyun, Crawford, rakip kupu tutuyor veya
// ilk el) beklemenin anlami yok -> otomatik at.
export function shouldAutoRoll(m: MatchState, turn: Player, turnsPlayed: number): boolean {
  // "Otomatik zar" AYARI KALDIRILDI (kullanici direktifi): zar yalnizca kup teklif etme
  // secenegi YOKKEN otomatik atilir. Teklif mumkunse oyuncu "Zar At"/"Katla" arasinda
  // secim yapabilsin diye beklenir.
  const canOfferCube = turnsPlayed > 0 && canDouble(m, turn, false)
  return !canOfferCube
}

// Mac bitti mi? Kazanan doner.
export function matchWinner(m: MatchState): Player | null {
  if (m.score.white >= m.target) return 'white'
  if (m.score.black >= m.target) return 'black'
  return null
}

// Oyun sonucu puanini skora ekle
export function scoreGame(m: MatchState, winner: Player, points: number): MatchState {
  const score = { ...m.score }
  score[winner] += points
  return { ...m, score }
}

// Sonraki oyunu hazirla (kup sifirlanir, Crawford durumu guncellenir)
export function setupNextGame(m: MatchState): MatchState {
  let isCrawford = false
  let crawfordDone = m.crawfordDone
  if (m.isCrawford) {
    crawfordDone = true // Crawford oyunu bitti
  } else if (!crawfordDone && (m.score.white === m.target - 1 || m.score.black === m.target - 1)) {
    isCrawford = true // biri hedefe 1 puan yaklasti -> sonraki oyun Crawford
  }
  return {
    ...m,
    cube: { value: 1, owner: null },
    isCrawford,
    crawfordDone,
  }
}

// Bir oyuncunun kazanmak icin ihtiyaci olan puan
export function pointsNeeded(m: MatchState, player: Player): number {
  return m.target - m.score[player]
}
