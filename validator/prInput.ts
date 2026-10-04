// A-31: /analyze-pr girdisi istemci kaynaklı oyun kaydından gelir (Laravel yalnız dizi olduğunu
// kontrol eder). Doğrulanmamış `dice` (ör. 12 elemanlı) generateMoves'u ~15^12 özyinelemeye sokup
// olay döngüsünü kilitliyordu -> canlı /validate da düşüp otoriter maçlar 503 alıyordu.
export const MAX_PR_LOG = 1000

export function saneDice(d: unknown): d is number[] {
  return (
    Array.isArray(d) &&
    d.length === 2 &&
    d.every((x) => Number.isInteger(x) && (x as number) >= 1 && (x as number) <= 6)
  )
}

export function sanePos(p: unknown): boolean {
  const pts = (p as { points?: unknown } | null)?.points
  return Array.isArray(pts) && pts.length === 24 && pts.every((x) => Number.isInteger(x) && Math.abs(x as number) <= 15)
}

export function saneSteps(s: unknown): boolean {
  return Array.isArray(s) && s.length <= 4
}
