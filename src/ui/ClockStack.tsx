import type { Player } from '../engine/types'
import { Icon } from './Icon'

interface Props {
  active: Player | null // sirasi gelen oyuncu
  delay: number // hamle gecikmesi (aktif tur; her turda sifirlanir)
  white: number // beyaz oyuncunun kalan rezerv bankasi (sn)
  black: number // siyah oyuncunun kalan rezerv bankasi (sn)
  final: number // son asama esigi (banka bu degerin altinda -> kirmizi)
  topOff?: number // ust oyuncunun topladigi pul (Galaxy: saatin ustunde kutu)
  bottomOff?: number // alt oyuncunun topladigi pul (saatin altinda kutu)
}

// Dikey saat: her oyuncunun kendi rezerv bankasi (maca yayilir). Aktif oyuncu once
// hamle gecikmesini, o bitince kendi bankasini tuketir.
export default function ClockStack({ active, delay, white, black, final, topOff, bottomOff }: Props) {
  // Rezerv bankasi mm:ss (Galaxy: 01:00); 60sn alti sade saniye
  const fmt = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}` : String(n))
  const box = (player: Player) => {
    const bank = player === 'white' ? white : black
    if (active === player && delay > 0) return { text: String(delay), cls: 'delay' }
    const counting = active === player
    return { text: fmt(bank), cls: bank <= final ? 'final' : counting ? 'over' : 'idle' }
  }
  const top = box('black')
  const bottom = box('white')
  return (
    <div className="clock-stack">
      {topOff != null && <div className="clock-off">{topOff}</div>}
      <div className={`clock-reserve ${active === 'black' ? 'active' : ''} ${top.cls}`}>
        {top.text}
      </div>
      <div className="clock-delay">
        {active ? delay > 0 ? <Icon name="dice" size={13} /> : <Icon name="alert" size={13} /> : '–'}
      </div>
      <div className={`clock-reserve ${active === 'white' ? 'active' : ''} ${bottom.cls}`}>
        {bottom.text}
      </div>
      {bottomOff != null && <div className="clock-off">{bottomOff}</div>}
    </div>
  )
}
