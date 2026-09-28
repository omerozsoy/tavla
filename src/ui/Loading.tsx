import { useT } from '../i18n'
import diceSpin from '../assets/dice-spin.gif'

// Merkezi yukleme gostergesi: donen zar gif'i + metin. Tum "Yukleniyor…" yerlerinde
// bunu kullan (App.tsx boot ekrani + panel/liste bekleme durumlari).
export default function Loading({ label, size = 56 }: { label?: string; size?: number }) {
  const { t } = useT()
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <img
        src={diceSpin}
        alt=""
        className="app-loading__dice"
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
      <span className="app-loading__text">{label ?? t('common.loading')}</span>
    </div>
  )
}
