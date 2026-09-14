/**
 * SlotControls — makinenin altındaki kontrol paneli: istatistik göstergeleri (kalan hak,
 * sonraki ücretsiz, spin bedeli, bakiye) + büyük ÇEVİR butonu. Buton mevcut Tavlai Button
 * componentini kullanır; spin sırasında disabled (çoklu-spin engeli parent'ta da var).
 *
 * Tüm değerler parent'tan (gerçek sunucu durumu) gelir — hard-code YOK.
 */
import { Icon } from './Icon'
import Coins from './Coins'
import { Countdown } from './Countdown'
import { Button } from '@/components/ui/button'
import { useT } from '../i18n'

interface Props {
  remaining: number
  nextFree: string | null
  spinCost: number
  isPaidNext: boolean
  coins: number
  spinning: boolean
  canSpin: boolean
  onSpin: () => void
  onCooldownExpire: () => void
}

export default function SlotControls({
  remaining,
  nextFree,
  spinCost,
  isPaidNext,
  coins,
  spinning,
  canSpin,
  onSpin,
  onCooldownExpire,
}: Props) {
  const { t } = useT()
  return (
    <div className="sm-deck">
      <div className="sm-gauges">
        <div className="sm-gauge">
          <span className="sm-gauge-label">{t('ds.remaining')}</span>
          <span className="sm-gauge-value tnum">{remaining}</span>
        </div>
        <div className="sm-gauge">
          <span className="sm-gauge-label">{t('ds.nextFree')}</span>
          <span className="sm-gauge-value">
            {remaining <= 0 && nextFree ? <Countdown target={nextFree} onExpire={onCooldownExpire} /> : '—'}
          </span>
        </div>
        <div className="sm-gauge">
          <span className="sm-gauge-label">{t('ds.cost')}</span>
          <span className="sm-gauge-value">
            {isPaidNext ? <Coins amount={spinCost} size={16} /> : <span className="sm-free">{t('ds.free')}</span>}
          </span>
        </div>
        <div className="sm-gauge">
          <span className="sm-gauge-label">{t('ds.balance')}</span>
          <span className="sm-gauge-value">
            <Coins amount={coins} size={16} />
          </span>
        </div>
      </div>

      <Button className="sm-spin-btn" onClick={onSpin} disabled={spinning || !canSpin}>
        {spinning ? (
          <>{t('ds.spinning')}…</>
        ) : isPaidNext ? (
          <>
            {t('ds.spinFor', { n: spinCost })} <Icon name="coin" size={18} />
          </>
        ) : (
          <>{t('ds.spin')}</>
        )}
      </Button>
    </div>
  )
}
