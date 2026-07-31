// Kozmetikler: avatar cerceveleri (coin ile acilir). Ortak modul -> dongusel import yok.
export interface FrameDef {
  id: string
  name: string
  price: number
  css: string // cerceve halkasi (background)
}

export const FRAMES: FrameDef[] = [
  { id: 'bronze', name: 'Bronz', price: 100, css: 'linear-gradient(135deg,#cd7f32,#8a5320)' },
  { id: 'silver', name: 'Gümüş', price: 250, css: 'linear-gradient(135deg,#e0e0e0,#9aa0a8)' },
  { id: 'gold', name: 'Altın', price: 500, css: 'linear-gradient(135deg,#ffe066,#c9971f)' },
  { id: 'neon', name: 'Neon', price: 700, css: 'linear-gradient(135deg,#18e0c0,#7a1fb0)' },
  { id: 'fire', name: 'Ateş', price: 900, css: 'linear-gradient(135deg,#ffcf3f,#ff5a1f,#c81f1f)' },
]

export const FRAME_CSS: Record<string, string> = Object.fromEntries(FRAMES.map((f) => [f.id, f.css]))

// Bir avatar cercevesinin arkaplan stili (yoksa undefined)
export function frameStyle(frame?: string | null): { background: string } | undefined {
  return frame && FRAME_CSS[frame] ? { background: FRAME_CSS[frame] } : undefined
}
