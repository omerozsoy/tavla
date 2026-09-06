import { useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { COIN_PACKAGES } from '../coinPackages'
import { validatePromo, type PromoResult } from '../api'
import { Button } from '@/components/ui/button'

// Sepet ogesi: coin paketi id + adet. (Sadece coin paketleri sepete girer.)
export interface CartItem {
  id: string
  qty: number
}

const fmtCoin = (n: number) => n.toLocaleString('tr-TR')
const fmtTL = (n: number) => `${n.toLocaleString('tr-TR')} ₺`

// Sepet ekrani: coin paketleri + adet + indirim kodu + toplam; "Ödemeye Geç" -> Garanti kart sayfasi.
export default function Cart({
  items,
  setItems,
  onClose,
  onContinue,
  onCheckout,
}: {
  items: CartItem[]
  setItems: (updater: (prev: CartItem[]) => CartItem[]) => void
  onClose: () => void
  onContinue: () => void // "Alışverişe devam" -> Mağaza (coin sekmesi)
  onCheckout: (items: CartItem[], code?: string | null) => Promise<void> // "Ödemeye Geç" -> odeme sayfasi
}) {
  useEscape(onClose)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  // Indirim kodu durumu (sunucu-otoriter dogrulama)
  const [code, setCode] = useState('')
  const [applied, setApplied] = useState<PromoResult | null>(null)
  const [promoErr, setPromoErr] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)

  // Sepet satirlari: gecerli paketlerle eslesenler.
  const rows = items
    .map((it) => ({ it, pkg: COIN_PACKAGES.find((p) => p.id === it.id) }))
    .filter((r): r is { it: CartItem; pkg: (typeof COIN_PACKAGES)[number] } => !!r.pkg)
  const total = rows.reduce((s, r) => s + r.pkg.price * r.it.qty, 0)
  const totalGc = rows.reduce((s, r) => s + r.pkg.gc * r.it.qty, 0)
  // Indirim (TL): sunucu kurus dondurur -> /100. Sepet degisince applied temizlenir (bkz mutate).
  const discountTL = applied ? applied.discount / 100 : 0
  const finalTL = Math.max(0, total - discountTL)

  // Sepet degisince uygulanan kodu temizle (indirim eski toplama gore hesaplanmisti).
  const clearPromo = () => {
    setApplied(null)
    setPromoErr('')
  }
  const setQty = (id: string, qty: number) => {
    clearPromo()
    setItems((prev) =>
      qty <= 0 ? prev.filter((p) => p.id !== id) : prev.map((p) => (p.id === id ? { ...p, qty } : p)),
    )
  }
  const remove = (id: string) => {
    clearPromo()
    setItems((prev) => prev.filter((p) => p.id !== id))
  }

  async function applyPromo() {
    const c = code.trim()
    if (!c || promoBusy || !rows.length) return
    setPromoErr('')
    setPromoBusy(true)
    try {
      const r = await validatePromo(items, c)
      setApplied(r)
      setCode('')
    } catch (e) {
      setApplied(null)
      setPromoErr((e as { message?: string })?.message || 'İndirim kodu geçersiz.')
    } finally {
      setPromoBusy(false)
    }
  }

  async function checkout() {
    if (!rows.length) return
    setErr('')
    setBusy(true)
    try {
      await onCheckout(items, applied?.code ?? null) // App: buyCoins(items, code) -> odeme sayfasi
    } catch (e) {
      setErr((e as { message?: string })?.message || 'Ödeme başlatılamadı.')
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
          <p className="cart-sub">Coin paketlerini gözden geçir, indirim kodunu uygula ve güvenle öde.</p>
        </header>

        {rows.length === 0 ? (
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
              {rows.map(({ it, pkg }) => (
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
            </div>

            {/* Indirim kodu: sunucu-otoriter dogrulama (odemede yeniden uygulanir) */}
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

            <div className="cart-summary">
              <div className="cart-sum-row">
                <span>Ara toplam</span>
                <span className="tnum">{fmtTL(total)}</span>
              </div>
              {applied && (
                <div className="cart-sum-row cart-sum-disc">
                  <span>İndirim · {applied.code}</span>
                  <span className="tnum">−{fmtTL(discountTL)}</span>
                </div>
              )}
              <div className="cart-sum-row cart-sum-total">
                <span>
                  Toplam <b className="tnum">{fmtCoin(totalGc)}</b> coin
                </span>
                <span className="cart-sum-amt tnum">{fmtTL(finalTL)}</span>
              </div>
            </div>

            {err && <div className="cart-err">{err}</div>}

            <div className="cart-actions">
              <Button variant="outline" onClick={onContinue}>
                Alışverişe devam
              </Button>
              <Button variant="default" disabled={busy} onClick={checkout}>
                <Icon name="coin" size={16} /> Ödemeye Geç
              </Button>
            </div>
            <p className="cart-note">Ödeme Garanti BBVA 3D Secure ile güvenli şekilde alınır.</p>
          </>
        )}
      </div>
    </div>
  )
}
