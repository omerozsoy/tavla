import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import type { CoinPackage } from '../coinPackages'
import { useCoinPackages } from '../useCoinPackages'
import { validatePromo, getAddresses, getBankTransferInfo, type PromoResult, type Address, type BankInfo, type PayMethod } from '../api'
import { Coins } from './Coins'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import './CheckoutSwiss.css'

// Sepet ogesi. kind: coins (paket) | membership (uyelik uzat) | product (fiziksel urun).
// product ogesi kendi gosterim verisini tasir (sepet yeniden fetch etmeden cizsin).
export interface CartItem {
  id: string
  qty: number
  kind?: 'coins' | 'membership' | 'product'
  product?: {
    id: number
    name: string
    image?: string | null
    color?: string | null
    category?: string | null // 'kitap' KDV'siz
    payment: 'coin' | 'money'
    coinPrice?: number | null
    moneyPrice?: number | null // kurus
  }
}

export const MEMBERSHIP_ITEM_ID = 'premium-yil'
export const MEMBERSHIP_PRICE_TL = 499

export interface CartAddressSel {
  shippingId: number | null
  billingId: number | null
}

const fmtCoin = (n: number) => n.toLocaleString('tr-TR')
const fmtTL = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ₺`
const imageUrl = (img?: string | null) => (img ? (/^(https?:|\/)/.test(img) ? img : '/uploads/' + img) : '')

export default function Cart({
  items,
  setItems,
  onClose,
  onContinue,
  onCheckout,
  onManageAddresses,
  autoCheckout = false,
}: {
  items: CartItem[]
  setItems: (updater: (prev: CartItem[]) => CartItem[]) => void
  onClose: () => void
  onContinue: () => void
  onCheckout: (items: CartItem[], code: string | null, sel: CartAddressSel, method: PayMethod) => Promise<void>
  onManageAddresses: () => void // "Adres ekle/yönet" -> profil Adreslerim
  autoCheckout?: boolean // "Hemen Satın Al" -> adres hazırsa ödemeyi (kart) bir kez otomatik başlat
}) {
  useEscape(onClose)
  const notify = useToast()
  const coinPackages = useCoinPackages()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [code, setCode] = useState('')
  const [applied, setApplied] = useState<PromoResult | null>(null)
  const [promoErr, setPromoErr] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)

  // Adresler (yalnız fiziksel ürün varsa gerekir)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [shipId, setShipId] = useState<number | null>(null)
  const [billId, setBillId] = useState<number | null>(null)

  // Ödeme yöntemi: kart (Garanti 3D) veya havale/EFT. Havale yalnız admin açtıysa gösterilir.
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null)
  const [payMethod, setPayMethod] = useState<PayMethod>('card')

  const memItem = items.find((i) => i.kind === 'membership')
  const coinRows = items
    .map((it) => ({ it, pkg: coinPackages.find((p) => p.id === it.id) }))
    .filter((r): r is { it: CartItem; pkg: CoinPackage } => !!r.pkg && it_isCoins(r.it))
  const productRows = items.filter((i) => i.kind === 'product' && i.product)
  const hasProducts = productRows.length > 0

  const shippingAddrs = useMemo(() => addresses.filter((a) => a.type === 'shipping'), [addresses])
  const billingAddrs = useMemo(() => addresses.filter((a) => a.type === 'billing'), [addresses])

  // Adresleri yükle (ürün varsa) + varsayılanları seç.
  useEffect(() => {
    if (!hasProducts) return
    let alive = true
    getAddresses()
      .then((list) => {
        if (!alive) return
        setAddresses(list)
        const defShip = list.find((a) => a.type === 'shipping' && a.is_default) ?? list.find((a) => a.type === 'shipping')
        const defBill = list.find((a) => a.type === 'billing' && a.is_default) ?? list.find((a) => a.type === 'billing')
        setShipId((cur) => cur ?? defShip?.id ?? null)
        setBillId((cur) => cur ?? defBill?.id ?? null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [hasProducts])

  // Havale bilgisini bir kez yükle (kapalıysa enabled:false döner -> seçenek gizli kalır).
  useEffect(() => {
    let alive = true
    getBankTransferInfo()
      .then((info) => alive && setBankInfo(info))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Para toplamı (TL): coin paketleri (pkg.price TL) + para-ürünleri (moneyPrice kuruş/100).
  const packagesTL = coinRows.reduce((s, r) => s + r.pkg.price * r.it.qty, 0)
  const totalCoinsPkg = coinRows.reduce((s, r) => s + r.pkg.gc * r.it.qty, 0)
  const moneyProductRows = productRows.filter((i) => i.product!.payment === 'money')
  const coinProductRows = productRows.filter((i) => i.product!.payment === 'coin')
  const moneyProductsTL = moneyProductRows.reduce((s, i) => s + (i.product!.moneyPrice ?? 0) / 100 * i.qty, 0)
  const coinProductsCoins = coinProductRows.reduce((s, i) => s + (i.product!.coinPrice ?? 0) * i.qty, 0)
  const moneyTotalTL = packagesTL + moneyProductsTL

  const discountTL = applied ? applied.discount / 100 : 0
  const finalTL = Math.max(0, moneyTotalTL - discountTL)

  // KDV %20, fiyata DAHİL (TR perakende KDV-dahil zorunlu) -> toplamı değiştirmez, bilgi satırı.
  // Kitaplar (category 'kitap') KDV'siz -> matrahtan çıkar. Dahil KDV = matrah × 20/120.
  const bookTL = moneyProductRows
    .filter((i) => i.product!.category === 'kitap')
    .reduce((s, i) => s + (i.product!.moneyPrice ?? 0) / 100 * i.qty, 0)
  const vatBaseTL = Math.max(0, finalTL - bookTL)
  const vatTL = vatBaseTL * 20 / 120

  const clearPromo = () => {
    setApplied(null)
    setPromoErr('')
  }
  const setQty = (id: string, qty: number) => {
    clearPromo()
    setItems((prev) => (qty <= 0 ? prev.filter((p) => p.id !== id) : prev.map((p) => (p.id === id ? { ...p, qty } : p))))
  }
  const remove = (id: string) => {
    clearPromo()
    setItems((prev) => prev.filter((p) => p.id !== id))
  }

  async function applyPromo() {
    const c = code.trim()
    if (!c || promoBusy || !coinRows.length) return
    setPromoErr('')
    setPromoBusy(true)
    try {
      const r = await validatePromo(items.filter((i) => it_isCoins(i)), c)
      setApplied(r)
      setCode('')
    } catch (e) {
      setApplied(null)
      const m = (e as { message?: string })?.message || 'İndirim kodu geçersiz.'
      setPromoErr(m)
      notify.error(m)
    } finally {
      setPromoBusy(false)
    }
  }

  const shippingRequired = hasProducts && !shipId
  const nothingToPay = !memItem && coinRows.length === 0 && productRows.length === 0

  async function checkout() {
    if (nothingToPay) return
    if (shippingRequired) {
      setErr('Lütfen bir teslimat adresi seç (ya da ekle).')
      return
    }
    setErr('')
    setBusy(true)
    try {
      const moneyDue = !!memItem || moneyTotalTL > 0
      await onCheckout(items, applied?.code ?? null, { shippingId: shipId, billingId: billId }, moneyDue ? payMethod : 'card')
    } catch (e) {
      const m = (e as { message?: string })?.message || 'Ödeme başlatılamadı.'
      setErr(m)
      notify.error(m)
      setBusy(false)
    }
  }

  // "Hemen Satın Al" -> sepet açılır açılmaz ödemeyi (kart) bir kez otomatik başlat. Yalnız adres
  // hazırsa (fiziksel üründe teslimat adresi seçili) tetiklenir; adres yoksa sepet görünür kalır ki
  // kullanıcı adres eklesin (adresler async yüklenir -> shipId oturunca effect yeniden değerlendirir).
  const autoRanRef = useRef(false)
  useEffect(() => {
    if (!autoCheckout || autoRanRef.current) return
    if (nothingToPay || shippingRequired) return
    autoRanRef.current = true
    void checkout()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckout, addresses, shipId, nothingToPay, shippingRequired])

  const totalItems = memItem ? 1 : coinRows.reduce((s, r) => s + r.it.qty, 0) + productRows.reduce((s, i) => s + i.qty, 0)
  const ctaLabel = memItem || moneyTotalTL > 0 ? 'Ödemeye Geç' : 'Siparişi Tamamla'

  const qtyStepper = (id: string, qty: number) => (
    <div className="ckw-qty" aria-label="adet">
      <button type="button" onClick={() => setQty(id, qty - 1)} aria-label="azalt">
        −
      </button>
      <span className="tnum">{qty}</span>
      <button type="button" onClick={() => setQty(id, qty + 1)} aria-label="arttır">
        +
      </button>
    </div>
  )

  return (
    // GERÇEK SAYFA (modal değil): page-host akışında statik Swiss sepet.
    <div className="register-overlay page">
      <div className="ckw ckw-cart">
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </Button>

        <header className="ckw-head">
          <h2 className="ckw-title">
            <Icon name="cart" size={26} /> Sepet
          </h2>
          {!nothingToPay && <span className="ckw-count">{totalItems} ürün</span>}
        </header>

        {nothingToPay ? (
          <div className="ckw-empty">
            <p className="ckw-eyebrow">Sepetin boş</p>
            <p>Coin paketleri, tavla ürünleri, kitaplar ve daha fazlası Mağaza'da seni bekliyor.</p>
            <button type="button" className="ckw-btn" onClick={onContinue}>
              <Icon name="shop" size={16} /> Mağaza'ya git
            </button>
          </div>
        ) : (
          <div className="ckw-grid">
            {/* SOL: sepet öğeleri */}
            <div className="ckw-items">
              {memItem ? (
                <div className="ckw-item">
                  <div className="ckw-thumb">
                    <Icon name="crown" size={26} />
                  </div>
                  <div className="ckw-info">
                    <span className="ckw-name">1 Yıllık Premium Üyelik</span>
                    <span className="ckw-meta">Üyelik bitişine +1 yıl eklenir</span>
                  </div>
                  <span className="ckw-line-price tnum">{fmtTL(MEMBERSHIP_PRICE_TL)}</span>
                  <button
                    type="button"
                    className="ckw-del"
                    onClick={() => setItems((prev) => prev.filter((p) => p.kind !== 'membership'))}
                    aria-label="kaldır"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ) : (
                <>
                  {coinRows.map(({ it, pkg }) => (
                    <div className="ckw-item" key={it.id}>
                      <div className="ckw-thumb">
                        <Icon name="coin" size={24} />
                      </div>
                      <div className="ckw-info">
                        <span className="ckw-name">{pkg.name}</span>
                        <span className="ckw-meta">{fmtCoin(pkg.gc)} jeton</span>
                        <span className="ckw-unit">Birim: {fmtTL(pkg.price)}</span>
                      </div>
                      {qtyStepper(it.id, it.qty)}
                      <span className="ckw-line-price tnum">{fmtTL(pkg.price * it.qty)}</span>
                      <button type="button" className="ckw-del" onClick={() => remove(it.id)} aria-label="kaldır">
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  ))}

                  {productRows.map((it) => {
                    const p = it.product!
                    const unit = p.payment === 'coin' ? p.coinPrice ?? 0 : (p.moneyPrice ?? 0) / 100
                    return (
                      <div className="ckw-item" key={it.id}>
                        <div className="ckw-thumb">
                          {p.image ? <img src={imageUrl(p.image)} alt="" /> : <Icon name="package" size={22} />}
                        </div>
                        <div className="ckw-info">
                          <span className="ckw-name">{p.name}</span>
                          <span className="ckw-meta">{p.color && <span className="ckw-chip">{p.color}</span>}</span>
                          <span className="ckw-unit">
                            Birim: {p.payment === 'coin' ? `${fmtCoin(unit)} jeton` : fmtTL(unit)}
                          </span>
                        </div>
                        {qtyStepper(it.id, it.qty)}
                        <span className="ckw-line-price tnum">
                          {p.payment === 'coin' ? (
                            <Coins amount={(p.coinPrice ?? 0) * it.qty} size={15} />
                          ) : (
                            fmtTL(((p.moneyPrice ?? 0) / 100) * it.qty)
                          )}
                        </span>
                        <button type="button" className="ckw-del" onClick={() => remove(it.id)} aria-label="kaldır">
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    )
                  })}
                </>
              )}

              <button type="button" className="ckw-continue" onClick={onContinue}>
                <Icon name="caret-left" size={15} /> Alışverişe devam et
              </button>
            </div>

            {/* SAĞ: özet + ödeme */}
            <aside className="ckw-summary">
              <h3 className="ckw-summary-t">Sipariş Özeti</h3>

              {/* Adres (fiziksel ürün varsa) */}
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
                    <span className="ckw-unit">Kayıtlı adres yok</span>
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

              {/* İndirim kodu (yalnız coin paketi varsa) */}
              {!memItem && coinRows.length > 0 && (
                <div className="ckw-block">
                  {applied ? (
                    <div className="ckw-promo-ok">
                      <Icon name="check" size={15} />
                      <b>{applied.code}</b>
                      <span className="tnum">−{fmtTL(discountTL)}</span>
                      <button type="button" onClick={clearPromo} aria-label="kodu kaldır">
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="ckw-promo">
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="İndirim kodu"
                        aria-label="İndirim kodu"
                        onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                      />
                      <button type="button" className="ckw-btn ckw-btn-ghost" disabled={promoBusy || !code.trim()} onClick={applyPromo}>
                        Uygula
                      </button>
                    </div>
                  )}
                  {promoErr && <div className="ckw-err">{promoErr}</div>}
                </div>
              )}

              {/* Toplamlar */}
              <div className="ckw-rows">
                {memItem ? (
                  <div className="ckw-row ckw-row-total">
                    <span>Toplam</span>
                    <span className="tnum">{fmtTL(MEMBERSHIP_PRICE_TL)}</span>
                  </div>
                ) : (
                  <>
                    {coinProductRows.length > 0 && (
                      <div className="ckw-row">
                        <span>Coin ile ödenecek</span>
                        <span>
                          <Coins amount={coinProductsCoins} size={14} />
                        </span>
                      </div>
                    )}
                    {moneyTotalTL > 0 && (
                      <div className="ckw-row">
                        <span>Ara toplam{totalCoinsPkg > 0 ? ` · ${fmtCoin(totalCoinsPkg)} coin` : ''}</span>
                        <span className="tnum">{fmtTL(moneyTotalTL)}</span>
                      </div>
                    )}
                    {applied && (
                      <div className="ckw-row ckw-row-disc">
                        <span>İndirim · {applied.code}</span>
                        <span className="tnum">−{fmtTL(discountTL)}</span>
                      </div>
                    )}
                    {vatTL > 0 && (
                      <div className="ckw-row ckw-row-vat">
                        <span>KDV (%20 dahil){bookTL > 0 ? ' · kitaplar hariç' : ''}</span>
                        <span className="tnum">{fmtTL(vatTL)}</span>
                      </div>
                    )}
                    {moneyTotalTL > 0 && (
                      <div className="ckw-row ckw-row-total">
                        <span>Ödenecek tutar</span>
                        <span className="tnum">{fmtTL(finalTL)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Ödeme yöntemi (yalnız para ödemesi varsa ve havale açıksa) */}
              {(memItem || moneyTotalTL > 0) && bankInfo?.enabled && (
                <div className="ckw-block" role="radiogroup" aria-label="Ödeme yöntemi">
                  <label className="ckw-label">Ödeme yöntemi</label>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={payMethod === 'card'}
                    className={`ckw-pm ${payMethod === 'card' ? 'on' : ''}`}
                    onClick={() => setPayMethod('card')}
                  >
                    <Icon name="credit-card" size={16} /> Kredi / Banka Kartı
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={payMethod === 'bank_transfer'}
                    className={`ckw-pm ${payMethod === 'bank_transfer' ? 'on' : ''}`}
                    onClick={() => setPayMethod('bank_transfer')}
                  >
                    <Icon name="money" size={16} /> Havale / EFT
                  </button>
                </div>
              )}

              {err && <div className="ckw-err" role="alert">{err}</div>}

              <button type="button" className="ckw-btn ckw-btn-block ckw-cta" disabled={busy || shippingRequired} onClick={checkout}>
                <Icon name={moneyTotalTL > 0 || memItem ? 'lock' : 'check'} size={16} /> {busy ? 'İşleniyor…' : ctaLabel}
              </button>

              <p className="ckw-secure">
                <Icon name="shield-check" size={14} />
                {moneyTotalTL > 0 || memItem
                  ? payMethod === 'bank_transfer' && bankInfo?.enabled
                    ? 'Havale/EFT bilgileri sonraki adımda; ödemen onaylanınca işleme alınır.'
                    : 'Ödemen onaylanınca siparişin işleme alınır.'
                  : 'Coin ürünleri anında hesabından düşülür.'}
              </p>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

// coins ogesi mi (kind yoksa geriye donuk uyum: coins say).
function it_isCoins(it: CartItem): boolean {
  return it.kind === 'coins' || it.kind === undefined
}
