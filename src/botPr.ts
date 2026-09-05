// Bot (YZ) seviyelerinin hedef PR araliklari — dusuk = daha iyi oyun.
// Index = difficulty-1; MatchSetup'taki AI_LEVELS/PR_TARGETS siralamasiyla BIREBIR ayni.
//   1 Beginner 35–50 · 2 Rookie 25–35 · 3 Casual 18–25 · 4 Skilled 12–18 · 5 Expert 8–12
//   6 Master 5–8 · 7 Grandmaster 3–5 · 8 Elite 1.5–3 · 9 Legend 0.5–1.5 · 10 Neural AI 0–0.5
//
// NeuralBot pratikte neredeyse-optimal oynadigi icin OLCULEN bot PR'i ~0.0 cikar; sonuc
// ekraninda/mac analizinde "0.0" gormek itici. Bunun yerine seviyeye uygun sabit-rastgele
// (araliktan) bir PR gosteririz — bot kendi seviyesinde oynamis gibi hissettirir.
export const BOT_PR_RANGES: readonly (readonly [number, number])[] = [
  [35, 50],
  [25, 35],
  [18, 25],
  [12, 18],
  [8, 12],
  [5, 8],
  [3, 5],
  [1.5, 3],
  [0.5, 1.5],
  [0, 0.5],
]

// Seviye butonlari altinda gosterilen etiketler ("Hedef PR 35–50"). Aralik dizisinden turer.
export const PR_TARGET_LABELS: readonly string[] = BOT_PR_RANGES.map(
  ([lo, hi]) => `${lo}–${hi}`,
)

// difficulty: 1..10. Seviyenin araligindan rasgele, 1 ondalik yuvarlanmis PR uretir.
export function randomBotPr(difficulty: number): number {
  const idx = Math.min(BOT_PR_RANGES.length - 1, Math.max(0, difficulty - 1))
  const [lo, hi] = BOT_PR_RANGES[idx]
  const v = lo + Math.random() * (hi - lo)
  return Math.round(v * 10) / 10
}
