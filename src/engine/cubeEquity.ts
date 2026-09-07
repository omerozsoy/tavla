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

// Küp verimliliği (cube efficiency): 0 = ölü küp (sadece cubeless), 1 = kusursuz verimli küp.
// KALİBRASYON (gammonsuz simetrik pozisyonda): 0.5 ile katlama noktası ~%70, nakit noktası %75,
// take point ~%21.4 çıkar — para oyunu referans değerleriyle (%70-75 katlama penceresi, ~%21-22
// take point) uyumlu. NOT: canlı-küp doğruları aşağıda kendi kurgumuz olduğundan buradaki x,
// Janowski makalesindeki x ile birebir AYNI ÖLÇEK DEĞİLDİR; değer bu modele göre kalibredir.
export const CUBE_EFFICIENCY = 0.5

// Canlı-küp equity doğrusu: [lo, hi] aralığında −1'den +1'e doğrusal (dışında sınırlanır).
// lo = küpün/oyunun KAYBEDİLDİĞİ nokta, hi = KAZANILDIĞI (nakit) nokta.
const liveLine = (lo: number, hi: number, p: number) =>
  clamp(-1 + 2 * ((p - lo) / Math.max(1e-9, hi - lo)), -1, 1)

// Aksiyon equity'leri. ÖNCEKİ MODELİN HATASI: sahip/sahip-değil doğruları aynıydı (tp≈0.25'te
// ikisi de 2p−1'e çöküyordu) -> küp SAHİPLİĞİNİN DEĞERİ SIFIRDI, dolayısıyla "katlamak" ileride
// olan taraf için her zaman bedava equity ikiye katlaması gibi görünüyordu (%43'ten itibaren
// "katla" diyordu). Sonuç: çok katlayan oyuncunun küp hatası hep 0 -> Küp PR 0.00.
// DOĞRUSU (Janowski mantığı): küpü TUTAN erken katlanamaz (aşağı ucu 0), küpü TUTMAYAN nakit
// edilebilir (aşağı ucu take point) -> sahiplik gerçek bir değer taşır.
export function cubeActionEquities(probs: number[], x = CUBE_EFFICIENCY): CubeActionEquities {
  const { p, W, L, ecl } = wlp(probs)
  const tp = clamp((L - 0.5) / (W + L), 0.02, 0.5) // kendi take point'im (ölü küp)
  const tpOpp = clamp((W - 0.5) / (W + L), 0.02, 0.5) // rakibin take point'i (kendi perspektifinden)
  const cashPoint = clamp(1 - tpOpp, 0.5, 0.98) // bunun üstünde rakip pas geçer (nakit)

  const dead = clamp(ecl, -3, 3)
  const blend = (live: number) => (1 - x) * dead + x * live

  // Merkezî küp: ilk nakit noktasına ulaşan küpü kazanır -> (tp, −1) ... (cash, +1).
  const noDouble = blend(liveLine(tp, cashPoint, p))
  // Teklif -> rakip TAKE ederse küp 2× ve SAHİPLİK RAKİPTE: ben artık nakit edilebilirim
  // -> (tp, −1) ... (1, +1) (yalnız oyunu kazanarak +1). PASS ise mevcut küpü kazanırım (+1).
  const opponentTakes = p < cashPoint
  const double = opponentTakes ? 2 * blend(liveLine(tp, 1, p)) : 1

  return { noDouble, double, cashPoint, tp, x }
}

// TAKE eden tarafın equity'si: küp 2× ve SAHİPLİK SENDE -> rakip seni nakit edemez, aşağı ucun
// 0'a kadar iner: (0, −1) ... (kendi nakit noktan, +1). probs = ALAN tarafın perspektifi.
function takerEquity(probs: number[], x: number): number {
  const { p, W, L, ecl } = wlp(probs)
  const tpOpp = clamp((W - 0.5) / (W + L), 0.02, 0.5)
  const cashPoint = clamp(1 - tpOpp, 0.5, 0.98)
  const dead = clamp(ecl, -3, 3)
  return 2 * ((1 - x) * dead + x * liveLine(0, cashPoint, p))
}

export type CubeOfferAction = 'no-double' | 'double'
export type CubeTakeAction = 'take' | 'pass'

export interface CubeLossResult {
  normalizedEquityLoss: number
  bestAction: string
  countsForPR: boolean
}

// Küp kararı PR PAYDASINA girer mi? (§8) İKİ koşuldan biri yeterli:
//  1) BANT: iki aksiyon birbirine yakınsa (fark <= BAND) küp gerçekten gündemdedir -> beceri
//     gerektiren karardır, sayılır.
//  2) HATA: bant dışında bile olsa oyuncu KÖTÜ tarafı seçtiyse (kayıp > EPS) gerçek hatadır,
//     sayılır -> bariz hatalar (ör. %50'de katlamak) bedava kalmaz.
// Bariz VE doğru oynanmış kararlar (her zar atışında "katlamamak") paydaya GİRMEZ; eskiden
// giriyordu ve sonuç ekranındaki Küp PR'ı 0.00'a suluyordu.
export const XG_CUBE_DECISION_BAND = 0.3
export const XG_CUBE_ERROR_EPS = 0.001

// TEKLİF kararı (mover, zar atmadan): no-double vs double. probs = MOVER perspektifi.
export function offerLoss(probs: number[], chosen: CubeOfferAction, x = CUBE_EFFICIENCY): CubeLossResult {
  const eq = cubeActionEquities(probs, x)
  const best = Math.max(eq.noDouble, eq.double)
  const worst = Math.min(eq.noDouble, eq.double)
  const chosenEq = chosen === 'double' ? eq.double : eq.noDouble
  const loss = Math.max(0, best - chosenEq)
  return {
    normalizedEquityLoss: loss,
    bestAction: eq.double > eq.noDouble ? 'double' : 'no-double',
    countsForPR: best - worst <= XG_CUBE_DECISION_BAND || loss > XG_CUBE_ERROR_EPS,
  }
}

// YANIT kararı (küple karşılaşan): take vs pass. probs = YANIT VERENİN perspektifi.
export function takeLoss(probs: number[], chosen: CubeTakeAction, x = CUBE_EFFICIENCY): CubeLossResult {
  const takeEq = takerEquity(probs, x)
  const passEq = -1
  const best = Math.max(takeEq, passEq)
  const worst = Math.min(takeEq, passEq)
  const chosenEq = chosen === 'take' ? takeEq : passEq
  const loss = Math.max(0, best - chosenEq)
  return {
    normalizedEquityLoss: loss,
    bestAction: takeEq >= passEq ? 'take' : 'pass',
    countsForPR: best - worst <= XG_CUBE_DECISION_BAND || loss > XG_CUBE_ERROR_EPS,
  }
}
