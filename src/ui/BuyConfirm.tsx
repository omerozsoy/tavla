import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { Icon } from './Icon'
import { Coins } from './Coins'
import { Button } from '@/components/ui/button'

interface Props {
  /** Satin alinacak ogenin adi (tahta/cerceve) */
  name: string
  /** Harcanacak coin */
  price: number
  /** Mevcut bakiye (kalan bakiye onizlemesi icin) */
  coins: number
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Kozmetik (tahta/cerceve) satin alma ONAY modali — yanlis tiklamayla coin harcanmasin
// diye kac coin gidecegini gosterip acik onay ister. Hem BoardPicker hem FrameShop kullanir.
// register-overlay + createPortal (transform'lu ata icinde fixed kirpilmasin, bkz
// [[fixed-portal-transform-tuzagi]]).
export default function BuyConfirm({ name, price, coins, busy, onConfirm, onCancel }: Props) {
  const { t } = useT()
  const after = Math.max(0, coins - price)
  return createPortal(
    <div className="register-overlay modal" role="dialog" aria-modal="true" onClick={onCancel}>
      <div className="register-card resign-card buy-confirm-card" onClick={(e) => e.stopPropagation()}>
        <h2>
          <Icon name="cart" size={20} /> {t('shop.confirmTitle')}
        </h2>
        <p className="register-sub">{t('shop.confirmBody', { name })}</p>
        <div className="buy-confirm-rows">
          <div className="buy-confirm-row">
            <span>{t('shop.confirmCost')}</span>
            <Coins amount={price} size={14} />
          </div>
          <div className="buy-confirm-row buy-confirm-after">
            <span>{t('shop.confirmAfter')}</span>
            <Coins amount={after} size={14} />
          </div>
        </div>
        <Button variant="default" disabled={busy} onClick={onConfirm}>
          {t('shop.confirmBuy')}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {t('reg.cancel')}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
