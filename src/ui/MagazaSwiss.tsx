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
  onCoinsChange?: (coins: number) => void
  onClose: () => void
  titleOverride?: string
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
  onCoinsChange,
  onClose,
  titleOverride,
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

  // --- Filtre + seçili ürün (inline detay) ---
  const [cat, setCat] = useState('all')
  const [selId, setSelId] = useState<number | null>(null)
  const visible = useMemo(
    () => (products ?? []).filter((p) => cat === 'all' || p.category === cat),
    [products, cat],
  )
  useEffect(() => {
    setSelId(null)
  }, [cat])

  // --- Grid sütun sayısı (satır-altı detay yerleşimi için) ---
  const gridRef = useRef<HTMLDivElement>(null)
  const [cols, setCols] = useState(1)
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const tpl = getComputedStyle(el).gridTemplateColumns
      setCols(Math.max(1, tpl.split(' ').filter(Boolean).length))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [visible.length])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'start' })
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

  const addCoinPkg = (pkgId: string) => {
    if (!user) return onRequireAuth()
    setCartItems((prev) => {
      const base = prev.filter((c) => c.kind !== 'membership')
      const ex = base.find((c) => c.id === pkgId)
      return ex
        ? base.map((c) => (c.id === pkgId ? { ...c, qty: c.qty + 1 } : c))
        : [...base, { id: pkgId, qty: 1 }]
    })
    flashAdded(`c${pkgId}`)
  }

  const addMembership = () => {
    if (!user) return onRequireAuth()
    setCartItems(() => [{ id: MEMBERSHIP_ITEM_ID, qty: 1, kind: 'membership' }])
    flashAdded('mem')
  }

  const cartCount = cartItems.reduce((s, c) => s + c.qty, 0)

  return (
    <div className="mgz">
      <button type="button" className="mgz-close" onClick={onClose} aria-label="Kapat">
        <Icon name="x" size={18} />
      </button>

      {/* 1 — ÜST MENÜ */}
      <header className="mgz-nav">
        <a
          className="mgz-logo"
          href="#ust"
          onClick={(e) => {
            e.preventDefault()
            scrollTo('ust')
          }}
        >
          TAVLA<span className="mgz-logo-dot">.</span>
        </a>
        <nav className="mgz-nav-links" aria-label="Sayfa bölümleri">
          {[
            ['urunler', 'Ürünler'],
            ['hikaye', 'Hikâye'],
            ['sepet', 'Sepet'],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault()
                scrollTo(id)
              }}
            >
              {label}
            </a>
          ))}
        </nav>
        <button type="button" className="mgz-cart-pill" onClick={() => scrollTo('sepet')} aria-label="Sepete git">
          <Icon name="cart" size={16} />
          <span className="tnum">{cartCount}</span>
        </button>
      </header>

      <span id="ust" className="mgz-anchor" aria-hidden="true" />

      {/* 2 — GİRİŞ / HERO */}
      <section className="mgz-hero" aria-label="Giriş">
        <div className="mgz-hero-text">
          <p className="mgz-eyebrow">TAVLATV · SEÇKİN TAVLA ATÖLYESİ</p>
          <h1 className="mgz-hero-title">
            {titleOverride || (
              <>
                Oyun,
                <br />
                bir <em>tasarım</em>
                <br />
                nesnesidir.
              </>
            )}
          </h1>
          <p className="mgz-hero-sub">
            Elde bitirilmiş tavlalar, ağırlıklı zarlar, meşe zar kuleleri ve usta işi kitaplar. Her parça; denge,
            oran ve dokunuşun İsviçre disiplininde buluştuğu bir seçki.
          </p>
          <button className="mgz-btn mgz-btn-xl" onClick={() => scrollTo('urunler')}>
            Alışverişe Başla <Icon name="arrow-right" size={18} />
          </button>
        </div>
        <div className="mgz-hero-media" aria-hidden="true">
          {(() => {
            const heroImg = (products ?? []).find((p) => p.images?.[0])?.images[0]
            return heroImg ? (
              <img src={imgUrl(heroImg)} alt="" />
            ) : (
              <span className="mgz-hero-ph">
                <Icon name="dice" size={120} />
              </span>
            )
          })()}
          <span className="mgz-hero-tag">EST. KOLEKSİYON</span>
        </div>
      </section>

      {/* 3 — ÜRÜNLER */}
      <section id="urunler" className="mgz-section" aria-label="Ürünler">
        <div className="mgz-section-head">
          <h2 className="mgz-h2">
            <span className="mgz-idx">01</span> Ürünler
          </h2>
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
        </div>

        {loadErr && <p className="mgz-note">Ürünler yüklenemedi. Lütfen sayfayı yenile.</p>}
        {!loadErr && products && visible.length === 0 && <p className="mgz-note">Bu kategoride henüz ürün yok.</p>}
        {!products && !loadErr && <p className="mgz-note">Yükleniyor…</p>}

        <div className="mgz-grid" ref={gridRef}>
          {visible.map((p, i) => {
            const out = p.stock <= 0
            const open = selId === p.id
            const isRowEnd = i % cols === cols - 1 || i === visible.length - 1
            const selIndex = visible.findIndex((x) => x.id === selId)
            const detailRowEnd =
              selIndex >= 0 && Math.floor(i / cols) === Math.floor(selIndex / cols) && isRowEnd
            return (
              <div key={p.id} className="mgz-cell">
                <article className={`mgz-card ${out ? 'is-out' : ''} ${open ? 'is-open' : ''}`}>
                  <button
                    type="button"
                    className="mgz-card-media"
                    onClick={() => setSelId(open ? null : p.id)}
                    aria-expanded={open}
                    aria-label={`${p.name} detayını ${open ? 'kapat' : 'aç'}`}
                  >
                    {p.images[0] ? <img src={imgUrl(p.images[0])} alt={p.name} loading="lazy" /> : <Icon name="dice" size={40} />}
                    {out && <span className="mgz-flag">Tükendi</span>}
                  </button>
                  <div className="mgz-card-body">
                    <span className="mgz-card-cat">{p.category_name ?? '—'}</span>
                    <button type="button" className="mgz-card-name" onClick={() => setSelId(open ? null : p.id)}>
                      {p.name}
                    </button>
                    {p.description && <p className="mgz-card-desc">{p.description}</p>}
                    <div className="mgz-card-foot">
                      <span className="mgz-price">
                        {p.money_price != null && <span className="tnum">{fmtTLk(p.money_price)}</span>}
                        {p.coin_price != null && (
                          <span className="mgz-price-coin">
                            <Coins amount={p.coin_price} size={14} />
                          </span>
                        )}
                      </span>
                      <div className="mgz-card-cta">
                        {added[`p${p.id}`] ? (
                          <span className="mgz-added" role="status">
                            <Icon name="check" size={14} /> Eklendi
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="mgz-btn mgz-btn-sm"
                            onClick={() => addProduct(p)}
                            disabled={out}
                          >
                            {out ? 'Tükendi' : 'Sepete Ekle'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>

                {detailRowEnd && selIndex >= 0 && (
                  <ProductDetail
                    product={visible[selIndex]}
                    added={!!added[`p${visible[selIndex].id}`]}
                    onAdd={(o) => addProduct(visible[selIndex], o)}
                    onClose={() => setSelId(null)}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Jeton & Üyelik — aynı akışta (üyelik kartı her zaman; jeton paketleri varsa) */}
        <div className="mgz-sub">
            <h3 className="mgz-h3">Jeton &amp; Üyelik</h3>
            <div className="mgz-coins">
              <article className="mgz-coin mgz-coin-prem">
                <span className="mgz-coin-badge">PREMIUM</span>
                <span className="mgz-coin-name">1 Yıllık Üyelik</span>
                <span className="mgz-coin-ico">
                  <Icon name="crown" size={28} />
                </span>
                <span className="mgz-coin-price tnum">{fmtTL(PREMIUM_YEARLY_TL)}</span>
                <span className="mgz-coin-per">/ yıl</span>
                {added['mem'] ? (
                  <span className="mgz-added" role="status">
                    <Icon name="check" size={14} /> Eklendi
                  </span>
                ) : (
                  <button type="button" className="mgz-btn mgz-btn-sm" onClick={addMembership}>
                    Sepete Ekle
                  </button>
                )}
              </article>
              {coinPackages.map((pk) => (
                <article key={pk.id} className={`mgz-coin ${pk.popular ? 'is-pop' : ''}`}>
                  {pk.popular && <span className="mgz-coin-badge">POPÜLER</span>}
                  <span className="mgz-coin-name">{pk.name}</span>
                  <span className="mgz-coin-ico">
                    <Coins amount={pk.gc} size={20} suffix="coin" />
                  </span>
                  <span className="mgz-coin-price tnum">{fmtTL(pk.price)}</span>
                  {pk.discount > 0 && <span className="mgz-coin-per">%{pk.discount} avantaj</span>}
                  {added[`c${pk.id}`] ? (
                    <span className="mgz-added" role="status">
                      <Icon name="check" size={14} /> Eklendi
                    </span>
                  ) : (
                    <button type="button" className="mgz-btn mgz-btn-sm" onClick={() => addCoinPkg(pk.id)}>
                      Sepete Ekle
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
      </section>

      {/* 4 — HİKÂYE + TESLİMAT */}
      <section id="hikaye" className="mgz-section mgz-story" aria-label="Marka hikâyesi ve teslimat">
        <div className="mgz-story-grid">
          <div className="mgz-story-main">
            <h2 className="mgz-h2">
              <span className="mgz-idx">02</span> Hikâye
            </h2>
            <p className="mgz-story-lead">
              TavlaTv, dijital tavlayı milyonlara ulaştırırken fiziksel oyunun dokusunu da unutmadı. Bu atölye;
              oranı, dengeyi ve el işçiliğini önemseyen küçük bir seçkidir.
            </p>
            <p className="mgz-story-body">
              Her tavla, kapandığında bir kitap gibi rafta durur; açıldığında oyunun ritmini taşır. Zarlar denge
              için ağırlıklandırılır, kuleler tek parça meşeden işlenir.
            </p>
          </div>
          <ul className="mgz-delivery">
            <li>
              <Icon name="package" size={20} />
              <div>
                <b>Hızlı Teslimat</b>
                <span>Siparişler 1–3 iş gününde kargoda.</span>
              </div>
            </li>
            <li>
              <Icon name="shield-check" size={20} />
              <div>
                <b>Güvenli Ödeme</b>
                <span>Havale/EFT ile onaylı sipariş.</span>
              </div>
            </li>
            <li>
              <Icon name="check" size={20} />
              <div>
                <b>Kolay İade</b>
                <span>14 gün içinde koşulsuz cayma hakkı.</span>
              </div>
            </li>
          </ul>
        </div>
      </section>

      {/* 5 — SEPET + ÖDEME */}
      <CartSection
        items={cartItems}
        setItems={setCartItems}
        coinPackages={coinPackages}
        onRequireAuth={onRequireAuth}
        user={user}
        onManageAddresses={onManageAddresses}
        onOrders={onOrders}
        onCoinsChange={onCoinsChange}
        onContinue={() => scrollTo('urunler')}
      />

      {/* 6 — FOOTER */}
      <footer className="mgz-foot" aria-label="İletişim ve yasal">
        <div className="mgz-foot-grid">
          <div className="mgz-foot-brand">
            <span className="mgz-logo mgz-logo-foot">
              TAVLA<span className="mgz-logo-dot">.</span>
            </span>
            <p>Seçkin tavla atölyesi — tavlatv.com</p>
          </div>
          <div className="mgz-foot-col">
            <h4>İletişim</h4>
            <a href="mailto:destek@tavlatv.com">destek@tavlatv.com</a>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onManageAddresses()
              }}
            >
              Adreslerim
            </a>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onOrders()
              }}
            >
              Siparişlerim
            </a>
          </div>
          <div className="mgz-foot-col">
            <h4>Takip</h4>
            <a href="https://instagram.com/tavlatv" target="_blank" rel="noreferrer noopener">
              Instagram
            </a>
            <a href="https://x.com/tavlatv" target="_blank" rel="noreferrer noopener">
              X / Twitter
            </a>
            <a href="https://youtube.com/@tavlatv" target="_blank" rel="noreferrer noopener">
              YouTube
            </a>
          </div>
        </div>

        <div className="mgz-legal">
          {[
            ['Mesafeli Satış Sözleşmesi', 'Siparişlerde 6502 sayılı Tüketicinin Korunması Hakkında Kanun kapsamında mesafeli satış hükümleri geçerlidir. Satıcı bilgileri, teslimat süresi ve cayma hakkı sipariş onayında ayrıca iletilir.'],
            ['İade ve İptal Koşulları', 'Teslimattan itibaren 14 gün içinde koşulsuz cayma hakkınız vardır. Ürün hasarsız ve kullanılmamış olmalıdır. İade onayından sonra ödeme aynı yöntemle iade edilir.'],
            ['Teslimat ve Kargo', 'Siparişler 1–3 iş günü içinde kargoya verilir. Kargo takip numarası sipariş durumunuza işlenir. Teslimat yalnızca Türkiye içine yapılır.'],
            ['Gizlilik ve KVKK', 'Kişisel verileriniz yalnızca sipariş ve teslimat amacıyla işlenir, üçüncü taraflarla paylaşılmaz. Detaylar için KVKK aydınlatma metnini inceleyebilirsiniz.'],
          ].map(([title, body]) => (
            <details key={title} className="mgz-acc">
              <summary>
                {title}
                <Icon name="chevron" size={16} />
              </summary>
              <p>{body}</p>
            </details>
          ))}
        </div>

        <p className="mgz-copy">© 2026 TavlaTv — Tüm hakları saklıdır.</p>
      </footer>
    </div>
  )
}

// ---- Inline ürün detayı (grid genişliğinde, satır altında) ----
function ProductDetail({
  product,
  added,
  onAdd,
  onClose,
}: {
  product: Product
  added: boolean
  onAdd: (o: { color?: string | null; qty?: number; pay?: 'coin' | 'money' }) => void
  onClose: () => void
}) {
  const colors: ProductColor[] = product.colors ?? []
  const [color, setColor] = useState<string | null>(colors[0]?.name ?? null)
  const [qty, setQty] = useState(1)
  const [pay, setPay] = useState<'coin' | 'money'>(product.money_price != null ? 'money' : 'coin')
  const [img, setImg] = useState(0)
  const [err, setErr] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: prefersReduced() ? 'auto' : 'smooth', block: 'nearest' })
  }, [])

  const out = product.stock <= 0
  const maxQty = Math.min(10, product.stock)
  const canCoin = product.coin_price != null
  const canMoney = product.money_price != null
  const hasImg = product.images.length > 0

  const add = () => {
    if (colors.length > 0 && !color) {
      setErr('Lütfen bir renk seç.')
      return
    }
    setErr('')
    onAdd({ color: colors.length ? color : null, qty, pay })
  }

  return (
    <div className="mgz-detail" ref={ref} role="region" aria-label={`${product.name} detay`}>
      <button type="button" className="mgz-detail-x" onClick={onClose} aria-label="Detayı kapat">
        <Icon name="x" size={16} />
      </button>
      <div className="mgz-detail-grid">
        <div className="mgz-detail-media">
          <div className="mgz-detail-main">
            {hasImg ? <img src={imgUrl(product.images[img])} alt={product.name} /> : <Icon name="dice" size={72} />}
            {out && <span className="mgz-flag">Tükendi</span>}
          </div>
          {product.images.length > 1 && (
            <div className="mgz-detail-thumbs">
              {product.images.map((im, i) => (
                <button
                  key={i}
                  type="button"
                  className={`mgz-detail-thumb ${i === img ? 'on' : ''}`}
                  onClick={() => setImg(i)}
                  aria-label={`${product.name} görsel ${i + 1}`}
                >
                  <img src={imgUrl(im)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mgz-detail-info">
          {product.category_name && <span className="mgz-eyebrow">{product.category_name}</span>}
          <h3 className="mgz-detail-title">{product.name}</h3>
          <div className="mgz-detail-price">
            {canMoney && <span className="tnum">{fmtTLk(product.money_price!)}</span>}
            {canCoin && (
              <span className="mgz-price-coin">
                <Coins amount={product.coin_price!} size={18} />
              </span>
            )}
          </div>
          <div className={`mgz-stock ${out ? 'out' : product.stock <= 5 ? 'low' : 'in'}`}>
            <span aria-hidden="true" />
            {out ? 'Tükendi' : `Stokta ${product.stock} adet`}
          </div>
          {product.description && <p className="mgz-detail-desc">{product.description}</p>}

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

          <div className="mgz-detail-row">
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

            {canCoin && canMoney && (
              <div className="mgz-field">
                <label className="mgz-flabel">Ödeme</label>
                <div className="mgz-paytoggle">
                  <button type="button" className={pay === 'money' ? 'on' : ''} onClick={() => setPay('money')} aria-pressed={pay === 'money'}>
                    TL
                  </button>
                  <button type="button" className={pay === 'coin' ? 'on' : ''} onClick={() => setPay('coin')} aria-pressed={pay === 'coin'}>
                    Jeton
                  </button>
                </div>
              </div>
            )}
          </div>

          {err && <p className="mgz-err">{err}</p>}

          <div className="mgz-detail-actions">
            {added ? (
              <span className="mgz-added mgz-added-lg" role="status">
                <Icon name="check" size={16} /> Sepete eklendi
              </span>
            ) : (
              <button type="button" className="mgz-btn mgz-btn-lg" onClick={add} disabled={out}>
                <Icon name="cart" size={16} /> {out ? 'Tükendi' : 'Sepete Ekle'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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
