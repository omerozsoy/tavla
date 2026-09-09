/**
 * Zar Slotu sonuç şeridi — makaraların ALTINDA görünen ince banner. Kaybetmede ekranı
 * kırmızıya boyamaz; yalnızca sade bir mesaj. Kazançta coin miktarını vurgular.
 * (Jackpot ayrı bileşende — JackpotAnimation.)
 */
import { useT } from '../i18n'
import { Icon } from './Icon'
import Coins from './Coins'

interface Props {
  winType: 'none' | 'triple' | 'jackpot' | 'straight'
  payout: number
  matchedValue: number | null
}

export default function SlotResult({ winType, payout, matchedValue }: Props) {
  const { t } = useT()

  if (winType === 'none') {
    return (
      <div className="ds-result is-lose" role="status">
        <span className="ds-result-msg">{t('ds.lose')}</span>
      </div>
    )
  }

  // Mesaj: sıralama -> "SIRALAMA!"; 6-6-6/5-5-5 -> "BÜYÜK ÖDÜL!"; diğer üçlüler -> "KAZANDIN!".
  const isStraight = winType === 'straight'
  const big = !isStraight && matchedValue != null && matchedValue >= 5
  const msg = isStraight ? t('ds.straightWin') : big ? t('ds.bigWin') : t('ds.win')
  return (
    <div className={`ds-result is-win ${big ? 'is-big' : ''}`} role="status">
      <Icon name={isStraight ? 'ranking' : 'trophy'} size={18} weight="fill" className="ds-result-ic" />
      <span className="ds-result-msg">{msg}</span>
      <Coins amount={payout} gain pill size={16} />
    </div>
  )
}
