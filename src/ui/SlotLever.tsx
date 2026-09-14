/**
 * SlotLever — makinenin sağ yanındaki fiziksel kol. Tıklanabilir (ÇEVİR butonuyla AYNI
 * spin fonksiyonunu çağırır). Kol çekildiğinde: aşağı çekilme → kısa bekleme → spring ile
 * yukarı dönüş (CSS `is-pull`). Krom mil + kiremit/casino kırmızısı parlak topuz.
 *
 * `pulling` true olduğunda pull animasyonu oynar (parent spin state'ine bağlar). Erişilebilir
 * buton: klavye ile de çalışır; disabled iken spin engellenir.
 */
interface Props {
  pulling?: boolean
  disabled?: boolean
  onPull: () => void
  label: string
}

export default function SlotLever({ pulling, disabled, onPull, label }: Props) {
  return (
    <div className={`sm-lever ${pulling ? 'is-pull' : ''}`}>
      <span className="sm-lever-base" aria-hidden="true" />
      <button
        type="button"
        className="sm-lever-btn"
        onClick={onPull}
        disabled={disabled}
        aria-label={label}
        title={label}
      >
        <span className="sm-lever-track" aria-hidden="true" />
        <span className="sm-lever-arm" aria-hidden="true">
          <span className="sm-lever-collar" />
          <span className="sm-lever-knob" />
        </span>
      </button>
    </div>
  )
}
