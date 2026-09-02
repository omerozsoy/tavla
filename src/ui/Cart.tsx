import { useState } from 'react'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { COIN_PACKAGES } from '../coinPackages'
import { Button } from '@/components/ui/button'
import { buyCoins } from '../api'

// Sepet ogesi: coin paketi id + adet. (Sadece coin paketleri sepete girer.)
export interface CartItem {
  id: string
  qty: number
}

const fmtCoin = (n: number) => n.toLocaleString('tr-TR')
const fmtTL = (n: number) => `${n.toLocaleString('tr-TR')} ₺`

// Sepet ekrani: coin paketleri + adet + toplam; "Ödemeye Geç" -> Garanti kart sayfasi.
export default function Cart({
  items,
  setItems,
  onClose,
  onContinue,
}: {
  items: CartItem[]
  setItems: (updater: (prev: CartItem[]) => CartItem[]) => void
  onClose: () => void
  onContinue: () => void // "Alışverişe devam" -> Mağaza (coin sekmesi)
}) {
  useEscape(onClose)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Sepet satirlari: gecerli paketlerle eslesenler.
  const rows = items
    .map((it) => ({ it, pkg: COIN_PACKAGES.find((p) => p.id === it.id) }))
    .filter((r): r is { it: CartItem; pkg: (typeof COIN_PACKAGES)[number] } => !!r.pkg)
  const total = rows.reduce((s, r) => s + r.pkg.price * r.it.qty, 0)
  const totalGc = rows.reduce((s, r) => s + r.pkg.gc * r.it.qty, 0)

  const setQty = (id: string, qty: number) =>
    setItems((prev) =>
      qty <= 0 ? prev.filter((p) => p.id !== id) : prev.map((p) => (p.id === id ? { ...p, qty } : p)),
    )
  const remove = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id))

  async function checkout() {
    if (!rows.length) return
    setErr('')
    setBusy(true)
    try {
      const r = await buyCoins(items)
      window.location.href = r.url // Garanti kart sayfasina yonlendir
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
        <h2>
          <Icon name="shop" size={20} /> Sepet
        </h2>

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

            <div className="cart-total">
              <span>
                Toplam <b className="tnum">{fmtCoin(totalGc)}</b> coin
              </span>
              <span className="cart-total-amt tnum">{fmtTL(total)}</span>
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
