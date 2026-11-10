import { useMemo, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { detectBrand, formatCardNumber, cvvLength, luhnValid, expiryValid, cardFormValid, type CardBrand } from './cardValidation'
import './CheckoutSwiss.css'

export interface CardPayData {
  number: string // yalnız haneler
  name: string
  expMonth: string // MM
  expYear: string // YY
  cvv: string
}

export interface CardBreakdown {
  subtotalTL: number
  shippingTL: number
  vatTL: number
  totalTL: number
}

interface Props {
  amount: number // kuruş
  title?: string
  busy?: boolean
  onClose: () => void
  onSubmit: (card: CardPayData) => void
  stepsSlot?: ReactNode // üstte adım göstergesi
  breakdown?: CardBreakdown // fiyat özeti (ara toplam/kargo/KDV) — ödeme adımında gösterilir
  onBack?: () => void // "Geri Dön" -> teslimat adımı (verilmezse onClose kullanılır)
}

const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'VISA',
  mastercard: 'Mastercard',
  amex: 'Amex',
  troy: 'Troy',
  unknown: '',
}

function fmtTL(kurus: number): string {
  return (kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺'
}

// Kredi/Banka Kartı ile ödeme sayfası (biçim). GÜVENLİK: kart verisi YALNIZ bu bileşenin
// state'inde; loglanmaz, localStorage'a yazılmaz. Gönderim onSubmit ile üst akışa verilir.
const fmtTLnum = (n: number): string =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' ₺'

export default function CardForm({ amount, title, busy = false, onClose, onSubmit, stepsSlot, breakdown, onBack }: Props) {
  const [number, setNumber] = useState('')
  const [name, setName] = useState('')
  const [mm, setMm] = useState('')
  const [yy, setYy] = useState('')
  const [cvv, setCvv] = useState('')
  const [touched, setTouched] = useState(false)

  const digits = number.replace(/\D/g, '')
  const brand = detectBrand(digits)
  const now = useMemo(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  }, [])
  const valid = cardFormValid({ number, name, mm, yy, cvv }, now)

  const err = {
    number: touched && digits.length > 0 && !luhnValid(digits) ? 'Kart numarası geçersiz' : '',
    name: touched && name.trim().length < 2 ? 'Kart üzerindeki ismi girin' : '',
    exp: touched && (mm || yy) && !expiryValid(mm, yy, now) ? 'Son kullanma tarihi geçersiz' : '',
    cvv: touched && cvv.length > 0 && cvv.length !== cvvLength(brand) ? 'CVV eksik' : '',
  }

  function submit() {
    setTouched(true)
    if (!valid || busy) return
    onSubmit({ number: digits, name: name.trim(), expMonth: mm, expYear: yy, cvv })
  }

  return (
    // GERÇEK SAYFA (modal değil): page-host akışında statik Swiss kart ödeme sayfası.
    <div className="register-overlay page">
      <div className="ckw ckw-pay">
        {stepsSlot}
        <header className="ckw-pay-head">
          <div>
            <p className="ckw-eyebrow">Güvenli Ödeme</p>
            <h2 className="ckw-title">
              <Icon name="credit-card" size={24} /> {title || 'Kart ile Ödeme'}
            </h2>
          </div>
          <div className="ckw-pay-amount">
            <span>Ödenecek</span>
            <b className="tnum">{fmtTL(amount)}</b>
          </div>
        </header>

        {breakdown && (
          <div className="ckw-rows ckw-pay-breakdown">
            <div className="ckw-row">
              <span>Ara toplam</span>
              <span className="tnum">{fmtTLnum(breakdown.subtotalTL)}</span>
            </div>
            {breakdown.shippingTL > 0 && (
              <div className="ckw-row">
                <span>Kargo</span>
                <span className="tnum">{fmtTLnum(breakdown.shippingTL)}</span>
              </div>
            )}
            {breakdown.vatTL > 0 && (
              <div className="ckw-row ckw-row-vat">
                <span>KDV (%20 dahil)</span>
                <span className="tnum">{fmtTLnum(breakdown.vatTL)}</span>
              </div>
            )}
            <div className="ckw-row ckw-row-total">
              <span>Ödenecek</span>
              <span className="tnum">{fmtTLnum(breakdown.totalTL)}</span>
            </div>
          </div>
        )}

        <form
          className="ckw-form"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label className="ckw-field">
            <span className="ckw-label">Kart Numarası</span>
            <div className="ckw-input-wrap">
              <input
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="0000 0000 0000 0000"
                value={formatCardNumber(number)}
                onChange={(e) => setNumber(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={!!err.number}
              />
              {BRAND_LABEL[brand] && <span className={`ckw-brand brand-${brand}`}>{BRAND_LABEL[brand]}</span>}
            </div>
            {err.number && <span className="ckw-field-err">{err.number}</span>}
          </label>

          <label className="ckw-field">
            <span className="ckw-label">Kart Üzerindeki İsim</span>
            <input
              autoComplete="cc-name"
              placeholder="AD SOYAD"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              onBlur={() => setTouched(true)}
              aria-invalid={!!err.name}
            />
            {err.name && <span className="ckw-field-err">{err.name}</span>}
          </label>

          <div className="ckw-row2">
            <label className="ckw-field">
              <span className="ckw-label">Son Kullanma</span>
              <div className="ckw-exp">
                <input
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                  placeholder="AA"
                  maxLength={2}
                  value={mm}
                  onChange={(e) => setMm(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={() => setTouched(true)}
                  aria-invalid={!!err.exp}
                />
                <span className="ckw-exp-sep">/</span>
                <input
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                  placeholder="YY"
                  maxLength={2}
                  value={yy}
                  onChange={(e) => setYy(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  onBlur={() => setTouched(true)}
                  aria-invalid={!!err.exp}
                />
              </div>
              {err.exp && <span className="ckw-field-err">{err.exp}</span>}
            </label>

            <label className="ckw-field">
              <span className="ckw-label">CVV</span>
              <input
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder={'•'.repeat(cvvLength(brand))}
                maxLength={cvvLength(brand)}
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, cvvLength(brand)))}
                onBlur={() => setTouched(true)}
                aria-invalid={!!err.cvv}
              />
              {err.cvv && <span className="ckw-field-err">{err.cvv}</span>}
            </label>
          </div>

          <div className="ckw-pay-secure">
            <Icon name="lock" size={16} /> 256-bit SSL ile şifreli bağlantı. Kart bilgileriniz saklanmaz. Ödenecek tutara %20 KDV dahildir.
          </div>

          <div className="ckw-pay-actions">
            <button type="button" className="ckw-btn ckw-btn-ghost" onClick={onBack ?? onClose} disabled={busy}>
              <Icon name="caret-left" size={16} /> Geri Dön
            </button>
            <button type="submit" className="ckw-btn" disabled={!valid || busy}>
              {busy ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" /> İşleniyor…
                </>
              ) : (
                <>
                  <Icon name="lock" size={16} /> {fmtTL(amount)} Öde
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
