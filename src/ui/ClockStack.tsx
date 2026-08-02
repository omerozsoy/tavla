import type { Player } from '../engine/types'

interface Props {
  active: Player | null // sirasi gelen oyuncu
  delay: number // 12sn hamle suresi (aktif tur)
  over: number // 12sn sonrasi kalan ek sure (30+30)
  final: number // son asama esigi (over bu degerin altinda -> son geri sayim)
}

// Dikey saat: her hamle sirasi icin 12sn + ek sure. Aktif oyuncunun kutusu sayar.
export default function ClockStack({ active, delay, over, final }: Props) {
  const box = (player: Player) => {
    if (active !== player) return { text: '–', cls: 'idle' }
    if (delay > 0) return { text: String(delay), cls: 'delay' }
    // 12sn bitti -> ek sure sayiyor; son asamada kirmizi
    return { text: String(over), cls: over <= final ? 'final' : 'over' }
  }
  const top = box('black')
  const bottom = box('white')
  return (
    <div className="clock-stack">
      <div className={`clock-reserve ${active === 'black' ? 'active' : ''} ${top.cls}`}>
        {top.text}
      </div>
      <div className="clock-delay">{active ? (delay > 0 ? '⏱' : '⚠') : '–'}</div>
      <div className={`clock-reserve ${active === 'white' ? 'active' : ''} ${bottom.cls}`}>
        {bottom.text}
      </div>
    </div>
  )
}
