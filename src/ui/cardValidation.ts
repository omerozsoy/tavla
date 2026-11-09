// Kredi/banka kartı giriş doğrulaması — SAF fonksiyonlar (UI'dan ayrı, test edilebilir).
// GÜVENLİK: kart verisi YALNIZ bellekte tutulur; buradaki hiçbir fonksiyon log/çıktı/depolama yapmaz.

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'troy' | 'unknown'

/** Kart markasını BIN (ilk haneler) ile tahmin et (ikon + CVV uzunluğu için). */
export function detectBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard'
  if (/^3[47]/.test(digits)) return 'amex'
  if (/^9792/.test(digits)) return 'troy'
  return 'unknown'
}

/** Luhn (mod-10) sağlaması — geçersiz kart numaralarını yakalar. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false
  let sum = 0
  let dbl = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (dbl) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    dbl = !dbl
  }
  return sum % 10 === 0
}

/** Ham numarayı marka formatına göre grupla (amex 4-6-5, diğerleri 4-4-4-4...). */
export function formatCardNumber(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 19)
  const groups = detectBrand(d) === 'amex' ? [4, 6, 5] : [4, 4, 4, 4, 3]
  const out: string[] = []
  let i = 0
  for (const g of groups) {
    if (i >= d.length) break
    out.push(d.slice(i, i + g))
    i += g
  }
  return out.join(' ')
}

/** CVV uzunluğu markaya bağlı (amex 4, diğer 3). */
export function cvvLength(brand: CardBrand): number {
  return brand === 'amex' ? 4 : 3
}

/** SKT (MM/YY) geçerli + gelecekte mi? now = {y: 4 haneli yıl, m: 1-12}. */
export function expiryValid(mm: string, yy: string, now: { y: number; m: number }): boolean {
  if (!/^\d{2}$/.test(mm) || !/^\d{2}$/.test(yy)) return false
  const m = Number(mm)
  if (m < 1 || m > 12) return false
  const year = 2000 + Number(yy)
  if (year < now.y) return false
  if (year === now.y && m < now.m) return false
  return true
}

/** Tüm form geçerli mi (tek kapı). */
export function cardFormValid(f: { number: string; name: string; mm: string; yy: string; cvv: string }, now: { y: number; m: number }): boolean {
  const digits = f.number.replace(/\D/g, '')
  const brand = detectBrand(digits)
  return (
    luhnValid(digits) &&
    f.name.trim().length >= 2 &&
    expiryValid(f.mm, f.yy, now) &&
    new RegExp(`^\\d{${cvvLength(brand)}}$`).test(f.cvv)
  )
}
