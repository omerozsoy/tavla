import type { CSSProperties } from 'react'

/**
 * Tek parca iskelet (shimmer) blogu. Yukleme sirasinda gercek icerigin yerini
 * tutar -> algilanan hiz artar, icerik gelince layout kaymaz (CLS).
 * prefers-reduced-motion'da parilti otomatik durur (App.css .sk::after).
 */
export function Skeleton({
  w,
  h = 12,
  r,
  className = '',
  style,
}: {
  w?: number | string
  h?: number | string
  r?: number | string
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      className={`sk ${className}`}
      aria-hidden="true"
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  )
}
