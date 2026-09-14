/**
 * WinEffect — kazanç kutlama katmanı. İki mod:
 *  - variant="win": normal kazançta makara ekranı üzerinde kısa coin kıvılcımı (bir kez oynar).
 *  - variant="jackpot": tüm kartı kaplayan JACKPOT kutlaması — coin yağmuru + konfeti +
 *    büyüyüp-küçülen 64 küpleri + "JACKPOT!" + kazanılan coin + KAZAN butonu.
 *
 * Efektler ölçülü ve kısa (maks birkaç sn). Kayıpta HİÇ efekt yok (parent çağırmaz).
 * prefers-reduced-motion CSS'te durdurulur.
 */
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import Coins from './Coins'
import SlotSymbol from './SlotSymbol'

interface Props {
  variant: 'win' | 'jackpot'
  amount: number
  onClose?: () => void
}

const CONFETTI = 26
const COINS = 16

export default function WinEffect({ variant, amount, onClose }: Props) {
  const { t } = useT()

  // Normal kazanç: ekran üzerinde yükselen coin kıvılcımları (bir kez, sonra kaybolur).
  if (variant === 'win') {
    return (
      <div className="we-sparks" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="we-spark"
            style={{ left: `${8 + i * 9}%`, animationDelay: `${(i % 5) * 0.05}s` }}
          />
        ))}
      </div>
    )
  }

  // JACKPOT: tam ekran kutlama.
  return (
    <div className="we-jackpot" role="dialog" aria-modal="true">
      <div className="we-glow" aria-hidden="true" />
      <div className="we-coinfall" aria-hidden="true">
        {Array.from({ length: COINS }).map((_, i) => (
          <span key={i} className="we-coin" style={{ left: `${(i * 6 + 3) % 97}%`, animationDelay: `${(i % 8) * 0.13}s` }} />
        ))}
      </div>
      <div className="we-confetti" aria-hidden="true">
        {Array.from({ length: CONFETTI }).map((_, i) => (
          <span
            key={i}
            className={`we-conf we-conf-${i % 4}`}
            style={{ left: `${(i * 3.8 + 2) % 98}%`, animationDelay: `${(i % 9) * 0.09}s` }}
          />
        ))}
      </div>

      <div className="we-inner">
        <div className="we-cubes" aria-hidden="true">
          <span className="we-cube"><SlotSymbol code="c64" /></span>
          <span className="we-cube"><SlotSymbol code="c64" /></span>
          <span className="we-cube"><SlotSymbol code="c64" /></span>
        </div>
        <div className="we-word">{t('ds.jackpot')}</div>
        <div className="we-amount">
          <Coins amount={amount} gain size={40} />
        </div>
        <Button className="we-claim" onClick={onClose}>
          {t('ds.claim')}
        </Button>
      </div>
    </div>
  )
}
