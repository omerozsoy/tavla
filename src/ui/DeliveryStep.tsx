import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useCoinPackages } from '../useCoinPackages'
import { getAddresses, getBankTransferInfo, type Address, type BankInfo, type PayMethod } from '../api'
import { MEMBERSHIP_PRICE_TL, type CartItem, type CartAddressSel } from './Cart'
import './CheckoutSwiss.css'

const fmtTL = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ₺`

// TESLİMAT & ÖDEME adımı (/odeme) — GERÇEK sayfa (page-host, modal YOK). Sepet ile Kart Ödeme
// arasında: teslimat/fatura adresi + ödeme yöntemi seçilir, sonra onPay -> sunucu siparişi (pending)
// -> /kart-odeme (kart) veya havale talimatı.
export default function DeliveryStep({
  items,
  onBack,
  onManageAddresses,
  onPay,
}: {
  items: CartItem[]
  onBack: () => void
  onManageAddresses: () => void
  onPay: (sel: CartAddressSel, method: PayMethod) => Promise<void>
}) {
  useEscape(onBack)
  const coinPackages = useCoinPackages()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [shipId, setShipId] = useState<number | null>(null)
  const [billId, setBillId] = useState<number | null>(null)
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null)
  const [method, setMethod] = useState<PayMethod>('card')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const memItem = items.find((i) => i.kind === 'membership')
  const productRows = items.filter((i) => i.kind === 'product' && i.product)
  const hasProducts = productRows.length > 0
  const coinRows = items.filter((i) => (i.kind === 'coins' || i.kind === undefined))

  const shippingAddrs = useMemo(() => addresses.filter((a) => a.type === 'shipping'), [addresses])
  const billingAddrs = useMemo(() => addresses.filter((a) => a.type === 'billing'), [addresses])

  // Ödenecek tutar (TL): para-ürünleri + coin paketleri + üyelik.
  const moneyProductsTL = productRows
    .filter((i) => i.product!.payment === 'money')
    .reduce((s, i) => s + ((i.product!.moneyPrice ?? 0) / 100) * i.qty, 0)
  const packagesTL = coinRows.reduce((s, it) => {
    const pkg = coinPackages.find((p) => p.id === it.id)
    return s + (pkg ? pkg.price * it.qty : 0)
  }, 0)
  const totalTL = memItem ? MEMBERSHIP_PRICE_TL : moneyProductsTL + packagesTL
  const itemCount = memItem ? 1 : productRows.reduce((s, i) => s + i.qty, 0) + coinRows.reduce((s, i) => s + i.qty, 0)
  const moneyDue = !!memItem || totalTL > 0

  useEffect(() => {
    if (!hasProducts) return
    let alive = true
    getAddresses()
      .then((list) => {
        if (!alive) return
        setAddresses(list)
        const dShip = list.find((a) => a.type === 'shipping' && a.is_default) ?? list.find((a) => a.type === 'shipping')
        const dBill = list.find((a) => a.type === 'billing' && a.is_default) ?? list.find((a) => a.type === 'billing')
        setShipId((cur) => cur ?? dShip?.id ?? null)
        setBillId((cur) => cur ?? dBill?.id ?? null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [hasProducts])

  useEffect(() => {
    let alive = true
    getBankTransferInfo()
      .then((info) => alive && setBankInfo(info))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const shippingRequired = hasProducts && !shipId

  async function pay() {
    if (shippingRequired) {
      setErr('Lütfen bir teslimat adresi seç (ya da ekle).')
      return
    }
    setErr('')
    setBusy(true)
    try {
      await onPay({ shippingId: shipId, billingId: billId }, moneyDue ? method : 'card')
    } catch (e) {
      setErr((e as { message?: string })?.message || 'Ödeme başlatılamadı.')
      setBusy(false)
    }
  }

  return (
    // GERÇEK SAYFA (modal değil): page-host akışında statik Swiss teslimat & ödeme adımı.
    <div className="register-overlay page">
      <div className="ckw ckw-pay">
        <header className="ckw-pay-head">
          <div>
            <p className="ckw-eyebrow">Adım 2 / 3 · Teslimat</p>
            <h2 className="ckw-title">
              <Icon name="package" size={24} /> Teslimat &amp; Ödeme
            </h2>
          </div>
          <div className="ckw-pay-amount">
            <span>Ödenecek</span>
            <b className="tnum">{fmtTL(totalTL)}</b>
          </div>
        </header>

        {/* Sipariş özeti (salt-okunur) */}
        <div className="ckw-block">
          <label className="ckw-label">Sipariş Özeti</label>
          <div className="ckw-rows">
            <div className="ckw-row">
              <span>{memItem ? '1 Yıllık Premium Üyelik' : `${itemCount} ürün`}</span>
              <span className="tnum">{fmtTL(totalTL)}</span>
            </div>
          </div>
          <button type="button" className="ckw-addr-link" onClick={onBack}>
            <Icon name="caret-left" size={13} /> Sepeti düzenle
          </button>
        </div>

        {/* Teslimat + fatura adresi (yalnız fiziksel ürün varsa) */}
        {hasProducts && (
          <div className="ckw-block">
            <label className="ckw-label">Teslimat adresi</label>
            {shippingAddrs.length > 0 ? (
              <select value={shipId ?? ''} onChange={(e) => setShipId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Seç…</option>
                {shippingAddrs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.title ? a.title + ' — ' : '') + a.name + ', ' + a.city}
                  </option>
                ))}
              </select>
            ) : (
              <span className="ckw-unit">Kayıtlı adres yok — lütfen bir adres ekle.</span>
            )}
            <label className="ckw-label">Fatura adresi (isteğe bağlı)</label>
            <select value={billId ?? ''} onChange={(e) => setBillId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Teslimat ile aynı</option>
              {billingAddrs.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.title ? a.title + ' — ' : '') + (a.company || a.name) + ', ' + a.city}
                </option>
              ))}
            </select>
            <button type="button" className="ckw-addr-link" onClick={onManageAddresses}>
              <Icon name="pin" size={13} /> Adres ekle / yönet
            </button>
          </div>
        )}

        {/* Ödeme yöntemi (para ödemesi varsa ve havale açıksa) */}
        {moneyDue && bankInfo?.enabled && (
          <div className="ckw-block" role="radiogroup" aria-label="Ödeme yöntemi">
            <label className="ckw-label">Ödeme yöntemi</label>
            <button
              type="button"
              role="radio"
              aria-checked={method === 'card'}
              className={`ckw-pm ${method === 'card' ? 'on' : ''}`}
              onClick={() => setMethod('card')}
            >
              <Icon name="credit-card" size={16} /> Kredi / Banka Kartı
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={method === 'bank_transfer'}
              className={`ckw-pm ${method === 'bank_transfer' ? 'on' : ''}`}
              onClick={() => setMethod('bank_transfer')}
            >
              <Icon name="money" size={16} /> Havale / EFT
            </button>
          </div>
        )}

        {err && <p className="ckw-err" role="alert">{err}</p>}

        <div className="ckw-pay-actions">
          <button type="button" className="ckw-btn ckw-btn-ghost" onClick={onBack} disabled={busy}>
            <Icon name="caret-left" size={16} /> Sepete dön
          </button>
          <button type="button" className="ckw-btn" onClick={pay} disabled={busy || shippingRequired}>
            {busy ? (
              <>
                <span className="btn-spinner" aria-hidden="true" /> İşleniyor…
              </>
            ) : (
              <>
                <Icon name="lock" size={16} />{' '}
                {moneyDue ? (method === 'bank_transfer' && bankInfo?.enabled ? 'Havale Bilgilerine Geç' : 'Kart Ödemeye Geç') : 'Siparişi Tamamla'}
              </>
            )}
          </button>
        </div>

        <p className="ckw-secure">
          <Icon name="shield-check" size={14} />
          {method === 'bank_transfer' && bankInfo?.enabled
            ? 'Havale/EFT bilgileri sonraki adımda; ödemen onaylanınca işleme alınır.'
            : 'Ödemen onaylanınca siparişin işleme alınır. Kart bilgilerin saklanmaz.'}
        </p>
      </div>
    </div>
  )
}
