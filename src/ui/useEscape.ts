import { useEffect } from 'react'

/**
 * Modal/dialoglar icin Esc tusu ile kapatma (ux: escape-routes / modal-escape).
 * Klavye kullanicilarina backdrop-click'e ek olarak standart cikis yolu saglar.
 */
export function useEscape(onClose?: () => void) {
  useEffect(() => {
    if (!onClose) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])
}
