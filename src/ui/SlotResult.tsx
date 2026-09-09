/**
 * Zar Slotu sonuç şeridi — makaraların ALTINDA görünen ince banner. Kaybetmede ekranı
 * kırmızıya boyamaz; yalnızca sade bir mesaj. Kazançta coin miktarını vurgular.
 * (Jackpot ayrı bileşende — JackpotAnimation.)
 */
import { useT } from '../i18n'
import { Icon } from './Icon'
import Coins from './Coins'

interface Props {
  winType: 'none' | 'triple' | 'jackpot'
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

  // triple: 6-6-6 en yüksek -> "BÜYÜK ÖDÜL!"; diğerleri "KAZANDIN!".
  const big = matchedValue != null && matchedValue >= 5
  return (
    <div className={`ds-result is-win ${big ? 'is-big' : ''}`} role="status">
      <Icon name="trophy" size={18} weight="fill" className="ds-result-ic" />
      <span className="ds-result-msg">{big ? t('ds.bigWin') : t('ds.win')}</span>
      <Coins amount={payout} gain pill size={16} />
    </div>
  )
}
