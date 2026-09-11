// Adil Zar test alani icin dagilim + Ki-Kare (chi-square) uygunluk testi.
// Zarlar GERCEK oyun fonksiyonu secureDie() ile uretilir (CSPRNG + reddetme
// ornekleme) — ayri bir Math.random() demosu DEGIL; production ile ayni kod yolu.

import { secureDie } from './game'

export interface DiceTestResult {
  total: number
  counts: number[] // index 0..5 -> zar yuzu 1..6
  percentages: number[] // yuzde (0..100)
  expectedPct: number // 100/6 = 16.666…
  mostFace: number // en cok gelen yuz (1..6)
  leastFace: number // en az gelen yuz (1..6)
  average: number // ortalama zar degeri
  chi2: number // ki-kare istatistigi
  df: number // serbestlik derecesi (5)
  pValue: number // ust kuyruk olasiligi
  anomalous: boolean // p < 0.01 -> olagan disi sapma
}

// n adet GERCEK zar at (secureDie), yuz sayimlarini dondur. Buyuk n'de cagiran
// taraf parca parca (batch) cagirabilir; bu fonksiyon tek blok sayar.
export function rollFaces(n: number): number[] {
  const counts = [0, 0, 0, 0, 0, 0]
  for (let i = 0; i < n; i++) counts[secureDie() - 1]++
  return counts
}

/* ---------- Ki-Kare p-değeri: regularize edilmiş eksik gama (Numerical Recipes) ---------- */

function gammln(xx: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  let x = xx
  let y = xx
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) {
    y += 1
    ser += cof[j] / y
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

// Alt regularize eksik gama P(a,x) — seri acilimi (x < a+1 icin yakinsak)
function gser(a: number, x: number): number {
  if (x <= 0) return 0
  const gln = gammln(a)
  let ap = a
  let sum = 1 / a
  let del = sum
  for (let n = 0; n < 300; n++) {
    ap += 1
    del *= x / ap
    sum += del
    if (Math.abs(del) < Math.abs(sum) * 1e-14) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - gln)
}

// Ust regularize eksik gama Q(a,x) — surekli kesir (x >= a+1 icin yakinsak)
function gcf(a: number, x: number): number {
  const FPMIN = 1e-300
  const gln = gammln(a)
  let b = x + 1 - a
  let c = 1 / FPMIN
  let d = 1 / b
  let h = d
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c
    if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-14) break
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h
}

// Ust kuyruk olasiligi Q(a,x) = 1 - P(a,x)
function gammq(a: number, x: number): number {
  if (x < 0 || a <= 0) return 1
  if (x < a + 1) return 1 - gser(a, x)
  return gcf(a, x)
}

// 1..6 yuzleri icin uniform (esit) dagilima karsi ki-kare uygunluk testi.
export function chiSquareUniform(counts: number[]): { chi2: number; df: number; pValue: number } {
  const total = counts.reduce((a, b) => a + b, 0)
  const df = counts.length - 1
  if (total === 0) return { chi2: 0, df, pValue: 1 }
  const exp = total / counts.length
  let chi2 = 0
  for (const c of counts) chi2 += ((c - exp) * (c - exp)) / exp
  const pValue = gammq(df / 2, chi2 / 2)
  return { chi2, df, pValue }
}

// Sayimlardan tam ozet. anomalous esigi p < 0.01 (cok gevsek; yanlis "kesin adil"
// iddiasi uretmez — yalnizca "olagan disi sapma var mi?" sorusuna bakar).
export function summarize(counts: number[]): DiceTestResult {
  const total = counts.reduce((a, b) => a + b, 0)
  const percentages = counts.map((c) => (total ? (c / total) * 100 : 0))
  let sum = 0
  for (let i = 0; i < 6; i++) sum += (i + 1) * counts[i]
  let mostFace = 1
  let leastFace = 1
  for (let i = 1; i < 6; i++) {
    if (counts[i] > counts[mostFace - 1]) mostFace = i + 1
    if (counts[i] < counts[leastFace - 1]) leastFace = i + 1
  }
  const { chi2, df, pValue } = chiSquareUniform(counts)
  return {
    total,
    counts,
    percentages,
    expectedPct: 100 / 6,
    mostFace,
    leastFace,
    average: total ? sum / total : 0,
    chi2,
    df,
    pValue,
    anomalous: pValue < 0.01,
  }
}
