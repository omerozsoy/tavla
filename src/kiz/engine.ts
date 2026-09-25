// ============================================================================
// KIZ TAVLASI — İKİ FAZLI kural motoru (SAF/test edilebilir). Klasik tavla motorundan
// (src/engine) TAMAMEN AYRIDIR. TavlaTV için seçilen TEK ve tutarlı iki-fazlı sürüm
// (bkz docs/kiz-tavlasi-kurallari.md + oyun içi "Nasıl Oynanır" — birebir aynı).
//
// Kaynak: gokhanbagci/KizTavlasiAlgoritma (iki-fazlı: önce İNDİRME/AÇMA, sonra TOPLAMA).
//
// KURALLAR (özet):
//  - Her oyuncunun kendi 6 hanesi (1..6). Başlangıç: 6:3, 5:3, 4:3, 3:2, 2:2, 1:2 = 15 pul.
//    Tüm pullar başta KAPALI (kendi hanesinde dizili). İki oyuncu BAĞIMSIZ (kırma/bar/kapatma yok).
//  - FAZ 1 — AÇMA/İNDİRME: oyuncunun kapalı pulu varken bu fazdadır. Zar d, d hanesinden BİR
//    pulu "indirir" (kapalı -> açık). Çift(d,d): o hanenin TÜM kapalı pulları indirilir.
//    d hanesinde kapalı pul yoksa o zar oynanamaz.
//  - FAZ 2 — TOPLAMA: oyuncunun TÜM pulları indirilince (kapalı=0) bu faza geçilir. Zar d, d
//    hanesindeki BİR açık pulu toplar (açık -> off). Çift(d,d): o hanenin TÜM açık pulları toplanır.
//    d hanesinde açık pul yoksa o zar oynanamaz.
//  - Hiçbir zar oynanamıyorsa sıra rakibe geçer.
//  - Pullarını (15) önce toplayan (off=15) KAZANIR. Rakip 0 toplamışsa MARS (iki kat).
// ============================================================================

export type KizPlayer = 'white' | 'black'

// Bir oyuncunun 6 hanesi: index 0 = 1.hane ... index 5 = 6.hane. Değer = o hanedeki pul sayısı.
export type KizLanes = [number, number, number, number, number, number]

export type KizPhase = 'acma' | 'toplama'

export interface KizState {
  closed: Record<KizPlayer, KizLanes> // henüz indirilmemiş (kapalı) pullar, hane başına
  open: Record<KizPlayer, KizLanes> // indirilmiş (açık) pullar, hane başına
  off: Record<KizPlayer, number> // toplanan pul sayısı; 15 = bitti
  turn: KizPlayer
  dice: number[] // atılan zarlar; çift ise [d, d]
  isDouble: boolean
  diceUsed: boolean[] // çiftte tek eleman (haneyi bir kez işler)
  rolled: boolean
  winner: KizPlayer | null
  mars: boolean
}

export const TOTAL_CHECKERS = 15

// Başlangıç KAPALI diziliş: 1..6 hane -> [2, 2, 2, 3, 3, 3].
export function initialClosed(): KizLanes {
  return [2, 2, 2, 3, 3, 3]
}
const emptyLanes = (): KizLanes => [0, 0, 0, 0, 0, 0]

export function initialState(first: KizPlayer = 'white'): KizState {
  return {
    closed: { white: initialClosed(), black: initialClosed() },
    open: { white: emptyLanes(), black: emptyLanes() },
    off: { white: 0, black: 0 },
    turn: first,
    dice: [],
    isDouble: false,
    diceUsed: [],
    rolled: false,
    winner: null,
    mars: false,
  }
}

export const other = (p: KizPlayer): KizPlayer => (p === 'white' ? 'black' : 'white')
export const lanesTotal = (l: KizLanes): number => l.reduce((a, b) => a + b, 0)
const laneIndex = (d: number): number => d - 1

/** Oyuncunun fazı: kapalı pulu KALMIŞSA açma; TAMAMI indirildiyse (kapalı=0) toplama. */
export function phaseOf(s: KizState, p: KizPlayer): KizPhase {
  return lanesTotal(s.closed[p]) > 0 ? 'acma' : 'toplama'
}

// O fazda "kaynak" hane dizisi (açma -> kapalı pullar; toplama -> açık pullar).
const sourceLanes = (s: KizState, p: KizPlayer): KizLanes =>
  phaseOf(s, p) === 'acma' ? s.closed[p] : s.open[p]

