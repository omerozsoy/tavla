import { useEffect, useRef } from 'react'

// Baglanti geri gelince (window 'online') cb'yi cagir. Hata durumundaki listeler kendiliginden
// yenilensin diye kullanilir.
export function useOnReconnect(cb: () => void) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    const on = () => ref.current()
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [])
}
