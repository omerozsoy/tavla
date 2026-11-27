import type { Player, Step } from '../engine/types'

// gnubg hamle notasyonu ('8/5 6/5', 'bar/20', '6/off', '13/7*/2', '24/18(2)') -> Step[] (hamle okları için).
// Foto analizinde her aday normalde sunucudan `steps` ile gelir; bu YEDEK (sunucu atlarsa ok yine çizilsin).
// turn='white' = fotoğrafı çeken. Index: beyaz p-1 / siyah 24-p — gnubg_service._gnubg_point_to_index ile
// birebir; sonuç fixed-board (GameState.points) index'idir, Board/MoveArrows bunu DOM'dan ölçerek çizer.
export function moveToSteps(turn: Player, move?: string): Step[] {
  if (!move) return []
  const idx = (tok: string): number | 'bar' | 'off' => {
    if (tok === 'bar') return 'bar'
    if (tok === 'off') return 'off'
    const p = parseInt(tok, 10)
    if (p === 25) return 'bar'
    if (p === 0 || !Number.isFinite(p)) return 'off'
    return turn === 'white' ? p - 1 : 24 - p
  }
  const steps: Step[] = []
  for (let tok of move.split(/\s+/)) {
    tok = tok.replace(/\*/g, '')
    let count = 1
    const lp = tok.indexOf('(')
    if (lp >= 0) {
      count = parseInt(tok.slice(lp + 1), 10) || 1
      tok = tok.slice(0, lp)
    }
    const parts = tok.split('/')
    for (let c = 0; c < count; c++) {
      for (let i = 0; i < parts.length - 1; i++) {
        // geçerli notasyonda kaynak asla 'off', hedef asla 'bar' değildir -> güvenli daraltma
        steps.push({ from: idx(parts[i]) as number | 'bar', to: idx(parts[i + 1]) as number | 'off', die: 0 })
      }
    }
  }
  return steps
}
