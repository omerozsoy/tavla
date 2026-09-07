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

// Bir oyuncu kupu teklif edebilir mi?
// NOT: "Olu kup" (kup >= hedefe kalan) ARTIK ENGELLENMEZ (kullanici direktifi). Gercek tavlada
// redouble her zaman LEGAL'dir; olu kupte sadece ANLAMSIZDIR. Eskiden buton gizleniyordu ve
// oyuncu "5'lik macta kup 4 bende, neden katlayamiyorum?" diye sasiriyordu. Anlamsizligi
// isaretlemek icin isCubeDead() var (bot bunu kullanir, insan serbesttir).
export function canDouble(m: MatchState, player: Player, awaitingResponse: boolean): boolean {
  if (awaitingResponse) return false
  if (m.isCrawford) return false // Crawford oyununda kup yok
  if (m.target <= 1) return false // 1 puanlik mac (tek oyun): kup HIC yok (gercek kural)
  if (m.cube.value >= 64) return false
  if (m.cube.owner !== null && m.cube.owner !== player) return false
  return true
}

// Kup bu oyuncu icin OLU mu: mevcut kup degeri maci kazanmaya zaten yetiyorsa katlamak sonucu
// degistiremez (kazaninca mac biter; rakip pas derse de ayni puan). Kurali ENGELLEMEZ — yalniz
// botun bos yere katlamasini onlemek / UI'da isaretlemek icin.
export function isCubeDead(m: MatchState, player: Player): boolean {
  return m.cube.value >= m.target - m.score[player]
}

// Sira gelen oyuncu icin zar otomatik atilmali mi?
// Kup teklif etme secenegi yoksa (1 puanlik oyun, Crawford, olu kup, rakip kupu
// tutuyor veya ilk el) beklemenin anlami yok -> autoRoll ayari kapali olsa bile
// otomatik at. Kup karari verilebilecekse yalnizca autoRoll acikken otomatik at.
export function shouldAutoRoll(
  m: MatchState,
  turn: Player,
  turnsPlayed: number,
  autoRoll: boolean,
): boolean {
  if (autoRoll) return true
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
