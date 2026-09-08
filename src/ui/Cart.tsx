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

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card cart-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label="Kapat">
          <Icon name="x" size={16} />
        </Button>
        <header className="cart-head">
          <h2>
            <Icon name="shop" size={20} /> Sepet
          </h2>
          <p className="cart-sub">
            {memItem ? 'Üyeliğini gözden geçir ve güvenle öde. Bitiş tarihine 1 yıl eklenir.' : 'Sepetini gözden geçir ve güvenle öde.'}
          </p>
        </header>

        {memItem ? (
          /* --- Üyelik uzatma sepeti (tek urun) --- */
          <>
            <div className="cart-list">
              <div className="cart-row cart-row-mem">
                <span className="cart-row-name">
                  <Icon name="crown" size={16} /> 1 Yıllık Premium Üyelik
                  <b className="cart-row-gc">Üyelik bitişine +1 yıl</b>
                </span>
                <span className="cart-row-price tnum">{fmtTL(MEMBERSHIP_PRICE_TL)}</span>
                <button type="button" className="cart-row-del" onClick={() => setItems((prev) => prev.filter((p) => p.kind !== 'membership'))} aria-label="kaldır">
                  <Icon name="x" size={14} />
                </button>
              </div>
            </div>
            <div className="cart-summary">
              <div className="cart-sum-row cart-sum-total">
                <span>Toplam</span>
                <span className="cart-sum-amt tnum">{fmtTL(MEMBERSHIP_PRICE_TL)}</span>
              </div>
            </div>
            {err && <div className="cart-err">{err}</div>}
            <div className="cart-actions">
              <Button variant="outline" onClick={onClose}>
                Vazgeç
              </Button>
              <Button variant="default" disabled={busy} onClick={checkout}>
                <Icon name="crown" size={16} /> Ödemeye Geç
              </Button>
            </div>
            <p className="cart-note">Ödeme Garanti BBVA 3D Secure ile güvenli şekilde alınır. Üyelik bitiş tarihine 1 yıl eklenir.</p>
          </>
        ) : nothingToPay ? (
          <div className="cart-empty">
            <Icon name="shop" size={34} />
            <p>Sepetin boş.</p>
            <Button variant="outline" onClick={onContinue}>
              <Icon name="coin" size={16} /> Coin paketlerine dön
            </Button>
          </div>
        ) : (
          <>
            <div className="cart-list">
              {/* Coin paketleri */}
              {coinRows.map(({ it, pkg }) => (
                <div className="cart-row" key={it.id}>
                  <span className="cart-row-name">
                    <Icon name="coin" size={16} /> {pkg.name}
                    <b className="cart-row-gc">{fmtCoin(pkg.gc)} coin</b>
                  </span>
                  <div className="cart-qty" aria-label="adet">
                    <button type="button" onClick={() => setQty(it.id, it.qty - 1)} aria-label="azalt">
                      −
                    </button>
                    <span className="tnum">{it.qty}</span>
                    <button type="button" onClick={() => setQty(it.id, it.qty + 1)} aria-label="arttır">
                      +
                    </button>
                  </div>
                  <span className="cart-row-price tnum">{fmtTL(pkg.price * it.qty)}</span>
                  <button type="button" className="cart-row-del" onClick={() => remove(it.id)} aria-label="kaldır">
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}

              {/* Fiziksel ürünler */}
              {productRows.map((it) => {
                const p = it.product!
                return (
                  <div className="cart-row cart-row-product" key={it.id}>
                    <span className="cart-row-name">
                      {p.image ? <img className="cart-thumb" src={imageUrl(p.image)} alt="" /> : <Icon name="package" size={16} />}
                      <span className="cart-row-lines">
                        <span>{p.name}</span>
                        <b className="cart-row-gc">
                          {p.color ? p.color + ' · ' : ''}
                          {p.payment === 'coin' ? <>coin ile</> : <>kart ile</>}
                        </b>
                      </span>
                    </span>
                    <div className="cart-qty" aria-label="adet">
                      <button type="button" onClick={() => setQty(it.id, it.qty - 1)} aria-label="azalt">
                        −
                      </button>
                      <span className="tnum">{it.qty}</span>
                      <button type="button" onClick={() => setQty(it.id, it.qty + 1)} aria-label="arttır">
                        +
                      </button>
                    </div>
                    <span className="cart-row-price tnum">
                      {p.payment === 'coin' ? <Coins amount={(p.coinPrice ?? 0) * it.qty} size={14} /> : fmtTL(((p.moneyPrice ?? 0) / 100) * it.qty)}
                    </span>
                    <button type="button" className="cart-row-del" onClick={() => remove(it.id)} aria-label="kaldır">
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Adres seçimi (fiziksel ürün varsa) */}
            {hasProducts && (
              <div className="cart-address">
                <div className="cart-addr-row">
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
                    <span className="cart-addr-empty">Kayıtlı adres yok</span>
                  )}
                </div>
                <div className="cart-addr-row">
                  <label>Fatura adresi (isteğe bağlı)</label>
                  <select value={billId ?? ''} onChange={(e) => setBillId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Teslimat ile aynı</option>
                    {billingAddrs.map((a) => (
                      <option key={a.id} value={a.id}>
                        {(a.title ? a.title + ' — ' : '') + (a.company || a.name) + ', ' + a.city}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="cart-addr-manage" onClick={onManageAddresses}>
                  <Icon name="pencil" size={13} /> Adres ekle / yönet
                </button>
              </div>
            )}

            {/* Indirim kodu (yalnız coin paketi varsa) */}
            {coinRows.length > 0 && (
              <div className="cart-promo">
                {applied ? (
                  <div className="cart-promo-applied">
                    <span className="cart-promo-ok">
                      <Icon name="check" size={15} /> <b>{applied.code}</b> uygulandı
                    </span>
                    <span className="cart-promo-off tnum">−{fmtTL(discountTL)}</span>
                    <button type="button" className="cart-promo-del" onClick={clearPromo} aria-label="kodu kaldır">
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="cart-promo-form">
                    <input
                      className="cart-promo-input"
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
                {promoErr && <div className="cart-promo-err">{promoErr}</div>}
              </div>
            )}

            <div className="cart-summary">
              {coinProductRows.length > 0 && (
                <div className="cart-sum-row">
                  <span>Coin ile ödenecek</span>
                  <span className="tnum">
                    <Coins amount={coinProductsCoins} size={14} />
                  </span>
                </div>
              )}
              {moneyTotalTL > 0 && (
                <div className="cart-sum-row">
                  <span>Kart ile ara toplam</span>
                  <span className="tnum">{fmtTL(moneyTotalTL)}</span>
                </div>
              )}
              {applied && (
                <div className="cart-sum-row cart-sum-disc">
                  <span>İndirim · {applied.code}</span>
                  <span className="tnum">−{fmtTL(discountTL)}</span>
                </div>
              )}
              {moneyTotalTL > 0 && (
                <div className="cart-sum-row cart-sum-total">
                  <span>{totalCoinsPkg > 0 ? <>Kart toplam · <b className="tnum">{fmtCoin(totalCoinsPkg)}</b> coin</> : 'Kart toplam'}</span>
                  <span className="cart-sum-amt tnum">{fmtTL(finalTL)}</span>
                </div>
              )}
            </div>

            {err && <div className="cart-err">{err}</div>}

            <div className="cart-actions">
              <Button variant="outline" onClick={onContinue}>
                Alışverişe devam
              </Button>
              <Button variant="default" disabled={busy || shippingRequired} onClick={checkout}>
                <Icon name={moneyTotalTL > 0 ? 'coin' : 'check'} size={16} />{' '}
                {moneyTotalTL > 0 ? 'Ödemeye Geç' : 'Siparişi Tamamla'}
              </Button>
            </div>
            <p className="cart-note">
              {moneyTotalTL > 0 ? 'Kart ödemesi Garanti BBVA 3D Secure ile güvenle alınır. ' : ''}
              {coinProductRows.length > 0 ? 'Coin ürünleri anında hesabından düşülür.' : ''}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// coins ogesi mi (kind yoksa geriye donuk uyum: coins say).
function it_isCoins(it: CartItem): boolean {
  return it.kind === 'coins' || it.kind === undefined
}
