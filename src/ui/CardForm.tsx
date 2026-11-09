import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { detectBrand, formatCardNumber, cvvLength, luhnValid, expiryValid, cardFormValid, type CardBrand } from './cardValidation'
import './CardForm.css'

export interface CardPayData {
  number: string // yalnız haneler
  name: string
  expMonth: string // MM
  expYear: string // YY
  cvv: string
}

interface Props {
  amount: number // kuruş
  title?: string
  busy?: boolean
  onClose: () => void
  onSubmit: (card: CardPayData) => void
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
export default function CardForm({ amount, title, busy = false, onClose, onSubmit }: Props) {
  useEscape(onClose)
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
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card cardpay-card" onClick={(e) => e.stopPropagation()}>
        <div className="cardpay-head">
          <h2>
            <Icon name="credit-card" size={22} /> {title || 'Kart ile Ödeme'}
          </h2>
          <div className="cardpay-amount">
            <span>Ödenecek</span>
            <b className="tnum">{fmtTL(amount)}</b>
          </div>
        </div>

        <form
          className="cardpay-form"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <label className="cardpay-field">
            <span className="cardpay-label">Kart Numarası</span>
            <div className="cardpay-input-wrap">
              <input
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="0000 0000 0000 0000"
                value={formatCardNumber(number)}
                onChange={(e) => setNumber(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={!!err.number}
              />
              {BRAND_LABEL[brand] && <span className={`cardpay-brand brand-${brand}`}>{BRAND_LABEL[brand]}</span>}
            </div>
            {err.number && <span className="cardpay-err">{err.number}</span>}
          </label>

          <label className="cardpay-field">
            <span className="cardpay-label">Kart Üzerindeki İsim</span>
            <input
              autoComplete="cc-name"
              placeholder="AD SOYAD"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              onBlur={() => setTouched(true)}
              aria-invalid={!!err.name}
            />
            {err.name && <span className="cardpay-err">{err.name}</span>}
          </label>

          <div className="cardpay-row2">
            <label className="cardpay-field">
              <span className="cardpay-label">Son Kullanma</span>
              <div className="cardpay-exp">
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
                <span className="cardpay-exp-sep">/</span>
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
              {err.exp && <span className="cardpay-err">{err.exp}</span>}
            </label>

            <label className="cardpay-field">
              <span className="cardpay-label">CVV</span>
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
              {err.cvv && <span className="cardpay-err">{err.cvv}</span>}
            </label>
          </div>

          <div className="cardpay-secure">
            <Icon name="lock" size={16} /> 256-bit SSL ile şifreli ödeme. Kart bilgileriniz saklanmaz.
          </div>

          <div className="cardpay-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Vazgeç
            </Button>
            <Button type="submit" variant="default" disabled={!valid || busy}>
              {busy ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" /> İşleniyor…
                </>
              ) : (
                <>
                  <Icon name="lock" size={16} /> {fmtTL(amount)} Öde
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
