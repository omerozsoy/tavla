import { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { useToast } from './Toast'
import { Coins } from './Coins'
import { getProducts, type Product, type ProductColor } from '../api'

// Sepete eklenecek ürün satırı (App bunu CartItem'a çevirir).
export interface CartAddLine {
  productId: number
  name: string
  image?: string | null
  color?: string | null
  payment: 'coin' | 'money'
  coinPrice?: number | null
  moneyPrice?: number | null // kurus
  qty: number
}

function imageUrl(img: string): string {
  return /^(https?:|\/)/.test(img) ? img : '/uploads/' + img
}
const fmtTL = (kurus: number) =>
  `${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`

// Fiziksel urun magazasi — GÖMÜLEBİLİR içerik (Mağaza sekmesi olarak). Overlay YOK.
// grid -> secili urun detayi (renk + adet + odeme yontemi) -> SEPETE EKLE.
// Teslimat/fatura adresi sepet/odeme adiminda secilir (Adreslerim).
export function ProductsInner({
  onAddToCart,
  onGoCart,
  products: productsProp,
  category,
  onCategories,
}: {
  onAddToCart: (line: CartAddLine) => void
  onGoCart: () => void
  products?: Product[] | null // dışarıdan verilirse fetch etme (Mağaza kategori sekmeleri)
  category?: string // dış kategori filtresi -> iç kategori çipleri gizlenir
  onCategories?: (cats: { slug: string; name: string }[]) => void
}) {
  const { t } = useT()
  const toast = useToast()

  const [fetched, setFetched] = useState<Product[] | null>(null)
  const products = productsProp !== undefined ? productsProp : fetched
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<Product | null>(null)
  const [cat, setCat] = useState<string>('all')

  useEffect(() => {
    if (productsProp !== undefined) return
    getProducts()
      .then(setFetched)
      .catch(() => setError(true))
  }, [productsProp])

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
  const onCatsRef = useRef(onCategories)
  useEffect(() => {
    onCatsRef.current = onCategories
  }, [onCategories])
  useEffect(() => {
    if (onCatsRef.current) onCatsRef.current(cats.map((c) => ({ slug: c, name: catNames[c] ?? c })))
  }, [cats, catNames])
  const activeCat = category ?? cat
  const visible = useMemo(
    () => (products ?? []).filter((p) => activeCat === 'all' || p.category === activeCat),
    [products, activeCat],
  )

  if (selected) {
    return <ProductDetail product={selected} onAddToCart={onAddToCart} onGoCart={onGoCart} onBack={() => setSelected(null)} toast={toast} />
  }

  return (
    <section className="products-inner">
      {!category && cats.length > 1 && (
        <div className="products-cats" role="tablist">
          <button type="button" className={`products-cat-chip ${cat === 'all' ? 'active' : ''}`} onClick={() => setCat('all')}>
            {t('products.all')}
          </button>
          {cats.map((c) => (
            <button key={c} type="button" className={`products-cat-chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
              {catLabel(c)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="products-msg">{t('products.loadError')}</p>}
      {!error && products && products.length === 0 && <p className="products-msg">{t('products.empty')}</p>}

      <div className="products-grid">
        {visible.map((p) => {
          const out = p.stock <= 0
          return (
            <button key={p.id} type="button" className="product-card" disabled={out} onClick={() => setSelected(p)}>
              <div className="product-thumb">
                {p.images[0] ? <img src={imageUrl(p.images[0])} alt={p.name} /> : <Icon name="shop" size={32} />}
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
    </section>
  )
}

// Bağımsız (deep-link /urunler) sarmalayıcı: overlay + kapat + gömülü içerik.
export default function Products({
  onAddToCart,
  onGoCart,
  onClose,
}: {
  onAddToCart: (line: CartAddLine) => void
  onGoCart: () => void
  onClose: () => void
}) {
  const { t } = useT()
  useEscape(onClose)
  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card products-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <div className="products-head">
          <div>
            <h2>
              <Icon name="shop" size={20} /> {t('products.title')}
            </h2>
            <p className="register-sub">{t('products.sub')}</p>
          </div>
          <Button variant="outline" onClick={onGoCart} title={t('shop.cart')}>
            <Icon name="cart" size={16} /> {t('shop.cart')}
          </Button>
        </div>
        <ProductsInner onAddToCart={onAddToCart} onGoCart={onGoCart} />
      </div>
    </div>
  )
}

// Tek urun: renk + adet + odeme yontemi secip SEPETE EKLE.
function ProductDetail({
  product,
  onAddToCart,
  onGoCart,
  onBack,
  toast,
}: {
  product: Product
  onAddToCart: (line: CartAddLine) => void
  onGoCart: () => void
  onBack: () => void
  toast: ReturnType<typeof useToast>
}) {
  const { t } = useT()
  const colors: ProductColor[] = product.colors ?? []
  const [color, setColor] = useState<string | null>(colors[0]?.name ?? null)
  const [qty, setQty] = useState(1)
  const [pay, setPay] = useState<'coin' | 'money'>(product.money_price != null ? 'money' : 'coin')
  const [img, setImg] = useState(0)
  const [added, setAdded] = useState(false)

  const maxQty = Math.min(10, product.stock)
  const canCoin = product.coin_price != null
  const canMoney = product.money_price != null
  const valid = colors.length === 0 || !!color

  const add = () => {
    if (!valid) {
      toast.error(t('products.pickColor'))
      return
    }
    onAddToCart({
      productId: product.id,
      name: product.name,
      image: product.images[0] ?? null,
      color: colors.length ? color : null,
      payment: pay,
      coinPrice: product.coin_price,
      moneyPrice: product.money_price,
      qty,
    })
    setAdded(true)
    toast.success(t('products.addedToCart'))
  }

  return (
    <div className="product-detail">
      <button type="button" className="checkout-back" onClick={onBack}>
        <Icon name="arrow-right" size={16} /> {t('products.back')}
      </button>

      <div className="product-detail-top">
        <div className="product-gallery">
          <div className="product-gallery-main">
            {product.images[img] ? <img src={imageUrl(product.images[img])} alt={product.name} /> : <Icon name="shop" size={48} />}
          </div>
          {product.images.length > 1 && (
            <div className="product-gallery-thumbs">
              {product.images.map((im, i) => (
                <button key={i} type="button" className={`product-gallery-thumb ${i === img ? 'active' : ''}`} onClick={() => setImg(i)}>
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
          <div className="product-detail-price">
            {canMoney && <span className="pd-price">{fmtTL(product.money_price!)}</span>}
            {canCoin && (
              <span className="pd-price-coin">
                <Coins amount={product.coin_price!} size={16} />
              </span>
            )}
          </div>

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
                <button type="button" className={pay === 'money' ? 'active' : ''} onClick={() => setPay('money')}>
                  <Icon name="banknotes" size={16} /> {t('products.payMoney')}
                </button>
                <button type="button" className={pay === 'coin' ? 'active' : ''} onClick={() => setPay('coin')}>
                  <Icon name="coins" size={16} /> {t('products.payCoin')}
                </button>
              </div>
            </div>
          )}

          <div className="product-detail-actions">
            <Button onClick={add}>
              <Icon name="shop" size={16} /> {t('products.addToCart')}
            </Button>
            {added && (
              <Button variant="outline" onClick={onGoCart}>
                {t('products.goToCart')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
