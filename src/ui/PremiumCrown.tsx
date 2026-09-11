import type { CSSProperties } from 'react'
import { Icon } from './Icon'

/**
 * PremiumCrown — süresi geçerli ücretli üyeyi belirten, ismin SONUNDA duran küçük
 * ALTIN taç (Phosphor CrownSimple, dolgulu). Avatar dekorasyonundan (24 animasyonlu
 * çerçeve) BAĞIMSIZ -> isim satırına inline konur, çakışmaz. Renk .premium-crown
 * sınıfından var(--coin-gold) gelir (sabit hex YOK). `style` yalnız konumlandırma
 * (margin/vertical-align) içindir.
 */
export default function PremiumCrown({ style, size = 15 }: { style?: CSSProperties; size?: number }) {
  return (
    <span className="premium-crown" style={style} title="Premium üye" aria-label="Premium üye">
      <Icon name="crown-simple" size={size} weight="fill" />
    </span>
  )
}
