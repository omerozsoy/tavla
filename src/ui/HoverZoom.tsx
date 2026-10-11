import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * HoverZoom — bir karta gelince YANINDA büyük yüzen önizleme (Tavla Tasarımları'ndaki
 * .bp-hover deseniyle AYNI). Masaüstü + fare/hover'da; dokunmatik/dar ekranda CSS gizler.
 * Konum: kartın sağına sığıyorsa sağına, yoksa soluna; dikeyde kartla ortalanır.
 * Kaydırma/yeniden boyutlandırmada konum bayatlar -> onDismiss ile kapatılır.
 */
export const canHoverPreview = (): boolean =>
  typeof window !== 'undefined' &&
  window.innerWidth >= 900 &&
  !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

export default function HoverZoom({
  rect,
  width,
  height,
  onDismiss,
  children,
}: {
  rect: DOMRect
  width: number
  height: number
  onDismiss: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const off = () => onDismiss()
    window.addEventListener('scroll', off, true)
    window.addEventListener('resize', off)
    return () => {
      window.removeEventListener('scroll', off, true)
      window.removeEventListener('resize', off)
    }
  }, [onDismiss])

  const gap = 12
  const toRight = rect.right + gap + width <= window.innerWidth - 8
  const left = toRight ? rect.right + gap : Math.max(8, rect.left - gap - width)
  const top = Math.min(Math.max(8, rect.top + rect.height / 2 - height / 2), window.innerHeight - height - 8)
  return createPortal(
    <div className="bp-hover" style={{ left, top, width }} aria-hidden="true">
      {children}
    </div>,
    document.body,
  )
}
