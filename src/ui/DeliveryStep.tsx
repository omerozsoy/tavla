import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useCoinPackages } from '../useCoinPackages'
import {
  getAddresses,
  getBankTransferInfo,
  createAddress,
  updateAddress,
  type Address,
  type AddressInput,
  type BankInfo,
  type PayMethod,
} from '../api'
import { PROVINCES } from '../provinces'
import { districtsOf } from '../districts'
import { MEMBERSHIP_PRICE_TL, type CartItem, type CartAddressSel } from './Cart'
import { type CardBreakdown } from './CardForm'
import './CheckoutSwiss.css'

const SHIPPING_TL = 250 // Kargo: premium hariç her sipariş SABİT (backend ile aynı: 25000 kuruş).

// TESLİMAT & ÖDEME adımı (/odeme) — GERÇEK sayfa (page-host, modal YOK). Teslimat + fatura adresi
// (yan yana, buradan girilebilir/düzenlenebilir) + kargo + ödeme yöntemi -> onPay -> /kart-odeme.
export default function DeliveryStep({
  items,
  onBack,
  onPay,
  stepsSlot,
}: {
  items: CartItem[]
  onBack: () => void
  onManageAddresses?: () => void
  onPay: (sel: CartAddressSel, method: PayMethod, breakdown?: CardBreakdown) => Promise<void>
  stepsSlot?: ReactNode // üstte adım göstergesi
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
  const coinRows = items.filter((i) => i.kind === 'coins' || i.kind === undefined)

  const shippingAddrs = useMemo(() => addresses.filter((a) => a.type === 'shipping'), [addresses])
  const billingAddrs = useMemo(() => addresses.filter((a) => a.type === 'billing'), [addresses])

  // Tutarlar (TL): para-ürünleri + coin paketleri + üyelik + KARGO (fiziksel üründe).
  const moneyProductsTL = productRows
    .filter((i) => i.product!.payment === 'money')
    .reduce((s, i) => s + ((i.product!.moneyPrice ?? 0) / 100) * i.qty, 0)
  const packagesTL = coinRows.reduce((s, it) => {
    const pkg = coinPackages.find((p) => p.id === it.id)
    return s + (pkg ? pkg.price * it.qty : 0)
  }, 0)
  const subtotalTL = memItem ? MEMBERSHIP_PRICE_TL : moneyProductsTL + packagesTL
  const moneyDue = !!memItem || subtotalTL > 0
  // Kargo: premium üyelik (dijital) HARİÇ her ödemeli sipariş kargolu (kullanıcı direktifi "premium
  // dijital, onun dışında her şeyde kargo"). Backend PaymentController ile senkron: cartCheckout'taki
  // coin paketi + fiziksel ürün kargolu; premium ayrı akış (buyMembership) -> kargosuz.
  const shippingTL = !memItem && moneyDue ? SHIPPING_TL : 0
  const totalTL = subtotalTL + shippingTL
  // KDV %20 DAHİL (kitaplar hariç). Toplam DEĞİŞMEZ — sadece fiyatın içindeki KDV (ödeme adımında gösterilir).
  const bookTL = productRows
    .filter((i) => i.product!.category === 'kitap')
    .reduce((s, i) => s + ((i.product!.moneyPrice ?? 0) / 100) * i.qty, 0)
  const vatTL = (Math.max(0, subtotalTL - bookTL) * 20) / 120

  const reload = () => getAddresses().then(setAddresses).catch(() => {})

  useEffect(() => {
    if (!moneyDue) return // para ödemesi olan HER checkout'ta adresleri yükle (dijital üyelik/coin dahil)
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
  }, [moneyDue])

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
      setErr('Lütfen bir teslimat adresi seç veya gir.')
      return
    }
    setErr('')
    setBusy(true)
    try {
      await onPay({ shippingId: shipId, billingId: billId }, moneyDue ? method : 'card', {
        subtotalTL,
        shippingTL,
        vatTL,
        totalTL,
      })
    } catch (e) {
      setErr((e as { message?: string })?.message || 'Ödeme başlatılamadı.')
      setBusy(false)
    }
  }

  return (
    // GERÇEK SAYFA (modal değil): page-host akışında statik Swiss teslimat & ödeme adımı.
    <div className="register-overlay page">
      <div className="ckw ckw-delivery">
        {stepsSlot}
        <header className="ckw-pay-head">
          <div>
            <p className="ckw-eyebrow">Adım 2 / 3 · Teslimat</p>
            <h2 className="ckw-title">
              <Icon name="pin" size={24} /> Teslimat
            </h2>
          </div>
        </header>

        {/* Teslimat + Fatura adresi — YAN YANA, buradan girilebilir/düzenlenebilir. Para ödemesi
            olan HER checkout'ta görünür (dijital üyelik/coin dahil). Teslimat adresi YALNIZ fiziksel
            üründe zorunlu; dijitalde opsiyonel (kayıtlı adres seç/düzenle için yine gösterilir). */}
        {moneyDue && (
          <div className="ckw-addr-grid">
            <AddressField
              label={hasProducts ? 'Teslimat adresi' : 'Adresim (isteğe bağlı)'}
              type="shipping"
              addresses={shippingAddrs}
              selectedId={shipId}
              onSelect={setShipId}
              onReload={reload}
              optional={!hasProducts}
            />
            <AddressField
              label="Fatura adresi (isteğe bağlı)"
              type="billing"
              addresses={billingAddrs}
              selectedId={billId}
              onSelect={setBillId}
              onReload={reload}
              optional
            />
          </div>
        )}

        {/* Fiyat özeti (ara toplam/kargo/KDV/ödenecek) KULLANICI İSTEĞİYLE bu adımdan kaldırıldı ->
            ÖDEME adımında (CardForm breakdown) gösterilir. Teslimat adımı = yalnız adres + ödeme yöntemi. */}

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

// ---- Adres alanı: kayıtlıdan seç VEYA buradan gir/düzenle (inline form) ----
function AddressField({
  label,
  type,
  addresses,
  selectedId,
  onSelect,
  onReload,
  optional = false,
}: {
  label: string
  type: 'shipping' | 'billing'
  addresses: Address[]
  selectedId: number | null
  onSelect: (id: number | null) => void
  onReload: () => Promise<void>
  optional?: boolean
}) {
  const empty = (): AddressInput => ({ type, title: '', name: '', phone: '', address: '', city: '', district: '', postal: '' })
  // Kayıtlı adres YOKSA (zorunlu) form açık; VARSA dropdown göster. Adresler ASYNC yüklenir (ilk
  // render'da boş) -> editing'i effect ile adres gelince güncelle; yoksa kayıtlı adres gizli kalırdı.
  const [editing, setEditing] = useState(false)
  const manualRef = useRef(false) // kullanıcı formu elle açtı/kapattı -> otomatik override etme
  const [editId, setEditId] = useState<number | null>(null)
  const [f, setF] = useState<AddressInput>(empty())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof AddressInput, v: string) => setF((p) => ({ ...p, [k]: v }))
  const ilceler = districtsOf(f.city)

  useEffect(() => {
    if (manualRef.current) return
    setEditing(!optional && addresses.length === 0)
  }, [addresses.length, optional])

  const startNew = () => {
    manualRef.current = true
    setEditId(null)
    setF(empty())
    setErr('')
    setEditing(true)
  }
  const startEdit = () => {
    const a = addresses.find((x) => x.id === selectedId)
    if (!a) return
    manualRef.current = true
    setEditId(a.id)
    setF({ ...a })
    setErr('')
    setEditing(true)
  }
  async function save() {
    if (!f.name.trim() || !f.phone.trim() || !f.city || !f.address.trim()) {
      setErr('Ad, telefon, il ve adres zorunlu.')
      return
    }
    setBusy(true)
    setErr('')
    try {
      const saved = editId ? await updateAddress(editId, f) : await createAddress(f)
      await onReload()
      onSelect(saved.id)
      setEditing(false)
    } catch (e) {
      setErr((e as { message?: string })?.message || 'Adres kaydedilemedi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ckw-addr-field">
      <label className="ckw-label">{label}</label>

      {!editing ? (
        <>
          {addresses.length > 0 ? (
            <select value={selectedId ?? ''} onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{optional ? 'Teslimat ile aynı' : 'Seç…'}</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {(a.title ? a.title + ' — ' : '') + a.name + ', ' + (a.district ? a.district + '/' : '') + a.city}
                </option>
              ))}
            </select>
          ) : (
            <span className="ckw-unit">Kayıtlı adres yok</span>
          )}
          <div className="ckw-addr-acts">
            <button type="button" className="ckw-addr-link" onClick={startNew}>
              <Icon name="plus" size={13} /> Yeni adres
            </button>
            {selectedId != null && (
              <button type="button" className="ckw-addr-link" onClick={startEdit}>
                <Icon name="pencil" size={13} /> Düzenle
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="ckw-addr-form">
          <input placeholder="Ad Soyad" value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={120} autoComplete="name" />
          <input placeholder="Telefon" value={f.phone} onChange={(e) => set('phone', e.target.value)} maxLength={40} inputMode="tel" autoComplete="tel" />
          <div className="ckw-addr-row">
            <select value={f.city} onChange={(e) => setF((p) => ({ ...p, city: e.target.value, district: '' }))}>
              <option value="">İl seç…</option>
              {PROVINCES.map((il) => (
                <option key={il} value={il}>
                  {il}
                </option>
              ))}
            </select>
            {ilceler.length > 0 ? (
              <select value={f.district ?? ''} onChange={(e) => set('district', e.target.value)} disabled={!f.city}>
                <option value="">İlçe</option>
                {ilceler.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            ) : (
              <input placeholder="İlçe" value={f.district ?? ''} onChange={(e) => set('district', e.target.value)} maxLength={80} />
            )}
          </div>
          <textarea
            placeholder="Mahalle, sokak, kapı/daire no"
            value={f.address}
            onChange={(e) => set('address', e.target.value)}
            rows={2}
            maxLength={1000}
          />
          <input placeholder="Posta kodu (ops.)" value={f.postal ?? ''} onChange={(e) => set('postal', e.target.value)} maxLength={20} inputMode="numeric" />
          {err && <p className="ckw-err">{err}</p>}
          <div className="ckw-addr-acts">
            {(addresses.length > 0 || optional) && (
              <button type="button" className="ckw-btn ckw-btn-ghost ckw-btn-sm" onClick={() => setEditing(false)}>
                Vazgeç
              </button>
            )}
            <button type="button" className="ckw-btn ckw-btn-sm" onClick={save} disabled={busy}>
              {busy ? 'Kaydediliyor…' : 'Adresi Kaydet'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