export function rollDice(rng: () => number = Math.random): { dice: number[]; isDouble: boolean } {
  const d1 = 1 + Math.floor(rng() * 6)
  const d2 = 1 + Math.floor(rng() * 6)
  return { dice: [d1, d2], isDouble: d1 === d2 }
}

export function applyRoll(s: KizState, dice: number[], isDouble: boolean): KizState {
  if (s.winner || s.rolled) return s
  return {
    ...s,
    dice: dice.slice(),
    isDouble,
    diceUsed: isDouble ? [false] : dice.map(() => false),
    rolled: true,
  }
}

/**
 * Bu turda oynanabilecek zar-slot index'leri: kullanılmamış + o zarın hanesinde (aktif faza göre
 * kapalı/açık) pul olan zarlar. Faz her oynanan hamleden sonra DİNAMİK değerlendirilir (son kapalı
 * indirilince ikinci zar toplama fazında oynanabilir hale gelebilir).
 */
export function playableSlots(s: KizState): number[] {
  if (!s.rolled || s.winner) return []
  const src = sourceLanes(s, s.turn)
  const out: number[] = []
  if (s.isDouble) {
    if (!s.diceUsed[0] && src[laneIndex(s.dice[0])] > 0) out.push(0)
    return out
  }
  for (let i = 0; i < s.dice.length; i++) {
    if (!s.diceUsed[i] && src[laneIndex(s.dice[i])] > 0) out.push(i)
  }
  return out
}

/** Oynanabilecek hane numaraları (1..6) — UI vurgusu için (benzersiz). */
export function playableLanes(s: KizState): number[] {
  const set = new Set<number>()
  for (const i of playableSlots(s)) set.add(s.dice[i])
  return [...set].sort((a, b) => a - b)
}

function checkWin(s: KizState): KizState {
  if (s.off[s.turn] >= TOTAL_CHECKERS) {
    return { ...s, winner: s.turn, mars: s.off[other(s.turn)] === 0 }
  }
  return s
}

/**
 * Bir zar-slot'unu oyna. Aktif faza göre:
 *  - AÇMA: d hanesinden pul(lar) KAPALI -> AÇIK (indir). Çift: o hanenin tüm kapalıları.
 *  - TOPLAMA: d hanesinden AÇIK pul(lar) -> OFF (topla). Çift: o hanenin tüm açıkları.
 * Geçersizse (kullanılmış/boş/bitti) state'i AYNEN döndürür.
 */
export function playSlot(s: KizState, slotIndex: number): KizState {
  if (s.winner || !s.rolled) return s
  if (s.diceUsed[slotIndex]) return s
  const d = s.dice[slotIndex]
  if (d === undefined) return s
  const idx = laneIndex(d)
  const phase = phaseOf(s, s.turn)
  const p = s.turn

  const newUsed = s.diceUsed.slice()
  newUsed[slotIndex] = true

  if (phase === 'acma') {
    if (s.closed[p][idx] <= 0) return s
    const take = s.isDouble ? s.closed[p][idx] : 1
    const closed = s.closed[p].slice() as KizLanes
    const open = s.open[p].slice() as KizLanes
    closed[idx] -= take
    open[idx] += take
    return {
      ...s,
      closed: { ...s.closed, [p]: closed },
      open: { ...s.open, [p]: open },
      diceUsed: newUsed,
    }
  }
  // toplama
  if (s.open[p][idx] <= 0) return s
  const take = s.isDouble ? s.open[p][idx] : 1
  const open = s.open[p].slice() as KizLanes
  open[idx] -= take
  let next: KizState = {
    ...s,
    open: { ...s.open, [p]: open },
    off: { ...s.off, [p]: s.off[p] + take },
    diceUsed: newUsed,
  }
  next = checkWin(next)
  return next
}

/** Turda oynanabilir zar kalmadı mı? */
export function turnComplete(s: KizState): boolean {
  if (s.winner) return true
  if (!s.rolled) return false
  return playableSlots(s).length === 0
}

/** Sırayı rakibe geçir + zar durumunu sıfırla. */
export function endTurn(s: KizState): KizState {
  if (s.winner) return s
  return { ...s, turn: other(s.turn), dice: [], isDouble: false, diceUsed: [], rolled: false }
}

/** Bütünlük: her oyuncu için kapalı + açık + off === 15 olmalı. */
export function checkersConserved(s: KizState): boolean {
  return (['white', 'black'] as KizPlayer[]).every(
    (p) => lanesTotal(s.closed[p]) + lanesTotal(s.open[p]) + s.off[p] === TOTAL_CHECKERS,
  )
}
