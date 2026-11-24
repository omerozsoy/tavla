// tavla-3d.js icin minimal tip bildirimi (modul JS; icerigine dokunulmadi, yalniz pointAtScreen eklendi).
export type Tavla3DPoint = number | 'bar'

export interface Tavla3DOptions {
  tilt?: number
  zoom?: number
  vshift?: number
  half?: 'right' | 'left'
  from?: 'bottom' | 'top'
  position?: number[]
  sound?: boolean
  slide?: number
  spin?: number
  wallHit?: boolean
  minSpread?: number
  maxSpread?: number
  initial?: [number, number]
  background?: string | null
  colors?: Record<string, string>
}

export interface Tavla3DInstance {
  canvas: HTMLCanvasElement
  pointAtScreen(clientX: number, clientY: number): Tavla3DPoint | null
  roll(values?: number[]): Promise<number[]>
  show(values: number[]): void
  setPosition(pos: number[], bar?: { w: number; b: number }): void
  markUsed(i: number, used?: boolean): void
  reset(): void
  readonly values: number[]
  readonly isRolling: boolean
  setSound(v: boolean): void
  setTilt(deg: number): void
  setZoom(z: number): void
  setThrow(half: 'right' | 'left' | null, from: 'bottom' | 'top' | null): void
  on(name: string, fn: (d: unknown) => void): Tavla3DInstance
  off(name: string, fn: (d: unknown) => void): Tavla3DInstance
  destroy(): void
}

export const OPENING: number[]
export function mount(container: HTMLElement, opts?: Tavla3DOptions): Tavla3DInstance
declare const _default: { mount: typeof mount; OPENING: number[] }
export default _default
