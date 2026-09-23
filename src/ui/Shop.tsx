import { useEffect, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { Coins } from './Coins'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { COIN_PACKAGES } from '../coinPackages'
import { Button } from '@/components/ui/button'
import { type BoardThemeOpt } from './BoardPicker'
import { ProductsInner, type CartAddLine } from './Products'
import { getShopCatalog, type Product } from '../api'

interface Props {
  coins: number
  rewardReady?: boolean
  rewardSecs?: number
  onDaily: () => Promise<{ claimed: boolean; reward?: number }>
  onBuyCoins?: (pkgId: string) => void // gercek para ile jeton paketi al
  cartCount?: number // sepetteki toplam adet (0 ise buton gizli)
  onOpenCart?: () => void // sepeti ac
  onMembership?: () => void // Star Uyelik kartindan uyelik ekranini ac
  // NOT: Tahta Rengi + Avatar Cercevesi sekmeleri Magaza'dan KALDIRILDI (profil'de yonetilir).
  // Bu proplar geriye donuk uyum icin duruyor (App hala geciyor); Magaza'da kullanilmiyor.
  boardTheme?: string
  setBoardTheme?: (id: string) => void
  boardThemes?: BoardThemeOpt[]
  onBuyItem?: (shopId: string) => void
  framesSlot?: ReactNode
  onAddToCart?: (line: CartAddLine) => void // ürün -> sepete ekle
  initialTab?: string
  /** URL-otoriter secili sekme (App shopTab): 'coin' (vitrin) | kategori-slug. Verilirse ic state yerine bu kullanilir. */
  tab?: string
  /** Sekme degisince App'e bildir -> URL /magaza veya /magaza/<kategori> guncellenir. */
  onTabChange?: (slug: string) => void
  /** URL-otoriter secili urun slug'i (/magaza/<kategori>/<urun>). */
  productSlug?: string | null
  /** Urun secilince/geri donunce App'e bildir -> URL guncellenir. */
  onSelectProduct?: (slug: string | null) => void
  onClose: () => void
}

// 'coin' (ve eski 'coins') = VITRIN (storefront landing): kategori kartlari + jeton paketleri.
// Kategori DEGIL; URL'de /magaza koku. Bir kategori secilince /magaza/<kategori> sayfasi acilir.
const isLanding = (s: string) => s === 'coin' || s === 'coins'

const fmtTL = (n: number) => `${n.toLocaleString('tr-TR')} ₺`
const fmtTLk = (kurus: number) =>
  `${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
const imgUrl = (img: string) => (/^(https?:|\/)/.test(img) ? img : '/uploads/' + img)

// Ürün kategorisi slug -> ikon (vitrin kartlari + kategori basligi)
const CAT_ICON: Record<string, IconName> = {
  tavla: 'dice',
  zar: 'dice',
  zar_kulesi: 'package',
  kitap: 'book',
  diger: 'package',
}

// Magaza — GERCEK sayfa (page-host icinde, modal degil). Uc gorunum, URL-otoriter:
//   /magaza                     -> Vitrin (kategori kartlari + jeton paketleri)
//   /magaza/<kategori>          -> Kategori urun izgarasi (ProductsInner)
//   /magaza/<kategori>/<urun>   -> Urun detayi (ProductsInner -> ProductDetail)
export default function Shop({
  coins,
  onBuyCoins,
  cartCount = 0,
  onOpenCart,
  onAddToCart,
  initialTab = 'coin',
  tab: controlledTab,
  onTabChange,
  productSlug,
  onSelectProduct,
  onClose,
}: Props) {
  const { t } = useT()
  useEscape(onClose)
  const initial = initialTab === 'board' || initialTab === 'frame' ? 'coin' : initialTab
  const [tabInner, setTabInner] = useState<string>(controlledTab ?? initial)
  // Kontrollu (URL-otoriter) sekme varsa onu kullan; yoksa ic state. Sekme secince App'e bildir.
  const tab = controlledTab ?? tabInner
  const setTab = (slug: string) => {
    setTabInner(slug)
    onTabChange?.(slug)
  }
  const goStorefront = () => {
    onSelectProduct?.(null)
    setTab('coin')
  }

  // Ürünleri bir kez çek; kategori kartlarini bundan türet (ProductsInner'a da bu liste
  // geçilir -> çift fetch olmaz).
  const [products, setProducts] = useState<Product[] | null>(null)
  const [cats, setCats] = useState<{ slug: string; name: string; image?: string | null }[]>([])
  // Jeton bölümü başlığı: admin panelde 'coin' kategorisine verilen ad (yoksa varsayilan).
  const [coinLabel, setCoinLabel] = useState<string>('')
  useEffect(() => {
    let alive = true
    getShopCatalog()
      .then(({ products: list, categories }) => {
        if (!alive) return
        setProducts(list)
        // Kategoriler: yayindaki TUM kategoriler (admin sirasiyla), coin haric (rezerve).
        const fromCats = categories.filter((c) => !isLanding(c.slug))
        if (fromCats.length) {
          setCats(fromCats)
        } else {
          // Eski backend (kategori listesi donmuyor) -> urunlerden turet (fallback).
          const seen: { slug: string; name: string }[] = []
          for (const p of list) {
            if (p.category && !isLanding(p.category) && !seen.some((c) => c.slug === p.category)) {
              seen.push({ slug: p.category, name: p.category_name || p.category })
            }
          }
          setCats(seen)
        }
        const coinCat = categories.find((c) => isLanding(c.slug))
        setCoinLabel(coinCat?.name ?? '')
      })
      .catch(() => setProducts([]))
    return () => {
      alive = false
    }
  }, [])

  const landing = isLanding(tab)
  const activeCat = landing ? null : cats.find((c) => c.slug === tab) ?? { slug: tab, name: tab }
  const countFor = (slug: string) => (products ?? []).filter((p) => p.category === slug).length
  // Kategori kapak görseli: önce admin'de yüklenen kategori görseli, yoksa o kategorideki
  // ilk görselli ürünün görseli (o da yoksa ikon).
  const catCover = (slug: string) => {
    const cat = cats.find((c) => c.slug === slug)
    if (cat?.image) return imgUrl(cat.image)
    const p = (products ?? []).find((x) => x.category === slug && x.images?.[0])
    return p ? imgUrl(p.images[0]) : null
  }
  // Vitrin "Öne Çıkan Ürünler": görselli ürünlerden ilkleri (kategori karışık).
  const featured = (products ?? []).filter((p) => p.images?.[0]).slice(0, 8)
  // Bir ürünü aç: kategori sekmesine geç + slug seç -> /magaza/<kat>/<slug> detay.
  const openProduct = (p: Product) => {
    setTab(p.category ?? 'diger')
    onSelectProduct?.(p.slug)
  }

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card shop-card" onClick={(e) => e.stopPropagation()}>
        {/* Mobilde sayfayi kapatma (X); masaustu page-host'ta gizli (menuden gezilir). */}
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>

        {/* Editoryal baslik (vitrin) VEYA geri + kategori basligi (kategori sayfasi) + cuzdan/sepet */}
        <header className="shop-head">
          <div className="shop-head-text">
            {landing ? (
              <>
                <h2 className="shop-title">{t('shop.title')}</h2>
                <p className="shop-sub">{t('shop.subtitle')}</p>
              </>
            ) : (
              <>
                <button type="button" className="shop-back" onClick={goStorefront}>
                  <Icon name="caret-left" size={15} /> {t('shop.backToShop')}
                </button>
                <h2 className="shop-title shop-title-cat">
                  <Icon name={CAT_ICON[activeCat!.slug] ?? 'package'} size={24} /> {activeCat!.name}
                </h2>
              </>
            )}
          </div>
          <div className="shop-head-actions">
            {onOpenCart && cartCount > 0 && (
              <Button variant="outline" className="shop-cart-btn" onClick={onOpenCart} title={t('shop.cart')}>
                <Icon name="cart" size={16} /> <span className="shop-cart-lbl">{t('shop.cart')}</span>
                <span className="shop-cart-count tnum">{cartCount}</span>
              </Button>
            )}
            <div className="shop-wallet" title={t('shop.balance')}>
              <span className="shop-wallet-label">{t('shop.balance')}</span>
              <span className="shop-wallet-amt">
                <Coins amount={coins} size={22} />
              </span>
            </div>
          </div>
        </header>

        {landing ? (
          <>
            {/* --- Kategoriler: gercek sayfalara goturen kartlar --- */}
            {onAddToCart && cats.length > 0 && (
              <section className="shop-section" aria-label={t('shop.categories')}>
                <h3 className="shop-section-t">{t('shop.categories')}</h3>
                <div className="shop-cats">
                  {cats.map((c) => {
                    const n = countFor(c.slug)
                    const cover = catCover(c.slug)
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        className={`shop-cat-card${cover ? ' has-cover' : ''}`}
                        onClick={() => setTab(c.slug)}
                      >
                        <span className="shop-cat-media">
                          {cover ? (
                            <img src={cover} alt="" loading="lazy" />
                          ) : (
                            <Icon name={CAT_ICON[c.slug] ?? 'package'} size={30} />
                          )}
                        </span>
                        <span className="shop-cat-body">
                          <span className="shop-cat-name">{c.name}</span>
                          <span className="shop-cat-count">
                            {n > 0 ? t('shop.catCount', { n }) : t('shop.catBrowse')}
                          </span>
                        </span>
                        <span className="shop-cat-go" aria-hidden="true">
                          <Icon name="arrow-right" size={16} />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* --- Öne çıkan ürünler: gerçek ürün görselleriyle vitrin (kart -> detay) --- */}
            {onAddToCart && featured.length > 0 && (
              <section className="shop-section" aria-label={t('shop.featured')}>
                <h3 className="shop-section-t">{t('shop.featured')}</h3>
                <div className="shop-feat-grid">
                  {featured.map((p) => {
                    const out = p.stock <= 0
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="shop-feat-card"
                        onClick={() => openProduct(p)}
                        disabled={out}
                      >
                        <span className="shop-feat-media">
                          <img src={imgUrl(p.images[0])} alt={p.name} loading="lazy" />
                          {out && <span className="shop-feat-out">{t('products.soldOut')}</span>}
                        </span>
                        <span className="shop-feat-info">
                          {p.category_name && <span className="shop-feat-cat">{p.category_name}</span>}
                          <span className="shop-feat-name">{p.name}</span>
                          <span className="shop-feat-price">
                            {p.money_price != null && <span>{fmtTLk(p.money_price)}</span>}
                            {p.coin_price != null && (
                              <span className="shop-feat-coin">
                                <Coins amount={p.coin_price} size={15} />
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* --- Jeton paketleri: vitrinde akista (kart tiklaninca sepete) --- */}
            <section className="shop-section coin-store" aria-label={coinLabel || t('shop.buyCoins')}>
              <h3 className="shop-section-t">{coinLabel || t('shop.buyCoins')}</h3>
              <div className="coin-grid">
                {COIN_PACKAGES.map((p) => {
                  const per = (p.price / p.gc).toLocaleString('tr-TR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="coin-card"
                      data-popular={p.popular || undefined}
                      onClick={() => onBuyCoins?.(p.id)}
                    >
                      {p.popular && <span className="coin-card-badge">{t('shop.popular')}</span>}
                      <span className="coin-card-name">{p.name}</span>
                      <span className="coin-card-amount">
                        <Coins amount={p.gc} size={20} suffix="coin" />
                      </span>
                      <span className="coin-card-price">{fmtTL(p.price)}</span>
                      <span className="coin-card-meta">
                        <span className="coin-card-per">
                          {t('shop.perCoin')} {per} ₺
                        </span>
                        {p.discount > 0 && (
                          <span className="coin-card-save">
                            %{p.discount} {t('shop.advantage')}
                          </span>
                        )}
                      </span>
                      <span className="coin-card-cta">
                        {t('shop.buy')} <Icon name="arrow-right" size={14} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        ) : (
          /* --- Kategori sayfasi: o kategorinin urunleri (izgara) + urun detayi --- */
          onAddToCart && (
            <ProductsInner
              products={products}
              category={tab}
              onAddToCart={onAddToCart}
              onGoCart={() => onOpenCart?.()}
              selectedSlug={productSlug ?? null}
              onSelect={onSelectProduct}
            />
          )
        )}
      </div>
    </div>
  )
}
