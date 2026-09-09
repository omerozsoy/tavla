/**
 * Zar Slotu JACKPOT kutlaması — 64-64-64 geldiğinde kart üzerinde açılan özel katman.
 * Hafif ekran parlaması, üç 64 küpünün büyüyüp-küçülmesi, "JACKPOT!" güçlü entrance,
 * kazanılan coin büyük gösterim ve hafif coin yağmuru. Efektler ölçülü — eski casino
 * sitesi hissi vermez; site token'larıyla (kiremit accent, coin altını) uyumlu.
 */
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import Coins from './Coins'
import SlotSymbol from './SlotSymbol'

interface Props {
  amount: number
  onClose: () => void
}

export default function JackpotAnimation({ amount, onClose }: Props) {
  const { t } = useT()
  // Coin yağmuru: birkaç parça, farklı gecikme/konum (CSS ile düşer).
  const coins = Array.from({ length: 14 })

  return (
    <div className="ds-jackpot" role="dialog" aria-modal="true">
      <div className="ds-jackpot-glow" aria-hidden="true" />
      <div className="ds-coinfall" aria-hidden="true">
        {coins.map((_, i) => (
          <span
            key={i}
            className="ds-coin"
            style={{ left: `${(i * 7 + 4) % 96}%`, animationDelay: `${(i % 7) * 0.14}s` }}
          />
        ))}
      </div>

      <div className="ds-jackpot-inner">
        <div className="ds-jackpot-cubes" aria-hidden="true">
          <span className="ds-jp-cube"><SlotSymbol code="c64" /></span>
          <span className="ds-jp-cube"><SlotSymbol code="c64" /></span>
          <span className="ds-jp-cube"><SlotSymbol code="c64" /></span>
        </div>

        <div className="ds-jackpot-word">{t('ds.jackpot')}</div>

        <div className="ds-jackpot-amount">
          <Coins amount={amount} gain size={40} />
        </div>

        <Button className="ds-jackpot-btn" onClick={onClose}>
          {t('ds.claim')}
        </Button>
      </div>
    </div>
  )
}
