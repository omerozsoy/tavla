import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { Button } from '@/components/ui/button'
import { COIN_PACKAGES } from '../coinPackages'
import type { CartItem } from './Cart'

const fmtCoin = (n: number) => n.toLocaleString('tr-TR')
const fmtTL = (kurus: number) => `${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`

const onlyDigits = (s: string) => s.replace(/\D/g, '')

// Kart markasi (numaranin ilk hanelerinden). Kart gorseli rengi + logo bunu kullanir.
function detectBrand(d: string): { cls: string; name: string } {
  if (/^4/.test(d)) return { cls: 'visa', name: 'VISA' }
  if (/^9792/.test(d)) return { cls: 'troy', name: 'TROY' }
  if (/^3[47]/.test(d)) return { cls: 'amex', name: 'AMEX' }
  if (/^(5[1-5]|22[2-9]|2[3-6]|27[01]|2720)/.test(d)) return { cls: 'mc', name: 'MASTERCARD' }
  return { cls: '', name: '' }
}

// Uygulama-ici odeme sayfasi: sol sepet ozeti + sag kredi karti formu (canli onizleme).
// "Öde" -> imzali pay.submit ucuna NATIVE form POST -> Garanti 3D (banka sayfasi).
export default function Checkout({
  submitUrl,
  amount,
  coins,
  items,
  onBack,
}: {
  submitUrl: string
  amount: number // kurus
  coins: number
  items: CartItem[]
  onBack: () => void
}) {
  useEscape(onBack)
  const [number, setNumber] = useState('')
  const [holder, setHolder] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [cvv, setCvv] = useState('')

  const digits = onlyDigits(number).slice(0, 19)
  const brand = detectBrand(digits)
  const numView = ((digits + '••••••••••••••••').slice(0, 16).match(/.{1,4}/g) ?? []).join(' ')
  const grouped = (digits.match(/.{1,4}/g) ?? []).join(' ')

  const rows = useMemo(
    () =>
      items
        .map((it) => ({ it, pkg: COIN_PACKAGES.find((p) => p.id === it.id) }))
        .filter((r): r is { it: CartItem; pkg: (typeof COIN_PACKAGES)[number] } => !!r.pkg),
    [items],
  )

  return (
    <div className="register-overlay page setup-page">
      <div className="checkout-split">
        {/* Sol: sipariş özeti */}
        <div className="register-card checkout-summary">
          <button type="button" className="checkout-back" onClick={onBack}>
            <Icon name="arrow-right" size={16} /> Sepete dön
          </button>
          <h2>
            <Icon name="shop" size={20} /> Sipariş Özeti
          </h2>
          <div className="co-list">
            {rows.map(({ it, pkg }) => (
              <div className="co-row" key={it.id}>
                <span className="co-name">
                  <Icon name="coin" size={15} /> {pkg.name}
                  <b className="co-gc">{fmtCoin(pkg.gc)} coin</b>
                  {it.qty > 1 && <span className="co-qty">×{it.qty}</span>}
                </span>
                <span className="co-price tnum">{fmtTL(pkg.price * 100 * it.qty)}</span>
              </div>
            ))}
          </div>
          <div className="co-total">
            <span>
              Toplam <b className="tnum">{fmtCoin(coins)}</b> coin
            </span>
            <span className="co-total-amt tnum">{fmtTL(amount)}</span>
          </div>
        </div>

        {/* Sağ: kredi kartı formu (native POST -> Garanti 3D) */}
        <form className="register-card checkout-card" method="post" action={submitUrl} autoComplete="on">
          <h2>
            <Icon name="star" size={20} /> Kredi Kartı ile Öde
          </h2>

          {/* Canlı kart önizleme */}
          <div className={`cc-card ${brand.cls}`}>
            <div className="cc-top">
              <span className="cc-chip" />
              <span className="cc-brand">{brand.name}</span>
            </div>
            <div className="cc-num">{numView}</div>
            <div className="cc-foot">
              <span className="cc-holder">
                <span className="cc-lbl">Kart Sahibi</span>
                {holder.trim() ? holder.toUpperCase() : 'AD SOYAD'}
              </span>
              <span>
                <span className="cc-lbl">Son Kul.</span>
                {(month || 'AA') + '/' + (year || 'YY')}
              </span>
            </div>
          </div>

          <label>Kart Numarası</label>
          <input
            name="number"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            value={grouped}
            onChange={(e) => setNumber(onlyDigits(e.target.value).slice(0, 19))}
            required
          />

          <label>Kart Üzerindeki İsim</label>
          <input
            name="holder"
            autoComplete="cc-name"
            placeholder="Ad Soyad"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
          />

          <div className="cc-row">
            <div>
              <label>Ay</label>
              <input
                name="month"
                inputMode="numeric"
                autoComplete="cc-exp-month"
                placeholder="AA"
                value={month}
                onChange={(e) => setMonth(onlyDigits(e.target.value).slice(0, 2))}
                required
              />
            </div>
            <div>
              <label>Yıl</label>
              <input
                name="year"
                inputMode="numeric"
                autoComplete="cc-exp-year"
                placeholder="YY"
                value={year}
                onChange={(e) => setYear(onlyDigits(e.target.value).slice(0, 2))}
                required
              />
            </div>
            <div>
              <label>CVV</label>
              <input
                name="cvv"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                value={cvv}
                onChange={(e) => setCvv(onlyDigits(e.target.value).slice(0, 4))}
                required
              />
            </div>
          </div>

          <Button type="submit" variant="default" className="checkout-pay">
            <Icon name="coin" size={18} /> {fmtTL(amount)} Güvenli Öde
          </Button>
          <p className="checkout-secure">
            <Icon name="shield-check" size={13} /> 3D Secure · Kart bilgileriniz saklanmaz, doğrudan bankaya iletilir.
          </p>
        </form>
      </div>
    </div>
  )
}
