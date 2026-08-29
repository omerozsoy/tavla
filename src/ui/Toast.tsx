// Birlesik bildirim (toast) sistemi — tum site geneli.
// Onceki dagitik desenlerin (Auth ".save-ok" inline metni + App ".verify-toast")
// yerine gecer. Flat/Swiss stil (App.css .toastr* kurallari), erisilebilir
// (aria-live: basari/bilgi=polite, hata=assertive), 4-6 sn otomatik kapanir,
// ust-orta yiginlanir, reduced-motion'a saygili.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'

export type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  kind: ToastKind
  msg: string
}

interface ToastApi {
  show: (msg: string, kind?: ToastKind) => void
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
  dismiss: (id: number) => void
}

// Saglayici yoksa (izole testler) coken degil sessiz no-op don.
const noop: ToastApi = {
  show: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
  dismiss: () => {},
}

const ToastCtx = createContext<ToastApi>(noop)

export function useToast(): ToastApi {
  return useContext(ToastCtx)
}

const ICON: Record<ToastKind, 'check' | 'alert' | 'bell'> = {
  success: 'check',
  error: 'alert',
  info: 'bell',
}

// Hatalar biraz daha uzun kalir (kullanici okuyabilsin); digerleri kisa.
const LIFETIME: Record<ToastKind, number> = {
  success: 4000,
  info: 4500,
  error: 6000,
}

const MAX_STACK = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seqRef = useRef(0)
  const timersRef = useRef<Map<number, number>>(new Map())

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((it) => it.id !== id))
    const timers = timersRef.current
    const h = timers.get(id)
    if (h !== undefined) {
      window.clearTimeout(h)
      timers.delete(id)
    }
  }, [])

  const show = useCallback(
    (msg: string, kind: ToastKind = 'info') => {
      if (!msg) return
      const id = ++seqRef.current
      setItems((list) => {
        const next = [...list, { id, kind, msg }]
        // Yigin tavani: en eskiyi dusur (timer'ini da temizle).
        while (next.length > MAX_STACK) {
          const dropped = next.shift()
          if (dropped) {
            const h = timersRef.current.get(dropped.id)
            if (h !== undefined) {
              window.clearTimeout(h)
              timersRef.current.delete(dropped.id)
            }
          }
        }
        return next
      })
      const handle = window.setTimeout(() => dismiss(id), LIFETIME[kind])
      timersRef.current.set(id, handle)
    },
    [dismiss],
  )

  const api = useRef<ToastApi>(noop)
  api.current = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    info: (m) => show(m, 'info'),
    dismiss,
  }
  // Sabit referansli API (her render'da yeni obje ureterek tuketicileri
  // gereksiz yenilemesin diye stabil bir sarma dondur).
  const stableRef = useRef<ToastApi>({
    show: (m, k) => api.current.show(m, k),
    success: (m) => api.current.success(m),
    error: (m) => api.current.error(m),
    info: (m) => api.current.info(m),
    dismiss: (id) => api.current.dismiss(id),
  })

  // Bilesen sokulurse bekleyen tum timer'lari temizle.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((h) => window.clearTimeout(h))
      timers.clear()
    }
  }, [])

  return (
    <ToastCtx.Provider value={stableRef.current}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastCtx.Provider>
  )
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[]
  onDismiss: (id: number) => void
}) {
  const { t } = useT()
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="toastr-viewport" role="region" aria-label={t('toast.region')}>
      {items.map((it) => (
        <div
          key={it.id}
          className={`toastr toastr--${it.kind}`}
          role={it.kind === 'error' ? 'alert' : 'status'}
          aria-live={it.kind === 'error' ? 'assertive' : 'polite'}
        >
          <span className="toastr__icon" aria-hidden="true">
            <Icon name={ICON[it.kind]} size={18} />
          </span>
          <span className="toastr__msg">{it.msg}</span>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            className="shrink-0"
            onClick={() => onDismiss(it.id)}
            aria-label={t('common.close')}
          >
            <Icon name="x" size={15} />
          </Button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
