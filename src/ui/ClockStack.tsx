import type { Player } from '../engine/types'

interface Props {
  active: Player | null // sirasi gelen oyuncu
  delay: number // hamle gecikmesi (aktif tur; her turda sifirlanir)
  white: number // beyaz oyuncunun kalan rezerv bankasi (sn)
  black: number // siyah oyuncunun kalan rezerv bankasi (sn)
  final: number // son asama esigi (banka bu degerin altinda -> kirmizi)
  topScore?: number // ust oyuncunun mac skoru (saatin ustunde kutu)
  bottomScore?: number // alt oyuncunun mac skoru (saatin altinda kutu)
}

// Dikey saat: her oyuncunun kendi tarafinda hamle suresi/rezervi + skoru gorunur.
// Sirasi gelen oyuncunun kutusu once hamle gecikmesini (yesil), o bitince kendi
// rezerv bankasini tuketir. Ekranda HER ZAMAN tam saniye (kayan-nokta salise yok).
export default function ClockStack({ active, delay, white, black, final, topScore, bottomScore }: Props) {
  const secs = (n: number) => Math.max(0, Math.ceil(n))
  // Rezerv mm:ss (>=60sn); altinda sade saniye.
  const fmt = (n: number) => {
    const s = secs(n)
    return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s)
  }
  const box = (player: Player) => {
    const bank = player === 'white' ? white : black
    // Sirasi gelen oyuncu: once hamle suresi (yesil), sonra kendi bankasi.
    if (active === player && delay > 0) return { text: String(secs(delay)), cls: 'delay' }
    const counting = active === player
    return { text: fmt(bank), cls: bank <= final ? 'final' : counting ? 'over' : 'idle' }
  }
  const top = box('black')
  const bottom = box('white')
  return (
    <div className="clock-stack">
      {topScore != null && <div className="clock-off">{topScore}</div>}
      <div className={`clock-reserve ${active === 'black' ? 'active' : ''} ${top.cls}`}>
        {top.text}
      </div>
      <div className={`clock-reserve ${active === 'white' ? 'active' : ''} ${bottom.cls}`}>
        {bottom.text}
      </div>
      {bottomScore != null && <div className="clock-off">{bottomScore}</div>}
    </div>
  )
}
