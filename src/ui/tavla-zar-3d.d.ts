// tavla-zar-3d.js icin minimal tip bildirimi (modul JS; icerigine dokunulmadi).
export type TavlaZarAvoid =
  | string
  | ArrayLike<Element | DOMRect>
  | (() => ArrayLike<Element | DOMRect>)

export interface TavlaZarOptions {
  dieSize?: number
  from?: 'bottom' | 'top' | 'left' | 'right'
  sound?: boolean
  colors?: { face?: string; pip?: string; ace?: string }
  initial?: [number, number]
  shadowOpacity?: number
  slide?: number
  spin?: number
  avoid?: TavlaZarAvoid | null
  avoidPadding?: number
  wallHit?: boolean
  maxSpread?: number
  minSpread?: number
}

export interface TavlaZarRolledEvent {
  values: [number, number]
  isDouble: boolean
  moves: number[]
}

export interface TavlaZarInstance {
  canvas: HTMLCanvasElement
  roll(values?: number[]): Promise<number[]>
  show(values: number[]): void
  markUsed(i: number, used?: boolean): void
  reset(): void
  readonly values: number[]
  readonly isRolling: boolean
  setSound(v: boolean): void
  setAvoid(v: TavlaZarAvoid | null): void
  on(name: string, fn: (d: unknown) => void): TavlaZarInstance
  off(name: string, fn: (d: unknown) => void): TavlaZarInstance
  destroy(): void
}

export function mount(container: HTMLElement, opts?: TavlaZarOptions): TavlaZarInstance
declare const _default: { mount: typeof mount }
export default _default
