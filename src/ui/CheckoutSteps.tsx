import { Icon, type IconName } from './Icon'

// Checkout adım göstergesi (Sepet → Teslimat → Ödeme) — ikonlu yatay stepper.
// Tamamlanan/geçmiş adımlara geri, güvenli ileri adıma (canDelivery/canPayment) tıklanabilir.
export type CheckoutStep = 'cart' | 'delivery' | 'payment'

const STEPS: { key: CheckoutStep; icon: IconName; label: string }[] = [
  { key: 'cart', icon: 'cart', label: 'Sepet' },
  { key: 'delivery', icon: 'pin', label: 'Teslimat' },
  { key: 'payment', icon: 'credit-card', label: 'Ödeme' },
]

export default function CheckoutSteps({
  current,
  canDelivery,
  canPayment,
  onGo,
}: {
  current: CheckoutStep
  canDelivery: boolean
  canPayment: boolean
  onGo: (s: CheckoutStep) => void
}) {
  const curIdx = STEPS.findIndex((s) => s.key === current)
  const clickable = (key: CheckoutStep, idx: number) => {
    if (idx < curIdx) return true // geçmiş adım -> geri
    if (key === current) return false
    if (key === 'delivery') return canDelivery // ileri (sepette ürün varsa)
    if (key === 'payment') return canPayment // yalnız aktif ödeme varsa
    return false
  }
  return (
    <nav className="ckw-steps" aria-label="Ödeme adımları">
      <ol>
        {STEPS.map((s, idx) => {
          const done = idx < curIdx
          const active = s.key === current
          const can = clickable(s.key, idx)
          return (
            <li key={s.key} className={`ckw-step ${active ? 'on' : ''} ${done ? 'done' : ''} ${can ? 'can' : ''}`}>
              <button
                type="button"
                disabled={!can}
                aria-current={active ? 'step' : undefined}
                onClick={() => can && onGo(s.key)}
              >
                <span className="ckw-step-ic">{done ? <Icon name="check" size={18} /> : <Icon name={s.icon} size={18} />}</span>
                <span className="ckw-step-l">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
