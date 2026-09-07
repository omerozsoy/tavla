import { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useToast } from './Toast'
import { Coins } from './Coins'
import { getProducts, orderProduct, type Product, type ProductColor } from '../api'

// Gorsel yolu: tam URL / mutlak yol ise oldugu gibi; ciplak yol ise panelden yuklenmis -> /uploads/
function imageUrl(img: string): string {
  return /^(https?:|\/)/.test(img) ? img : '/uploads/' + img
}
const fmtTL = (kurus: number) =>
  `${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`

// Fiziksel urun magazasi: grid -> secili urun detayi (renk gorsel secimi + adet + teslimat +
// odeme yontemi). Coin ile aninda satin alma; kart ile Garanti odeme sayfasina yonlenir.
export default function Products({
  coins,
  defaultName,
  onCoinsChange,
  onGoOrders,
  onClose,
}: {
  coins: number
  defaultName?: string
  onCoinsChange: (coins: number) => void
  onGoOrders: () => void
  onClose: () => void
}) {
  const { t } = useT()
  const toast = useToast()
  useEscape(onClose)

  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<Product | null>(null)
  const [cat, setCat] = useState<string>('all') // secili kategori filtresi

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => setError(true))
  }, [])

  // Kategori adlari panelden gelir (dinamik) -> slug -> ad haritasi + mevcut kategoriler.
  // slug null olan urunleri "diger" altina toplama; sadece kategorisi olanlari filtrele.
  const cats = useMemo(() => {
    const seen: string[] = []
    for (const p of products ?? []) if (p.category && !seen.includes(p.category)) seen.push(p.category)
    return seen
  }, [products])
  const catNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const p of products ?? []) if (p.category) m[p.category] = p.category_name || p.category
    return m
  }, [products])
  const catLabel = (c: string) => catNames[c] ?? c
  const visible = useMemo(
    () => (products ?? []).filter((p) => cat === 'all' || p.category === cat),
    [products, cat],
  )

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card products-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>

        {!selected ? (
          <>
            <h2>
              <Icon name="shop" size={20} /> {t('products.title')}
            </h2>
            <p className="register-sub">{t('products.sub')}</p>

            {cats.length > 1 && (
              <div className="products-cats" role="tablist">
                <button
                  type="button"
                  className={`products-cat-chip ${cat === 'all' ? 'active' : ''}`}
                  onClick={() => setCat('all')}
                >
                  {t('products.all')}
                </button>
                {cats.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`products-cat-chip ${cat === c ? 'active' : ''}`}
                    onClick={() => setCat(c)}
                  >
                    {catLabel(c)}
                  </button>
                ))}
              </div>
            )}

            {error && <p className="products-msg">{t('products.loadError')}</p>}
            {!error && products && products.length === 0 && (
              <p className="products-msg">{t('products.empty')}</p>
            )}

            <div className="products-grid">
              {visible.map((p) => {
                const out = p.stock <= 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="product-card"
                    disabled={out}
                    onClick={() => setSelected(p)}
                  >
                    <div className="product-thumb">
                      {p.images[0] ? (
                        <img src={imageUrl(p.images[0])} alt={p.name} />
                      ) : (
                        <Icon name="shop" size={32} />
                      )}
                      {out && <span className="product-out">{t('products.soldOut')}</span>}
                    </div>
                    <div className="product-info">
                      <span className="product-cat">{p.category_name ?? ''}</span>
                      <span className="product-name">{p.name}</span>
                      <span className="product-price">
                        {p.money_price != null && <span>{fmtTL(p.money_price)}</span>}
                        {p.coin_price != null && (
                          <span className="product-price-coin">
                            <Coins amount={p.coin_price} />
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <ProductDetail
            product={selected}
            coins={coins}
            defaultName={defaultName}
            onCoinsChange={onCoinsChange}
            onGoOrders={onGoOrders}
            onBack={() => setSelected(null)}
            toast={toast}
          />
        )}
      </div>
    </div>
  )
}

// Tek urun satin alma formu.
function ProductDetail({
  product,
  coins,
  defaultName,
  onCoinsChange,
  onGoOrders,
  onBack,
  toast,
}: {
  product: Product
  coins: number
  defaultName?: string
  onCoinsChange: (coins: number) => void
  onGoOrders: () => void
  onBack: () => void
  toast: ReturnType<typeof useToast>
}) {
  const { t } = useT()
  const colors: ProductColor[] = product.colors ?? []
  const [color, setColor] = useState<string | null>(colors[0]?.name ?? null)
  const [qty, setQty] = useState(1)
  const [pay, setPay] = useState<'coin' | 'money'>(product.money_price != null ? 'money' : 'coin')
  const [img, setImg] = useState(0)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState(defaultName ?? '')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postal, setPostal] = useState('')
  const [note, setNote] = useState('')

  const maxQty = Math.min(10, product.stock)
  const total = useMemo(() => {
    if (pay === 'coin') return product.coin_price != null ? product.coin_price * qty : 0
    return product.money_price != null ? product.money_price * qty : 0
  }, [pay, qty, product])

  const canCoin = product.coin_price != null
  const canMoney = product.money_price != null
  const formValid = name.trim() && phone.trim() && address.trim() && city.trim() && (colors.length === 0 || color)

  const submit = async () => {
    if (!formValid || busy) return
    setBusy(true)
    try {
      const res = await orderProduct({
        product_id: product.id,
        qty,
        color: colors.length ? color : null,
        payment_type: pay,
        ship_name: name.trim(),
        ship_phone: phone.trim(),
        ship_address: address.trim(),
        ship_city: city.trim(),
        ship_postal: postal.trim() || undefined,
        note: note.trim() || undefined,
      })
      if (res.kind === 'coin') {
        if (typeof res.coins === 'number') onCoinsChange(res.coins)
        toast.success(t('products.orderCoinOk'))
        onGoOrders()
      } else if (res.url) {
        // Kart ile odeme: imzali Garanti kart sayfasina yonlen.
        window.location.href = res.url
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('products.orderError')
      toast.error(msg || t('products.orderError'))
      setBusy(false)
    }
  }

  return (
    <div className="product-detail">
      <button type="button" className="checkout-back" onClick={onBack}>
        <Icon name="arrow-right" size={16} /> {t('products.back')}
      </button>

      <div className="product-detail-top">
        <div className="product-gallery">
          <div className="product-gallery-main">
            {product.images[img] ? (
              <img src={imageUrl(product.images[img])} alt={product.name} />
            ) : (
              <Icon name="shop" size={48} />
            )}
          </div>
          {product.images.length > 1 && (
            <div className="product-gallery-thumbs">
              {product.images.map((im, i) => (
                <button
                  key={i}
                  type="button"
                  className={`product-gallery-thumb ${i === img ? 'active' : ''}`}
                  onClick={() => setImg(i)}
                >
                  <img src={imageUrl(im)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-detail-info">
          <span className="product-cat">{product.category_name ?? ''}</span>
          <h2>{product.name}</h2>
          {product.description && <p className="product-desc">{product.description}</p>}

          {colors.length > 0 && (
            <div className="product-field">
              <label>{t('products.color')}</label>
              <div className="product-colors">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    title={c.name}
                    className={`product-swatch ${color === c.name ? 'active' : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => setColor(c.name)}
                    aria-label={c.name}
                  />
                ))}
              </div>
              {color && <span className="product-color-name">{color}</span>}
            </div>
          )}

          <div className="product-field">
            <label>{t('products.qty')}</label>
            <div className="product-qty">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1}>
                −
              </button>
              <span>{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty}>
                +
              </button>
            </div>
          </div>

          {canCoin && canMoney && (
            <div className="product-field">
              <label>{t('products.payWith')}</label>
              <div className="product-pay-toggle">
                <button
                  type="button"
                  className={pay === 'money' ? 'active' : ''}
                  onClick={() => setPay('money')}
                >
                  <Icon name="banknotes" size={16} /> {t('products.payMoney')}
                </button>
                <button
                  type="button"
                  className={pay === 'coin' ? 'active' : ''}
                  onClick={() => setPay('coin')}
                >
                  <Icon name="coins" size={16} /> {t('products.payCoin')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="product-shipping">
        <h3>{t('products.shipping')}</h3>
        <div className="product-form-grid">
          <label className="product-form-row">
            <span>{t('products.shipName')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </label>
          <label className="product-form-row">
            <span>{t('products.shipPhone')}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} inputMode="tel" />
          </label>
          <label className="product-form-row product-form-wide">
            <span>{t('products.shipAddress')}</span>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} maxLength={1000} />
          </label>
          <label className="product-form-row">
            <span>{t('products.shipCity')}</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} />
          </label>
          <label className="product-form-row">
            <span>{t('products.shipPostal')}</span>
            <input value={postal} onChange={(e) => setPostal(e.target.value)} maxLength={20} inputMode="numeric" />
          </label>
          <label className="product-form-row product-form-wide">
            <span>{t('products.note')}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
          </label>
        </div>
      </div>

      <div className="product-checkout-bar">
        <div className="product-total">
          <span>{t('products.total')}</span>
          <strong>
            {pay === 'coin' ? <Coins amount={total} /> : fmtTL(total)}
          </strong>
        </div>
        <Button onClick={submit} disabled={!formValid || busy || (pay === 'coin' && total > coins)}>
          {pay === 'coin' && total > coins ? t('products.needCoins') : t('products.placeOrder')}
        </Button>
      </div>
    </div>
  )
}
