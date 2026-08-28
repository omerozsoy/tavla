/**
 * TavlaTv logo — marka kilidi (wordmark) + sembol.
 * Tasarim yonu 4a: "TAVLATV" buyuk harf; A ve V harfleri tavla hanesi (ucgen).
 *
 * Hizalama kurali (handoff'tan):
 *   satir  -> align-items: baseline
 *   ucgen  -> height: 0.71em (Outfit 700 kapak yuksekligi), width: 0.53em
 * Boylece ucgenin tepesi buyuk harfin ust cizgisiyle, tabani taban cizgisiyle
 * birebir hizali olur ve tek `size` degeriyle olceklenir.
 *
 * Renk: varsayilan olarak uygulamanin tema degiskenlerini izler
 *   yukari hane (A) = var(--accent) [kiremit]
 *   asagi hane (V) + harfler = var(--text) [ink acik temada / krem koyu temada]
 * Bu, handoff'un light/dark varyantlariyla ortusur. `tone` verilirse sabit
 * marka renkleri kullanilir ( or. kiremit zemin uzerinde).
 */

type Tone = 'auto' | 'light' | 'dark' | 'brick' | 'mono'

const POINT: Record<Exclude<Tone, 'auto'>, { up: string; down: string; text: string; downOpacity?: number }> = {
  // Royal Navy marka: gold aksan ucgen + ivory/navy harfler
  light: { up: '#927540', down: '#14243A', text: '#14243A' },
  dark: { up: '#C2A15F', down: '#F0E8D8', text: '#F0E8D8' },
  brick: { up: '#F0E8D8', down: '#14243A', text: '#F0E8D8' }, // gold zemin uzerinde
  mono: { up: '#14243A', down: '#14243A', text: '#14243A', downOpacity: 0.35 },
}

const CAP = 0.71 // Outfit 700 kapak yuksekligi / em
const POINT_RATIO = 0.75 // ucgen genisligi / yuksekligi

export function TavlaTvLogo({
  size = 24,
  tone = 'auto',
  color,
  className,
}: {
  /** font-size. Sayi -> px; string -> dogrudan CSS (or. 'calc(var(--col)*.6)'). */
  size?: number | string
  tone?: Tone
  /** Verilirse ucgenler + harfler tek renk olur (watermark: var(--wm-color)). */
  color?: string
  className?: string
}) {
  const c = tone === 'auto' ? null : POINT[tone]
  const up = color ?? (c ? c.up : 'var(--accent)')
  const down = color ?? (c ? c.down : 'var(--text)')
  const text = color ?? (c ? c.text : 'var(--text)')

  const point = (dir: 'up' | 'down') => (
    <span
      aria-hidden
      style={{
        width: `${(CAP * POINT_RATIO).toFixed(3)}em`,
        height: `${CAP}em`,
        flex: 'none',
        background: dir === 'up' ? up : down,
        opacity: dir === 'down' ? c?.downOpacity : undefined,
        clipPath:
          dir === 'up'
            ? 'polygon(50% 0, 100% 100%, 0 100%)'
            : 'polygon(50% 100%, 100% 0, 0 0)',
      }}
    />
  )

  return (
    <span
      className={className}
      role="img"
      aria-label="TavlaTv"
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '.1em',
        fontFamily: "'Outfit', system-ui, sans-serif",
        fontWeight: 700,
        letterSpacing: '.02em',
        lineHeight: 1,
        fontSize: size,
        color: text,
      }}
    >
      <span>T</span>
      {point('up')}
      {point('down')}
      <span>L</span>
      {point('up')}
      <span>T</span>
      {point('down')}
    </span>
  )
}

/**
 * Sembol: avatar, uygulama ikonu. Iki hane; kutu olcusu `size`.
 * 16px ve altinda tek hane kullanilir (iki ucgen birbirine girer).
 */
export function TavlaTvMark({
  size = 40,
  radius = '50%',
  background = '#14243A',
}: {
  size?: number
  radius?: number | string
  background?: string
}) {
  const single = size <= 16
  const h = Math.round(size * 0.36)
  const w = Math.round(h * 0.75)
  const tri = (dir: 'up' | 'down', color: string) => (
    <span
      aria-hidden
      style={{
        width: w,
        height: h,
        flex: 'none',
        background: color,
        clipPath:
          dir === 'up'
            ? 'polygon(50% 0, 100% 100%, 0 100%)'
            : 'polygon(50% 100%, 100% 0, 0 0)',
      }}
    />
  )

  return (
    <span
      role="img"
      aria-label="TavlaTv"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Math.max(1, Math.round(size * 0.03)),
      }}
    >
      {tri('up', '#C2A15F')}
      {!single && tri('down', '#F0E8D8')}
    </span>
  )
}
