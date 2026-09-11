// XG-style Performance Rating (PR) — TEK KAYNAK (client + validator + testler bunu kullanır).
//
// KAYNAK: eXtreme Gammon (XG) Performance Rating metodolojisi.
//   PR = (sayılan kararlar boyunca kaybedilen NORMALIZE equity toplamı / sayılan karar) × 500
//   Düşük PR daha iyi; kusursuz oyun PR = 0.
//
// ÖNEMLİ AYRIMLAR:
//  - Bu GNU Backgammon "Error Rate" (×1000) DEĞİL; XG PR (×500).
//  - "Normalize equity": motorumuzun `equityFrom`'u KÜBSÜZ PARA equity'si (win−lose + 2(wg−lg)
//    + 3(wbg−lbg), ~[−3,+3]). XG'nin cubeful EMG'sinden FARKLI motor → bu "XG-style PR"
//    (aynı FORMÜL, farklı motor equity'si). Parite iddia edilmez (§23).
//  - PR ≠ hata etiketi (inaccuracy/mistake/blunder). PR gerçek equity kaybından türer; sayım
//    hatalarından değil (§19). Şans (luck) PR'a GİRMEZ (§20).
//  - AGREGASYON: maç PR'larının ortalaması ALINMAZ; ham (Σloss, Σkarar) HAVUZLANIR (§13).

// XG: bir checker kararında tüm yasal oynamalar equity olarak ~eşitse (spread < eşik) karar
// "obvious" sayılır ve PR paydasına GİRMEZ. Tek sabit — kod içine dağıtma (§5).
export const XG_OBVIOUS_CHECKER_EQUITY_SPREAD = 0.001

export type DecisionType = 'checker' | 'cube'

// Denetlenebilir tek karar kaydı (§17). Kaynak (client/validator) doldurur; PR bundan türer.
export interface PrDecision {
  type: DecisionType
  countsForPR: boolean // paydaya girer mi (zorunlu/obvious ise false)
  normalizedEquityLoss: number // max(0, best − seçilen), 1pt faktörü UYGULANMADAN, tam hassasiyet
  prAdjustedEquityLoss: number // 1-puanlık maçta ×1.5 uygulanmış (§14); PR bunu kullanır
}

export interface PrCategory {
  decisions: number
  equityLost: number // prAdjusted toplam (tam hassasiyet)
  pr: number | null // (equityLost / decisions) × 500; decisions=0 -> null
}

export interface PrSummary {
  checker: PrCategory
  cube: PrCategory
  overall: PrCategory
}

// 1-puanlık maç faktörü — ARTIK NÖTR (her zaman 1). 2026-09-11: XG "Performance Rating" 1-puanlık
// maçta hataları ×1.5 ÖLÇEKLEMEZ; sunucu-otoriter gnubg yolu (AnalysisOrchestrator) da uygulamıyordu.
// Eski ×1.5 wildbg yolunu gnubg/XG ile TUTARSIZ yapıp 1-puanlık PR'ı %50 ŞİŞİRİYORDU (kullanıcı:
// "TavlaTV PR XG'den yüksek"). Faktör kaldırıldı; imza korunur (log şeması + geriye uyum). XG'nin
// 1-puanlık maçta doğru davranışı zaten match-aware equity'den gelir (gnubg yolu); wildbg kübsüz
// money-equity kullandığı için TAM parite iddia edilmez (§11) ama bu ×1.5 artık farkı büyütmez.
export function onePointFactor(_matchLength: number, _isMoney = false): number {
  return 1
}

// 1-PUANLIK MAÇ EQUITY (XG hizalama): 1-puanlık maçta gammon/backgammon ALAKASIZ (yalnız kazan/kaybet
// sayılır). Bu yüzden PR equity kaybı MONEY equity (win−lose + 2·gammon + 3·bg) DEĞİL, saf kazanma
// equity'si = Σwin − Σlose = (wn+wg+wb) − (ln+lg+lb) = 2·P(kazan)−1 (∈[-1,1]) ile ölçülmeli. XG de
// böyle yapar; money equity kullanmak gammon terimleriyle 1-puanlık PR'ı sistematik ŞİŞİRİR.
// probs: mover perspektifi [wn,wg,wb,ln,lg,lb]. Yoksa/1-puanlık değilse money equity'ye düş.
export function prMatchEquity(
  probs: number[] | undefined,
  moneyEquity: number,
  matchLength: number,
  isMoney = false,
): number {
  if (matchLength === 1 && !isMoney && probs && probs.length >= 6) {
    return probs[0] + probs[1] + probs[2] - (probs[3] + probs[4] + probs[5])
  }
  return moneyEquity
}

