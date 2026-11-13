import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import type { CoinPackage } from '../coinPackages'
import { useCoinPackages } from '../useCoinPackages'
import { useMembershipPrice } from '../useMembershipPrice'
import { validatePromo, type PromoResult } from '../api'
import { Coins } from './Coins'
import { Button } from '@/components/ui/button'
import { useToast } from './Toast'
import './CheckoutSwiss.css'

// Sepet ogesi. kind: coins (paket) | membership (uyelik uzat) | product (fiziksel urun).
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

export interface CartAddressSel {
  shippingId: number | null
  billingId: number | null
}

const fmtCoin = (n: number) => n.toLocaleString('tr-TR')
const fmtTL = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ₺`
const imageUrl = (img?: string | null) => (img ? (/^(https?:|\/)/.test(img) ? img : '/uploads/' + img) : '')

// SEPET sayfası (/sepet) — GERÇEK sayfa (page-host, modal YOK). Yalnız ürün incelemesi + indirim
// kodu + özet. Adres/kargo + ödeme yöntemi SONRAKİ adımda (/odeme, DeliveryStep). "Devam Et" ->
// onProceed() -> Teslimat & Ödeme adımı -> /kart-odeme.
export default function Cart({
  items,
  setItems,
  onClose,
  onContinue,
  onProceed,
  autoCheckout = false,
  stepsSlot,
}: {
  items: CartItem[]
  setItems: (updater: (prev: CartItem[]) => CartItem[]) => void
  onClose: () => void
  onContinue: () => void
  onProceed: () => void // "Devam Et" -> Teslimat & Ödeme adımı (/odeme)
  autoCheckout?: boolean // "Hemen Satın Al" -> adım akışını bir kez otomatik başlat
  stepsSlot?: ReactNode // üstte adım göstergesi (Sepet → Teslimat → Ödeme)
}) {
  useEscape(onClose)
  const notify = useToast()
  const coinPackages = useCoinPackages()
  const MEMBERSHIP_PRICE_TL = useMembershipPrice() // panelden yonetilen premium fiyati (gosterim)
  const [code, setCode] = useState('')
  const [applied, setApplied] = useState<PromoResult | null>(null)
  const [promoErr, setPromoErr] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)

  const memItem = items.find((i) => i.kind === 'membership')
  const coinRows = items
    .map((it) => ({ it, pkg: coinPackages.find((p) => p.id === it.id) }))
    .filter((r): r is { it: CartItem; pkg: CoinPackage } => !!r.pkg && it_isCoins(r.it))
  const productRows = items.filter((i) => i.kind === 'product' && i.product)

  // Para toplamı (TL): coin paketleri (pkg.price TL) + para-ürünleri (moneyPrice kuruş/100).
  const packagesTL = coinRows.reduce((s, r) => s + r.pkg.price * r.it.qty, 0)
  const totalCoinsPkg = coinRows.reduce((s, r) => s + r.pkg.gc * r.it.qty, 0)
  const moneyProductRows = productRows.filter((i) => i.product!.payment === 'money')
  const coinProductRows = productRows.filter((i) => i.product!.payment === 'coin')
  const moneyProductsTL = moneyProductRows.reduce((s, i) => s + ((i.product!.moneyPrice ?? 0) / 100) * i.qty, 0)
  const coinProductsCoins = coinProductRows.reduce((s, i) => s + (i.product!.coinPrice ?? 0) * i.qty, 0)
  const moneyTotalTL = packagesTL + moneyProductsTL

  const discountTL = applied ? applied.discount / 100 : 0
  const finalTL = Math.max(0, moneyTotalTL - discountTL)

  // KDV %20 dahil; kitaplar (category 'kitap') KDV'siz -> matrahtan çıkar. Dahil KDV = matrah × 20/120.
  const bookTL = moneyProductRows
    .filter((i) => i.product!.category === 'kitap')
    .reduce((s, i) => s + ((i.product!.moneyPrice ?? 0) / 100) * i.qty, 0)
  const vatTL = (Math.max(0, finalTL - bookTL) * 20) / 120

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

  const nothingToPay = !memItem && coinRows.length === 0 && productRows.length === 0

  // "Hemen Satın Al" -> sepet açılır açılmaz bir kez Teslimat & Ödeme adımına geç.
  const autoRanRef = useRef(false)
  useEffect(() => {
    if (!autoCheckout || autoRanRef.current || nothingToPay) return
    autoRanRef.current = true
    onProceed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckout, nothingToPay])

  const totalItems = memItem ? 1 : coinRows.reduce((s, r) => s + r.it.qty, 0) + productRows.reduce((s, i) => s + i.qty, 0)

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

        {stepsSlot}

        <header className="ckw-head">
          <h2 className="ckw-title">
            <Icon name="cart" size={26} /> Sepet
          </h2>
          {!nothingToPay && <span className="ckw-count">{totalItems} ürün</span>}
        </header>

        {nothingToPay ? (
          <div className="ckw-empty">
            <p className="ckw-eyebrow">Sepetin boş</p>
            <p>Tavla ürünleri, kitaplar ve Premium üyelik Mağaza'da seni bekliyor.</p>
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

            {/* SAĞ: özet (adres/ödeme SONRAKİ adımda) */}
            <aside className="ckw-summary">
              <h3 className="ckw-summary-t">Sipariş Özeti</h3>

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
                  <>
                    <div className="ckw-row ckw-row-vat">
                      <span>KDV (%20 dahil)</span>
                      <span className="tnum">{fmtTL((MEMBERSHIP_PRICE_TL * 20) / 120)}</span>
                    </div>
                    <div className="ckw-row ckw-row-total">
                      <span>Toplam</span>
                      <span className="tnum">{fmtTL(MEMBERSHIP_PRICE_TL)}</span>
                    </div>
                  </>
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

              <button type="button" className="ckw-btn ckw-btn-block ckw-cta" disabled={nothingToPay} onClick={onProceed}>
                Devam Et <Icon name="arrow-right" size={16} />
              </button>

              <p className="ckw-secure">
                <Icon name="shield-check" size={14} />
                {memItem || moneyTotalTL > 0
                  ? 'Sonraki adım: teslimat adresi ve ödeme yöntemi.'
                  : 'Coin ürünleri bir sonraki adımda onaylanır.'}
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
