import { useEffect, useMemo, useRef, useState } from 'react'
import './MagazaSwiss.css'
import { Icon } from './Icon'
import { Coins } from './Coins'
import { useCoinPackages } from '../useCoinPackages'
import { PLANS } from '../plans'
import { MEMBERSHIP_ITEM_ID, type CartItem } from './Cart'
import {
  getShopCatalog,
  getAddresses,
  getBankTransferInfo,
  validatePromo,
  cartCheckout,
  cartCoinOrder,
  buyMembership,
  isBankTransfer,
  type Product,
  type ProductColor,
  type Address,
  type BankInfo,
  type PromoResult,
  type PayMethod,
  type CheckoutResult,
} from '../api'

// Swiss-design TEK SAYFA mağaza — overlay/modal YOK; her şey (ürünler, ürün detayı,
// sepet, ödeme, sonuç, yasal metinler) aynı sayfanın doğal akışında. Metinler bu sayfaya
// özel Türkçe (bespoke storefront) — i18n'e bağlanmadı. Ödeme altyapısı tahsilat YAPMAZ:
// havale = IBAN talimatı, kart = PENDING sipariş (sahte "ödendi" mesajı YOK).

const PREMIUM_YEARLY_TL = PLANS.find((p) => p.id === 'premium')?.yearly ?? 499

const fmtTL = (n: number) =>
  `${n.toLocaleString('tr-TR', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })} ₺`
const fmtTLk = (kurus: number) => fmtTL(kurus / 100)
const imgUrl = (img?: string | null) => (img ? (/^(https?:|\/)/.test(img) ? img : '/uploads/' + img) : '')
const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

type Props = {
  user: { coins?: number | null } | null
  cartItems: CartItem[]
  setCartItems: (u: (prev: CartItem[]) => CartItem[]) => void
  onRequireAuth: () => void
  onManageAddresses: () => void
  onOrders: () => void
  onOpenCart: () => void // "Sepete git" -> eski Sepet modalı (inline sepet kaldırıldı)
  onCoinsChange?: (coins: number) => void
  onClose: () => void
  titleOverride?: string
  // URL-otoriter seçili ürün (/magaza/<kat>/<slug>). Verilince ürün DETAY SAYFASI (ayrı) açılır.
  productSlug?: string | null
  onSelectProduct?: (slug: string | null, category?: string | null) => void
}

type Result =
  | { kind: 'bank'; reference: string; amount: number; iban: string; name: string; bank: string; note?: string }
  | { kind: 'pending'; amount: number }
  | { kind: 'coin'; coins: number }