// PR = (equityLost / decisions) × 500; karar yoksa null (§10-12: asla 0 döndürme). Tam hassasiyet;
// yalnızca GÖSTERİMDE yuvarla (§16).
export function prValue(equityLost: number, decisions: number): number | null {
  if (decisions <= 0) return null
  return (equityLost / decisions) * 500
}

// Maçlar/oturumlar arası DOĞRU agregasyon (§13): ham toplamları havuzla, PR'ları ortalama.
export function pooledPR(totalEquityLost: number, totalDecisions: number): number | null {
  return prValue(totalEquityLost, totalDecisions)
}

// ---- Karar kurucular (kuralları TEK yerde uygula) ----

// Checker kararı. bestEq/worstEq = tüm yasal oynamaların en iyi/en kötü equity'si (mover perspektifi).
// legalMoveCount = yasal tam-tur sayısı. Zorunlu (≤1) veya obvious (spread<eşik) -> sayılmaz.
export function checkerDecision(
  bestEq: number,
  playedEq: number,
  worstEq: number,
  legalMoveCount: number,
  matchLength: number,
  isMoney = false,
): PrDecision {
  const counts = legalMoveCount > 1 && bestEq - worstEq >= XG_OBVIOUS_CHECKER_EQUITY_SPREAD
  const loss = Math.max(0, bestEq - playedEq) // FP gürültüsü negatife düşmesin (§2)
  return {
    type: 'checker',
    countsForPR: counts,
    normalizedEquityLoss: loss,
    prAdjustedEquityLoss: loss * onePointFactor(matchLength, isMoney),
  }
}

// Küp kararı (double/take/pass/redouble). bestEq/actualEq = en iyi ve seçilen küp aksiyonunun
// cubeful equity'si. countsForPR: motor/kaynak "bu küp kararı sayılır mı" bayrağını verir (§8) —
// obvious küp durumları hariç. Hatayı KARARI VEREN oyuncuya yaz (§9, caller sorumlu).
export function cubeDecision(
  bestEq: number,
  actualEq: number,
  countsForPR: boolean,
  matchLength: number,
  isMoney = false,
): PrDecision {
  const loss = Math.max(0, bestEq - actualEq)
  return {
    type: 'cube',
    countsForPR,
    normalizedEquityLoss: loss,
    prAdjustedEquityLoss: loss * onePointFactor(matchLength, isMoney),
  }
}

// ---- Özet: checker + cube havuzlanır (ortalama DEĞİL) ----
export function summarize(decisions: PrDecision[]): PrSummary {
  const acc = {
    checker: { equityLost: 0, decisions: 0 },
    cube: { equityLost: 0, decisions: 0 },
  }
  for (const d of decisions) {
    if (!d.countsForPR) continue // zorunlu/obvious -> paydaya girmez
    acc[d.type].equityLost += d.prAdjustedEquityLoss
    acc[d.type].decisions += 1
  }
  const checkerC: PrCategory = {
    decisions: acc.checker.decisions,
    equityLost: acc.checker.equityLost,
    pr: prValue(acc.checker.equityLost, acc.checker.decisions),
  }
  const cubeC: PrCategory = {
    decisions: acc.cube.decisions,
    equityLost: acc.cube.equityLost,
    pr: prValue(acc.cube.equityLost, acc.cube.decisions),
  }
  const totalLost = checkerC.equityLost + cubeC.equityLost
  const totalDec = checkerC.decisions + cubeC.decisions
  return {
    checker: checkerC,
    cube: cubeC,
    overall: { decisions: totalDec, equityLost: totalLost, pr: prValue(totalLost, totalDec) },
  }
}
