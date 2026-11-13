// MAC-OYUNU kup karari: skor-farkinda (match equity table + 6-sonuc olasiligi) kup aksiyonu.
//
// DURUST SINIR: Para-kupu gibi (bkz cubeEquity.ts) bu da YAKLASIMDIR — standart bir MET + "olu kup"
// mac-equity modeli (gelecekteki kup kaldiraci yok sayilir). Mac sonuna yakin / buyuk equity
// sicramalarinda kararlar dogrudur; sinir pozisyonlarinda XG rollout'tan ufak sapabilir. Trainer'in
// "dogru"su = bu modelin verdigi karardir (money kup ile ayni felsefe).

// Pre-Crawford MET: my-away (satir) x opp-away (sutun), MY mac-kazanma olasiligi (%). 1..9 away.
// Standart degerlere yakin (kose = %50 simetrik). Range disi away [1,9]'a kirpilir.
const MET: number[][] = [
  [50, 70, 75, 83, 85, 90, 91, 94, 95],
  [30, 50, 60, 68, 75, 81, 85, 88, 90],
  [25, 40, 50, 59, 66, 71, 76, 80, 84],
  [17, 32, 41, 50, 58, 64, 70, 75, 79],
  [15, 25, 34, 42, 50, 57, 63, 68, 73],
  [10, 19, 29, 36, 43, 50, 56, 62, 67],
  [9, 15, 24, 30, 37, 44, 50, 56, 61],
  [6, 12, 20, 25, 32, 38, 44, 50, 55],
  [5, 10, 16, 21, 27, 33, 39, 45, 50],
]

// MY mac-kazanma olasiligi (0..1): myAway/oppAway. away<=0 -> mac bitti.
export function metWin(myAway: number, oppAway: number): number {
  if (myAway <= 0) return 1
  if (oppAway <= 0) return 0
  const i = Math.min(9, myAway) - 1
  const j = Math.min(9, oppAway) - 1
  return MET[i][j] / 100
}

// Bir oyun-sonucunun (signed puan: +kazan / -kaybet, 1/2/3) sonrasi MY mac-equity'si.
function metAfterPts(pts: number, cube: number, myAway: number, oppAway: number): number {
  if (pts > 0) {
    const na = myAway - cube * pts
    return na <= 0 ? 1 : metWin(na, oppAway)
  }
  const oa = oppAway - cube * -pts
  return oa <= 0 ? 0 : metWin(myAway, oa)
}

// probs = [wn,wg,wb,ln,lg,lb] (mover perspektifi). cube'daki oyunun MY mac-equity'si (olu kup).
function matchEquityAtCube(probs: number[], cube: number, myAway: number, oppAway: number): number {
  const [wn = 0, wg = 0, wb = 0, ln = 0, lg = 0, lb = 0] = probs
  return (
    wn * metAfterPts(1, cube, myAway, oppAway) +
    wg * metAfterPts(2, cube, myAway, oppAway) +
    wb * metAfterPts(3, cube, myAway, oppAway) +
    ln * metAfterPts(-1, cube, myAway, oppAway) +
    lg * metAfterPts(-2, cube, myAway, oppAway) +
    lb * metAfterPts(-3, cube, myAway, oppAway)
  )
}

export interface MatchCubeResult {
  bestAction: string // 'double' | 'no-double' (teklif) ya da 'take' | 'pass' (yanit)
  normalizedEquityLoss: number // secilen aksiyonun en-iyiye gore mac-equity kaybi
}

// TEKLIF karari (mover, zar atmadan): double vs no-double. cube = mevcut kup degeri (genelde 1).
export function matchOfferLoss(
  probs: number[],
  chosen: 'double' | 'no-double',
  cube: number,
  myAway: number,
  oppAway: number,
): MatchCubeResult {
  const noDouble = matchEquityAtCube(probs, cube, myAway, oppAway)
  const doubleTake = matchEquityAtCube(probs, cube * 2, myAway, oppAway)
  const na = myAway - cube
  const doublePass = na <= 0 ? 1 : metWin(na, oppAway)
  // Rakip, kendisi icin iyi olani secer: benim equity'mi KUCULTEN. take benim icin daha kotuyse alir.
  const oppTakes = doubleTake <= doublePass
  const doubleEq = oppTakes ? doubleTake : doublePass
  const best = Math.max(noDouble, doubleEq)
  const chosenEq = chosen === 'double' ? doubleEq : noDouble
  return {
    bestAction: doubleEq > noDouble ? 'double' : 'no-double',
    normalizedEquityLoss: Math.max(0, best - chosenEq),
  }
}

// YANIT karari (kupe maruz kalan): take vs pass. cube = TEKLIF SONRASI kup degeri (ornek 2).
export function matchTakeLoss(
  probs: number[],
  chosen: 'take' | 'pass',
  cube: number,
  myAway: number,
  oppAway: number,
): MatchCubeResult {
  const takeEq = matchEquityAtCube(probs, cube, myAway, oppAway)
  const oa = oppAway - cube / 2 // pas -> rakip onceki kup degerini (cube/2) kazanir
  const passEq = oa <= 0 ? 0 : metWin(myAway, oa)
  const best = Math.max(takeEq, passEq)
  const chosenEq = chosen === 'take' ? takeEq : passEq
  return {
    bestAction: takeEq >= passEq ? 'take' : 'pass',
    normalizedEquityLoss: Math.max(0, best - chosenEq),
  }
}
