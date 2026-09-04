// Küp (doubling cube) EQUITY modeli — sinir ağının KÜBSÜZ olasılıklarından cubeful equity türetir.
//
// NEDEN: wildbg NN yalnız cubeless [wn,wg,wb,ln,lg,lb] üretir; cubeful equity (küp kararları için)
// ÜRETMEZ. XG-style cube PR, her küp aksiyonunun (no-double/double, take/pass) equity'sini + en
// iyiye göre KAYBINI ister. Bu modül, standart PARA-oyunu doubling teorisiyle (owner / non-owner
// per-küp equity + cube efficiency x ile dead↔live interpolasyonu) aksiyon equity'lerini üretir.
//
// MODELİN ÇEKİRDEĞİ (para oyunu, tam hassasiyet):
//  - Take point tp: kazanınca W / kaybedince L ort. puanla tp=(L−0.5)/(W+L) (gammonsuz ~0.25).
//  - Küpü TUTAN oyuncunun per-küp equity'si: take point'te −0.5 (yani orijinal küpte 2×(−0.5)=−1,
//    pas ile KAYITSIZLIK), p=1'de +1 -> doğrusal (ownedFrac). Bu, take/pass sınırını DOĞRU verir.
//  - Küpü TUTMAYAN (doubled-out olabilir): simetri -> nonOwnerFrac(p) = −ownedFrac(1−p).
//  - Merkezî küp ≈ ikisinin ortalaması. Janowski tarzı: E = (1−x)·cubeless + x·liveFrac.
//
// DÜRÜST SINIR (§23): YAKLAŞIMDIR (rollout / cube-aware net DEĞİL). XG ile SAYISAL parite iddia
// EDİLMEZ; metodoloji (equity kaybı × 500) XG'dir. Sabitler sanity testleriyle doğrulanır.
// Equity birimi: MEVCUT küp = 1 normalize (puan/mevcut-küp), mover perspektifi.

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

function wlp(probs: number[]): { p: number; W: number; L: number; ecl: number } {
  const [wn = 0, wg = 0, wb = 0, ln = 0, lg = 0, lb = 0] = probs
  const p = clamp(wn + wg + wb, 1e-6, 1 - 1e-6)
  const winPts = wn + 2 * wg + 3 * wb
  const losePts = ln + 2 * lg + 3 * lb
  return { p, W: winPts / p, L: losePts / (1 - p), ecl: winPts - losePts }
}

export interface CubeActionEquities {
  noDouble: number // mover equity — teklif ETMEZSE (oyuna devam, küp merkezî)
  double: number // mover equity — teklif EDERSE (rakip optimal yanıt)
  cashPoint: number // mover kazanma% bunun üstündeyse rakip pas geçer (nakit)
  tp: number // take point
  x: number
}

// x = cube efficiency (0=ölü, 1=canlı). Tipik ~0.7.
export function cubeActionEquities(probs: number[], x = 0.7): CubeActionEquities {
  const { p, W, L, ecl } = wlp(probs)
  const tp = clamp((L - 0.5) / (W + L), 0.02, 0.5)
  const cashPoint = 1 - tp

  // Küpü tutanın per-küp equity'si: (tp, −0.5) -> (1, +1) doğrusal (−1..+1 sınırlı).
  const ownedFrac = (pw: number) => clamp(-0.5 + 1.5 * ((pw - tp) / (1 - tp)), -1, 1)
  const nonOwnerFrac = (pw: number) => -ownedFrac(1 - pw)
  const centeredFrac = (pw: number) => (ownedFrac(pw) + nonOwnerFrac(pw)) / 2

  const dead = clamp(ecl, -3, 3)
  const noDouble = (1 - x) * dead + x * centeredFrac(p)

  // Teklif: rakip take/pass. Take -> mover artık NON-owner, küp 2× -> 2×nonOwnerFrac(p).
  // Pass -> mover +1 (mevcut küpü kazanır). Rakip take'i mover'ın kazanma%'si cashPoint altındaysa.
  const takeForDoubler = 2 * nonOwnerFrac(p)
  const opponentTakes = p < cashPoint
  const double = opponentTakes ? takeForDoubler : 1

  return { noDouble, double, cashPoint, tp, x }
}

// Küpü tutanın per-küp equity'si (take equity hesabı için dışa açık yardımcı değil; iç kullanım).
function takerEquity(probs: number[], x: number): number {
  const { p, W, L } = wlp(probs)
  const tp = clamp((L - 0.5) / (W + L), 0.02, 0.5)
  const ownedFrac = clamp(-0.5 + 1.5 * ((p - tp) / (1 - tp)), -1, 1)
  const dead = clamp(2 * p - 1, -1, 1)
  // Take -> küp 2×, sahiplik SENDE: 2 × (x·live + (1−x)·dead-per-küp).
  return 2 * (x * ownedFrac + (1 - x) * dead)
}

export type CubeOfferAction = 'no-double' | 'double'
export type CubeTakeAction = 'take' | 'pass'

export interface CubeLossResult {
  normalizedEquityLoss: number
  bestAction: string
  countsForPR: boolean
}

// Obvious küp kararı eşiği (§8): en iyi ile en kötü aksiyon farkı bunun altındaysa sayılmaz.
export const XG_OBVIOUS_CUBE_EQUITY_SPREAD = 0.001

// TEKLİF kararı (mover, zar atmadan): no-double vs double. probs = MOVER perspektifi.
export function offerLoss(probs: number[], chosen: CubeOfferAction, x = 0.7): CubeLossResult {
  const eq = cubeActionEquities(probs, x)
  const best = Math.max(eq.noDouble, eq.double)
  const worst = Math.min(eq.noDouble, eq.double)
  const chosenEq = chosen === 'double' ? eq.double : eq.noDouble
  return {
    normalizedEquityLoss: Math.max(0, best - chosenEq),
    bestAction: eq.double > eq.noDouble ? 'double' : 'no-double',
    countsForPR: best - worst >= XG_OBVIOUS_CUBE_EQUITY_SPREAD,
  }
}

// YANIT kararı (küple karşılaşan): take vs pass. probs = YANIT VERENİN perspektifi.
export function takeLoss(probs: number[], chosen: CubeTakeAction, x = 0.7): CubeLossResult {
  const takeEq = takerEquity(probs, x)
  const passEq = -1
  const best = Math.max(takeEq, passEq)
  const worst = Math.min(takeEq, passEq)
  const chosenEq = chosen === 'take' ? takeEq : passEq
  return {
    normalizedEquityLoss: Math.max(0, best - chosenEq),
    bestAction: takeEq >= passEq ? 'take' : 'pass',
    countsForPR: best - worst >= XG_OBVIOUS_CUBE_EQUITY_SPREAD,
  }
}
