// ONLINE saat GÖRÜNÜMÜ: sunucu demirinden (anchor) istemci rakamını türeten SAF fonksiyon.
//
// Sunucu-otoriter saat (backend MatchClock::clientView) her poll'da tek bir "demir" gönderir:
// kalan delay/bank + aktif taraf + hold (bot-reveal grace) + damga zamanı. İstemci bu demirden
// ~250ms'de ARADEĞER (interpolate) ederek pürüzsüz saniye gösterir. Mantığı App.tsx'ten buraya
// çıkardık ki "anlamsız saniye" (NaN/negatif) sınıfı regresyonlar deterministik test edilsin.
//
// TRUST BOUNDARY: alanlar ağdan gelir. Sonlu-olmayan (NaN/undefined/Infinity) bir alan ceil() ile
// doğrudan "nonsense" olarak ekrana düşerdi -> fin() ile 0'a sabitlenir (kullanıcı raporu:
// "sayaç anlamsız saniyeler gösteriyor"). Tüm değerler max(0, ...) ile negatiften korunur.

export interface ClockAnchor {
  delay: number // kalan delay (sn) — poll anındaki
  hold?: number // bot-reveal grace: bu kadar sn delay SABİT tutulur (eff=0)
  white: number // beyaz banka (sn)
  black: number // siyah banka (sn)
  active: 'white' | 'black' | null // sırası/süresi işleyen taraf
  at: number // demirin alındığı istemci zamanı (Date.now(), ms)
}

export interface ClockView {
  delay: number
  white: number
  black: number
}

/** Sonlu değilse d'ye sabitle (ağdan gelen bozuk alanın ekrana NaN düşmesini engeller). */
function fin(n: number | undefined, d = 0): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : d
}

/**
 * Demir (anchor) + şimdiki zamandan (ms) gösterilecek saat rakamını türet.
 *  - elapsed: demirden bu yana geçen sn.
 *  - hold boyunca delay SABİT (eff=0) -> "10 9 10 9" titremesi olmaz.
 *  - delay bittikten sonra (over) yalnız AKTİF tarafın bankası erir.
 *  - ceil: tam saniye gösterilir; max(0): negatif/NaN yok.
 */
export function interpClock(a: ClockAnchor, nowMs: number): ClockView {
  const elapsed = Math.max(0, (fin(nowMs) - fin(a.at)) / 1000)
  const hold = Math.max(0, fin(a.hold))
  const delayBank = Math.max(0, fin(a.delay))
  const eff = Math.max(0, elapsed - hold)
  const delay = Math.max(0, delayBank - eff)
  const over = Math.max(0, eff - delayBank) // delay bitince bankayı yiyen süre
  const white = a.active === 'white' ? Math.max(0, fin(a.white) - over) : Math.max(0, fin(a.white))
  const black = a.active === 'black' ? Math.max(0, fin(a.black) - over) : Math.max(0, fin(a.black))
  return { delay: Math.ceil(delay), white: Math.ceil(white), black: Math.ceil(black) }
}
