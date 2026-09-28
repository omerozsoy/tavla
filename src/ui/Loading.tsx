import { useT } from '../i18n'
import diceSpin from '../assets/dice-spin.gif'

// Merkezi yukleme gostergesi: donen zar gif'i + metin. Tum "Yukleniyor…" yerlerinde
// bunu kullan (App.tsx boot ekrani + panel/liste bekleme durumlari).
export default function Loading({
  label,
  size = 56,
  inline = false,
}: {
  label?: string
  size?: number
  inline?: boolean
}) {
  const { t } = useT()
  // inline: buton/satir icinde kullanim (yatay, dolgusuz, size kucuk verilir)
  const eff = inline ? size || 18 : size
  return (
    <div
      className={inline ? 'app-loading app-loading--inline' : 'app-loading'}
      role="status"
      aria-live="polite"
    >
      <img
        src={diceSpin}
        alt=""
        className="app-loading__dice"
        width={eff}
        height={eff}
        style={{ width: eff, height: eff }}
      />
      <span className="app-loading__text">{label ?? t('common.loading')}</span>
    </div>
  )
}
