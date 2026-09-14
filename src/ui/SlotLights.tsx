/**
 * SlotLights — makine çevresindeki küçük ampuller. Bağımsız ışık kaynağı gibi görünürler
 * (sıcak beyaz/altın glow). Boştayken sakin nabız; `chase` (jackpot) modunda sırayla yanar.
 *
 * Salt görsel (aria-hidden). `count` ampul üretir; her birine kademeli animationDelay verir.
 * prefers-reduced-motion CSS tarafında durdurulur.
 */
interface Props {
  count: number
  /** Jackpot kutlaması: ampuller sırayla koşan ışık gibi yanar. */
  chase?: boolean
  /** Spin sırasında biraz daha canlı nabız. */
  active?: boolean
  className?: string
}

export default function SlotLights({ count, chase, active, className }: Props) {
  return (
    <div
      className={`sl-lights ${chase ? 'is-chase' : ''} ${active ? 'is-active' : ''} ${className ?? ''}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="sl-bulb" style={{ animationDelay: `${(i / count) * 1.2}s` }} />
      ))}
    </div>
  )
}
