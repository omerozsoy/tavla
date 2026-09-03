import { Icon } from './Icon'

interface CoinsProps {
  /** Coin miktari. */
  amount: number
  /** Ikon boyutu (px). Cevre metne gore olceklenir; varsayilan 15. */
  size?: number
  /** Kazanc gosterimi: sayinin basina '+' koyar (odul/prim/havuz artisi). */
  gain?: boolean
  /** Cevrelenmis altin pill kabuk (bakiye/vurgu). Varsayilan: inline (metin akisinda). */
  pill?: boolean
  /** Sondan etiket (orn. 'GC', 'coin') — soluk, kucuk. */
  suffix?: string
  /** Ek sinif. */
  className?: string
}

/**
 * Site geneli TEK tip "elit" coin gosterimi — ust menudeki altin coin rozetiyle ayni
 * gorsel dil: altin (--coin-gold) coin ikonu + tabular (hizali) rakamlar. TUM coin
 * MIKTARI gosterimleri (bakiye, bahis, fiyat, odul, havuz, giris ucreti) bunu kullanir.
 * "Coin paketi", "Coin al" gibi ETIKET/BUTON ikonlari bunun disinda kalir.
 */
export function Coins({ amount, size = 15, gain, pill, suffix, className }: CoinsProps) {
  return (
    <span className={`coins${pill ? ' coins--pill' : ''}${className ? ' ' + className : ''}`}>
      <Icon name="coin" size={size} className="coins-ic" />
      <span className="coins-val">
        {gain ? '+' : ''}
        {amount.toLocaleString('tr-TR')}
        {suffix ? <span className="coins-suffix">{suffix}</span> : null}
      </span>
    </span>
  )
}

export default Coins
