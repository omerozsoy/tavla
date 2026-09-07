import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Icon } from './Icon'
import { useEscape } from './useEscape'
import { Coins } from './Coins'
import { getMyOrders, type ProductOrder } from '../api'

const fmtTL = (kurus: number) =>
  `${(kurus / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`

// Durum -> renk sinifi (rozet).
const STATUS_CLS: Record<string, string> = {
  pending: 'gray',
  paid: 'warn',
  shipped: 'info',
  delivered: 'ok',
  cancelled: 'bad',
}

// Siparişlerim: kullanicinin verdigi fiziksel urun siparisleri + durum/kargo takip.
export default function MyOrders({ onClose, onShop }: { onClose: () => void; onShop: () => void }) {
  const { t } = useT()
  useEscape(onClose)
  const [orders, setOrders] = useState<ProductOrder[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .catch(() => setError(true))
  }, [])

  const relDate = (iso?: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('tr-TR')
  }

  return (
    <div className="register-overlay modal page" role="dialog" aria-modal="true">
      <div className="register-card orders-card" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="modal-close" onClick={onClose} aria-label={t('common.close')}>
          <Icon name="x" size={16} />
        </Button>
        <h2>
          <Icon name="package" size={20} /> {t('orders.title')}
        </h2>
        <p className="register-sub">{t('orders.sub')}</p>

        {error && <p className="products-msg">{t('orders.loadError')}</p>}
        {!error && orders && orders.length === 0 && (
          <div className="orders-empty">
            <p className="products-msg">{t('orders.empty')}</p>
            <Button variant="outline" onClick={onShop}>
              <Icon name="shop" size={16} /> {t('products.title')}
            </Button>
          </div>
        )}

        <div className="orders-list">
          {(orders ?? []).map((o) => (
            <div key={o.id} className="order-row">
              <div className="order-main">
                <span className="order-name">{o.product_name}</span>
                <span className="order-meta">
                  {t('orders.qtyShort', { n: o.qty })}
                  {o.color ? ` · ${o.color}` : ''}
                  {o.created_at ? ` · ${relDate(o.created_at)}` : ''}
                </span>
                {o.tracking && (
                  <span className="order-tracking">
                    {t('orders.tracking')}: <strong>{o.tracking}</strong>
                  </span>
                )}
              </div>
              <div className="order-side">
                <span className="order-amount">
                  {o.payment_type === 'coin' ? (
                    <Coins amount={o.coin_cost ?? 0} />
                  ) : (
                    fmtTL(o.amount ?? 0)
                  )}
                </span>
                <span className={`order-status ${STATUS_CLS[o.status] ?? 'gray'}`}>{o.status_label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