export default function MagazaSwiss({
  user,
  cartItems,
  setCartItems,
  onRequireAuth,
  onManageAddresses,
  onOrders,
  onOpenCart,
  onCoinsChange,
  onClose,
  productSlug,
  onSelectProduct,
}: Props) {
  const coinPackages = useCoinPackages()

  // --- Katalog ---
  const [products, setProducts] = useState<Product[] | null>(null)
  const [cats, setCats] = useState<{ slug: string; name: string }[]>([])
  const [loadErr, setLoadErr] = useState(false)
  useEffect(() => {
    let alive = true
    getShopCatalog()
      .then(({ products: list, categories }) => {
        if (!alive) return
        setProducts(list)
        const reserved = (s: string) => s === 'coin' || s === 'coins'
        const fromCats = categories.filter((c) => !reserved(c.slug)).map((c) => ({ slug: c.slug, name: c.name }))
        if (fromCats.length) setCats(fromCats)
        else {
          const seen: { slug: string; name: string }[] = []
          for (const p of list)
            if (p.category && !reserved(p.category) && !seen.some((c) => c.slug === p.category))
              seen.push({ slug: p.category, name: p.category_name || p.category })
          setCats(seen)
        }
      })
      .catch(() => alive && setLoadErr(true))
    return () => {
      alive = false
    }
  }, [])

  // --- Filtre + sıralama ---
  const [cat, setCat] = useState('all')
  const [sort, setSort] = useState<'default' | 'price-asc' | 'price-desc' | 'name'>('default')
  // Sıralama fiyatı: TL (kuruş) varsa onu; yoksa coin'i büyük ofsetle sona iter (karışık katalog
  // için naif ama küçük katalogda yeterli — ponytail).
  const priceOf = (p: Product) => (p.money_price != null ? p.money_price : p.coin_price != null ? 1e12 + p.coin_price : 1e15)
  // Tükenen ürünler (stok ≤ 0) seçili sıralamadan BAĞIMSIZ her zaman en sona (stable: eşit stokta
  // ikincil kriter korunur).
  const outRank = (p: Product) => (p.stock <= 0 ? 1 : 0)
  const visible = useMemo(() => {
    const list = (products ?? []).filter((p) => cat === 'all' || p.category === cat)
    const byOut = (a: Product, b: Product) => outRank(a) - outRank(b)
    if (sort === 'price-asc') return [...list].sort((a, b) => byOut(a, b) || priceOf(a) - priceOf(b))
    if (sort === 'price-desc') return [...list].sort((a, b) => byOut(a, b) || priceOf(b) - priceOf(a))
    if (sort === 'name') return [...list].sort((a, b) => byOut(a, b) || a.name.localeCompare(b.name, 'tr'))
    return [...list].sort(byOut)
  }, [products, cat, sort])

  // Seçili ürün = URL slug'ı (AYRI DETAY SAYFASI). Verilmezse grid görünür.
  const selectedProduct = productSlug ? (products ?? []).find((p) => p.slug === productSlug) ?? null : null

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' })
  }
  // Ürün detay sayfasını aç (URL /magaza/<kat>/<slug>). Detaya girince en üste çık.
  const openProduct = (p: Product) => {
    onSelectProduct?.(p.slug, p.category)
    window.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' })
  }

  // --- Sepete ekleme (inline geri bildirim) ---
  const [added, setAdded] = useState<Record<string, number>>({}) // key -> timestamp'siz sayaç
  const flashAdded = (key: string) => {
    setAdded((a) => ({ ...a, [key]: (a[key] ?? 0) + 1 }))
    window.setTimeout(() => setAdded((a) => ({ ...a, [key]: Math.max(0, (a[key] ?? 1) - 1) })), 2200)
  }

  const addProduct = (p: Product, opts?: { color?: string | null; qty?: number; pay?: 'coin' | 'money' }) => {
    if (!user) return onRequireAuth()
    if (p.stock <= 0) return
    const pay = opts?.pay ?? (p.money_price != null ? 'money' : 'coin')
    const color = opts?.color ?? p.colors?.[0]?.name ?? null
    const qty = opts?.qty ?? 1
    const id = `p:${p.id}:${color ?? ''}:${pay}`
    setCartItems((prev) => {
      const base = prev.filter((c) => c.kind !== 'membership')
      const ex = base.find((c) => c.id === id)
      if (ex) return base.map((c) => (c.id === id ? { ...c, qty: Math.min(10, c.qty + qty) } : c))
      return [
        ...base,
        {
          id,
          qty,
          kind: 'product',
          product: {
            id: p.id,
            name: p.name,
            image: p.images[0] ?? null,
            color,
            category: p.category,
            payment: pay,
            coinPrice: p.coin_price,
            moneyPrice: p.money_price,
          },
        },
      ]
    })
    flashAdded(`p${p.id}`)
  }

  // Jeton paketi ekleme KALDIRILDI (jeton satışı yok). coinPackages hâlâ gizli CartSection'a geçer.

  const addMembership = () => {
    if (!user) return onRequireAuth()
    setCartItems(() => [{ id: MEMBERSHIP_ITEM_ID, qty: 1, kind: 'membership' }])
    flashAdded('mem')
  }

  return (
    <div className="mgz">
      <button type="button" className="mgz-close" onClick={onClose} aria-label="Kapat">
        <Icon name="x" size={18} />
      </button>
      {/* Yüzen "Sepet" fab'ı KALDIRILDI (kullanıcı: "havada duruyor"): üst bardaki sepet ikonu
          (cartCount>0 iken görünür) zaten aynı sepeti açar — çift buton kafa karıştırıyordu. */}

      {selectedProduct ? (
        /* ÜRÜN DETAY SAYFASI — ayrı sayfa (satır-altı inline DEĞİL). */
        <ProductDetailPage
          product={selectedProduct}
          added={!!added[`p${selectedProduct.id}`]}
          onAdd={(o) => addProduct(selectedProduct, o)}
          onBuyNow={(o) => {
            addProduct(selectedProduct, o)
            onOpenCart()
          }}
          onBack={() => onSelectProduct?.(null)}
        />
      ) : (
        <>
      {/* PREMIUM ÜYELİK — BİRİNCİ SIRADA (kullanıcı isteği). */}
      <section className="mgz-mem" aria-label="Premium Üyelik">
        <div className="mgz-mem-inner">
          <div className="mgz-mem-text">
            <span className="mgz-mem-badge"><Icon name="crown" size={15} /> PREMIUM ÜYELİK</span>
            <h2 className="mgz-mem-title">Oyunu bir üst seviyeye taşı.</h2>
            <p className="mgz-mem-sub">
              Yapay zekâ, turnuvalar ve gelişmiş analizlerle tam erişim — bir yıl boyunca.
            </p>
            <ul className="mgz-mem-perks">
              <li><Icon name="check" size={15} /> Yapay Zeka ile Oyna</li>
              <li><Icon name="check" size={15} /> Online Turnuvalar</li>
              <li><Icon name="check" size={15} /> Ulusal Turnuva Takvimi</li>
              <li><Icon name="check" size={15} /> Pozisyon Analizi</li>
              <li><Icon name="check" size={15} /> Mat Analizi</li>
              <li><Icon name="check" size={15} /> Maç Analizleri</li>
              <li><Icon name="check" size={15} /> Kanıtlanabilir Adil Zar — Provably Fair</li>
              <li><Icon name="check" size={15} /> Detaylı Oyuncu İstatistikleri</li>
            </ul>
          </div>
          <div className="mgz-mem-cta">
            <span className="mgz-mem-ico"><Icon name="crown" size={40} /></span>
            <span className="mgz-mem-price tnum">{fmtTL(PREMIUM_YEARLY_TL)}</span>
            <span className="mgz-mem-per">/ yıl</span>
            {added['mem'] ? (
              <span className="mgz-added" role="status"><Icon name="check" size={14} /> Sepete eklendi</span>
            ) : (
              <button type="button" className="mgz-btn mgz-btn-lg mgz-mem-btn" onClick={addMembership}>
                Premium Satın Al <Icon name="arrow-right" size={16} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ÜRÜNLER */}
      <section id="urunler" className="mgz-section" aria-label="Ürünler">
        <div className="mgz-section-head">
          <div className="mgz-filters" role="tablist" aria-label="Kategori filtresi">
            <button
              type="button"
              role="tab"
              aria-selected={cat === 'all'}
              className={`mgz-chip ${cat === 'all' ? 'on' : ''}`}
              onClick={() => setCat('all')}
            >
              Tümü
            </button>
            {cats.map((c) => (
              <button
                key={c.slug}
                type="button"
                role="tab"
                aria-selected={cat === c.slug}
                className={`mgz-chip ${cat === c.slug ? 'on' : ''}`}
                onClick={() => setCat(c.slug)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <label className="mgz-sort">
            <span>Sırala</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sıralama">
              <option value="default">Önerilen</option>
              <option value="price-asc">Fiyat ↑</option>
              <option value="price-desc">Fiyat ↓</option>
              <option value="name">İsim (A–Z)</option>
            </select>
          </label>
        </div>

        {loadErr ? (
          <p className="mgz-note mgz-state">Ürünler yüklenemedi. Lütfen sayfayı yenile.</p>
        ) : !products ? (
          <div className="mgz-grid" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="mgz-cell">
                <div className="mgz-skel" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="mgz-state">
            <p className="mgz-note">{cat === 'all' ? 'Henüz ürün yok.' : 'Bu kategoride ürün bulunamadı.'}</p>
            {cat !== 'all' && (
              <button type="button" className="mgz-btn mgz-btn-sm" onClick={() => setCat('all')}>
                Tüm ürünler
              </button>
            )}
          </div>
        ) : null}

        <div className="mgz-grid">
          {visible.map((p) => {
            const out = p.stock <= 0
            return (
              <article key={p.id} className={`mgz-card ${out ? 'is-out' : ''}`}>
                <button
                  type="button"
                  className="mgz-card-media"
                  onClick={() => openProduct(p)}
                  aria-label={`${p.name} — ürün detayı`}
                >
                  {p.images[0] ? <img src={imgUrl(p.images[0])} alt={p.name} loading="lazy" /> : <Icon name="dice" size={40} />}
                  {out ? (
                    <span className="mgz-flag">Tükendi</span>
                  ) : (
                    p.stock <= 5 && <span className="mgz-flag mgz-flag-low">Son {p.stock}</span>
                  )}
                </button>
                <div className="mgz-card-body">
                  <span className="mgz-card-cat">{p.category_name ?? '—'}</span>
                  <button type="button" className="mgz-card-name" onClick={() => openProduct(p)}>
                    {p.name}
                  </button>
                  <div className="mgz-card-foot">
                    <span className="mgz-price tnum">
                      {fmtTLk(p.money_price ?? p.coin_price ?? 0)}
                    </span>
                    {added[`p${p.id}`] ? (
                      <span className="mgz-added" role="status">
                        <Icon name="check" size={14} /> Eklendi
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="mgz-card-add"
                        onClick={() => addProduct(p)}
                        disabled={out}
                        aria-label={`${p.name} sepete ekle`}
                      >
                        <Icon name="cart" size={13} /> {out ? 'Tükendi' : 'Sepete Ekle'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>
        </>
      )}

      {/* Jeton satışı YOK (kullanıcı: "jeton satmıyoruz") -> jeton bölümü kaldırıldı; Premium üyelik
          en üstte banner olarak. Hikâye bölümü de kaldırıldı. Inline Sepet bölümü CSS ile GİZLİ (.mgz-cart{display:none}) —
          kullanıcı isteğiyle sayfadan çıkarıldı; sepet/ödeme "Sepete git" fab'ı ile eski Sepet
          modalında (SEPETİM) yapılır (onOpenCart). Render korunur ki checkout mantığı/tipler
          "kullanılıyor" kalsın (ponytail: gizleme < büyük söküm; çöp temizliği gerekirse CartSection
          + yalnız-onun import'ları sökülür). */}
      <CartSection
        items={cartItems}
        setItems={setCartItems}
        coinPackages={coinPackages}
        user={user}
        onRequireAuth={onRequireAuth}
        onManageAddresses={onManageAddresses}
        onOrders={onOrders}
        onCoinsChange={onCoinsChange}
        onContinue={() => scrollTo('urunler')}
      />
    </div>
  )
}

// ---- ÜRÜN DETAY SAYFASI (ayrı sayfa — satır-altı inline DEĞİL) ----
function ProductDetailPage({
  product,
  added,
  onAdd,
  onBuyNow,
  onBack,
}: {
  product: Product
  added: boolean
  onAdd: (o: { color?: string | null; qty?: number; pay?: 'coin' | 'money' }) => void
  onBuyNow: (o: { color?: string | null; qty?: number; pay?: 'coin' | 'money' }) => void
  onBack: () => void
}) {
  const colors: ProductColor[] = product.colors ?? []
  const [color, setColor] = useState<string | null>(colors[0]?.name ?? null)
  const [qty, setQty] = useState(1)
  const [pay] = useState<'coin' | 'money'>(product.money_price != null ? 'money' : 'coin')
  const [img, setImg] = useState(0)
  const [err, setErr] = useState('')

  const out = product.stock <= 0
  const maxQty = Math.min(10, product.stock)
  const canMoney = product.money_price != null
  const hasImg = product.images.length > 0

  const validate = () => {
    if (colors.length > 0 && !color) {
      setErr('Lütfen bir renk seç.')
      return false
    }
    setErr('')
    return true
  }
  const opts = () => ({ color: colors.length ? color : null, qty, pay })
  const add = () => validate() && onAdd(opts())
  const buy = () => validate() && onBuyNow(opts())

  return (
    <section className="mgz-pdp" aria-label={`${product.name} ürün detayı`}>
      <button type="button" className="mgz-pdp-back" onClick={onBack}>
        <Icon name="caret-left" size={16} /> Mağazaya dön
      </button>

      <div className="mgz-pdp-grid">
        {/* Medya galerisi */}
        <div className="mgz-pdp-media">
          <div className="mgz-pdp-main">
            {hasImg ? <img src={imgUrl(product.images[img])} alt={product.name} /> : <Icon name="dice" size={96} />}
            {out && <span className="mgz-flag">Tükendi</span>}
          </div>
          {product.images.length > 1 && (
            <div className="mgz-pdp-thumbs">
              {product.images.map((im, i) => (
                <button
                  key={i}
                  type="button"
                  className={`mgz-pdp-thumb ${i === img ? 'on' : ''}`}
                  onClick={() => setImg(i)}
                  aria-label={`${product.name} görsel ${i + 1}`}
                >
                  <img src={imgUrl(im)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bilgi + satın alma */}
        <div className="mgz-pdp-info">
          {product.category_name && <span className="mgz-eyebrow">{product.category_name}</span>}
          <h1 className="mgz-pdp-title">{product.name}</h1>
          <div className="mgz-pdp-price tnum">
            {fmtTLk(canMoney ? product.money_price! : product.coin_price ?? 0)}
            {canMoney && product.category !== 'kitap' && <span className="mgz-vat-inline"> · %20 KDV dahil</span>}
          </div>
          <div className={`mgz-stock ${out ? 'out' : product.stock <= 5 ? 'low' : 'in'}`}>
            <span aria-hidden="true" />
            {out ? 'Tükendi' : `Stokta ${product.stock} adet`}
          </div>
          {product.description && <p className="mgz-pdp-desc">{product.description}</p>}

          {colors.length > 0 && (
            <div className="mgz-field">
              <label className="mgz-flabel">
                Renk {color && <span>· {color}</span>}
              </label>
              <div className="mgz-swatches">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    title={c.name}
                    className={`mgz-swatch ${color === c.name ? 'on' : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => setColor(c.name)}
                    aria-label={c.name}
                    aria-pressed={color === c.name}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mgz-field">
            <label className="mgz-flabel">Adet</label>
            <div className="mgz-qty">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="azalt">
                −
              </button>
              <span className="tnum">{qty}</span>
              <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="arttır">
                +
              </button>
            </div>
          </div>

          {err && <p className="mgz-err">{err}</p>}

          <div className="mgz-pdp-actions">
            {added ? (
              <span className="mgz-added mgz-added-lg" role="status">
                <Icon name="check" size={16} /> Sepete eklendi
              </span>
            ) : (
              <button type="button" className="mgz-btn mgz-btn-lg" onClick={add} disabled={out}>
                <Icon name="cart" size={16} /> {out ? 'Tükendi' : 'Sepete Ekle'}
              </button>
            )}
            <button type="button" className="mgz-btn mgz-btn-lg mgz-pdp-buy" onClick={buy} disabled={out}>
              Hemen Satın Al <Icon name="arrow-right" size={16} />
            </button>
          </div>

          <ul className="mgz-pdp-trust">
            <li><Icon name="shield-check" size={16} /> Güvenli ödeme</li>
            <li><Icon name="package" size={16} /> 1–3 iş günü kargo</li>
            <li><Icon name="check" size={16} /> 14 gün içinde iade</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

// ---- Sepet + ödeme bölümü (akış içinde) ----
function CartSection({
  items,
  setItems,
  coinPackages,
  user,
  onRequireAuth,
  onManageAddresses,
  onOrders,
  onCoinsChange,
  onContinue,
}: {
  items: CartItem[]
  setItems: (u: (prev: CartItem[]) => CartItem[]) => void
  coinPackages: ReturnType<typeof useCoinPackages>
  user: { coins?: number | null } | null
  onRequireAuth: () => void
  onManageAddresses: () => void
  onOrders: () => void
  onCoinsChange?: (coins: number) => void
  onContinue: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [code, setCode] = useState('')
  const [applied, setApplied] = useState<PromoResult | null>(null)
  const [promoErr, setPromoErr] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)

  const [addresses, setAddresses] = useState<Address[]>([])
  const [shipId, setShipId] = useState<number | null>(null)
  const [billId, setBillId] = useState<number | null>(null)
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null)
  const [payMethod, setPayMethod] = useState<PayMethod>('card')

  const memItem = items.find((i) => i.kind === 'membership')
  const coinRows = items
    .map((it) => ({ it, pkg: coinPackages.find((p) => p.id === it.id) }))
    .filter((r): r is { it: CartItem; pkg: NonNullable<typeof r.pkg> } => !!r.pkg && (r.it.kind === 'coins' || r.it.kind === undefined))
  const productRows = items.filter((i) => i.kind === 'product' && i.product)
  const hasProducts = productRows.length > 0

  const shippingAddrs = useMemo(() => addresses.filter((a) => a.type === 'shipping'), [addresses])
  const billingAddrs = useMemo(() => addresses.filter((a) => a.type === 'billing'), [addresses])

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

  const packagesTL = coinRows.reduce((s, r) => s + r.pkg.price * r.it.qty, 0)
  const totalCoinsPkg = coinRows.reduce((s, r) => s + r.pkg.gc * r.it.qty, 0)
  const moneyProductRows = productRows.filter((i) => i.product!.payment === 'money')
  const coinProductRows = productRows.filter((i) => i.product!.payment === 'coin')
  const moneyProductsTL = moneyProductRows.reduce((s, i) => s + ((i.product!.moneyPrice ?? 0) / 100) * i.qty, 0)
  const coinProductsCoins = coinProductRows.reduce((s, i) => s + (i.product!.coinPrice ?? 0) * i.qty, 0)
  const moneyTotalTL = packagesTL + moneyProductsTL
  const discountTL = applied ? applied.discount / 100 : 0
  const finalTL = Math.max(0, moneyTotalTL - discountTL)
  const bookTL = moneyProductRows
    .filter((i) => i.product!.category === 'kitap')
    .reduce((s, i) => s + ((i.product!.moneyPrice ?? 0) / 100) * i.qty, 0)
  const vatTL = (Math.max(0, finalTL - bookTL) * 20) / 120

  const nothing = !memItem && coinRows.length === 0 && productRows.length === 0
  const shippingRequired = hasProducts && !shipId
  const totalItems = memItem ? 1 : coinRows.reduce((s, r) => s + r.it.qty, 0) + productRows.reduce((s, i) => s + i.qty, 0)

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
      const r = await validatePromo(items.filter((i) => i.kind === 'coins' || i.kind === undefined), c)
      setApplied(r)
      setCode('')
    } catch (e) {
      setApplied(null)
      setPromoErr((e as { message?: string })?.message || 'İndirim kodu geçersiz.')
    } finally {
      setPromoBusy(false)
    }
  }

  const resultRef = useRef<HTMLDivElement>(null)
  const show = (r: Result) => {
    setResult(r)
    window.setTimeout(
      () => resultRef.current?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' }),
      40,
    )
  }
  const handleCheckoutResult = (r: CheckoutResult) => {
    if (isBankTransfer(r)) {
      show({ kind: 'bank', reference: r.reference, amount: r.amount, iban: r.iban, name: r.name, bank: r.bank, note: r.note })
    } else {
      show({ kind: 'pending', amount: r.amount })
    }
  }

  async function checkout() {
    if (nothing || busy) return
    if (!user) return onRequireAuth()
    if (shippingRequired) {
      setErr('Lütfen bir teslimat adresi seç (ya da ekle).')
      return
    }
    setErr('')
    setBusy(true)
    try {
      const moneyDue = !!memItem || moneyTotalTL > 0
      const method: PayMethod = moneyDue ? payMethod : 'card'

      if (memItem) {
        const r = await buyMembership(method)
        setItems((prev) => prev.filter((i) => i.kind !== 'membership'))
        handleCheckoutResult(r)
        return
      }

      // Coin ödemeli ürünler -> anında sipariş (atomik).
      let coinsAfter: number | null = null
      if (coinProductRows.length) {
        const lines = coinProductRows.map((i) => ({ product_id: i.product!.id, qty: i.qty, color: i.product!.color ?? null }))
        const r = await cartCoinOrder(lines, shipId as number, billId, undefined, crypto.randomUUID())
        coinsAfter = r.coins
        onCoinsChange?.(r.coins)
        setItems((prev) => prev.filter((i) => !(i.kind === 'product' && i.product?.payment === 'coin')))
      }

      // Para kısmı (coin paketleri + para-ürünleri) -> tek ödeme.
      if (coinRows.length || moneyProductRows.length) {
        const r = await cartCheckout({
          coin_items: coinRows.map((r) => ({ id: r.it.id, qty: r.it.qty })),
          products: moneyProductRows.map((i) => ({ product_id: i.product!.id, qty: i.qty, color: i.product!.color ?? null })),
          shipping_address_id: shipId,
          billing_address_id: billId,
          code: applied?.code ?? null,
          method,
        })
        setItems((prev) =>
          prev.filter((i) => !(i.kind === 'coins' || i.kind === undefined) && !(i.kind === 'product' && i.product?.payment === 'money')),
        )
        handleCheckoutResult(r)
      } else if (coinsAfter != null) {
        show({ kind: 'coin', coins: coinsAfter })
      }
    } catch (e) {
      setErr((e as { message?: string })?.message || 'Ödeme başlatılamadı.')
    } finally {
      setBusy(false)
    }
  }

  const ctaLabel = memItem || moneyTotalTL > 0 ? 'Ödemeye Geç' : 'Siparişi Tamamla'

  return (
    <section id="sepet" className="mgz-section mgz-cart" aria-label="Sepet ve ödeme">
      <h2 className="mgz-h2">
        <span className="mgz-idx">03</span> Sepet
        {!nothing && <span className="mgz-cart-count">{totalItems} ürün</span>}
      </h2>

      {nothing ? (
        <div className="mgz-cart-empty">
          <p>Sepetin boş.</p>
          <button type="button" className="mgz-btn" onClick={onContinue}>
            Ürünlere dön <Icon name="arrow-right" size={16} />
          </button>
        </div>
      ) : (
        <div className="mgz-cart-grid">
          <div className="mgz-cart-items">
            {memItem && (
              <div className="mgz-ci">
                <span className="mgz-ci-ico">
                  <Icon name="crown" size={22} />
                </span>
                <div className="mgz-ci-info">
                  <b>1 Yıllık Premium Üyelik</b>
                  <span>Üyelik bitişine +1 yıl eklenir</span>
                </div>
                <span className="mgz-ci-price tnum">{fmtTL(PREMIUM_YEARLY_TL)}</span>
                <button type="button" className="mgz-ci-del" onClick={() => setItems((p) => p.filter((i) => i.kind !== 'membership'))} aria-label="kaldır">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            )}

            {!memItem &&
              coinRows.map(({ it, pkg }) => (
                <div className="mgz-ci" key={it.id}>
                  <span className="mgz-ci-ico">
                    <Icon name="coin" size={22} />
                  </span>
                  <div className="mgz-ci-info">
                    <b>{pkg.name}</b>
                    <span>{pkg.gc.toLocaleString('tr-TR')} jeton</span>
                  </div>
                  <Stepper qty={it.qty} onChange={(q) => setQty(it.id, q)} />
                  <span className="mgz-ci-price tnum">{fmtTL(pkg.price * it.qty)}</span>
                  <button type="button" className="mgz-ci-del" onClick={() => remove(it.id)} aria-label="kaldır">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}

            {!memItem &&
              productRows.map((it) => {
                const p = it.product!
                return (
                  <div className="mgz-ci" key={it.id}>
                    <span className="mgz-ci-ico">
                      {p.image ? <img src={imgUrl(p.image)} alt="" /> : <Icon name="package" size={20} />}
                    </span>
                    <div className="mgz-ci-info">
                      <b>{p.name}</b>
                      <span>{p.color ? `Renk: ${p.color}` : '—'}</span>
                    </div>
                    <Stepper qty={it.qty} onChange={(q) => setQty(it.id, q)} />
                    <span className="mgz-ci-price tnum">
                      {p.payment === 'coin' ? (
                        <Coins amount={(p.coinPrice ?? 0) * it.qty} size={14} />
                      ) : (
                        fmtTL(((p.moneyPrice ?? 0) / 100) * it.qty)
                      )}
                    </span>
                    <button type="button" className="mgz-ci-del" onClick={() => remove(it.id)} aria-label="kaldır">
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                )
              })}

            <button type="button" className="mgz-cart-continue" onClick={onContinue}>
              <Icon name="caret-left" size={14} /> Alışverişe devam et
            </button>
          </div>

          <aside className="mgz-summary">
            <h3 className="mgz-h3">Özet</h3>

            {hasProducts && (
              <div className="mgz-sum-block">
                <label className="mgz-flabel">Teslimat adresi</label>
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
                  <span className="mgz-note">Kayıtlı adres yok</span>
                )}
                <label className="mgz-flabel">Fatura adresi</label>
                <select value={billId ?? ''} onChange={(e) => setBillId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Teslimat ile aynı</option>
                  {billingAddrs.map((a) => (
                    <option key={a.id} value={a.id}>
                      {(a.title ? a.title + ' — ' : '') + (a.company || a.name) + ', ' + a.city}
                    </option>
                  ))}
                </select>
                <button type="button" className="mgz-addr-link" onClick={onManageAddresses}>
                  <Icon name="pin" size={13} /> Adres ekle / yönet
                </button>
              </div>
            )}

            {!memItem && coinRows.length > 0 && (
              <div className="mgz-sum-block">
                {applied ? (
                  <div className="mgz-promo-ok">
                    <Icon name="check" size={14} /> <b>{applied.code}</b>
                    <span className="tnum">−{fmtTL(discountTL)}</span>
                    <button type="button" onClick={clearPromo} aria-label="kodu kaldır">
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="mgz-promo">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="İndirim kodu"
                      aria-label="İndirim kodu"
                      onKeyDown={(e) => e.key === 'Enter' && applyPromo()}
                    />
                    <button type="button" className="mgz-btn mgz-btn-sm" disabled={promoBusy || !code.trim()} onClick={applyPromo}>
                      Uygula
                    </button>
                  </div>
                )}
                {promoErr && <p className="mgz-err">{promoErr}</p>}
              </div>
            )}

            <div className="mgz-sum-rows">
              {memItem ? (
                <div className="mgz-sum-row mgz-sum-total">
                  <span>Toplam</span>
                  <span className="tnum">{fmtTL(PREMIUM_YEARLY_TL)}</span>
                </div>
              ) : (
                <>
                  {coinProductRows.length > 0 && (
                    <div className="mgz-sum-row">
                      <span>Jeton ile</span>
                      <Coins amount={coinProductsCoins} size={14} />
                    </div>
                  )}
                  {moneyTotalTL > 0 && (
                    <div className="mgz-sum-row">
                      <span>Ara toplam{totalCoinsPkg > 0 ? ` · ${totalCoinsPkg.toLocaleString('tr-TR')} jeton` : ''}</span>
                      <span className="tnum">{fmtTL(moneyTotalTL)}</span>
                    </div>
                  )}
                  {applied && (
                    <div className="mgz-sum-row mgz-sum-disc">
                      <span>İndirim · {applied.code}</span>
                      <span className="tnum">−{fmtTL(discountTL)}</span>
                    </div>
                  )}
                  {vatTL > 0 && (
                    <div className="mgz-sum-row mgz-sum-vat">
                      <span>KDV (%20 dahil){bookTL > 0 ? ' · kitaplar hariç' : ''}</span>
                      <span className="tnum">{fmtTL(vatTL)}</span>
                    </div>
                  )}
                  {moneyTotalTL > 0 && (
                    <div className="mgz-sum-row mgz-sum-total">
                      <span>Ödenecek</span>
                      <span className="tnum">{fmtTL(finalTL)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {(memItem || moneyTotalTL > 0) && bankInfo?.enabled && (
              <div className="mgz-sum-block" role="radiogroup" aria-label="Ödeme yöntemi">
                <label className="mgz-flabel">Ödeme yöntemi</label>
                <button
                  type="button"
                  role="radio"
                  aria-checked={payMethod === 'card'}
                  className={`mgz-pm ${payMethod === 'card' ? 'on' : ''}`}
                  onClick={() => setPayMethod('card')}
                >
                  <Icon name="credit-card" size={16} /> Kredi / Banka Kartı
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={payMethod === 'bank_transfer'}
                  className={`mgz-pm ${payMethod === 'bank_transfer' ? 'on' : ''}`}
                  onClick={() => setPayMethod('bank_transfer')}
                >
                  <Icon name="money" size={16} /> Havale / EFT
                </button>
              </div>
            )}

            {err && <p className="mgz-err" role="alert">{err}</p>}

            <button type="button" className="mgz-btn mgz-btn-lg mgz-checkout" disabled={busy || shippingRequired} onClick={checkout}>
              <Icon name={memItem || moneyTotalTL > 0 ? 'lock' : 'check'} size={16} /> {busy ? 'İşleniyor…' : ctaLabel}
            </button>
            <p className="mgz-secure">
              <Icon name="shield-check" size={13} />{' '}
              {memItem || moneyTotalTL > 0
                ? payMethod === 'bank_transfer' && bankInfo?.enabled
                  ? 'Havale/EFT bilgileri aşağıda; ödemen onaylanınca işleme alınır.'
                  : 'Siparişin kaydedilir; ödeme onayı sonrası işleme alınır.'
                : 'Jeton ürünleri anında hesabından düşülür.'}
            </p>
          </aside>
        </div>
      )}

      {/* Ödeme sonucu — akış içinde (overlay YOK). Sahte "ödendi" yok. */}
      {result && (
        <div className="mgz-result" ref={resultRef} role="status">
          {result.kind === 'bank' && (
            <>
              <h3 className="mgz-h3">
                <Icon name="money" size={18} /> Havale / EFT Talimatı
              </h3>
              <p className="mgz-result-lead">
                Aşağıdaki hesaba <b>{fmtTLk(result.amount)}</b> gönder. <b>Açıklama</b> kısmına referans numaranı yaz —
                ödemeni bununla eşleştiriyoruz. Onaylanınca siparişin işleme alınır.
              </p>
              <dl className="mgz-bank">
                <div>
                  <dt>Tutar</dt>
                  <dd className="tnum">{fmtTLk(result.amount)}</dd>
                </div>
                <div>
                  <dt>IBAN</dt>
                  <dd className="mgz-mono">{result.iban}</dd>
                </div>
                {result.name && (
                  <div>
                    <dt>Hesap sahibi</dt>
                    <dd>{result.name}</dd>
                  </div>
                )}
                {result.bank && (
                  <div>
                    <dt>Banka</dt>
                    <dd>{result.bank}</dd>
                  </div>
                )}
                <div>
                  <dt>Açıklama (referans)</dt>
                  <dd className="mgz-mono">{result.reference}</dd>
                </div>
              </dl>
              {result.note && <p className="mgz-note">{result.note}</p>}
            </>
          )}
          {result.kind === 'pending' && (
            <>
              <h3 className="mgz-h3">
                <Icon name="check" size={18} /> Siparişin alındı
              </h3>
              <p className="mgz-result-lead">
                <b>{fmtTLk(result.amount)}</b> tutarındaki siparişin kaydedildi. Ödeme henüz tahsil edilmedi; onaylanınca
                işleme alınır. Durumu “Siparişlerim”den takip edebilirsin.
              </p>
            </>
          )}
          {result.kind === 'coin' && (
            <>
              <h3 className="mgz-h3">
                <Icon name="check" size={18} /> Siparişin alındı
              </h3>
              <p className="mgz-result-lead">
                Jeton ürünlerin işlendi; güncel bakiyen <b>{result.coins.toLocaleString('tr-TR')}</b> jeton.
              </p>
            </>
          )}
          <button type="button" className="mgz-btn" onClick={onOrders}>
            Siparişlerim <Icon name="arrow-right" size={16} />
          </button>
        </div>
      )}
    </section>
  )
}

function Stepper({ qty, onChange }: { qty: number; onChange: (q: number) => void }) {
  return (
    <div className="mgz-qty mgz-qty-sm" aria-label="adet">
      <button type="button" onClick={() => onChange(qty - 1)} aria-label="azalt">
        −
      </button>
      <span className="tnum">{qty}</span>
      <button type="button" onClick={() => onChange(qty + 1)} aria-label="arttır">
        +
      </button>
    </div>
  )
}
