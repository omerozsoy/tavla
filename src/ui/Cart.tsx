import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { COIN_PACKAGES } from '../coinPackages'
import { validatePromo, getAddresses, type PromoResult, type Address } from '../api'
import { Coins } from './Coins'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'

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
}: {
  items: CartItem[]
  setItems: (updater: (prev: CartItem[]) => CartItem[]) => void
  onClose: () => void
  onContinue: () => void
  onCheckout: (items: CartItem[], code: string | null, sel: CartAddressSel) => Promise<void>
  onManageAddresses: () => void // "Adres ekle/yönet" -> profil Adreslerim
}) {
  useEscape(onClose)
  const notify = useToast()
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

  const memItem = items.find((i) => i.kind === 'membership')
  const coinRows = items
    .map((it) => ({ it, pkg: COIN_PACKAGES.find((p) => p.id === it.id) }))
    .filter((r): r is { it: CartItem; pkg: (typeof COIN_PACKAGES)[number] } => !!r.pkg && it_isCoins(r.it))
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
      await onCheckout(items, applied?.code ?? null, { shippingId: shipId, billingId: billId })
    } catch (e) {
      const m = (e as { message?: string })?.message || 'Ödeme başlatılamadı.'
      setErr(m)
      notify.error(m)
      setBusy(false)
    }
  }

  const totalItems = memItem ? 1 : coinRows.reduce((s, r) => s + r.it.qty, 0) + productRows.reduce((s, i) => s + i.qty, 0)
  const ctaLabel = memItem || moneyTotalTL > 0 ? 'Ödemeye Geç' : 'Siparişi Tamamla'

  const qtyStepper = (id: string, qty: number) => (
    <div className="cart2-qty" aria-label="adet">
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
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card cart2-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </Button>

        <header className="cart2-head">
          <h2>
            <Icon name="cart" size={22} /> Sepetim
          </h2>
          {!nothingToPay && <span className="cart2-count">{totalItems} ürün</span>}
        </header>

        {nothingToPay ? (
          <div className="cart2-empty">
            <div className="cart2-empty-ic">
              <Icon name="cart" size={40} />
            </div>
            <p className="cart2-empty-t">Sepetin boş</p>
            <p className="cart2-empty-s">Coin paketleri, tavla ürünleri, kitaplar ve daha fazlası Mağaza'da seni bekliyor.</p>
            <Button onClick={onContinue}>
              <Icon name="shop" size={16} /> Mağaza'ya git
            </Button>
          </div>
        ) : (
          <div className="cart2-grid">
            {/* SOL: sepet öğeleri */}
            <div className="cart2-main">
              {memItem ? (
                <div className="cart2-item">
                  <div className="cart2-thumb cart2-thumb-mem">
                    <Icon name="crown" size={26} />
                  </div>
                  <div className="cart2-item-info">
                    <span className="cart2-item-name">1 Yıllık Premium Üyelik</span>
                    <span className="cart2-item-meta">Üyelik bitişine +1 yıl eklenir</span>
                  </div>
                  <span className="cart2-item-price tnum">{fmtTL(MEMBERSHIP_PRICE_TL)}</span>
                  <button
                    type="button"
                    className="cart2-del"
                    onClick={() => setItems((prev) => prev.filter((p) => p.kind !== 'membership'))}
                    aria-label="kaldır"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ) : (
                <>
                  {coinRows.map(({ it, pkg }) => (
                    <div className="cart2-item" key={it.id}>
                      <div className="cart2-thumb cart2-thumb-coin">
                        <Icon name="coin" size={24} />
                      </div>
                      <div className="cart2-item-info">
                        <span className="cart2-item-name">{pkg.name}</span>
                        <span className="cart2-item-meta">{fmtCoin(pkg.gc)} jeton</span>
                      </div>
                      {qtyStepper(it.id, it.qty)}
                      <span className="cart2-item-price tnum">{fmtTL(pkg.price * it.qty)}</span>
                      <button type="button" className="cart2-del" onClick={() => remove(it.id)} aria-label="kaldır">
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  ))}

                  {productRows.map((it) => {
                    const p = it.product!
                    return (
                      <div className="cart2-item" key={it.id}>
                        <div className="cart2-thumb">
                          {p.image ? <img src={imageUrl(p.image)} alt="" /> : <Icon name="package" size={22} />}
                        </div>
                        <div className="cart2-item-info">
                          <span className="cart2-item-name">{p.name}</span>
                          <span className="cart2-item-meta">
                            {p.color && <span className="cart2-chip">{p.color}</span>}
                            <span className={`cart2-chip cart2-chip-${p.payment}`}>
                              {p.payment === 'coin' ? 'Coin ile' : 'Kart ile'}
                            </span>
                          </span>
                        </div>
                        {qtyStepper(it.id, it.qty)}
                        <span className="cart2-item-price tnum">
                          {p.payment === 'coin' ? (
                            <Coins amount={(p.coinPrice ?? 0) * it.qty} size={15} />
                          ) : (
                            fmtTL(((p.moneyPrice ?? 0) / 100) * it.qty)
                          )}
                        </span>
                        <button type="button" className="cart2-del" onClick={() => remove(it.id)} aria-label="kaldır">
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    )
                  })}
                </>
              )}

              <button type="button" className="cart2-continue" onClick={onContinue}>
                <Icon name="caret-left" size={15} /> Alışverişe devam et
              </button>
            </div>

            {/* SAĞ: özet + ödeme */}
            <aside className="cart2-summary">
              <h3 className="cart2-summary-t">Sipariş Özeti</h3>

              {/* Adres (fiziksel ürün varsa) */}
              {hasProducts && (
                <div className="cart2-block cart2-addr">
                  <label>Teslimat adresi</label>
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
                    <span className="cart2-addr-empty">Kayıtlı adres yok</span>
                  )}
                  <label>Fatura adresi (isteğe bağlı)</label>
                  <select value={billId ?? ''} onChange={(e) => setBillId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Teslimat ile aynı</option>
                    {billingAddrs.map((a) => (
                      <option key={a.id} value={a.id}>
                        {(a.title ? a.title + ' — ' : '') + (a.company || a.name) + ', ' + a.city}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="cart2-addr-link" onClick={onManageAddresses}>
                    <Icon name="pin" size={13} /> Adres ekle / yönet
                  </button>
                </div>
              )}

              {/* İndirim kodu (yalnız coin paketi varsa) */}
              {!memItem && coinRows.length > 0 && (
                <div className="cart2-block cart2-promo">
                  {applied ? (
                    <div className="cart2-promo-ok">
                      <Icon name="check" size={15} />
                      <b>{applied.code}</b> uygulandı
                      <span className="cart2-promo-off tnum">−{fmtTL(discountTL)}</span>
                      <button type="button" onClick={clearPromo} aria-label="kodu kaldır">
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="cart2-promo-form">
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="İndirim kodu"
                        aria-label="İndirim kodu"
                        onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                      />
                      <Button variant="outline" disabled={promoBusy || !code.trim()} onClick={applyPromo}>
                        Uygula
                      </Button>
                    </div>
                  )}
                  {promoErr && <div className="cart2-promo-err">{promoErr}</div>}
                </div>
              )}

              {/* Toplamlar */}
              <div className="cart2-rows">
                {memItem ? (
                  <div className="cart2-row cart2-row-total">
                    <span>Toplam</span>
                    <span className="tnum">{fmtTL(MEMBERSHIP_PRICE_TL)}</span>
                  </div>
                ) : (
                  <>
                    {coinProductRows.length > 0 && (
                      <div className="cart2-row">
                        <span>Coin ile ödenecek</span>
                        <span>
                          <Coins amount={coinProductsCoins} size={14} />
                        </span>
                      </div>
                    )}
                    {moneyTotalTL > 0 && (
                      <div className="cart2-row">
                        <span>Ara toplam{totalCoinsPkg > 0 ? ` · ${fmtCoin(totalCoinsPkg)} coin` : ''}</span>
                        <span className="tnum">{fmtTL(moneyTotalTL)}</span>
                      </div>
                    )}
                    {applied && (
                      <div className="cart2-row cart2-row-disc">
                        <span>İndirim · {applied.code}</span>
                        <span className="tnum">−{fmtTL(discountTL)}</span>
                      </div>
                    )}
                    {moneyTotalTL > 0 && (
                      <div className="cart2-row cart2-row-total">
                        <span>Ödenecek tutar</span>
                        <span className="tnum">{fmtTL(finalTL)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {err && <div className="cart2-err">{err}</div>}

              <Button className="cart2-cta" disabled={busy || shippingRequired} onClick={checkout}>
                <Icon name={moneyTotalTL > 0 || memItem ? 'lock' : 'check'} size={16} /> {ctaLabel}
              </Button>

              <p className="cart2-secure">
                <Icon name="shield-check" size={14} />
                {moneyTotalTL > 0 || memItem ? ' Garanti BBVA 3D Secure ile güvenli ödeme' : ' Coin ürünleri anında hesabından düşülür'}
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
