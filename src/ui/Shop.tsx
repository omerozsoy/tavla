import { useEffect, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { Coins } from './Coins'
import { useEscape } from './useEscape'
import { useT } from '../i18n'
import { COIN_PACKAGES } from '../coinPackages'
import { Button } from '@/components/ui/button'
import { type BoardThemeOpt } from './BoardPicker'
import { ProductsInner, type CartAddLine } from './Products'
import { getProducts, type Product } from '../api'

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
  onClose: () => void
}

const fmtTL = (n: number) => `${n.toLocaleString('tr-TR')} ₺`

// Ürün kategorisi slug -> ikon
const CAT_ICON: Record<string, IconName> = {
  tavla: 'dice',
  zar: 'dice',
  zar_kulesi: 'package',
  kitap: 'book',
  diger: 'package',
}

// Magaza: Coin (jeton) satin alma + fiziksel ürünler (kategori sekmeleri: Tavla, Zar, Kitap…).
export default function Shop({
  coins,
  onBuyCoins,
  cartCount = 0,
  onOpenCart,
  onAddToCart,
  initialTab = 'coins',
  onClose,
}: Props) {
  const { t } = useT()
  useEscape(onClose)
  const [tab, setTab] = useState<string>(initialTab === 'board' || initialTab === 'frame' ? 'coins' : initialTab)

  // Ürünleri bir kez çek; kategori sekmelerini bundan türet (ProductsInner'a da bu liste
  // geçilir -> çift fetch olmaz).
  const [products, setProducts] = useState<Product[] | null>(null)
  const [cats, setCats] = useState<{ slug: string; name: string }[]>([])
  useEffect(() => {
    let alive = true
    getProducts()
      .then((list) => {
        if (!alive) return
        setProducts(list)
        const seen: { slug: string; name: string }[] = []
        for (const p of list) {
          if (p.category && !seen.some((c) => c.slug === p.category)) {
            seen.push({ slug: p.category, name: p.category_name || p.category })
          }
        }
        setCats(seen)
      })
      .catch(() => setProducts([]))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card shop-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        {/* Editoryal baslik + cuzdan */}
        <header className="shop-head">
          <div className="shop-head-text">
            <h2>
              <Icon name="shop" size={20} /> {t('shop.title')}
            </h2>
            <p className="shop-sub">{t('shop.subtitle')}</p>
          </div>
          <div className="shop-head-actions">
            {onOpenCart && cartCount > 0 && (
              <Button variant="outline" className="shop-cart-btn" onClick={onOpenCart} title={t('shop.cart')}>
                <Icon name="cart" size={16} /> {t('shop.cart')} <span className="shop-cart-count tnum">{cartCount}</span>
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

        {/* Sekmeler: Coin Satın Al + ürün kategorileri (Tavla · Zar · Kitap…) */}
        <div className="prof-tabs bs-tabs shop-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'coins'}
            className={`prof-tab ${tab === 'coins' ? 'active' : ''}`}
            onClick={() => setTab('coins')}
          >
            <Icon name="coin" size={16} /> {t('shop.buyCoins')}
          </button>
          {onAddToCart &&
            cats.map((c) => (
              <button
                key={c.slug}
                type="button"
                role="tab"
                aria-selected={tab === c.slug}
                className={`prof-tab ${tab === c.slug ? 'active' : ''}`}
                onClick={() => setTab(c.slug)}
              >
                <Icon name={CAT_ICON[c.slug] ?? 'package'} size={16} /> {c.name}
              </button>
            ))}
        </div>

        {/* Coin satın al */}
        {tab === 'coins' && (
          <section className="coin-store" aria-label={t('shop.buyCoins')}>
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
        )}

        {/* Ürün kategorisi sekmesi -> o kategorinin ürünleri (çipler gizli, sekmeler yukarıda) */}
        {tab !== 'coins' && onAddToCart && (
          <ProductsInner products={products} category={tab} onAddToCart={onAddToCart} onGoCart={() => onOpenCart?.()} />
        )}
      </div>
    </div>
  )
}
