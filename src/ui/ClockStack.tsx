import type { Player } from '../engine/types'

interface Props {
  topTime: string // ust oyuncu (siyah) rezervi mm:ss
  bottomTime: string // alt oyuncu (beyaz) rezervi mm:ss
  delay: number // aktif turun gecikme sayaci (sn)
  active: Player | null // sirasi gelen oyuncu
  lowTop: boolean // ust oyuncu rezervi azaldi
  lowBottom: boolean // alt oyuncu rezervi azaldi
}

// Backgammon Galaxy tarzi dikey saat: ust rezerv / gecikme / alt rezerv
export default function ClockStack({ topTime, bottomTime, delay, active, lowTop, lowBottom }: Props) {
  return (
    <div className="clock-stack">
      <div className={`clock-reserve ${active === 'black' ? 'active' : ''} ${lowTop ? 'low' : ''}`}>
        {topTime}
      </div>
      <div className="clock-delay">{active ? delay : '–'}</div>
      <div
        className={`clock-reserve ${active === 'white' ? 'active' : ''} ${lowBottom ? 'low' : ''}`}
      >
        {bottomTime}
      </div>
    </div>
  )
}
