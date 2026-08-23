// Kup (doubling cube) karar danismani.
// Sinir agi cubeless olasilik verir [wn,wg,wb,ln,lg,lb]. Buradan standart
// risk/odul (take point) formulleriyle para-oyunu yaklasimi bir tavsiye uretir.
// Not: rollout degil, REHBER niteligindedir (Galaxy'nin "cube guidance"i gibi).

export type CubeAction = 'no-double' | 'double-take' | 'double-pass' | 'too-good'
export type TakeAction = 'take' | 'drop'

export interface CubeAdvice {
  winPct: number // sirada olan oyuncunun kazanma %
  gammonPct: number // kazandiginda gammon+bg orani (%)
  equity: number // cubeless para equity (mover)
  oppTakePct: number // rakibin take point'i (kabul icin gereken min kazanma %)
  action: CubeAction // sirada olan oyuncu icin kup teklif karari
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// W = kazanildiginda ortalama puan, L = kaybedildiginde ortalama puan
function wl(probs: number[]) {
  const [wn, wg, wb, ln, lg, lb] = probs
  const p = clamp(wn + wg + wb, 1e-6, 1 - 1e-6)
  const winPts = wn + 2 * wg + 3 * wb
  const losePts = ln + 2 * lg + 3 * lb
  const W = winPts / p
  const L = losePts / (1 - p)
  return { p, W, L, equity: winPts - losePts, gammonRate: (wg + wb) / p }
}

// Rakibin take point'i (kazanmasi gereken min oran). Recube vig ~ 0.5 puan.
function takePoint(W: number, L: number) {
  return clamp((L - 0.5) / (W + L), 0.05, 0.5)
}

// Sirada olan oyuncu (probs onun perspektifi) icin kup teklif tavsiyesi
export function cubeAdvice(probs: number[]): CubeAdvice {
  const { p, W, L, equity, gammonRate } = wl(probs)
  // Rakibin take point'i: rakibin W'si ~ bizim L, rakibin L'si ~ bizim W (simetri).
  // takePoint(a,b) = (b-0.5)/(a+b) -> rakip icin takePoint(L, W) = (W-0.5)/(L+W).
  // Simetrik (gammonsuz) durumda 0.25 = klasik %25 take point.
  const oppTake = takePoint(L, W)
  const cashPoint = 1 - oppTake // bunun ustunde rakip pas gecmeli (nakit)
  const doublePoint = clamp(cashPoint - 0.1, 0.5, 0.99) // pencerenin alt ucu (~%10 altta)

  let action: CubeAction
  if (p < doublePoint) {
    action = 'no-double'
  } else if (p >= cashPoint) {
    // Cok mu iyi? Yuksek gammon + guclu equity -> nakit yerine oynamaya devam
    if (gammonRate >= 0.3 && equity > 1.0) action = 'too-good'
    else action = 'double-pass'
  } else {
    action = 'double-take'
  }

  return {
    winPct: p * 100,
    gammonPct: gammonRate * 100,
    equity,
    oppTakePct: oppTake * 100,
    action,
  }
}

// Kup teklifiyle karsilasan oyuncu (probs onun perspektifi) take/drop karari
export function takeDecision(probs: number[]): { take: TakeAction; winPct: number; tpPct: number } {
  const { p, W, L } = wl(probs)
  const tp = takePoint(W, L) // kendi take point'imiz
  return { take: p >= tp ? 'take' : 'drop', winPct: p * 100, tpPct: tp * 100 }
}
