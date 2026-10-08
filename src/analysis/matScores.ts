// .mat dosyasındaki OYUN BAŞI maç skorlarını çıkarır. Standart format (gnubg/XG, bu projenin
// MatSerializer çıktısı): her " Game N" satırının hemen altındaki satır o oyunun BAŞINDAKİ skoru
// taşır -> " <beyazAd> : SW        <siyahAd> : SB". index = oyun (0-based) -> [{white, black}].
// Mat Analiz görüntüleyicisi (MatReview) hangi oyundaysa o oyunun başındaki skoru gösterir
// (eskiden hep 0/N yazıyordu -> "4. oyunda 2/9, 1/9" görünmüyordu).
export function parseMatScores(mat: string): { white: number; black: number }[] {
  const lines = mat.split(/\r?\n/)
  const out: { white: number; black: number }[] = []
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*Game\s+\d+/i.test(lines[i])) continue
    // "Game N"den sonraki ilk DOLU satır skor başlığıdır.
    let j = i + 1
    while (j < lines.length && lines[j].trim() === '') j++
    const m = (lines[j] ?? '').match(/:\s*(\d+)/g)
    if (m && m.length >= 2) {
      const a = parseInt(m[0].replace(/\D/g, ''), 10)
      const b = parseInt(m[1].replace(/\D/g, ''), 10)
      out.push({ white: Number.isFinite(a) ? a : 0, black: Number.isFinite(b) ? b : 0 })
    } else {
      out.push({ white: 0, black: 0 })
    }
  }
  return out
}
