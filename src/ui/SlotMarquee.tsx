/**
 * SlotMarquee — makinenin üstündeki ışıklı tabela (marquee). Altın işlemeli "TAVLAI SLOT"
 * başlığı, çevresinde sıcak ampuller (SlotLights) ve iki yanda kiremit pip aksanı.
 *
 * Salt sunum. Başlık ve alt-metin i18n'den gelir (App/DiceSlot geçirir).
 */
import SlotLights from './SlotLights'

interface Props {
  title: string
  celebrate?: boolean // jackpot: ampuller sırayla koşar
  spinning?: boolean
}

export default function SlotMarquee({ title, celebrate, spinning }: Props) {
  return (
    <header className="sm-marquee">
      {/* Üst kavis: ampul dizisi */}
      <SlotLights count={16} chase={celebrate} active={spinning} className="sm-marquee-lamps" />
      <div className="sm-marquee-sign">
        <span className="sm-marquee-pip" aria-hidden="true" />
        <h2 className="sm-marquee-title">{title}</h2>
        <span className="sm-marquee-pip" aria-hidden="true" />
      </div>
    </header>
  )
}
