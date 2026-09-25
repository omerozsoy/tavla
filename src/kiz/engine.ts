// ============================================================================
// KIZ TAVLASI — kural motoru (SAF/test edilebilir). Klasik tavla motorundan (src/engine)
// TAMAMEN AYRIDIR; klasik kurallara DOKUNMAZ. Aşağıdaki kural seti TavlaTV için seçilen
// TEK ve tutarlı sürümdür (bkz docs/kiz-tavlasi-kurallari.md + oyun içi "Nasıl Oynanır").
//
// KURALLAR (özet):
//  - Her oyuncunun kendi 6 hanesi (1..6) var; başlangıç 6:3, 5:3, 4:3, 3:2, 2:2, 1:2 = 15 pul.
//  - İki oyuncunun haneleri BAĞIMSIZ (kırma/bar/kapatma yok). Pullar tahtayı DOLAŞMAZ.
//  - Zar atılır. Her zar değeri d, SIRADAKİ oyuncunun d hanesinden BİR pul toplar (kaldırır).
//  - Çift (d,d): d hanesindeki TÜM pullar birden toplanır.
//  - Zarın gösterdiği hane BOŞsa o zar OYNANAMAZ (overflow yok; klasikten miras alınmaz).
//  - Hiçbir zar oynanamıyorsa tur geçer (hamlesiz tur).
//  - Pullarını önce bitiren KAZANIR. Kazanırken rakip 0 pul topladıysa MARS (2 kat).
// ============================================================================

export type KizPlayer = 'white' | 'black'

// Bir oyuncunun 6 hanesi: index 0 = 1.hane ... index 5 = 6.hane. Değer = o hanedeki pul sayısı.
export type KizLanes = [number, number, number, number, number, number]

export interface KizState {
  lanes: Record<KizPlayer, KizLanes>
  off: Record<KizPlayer, number> // toplanan (kaldırılan) pul sayısı; 15 = bitti
  turn: KizPlayer
  dice: number[] // atılan zarlar; çift ise [d, d] (iki eleman — çift "tüm haneyi topla" demektir)
  isDouble: boolean
  diceUsed: boolean[] // her zar oynandı mı (çiftte tek eleman kullanılır: haneyi bir kez temizler)
  rolled: boolean // bu turda zar atıldı mı
  winner: KizPlayer | null
  mars: boolean // kazanan bitirdiğinde rakip 0 pul topladıysa true
}

export const TOTAL_CHECKERS = 15

// Başlangıç dizilişi: 1..6 hane -> [2, 2, 2, 3, 3, 3] (index 0=1.hane ... index 5=6.hane).
export function initialLanes(): KizLanes {
  return [2, 2, 2, 3, 3, 3]
}

