import './clockStack.css'
import type { Player } from '../engine/types'

interface Props {
  active: Player | null // sirasi gelen oyuncu
  delay: number // hamle gecikmesi (aktif tur; her turda sifirlanir)
  white: number // beyaz oyuncunun kalan rezerv bankasi (sn)
  black: number // siyah oyuncunun kalan rezerv bankasi (sn)
  final: number // son asama esigi (banka bu degerin altinda -> uyari)
  topScore?: number // ust oyuncunun mac skoru (buyuk beyaz kutu)
  bottomScore?: number // alt oyuncunun mac skoru
  // Tahta flip'iyle AYNI: local oyuncu siyahsa (flipBoard) saatler de cevrilir -> her oyuncu
  // KENDI saatini AVATARIYLA AYNI tarafta (altta) gorur. Aksi halde saatler karisir.
  flip?: boolean
}

// Dikey saat (Galaxy tarzi): buyuk beyaz SKOR kutulari (ust/alt) + ortadaki amber grup.
// Amber grupta HER iki oyuncunun rezerv suresi (mm:ss) hep gorunur; aralarindaki kutu
// sirasi gelen oyuncunun HAMLE SURESI'dir (ortak). Ekranda her zaman tam saniye.
export default function ClockStack({ active, delay, white, black, final, topScore, bottomScore, flip }: Props) {
  const secs = (n: number) => Math.max(0, Math.ceil(n))
  const pad = (n: number) => String(n).padStart(2, '0')
  const mmss = (n: number) => {
    const s = secs(n)
    return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
  }
  const bankCls = (bank: number, counting: boolean) => `${counting ? 'active' : ''} ${bank <= final ? 'low' : ''}`

  // Konumsal renkler: flip=false -> ust siyah / alt beyaz (varsayilan). flip=true (local siyah)
  // -> ust beyaz / alt siyah; boylece saat avatar dizilisiyle (kendim altta) EŞLEŞİR.
  const topColor: Player = flip ? 'white' : 'black'
  const bottomColor: Player = flip ? 'black' : 'white'
  const topBank = flip ? white : black
  const bottomBank = flip ? black : white
  return (
    <div className="clock-stack">
      {topScore != null && <div className="clock-off">{topScore}</div>}
      <div className="clock-group">
        <div className={`clock-bank ${bankCls(topBank, active === topColor)}`}>{mmss(topBank)}</div>
        <div className={`clock-move ${active ? 'on' : ''}`}>{active ? String(secs(delay)) : '–'}</div>
        <div className={`clock-bank ${bankCls(bottomBank, active === bottomColor)}`}>{mmss(bottomBank)}</div>
      </div>
      {bottomScore != null && <div className="clock-off">{bottomScore}</div>}
    </div>
  )
}