export function initialState(first: KizPlayer = 'white'): KizState {
  return {
    lanes: { white: initialLanes(), black: initialLanes() },
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

// Bir oyuncunun tahtada kalan toplam pulu (haneler toplamı). off ile toplamı DAİMA 15 olmalı.
export const lanesTotal = (l: KizLanes): number => l.reduce((a, b) => a + b, 0)

// Zar değeri d (1..6) için hane index'i (0..5).
const laneIndex = (d: number): number => d - 1

/** Deterministik değil — sadece motor dışında (UI/AI) çağrılır. rng verilebilir (test için). */
export function rollDice(rng: () => number = Math.random): { dice: number[]; isDouble: boolean } {
  const d1 = 1 + Math.floor(rng() * 6)
  const d2 = 1 + Math.floor(rng() * 6)
  return { dice: [d1, d2], isDouble: d1 === d2 }
}

/** Zarları state'e uygula (turda bir kez). Zaten atılmışsa/oyun bittiyse yok sayar. */
export function applyRoll(s: KizState, dice: number[], isDouble: boolean): KizState {
  if (s.winner || s.rolled) return s
  return {
    ...s,
    dice: dice.slice(),
    isDouble,
    // Çiftte tek "kullanım" var (haneyi bir kez temizler); normalde iki zar iki kullanım.
    diceUsed: isDouble ? [false] : dice.map(() => false),
    rolled: true,
  }
}

/**
 * Bu turda oynanabilecek zar-slot index'leri. Dönüş: kullanılmamış + hedef hanesi DOLU olan
 * zarların index listesi. Boşsa -> hamlesiz tur (endTurn ile geç).
 *   - Normal: diceUsed[i]===false ve lanes[turn][dice[i]-1] > 0 olan her i.
 *   - Çift: tek slot (index 0); lanes[turn][d-1] > 0 ise oynanabilir.
 */
export function playableSlots(s: KizState): number[] {
  if (!s.rolled || s.winner) return []
  const lanes = s.lanes[s.turn]
  const out: number[] = []
  if (s.isDouble) {
    if (!s.diceUsed[0] && lanes[laneIndex(s.dice[0])] > 0) out.push(0)
    return out
  }
  for (let i = 0; i < s.dice.length; i++) {
    if (!s.diceUsed[i] && lanes[laneIndex(s.dice[i])] > 0) out.push(i)
  }
  return out
}

/** Bu turda oynanabilecek hane numaraları (1..6) — UI vurgusu için (benzersiz, dolu). */
export function playableLanes(s: KizState): number[] {
  const slots = playableSlots(s)
  const set = new Set<number>()
  for (const i of slots) set.add(s.dice[i])
  return [...set].sort((a, b) => a - b)
}

function checkWin(s: KizState): KizState {
  if (s.off[s.turn] >= TOTAL_CHECKERS) {
    return { ...s, winner: s.turn, mars: s.off[other(s.turn)] === 0 }
  }
  return s
}

/**
 * Belirli bir zar-slot'unu oyna: o zarın gösterdiği haneden pul topla.
 *  - Normal zar: 1 pul kaldırır (hane dolu olmalı).
 *  - Çift: o hanedeki TÜM pulları kaldırır (tek kullanım).
 * Geçersizse (kullanılmış/boş/oyun bitti) state'i AYNEN döndürür (idempotent koruma).
 */
export function playSlot(s: KizState, slotIndex: number): KizState {
  if (s.winner || !s.rolled) return s
  if (s.diceUsed[slotIndex]) return s
  const d = s.dice[slotIndex]
  if (d === undefined) return s
  const idx = laneIndex(d)
  const lanes = s.lanes[s.turn]
  if (lanes[idx] <= 0) return s // boş hane -> oynanamaz

  const take = s.isDouble ? lanes[idx] : 1 // çift: tüm hane; normal: bir pul
  const newLanes = lanes.slice() as KizLanes
  newLanes[idx] -= take
  const newUsed = s.diceUsed.slice()
  newUsed[slotIndex] = true

  let next: KizState = {
    ...s,
    lanes: { ...s.lanes, [s.turn]: newLanes },
    off: { ...s.off, [s.turn]: s.off[s.turn] + take },
    diceUsed: newUsed,
  }
  next = checkWin(next)
  return next
}

/** Turda kalan tüm oynanabilir zarlar tükendi mi? (winner değilse endTurn'e hazır). */
export function turnComplete(s: KizState): boolean {
  if (s.winner) return true
  if (!s.rolled) return false
  return playableSlots(s).length === 0
}

/** Sırayı rakibe geçir + zar durumunu sıfırla. Oyun bittiyse dokunmaz. */
export function endTurn(s: KizState): KizState {
  if (s.winner) return s
  return {
    ...s,
    turn: other(s.turn),
    dice: [],
    isDouble: false,
    diceUsed: [],
    rolled: false,
  }
}

/** Bütünlük denetimi: her oyuncu için lanes toplamı + off === 15 olmalı (test/guard). */
export function checkersConserved(s: KizState): boolean {
  return (['white', 'black'] as KizPlayer[]).every(
    (p) => lanesTotal(s.lanes[p]) + s.off[p] === TOTAL_CHECKERS,
  )
}
