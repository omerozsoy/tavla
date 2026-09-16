import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  // Granular kullanim: hata olunca varsayilan ekran yerine bunu goster.
  // fallback={null} verilirse hata sessizce yutulmaz -> bosluk gosterilir (kritik olmayan
  // suslu bilesenler icin: ornegin cerceve animasyonu chunk'i deploy sonrasi yuklenemezse).
  fallback?: ReactNode
  // Loglama etiketi (hangi bolge cokmus).
  name?: string
}
interface State {
  hasError: boolean
  // ChunkLoadError (deploy sonrasi bayat chunk) mi? Oyleyse KORKUTUCU "ters gitti" yerine
  // sessiz "Guncelleniyor..." goster (otomatik reload zaten yeni surumu alacak).
  isChunk: boolean
}

// Deploy sonrasi eski sekmede lazy chunk yuklenememesi (ChunkLoadError / "Failed to fetch
// dynamically imported module") tipik ve GECICI bir hatadir: yeni surumu almak icin tek
// bir reload yeter. Bunu kalici render hatasindan ayirt ederiz.
function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const name = typeof error === 'object' && error && 'name' in error ? String((error as { name?: unknown }).name ?? '') : ''
  const msg = typeof error === 'object' && error && 'message' in error ? String((error as { message?: unknown }).message ?? '') : ''
  return (
    name === 'ChunkLoadError' ||
    /dynamically imported module|module script failed|importing a module|loading chunk|failed to fetch/i.test(msg)
  )
}

// Otomatik reload'u son 10 sn ile sinirlayan kalkani (sonsuz reload dongusu OLMASIN).
const CLE_KEY = 'tavla.chunkReloadAt'
function canAutoReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(CLE_KEY) || 0)
    return !last || Date.now() - last > 10_000
  } catch {
    // sessionStorage yoksa (gizli mod) otomatik reload yapma -> kullaniciya fallback goster
    return false
  }
}

// Uygulama hata siniri: tek bir render hatasi tum uygulamayi beyaz ekrana dusurmesin.
// Hata yakalanir, dostane bir ekran + yenile butonu gosterilir. Ayrica deploy-sonrasi
// chunk hatasi icin TEK SEFERLIK guvenli otomatik reload uygulanir.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunk: false }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, isChunk: isChunkLoadError(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const tag = this.props.name ? ` [${this.props.name}]` : ''
    console.error(`Uygulama hatasi${tag}:`, error, info.componentStack)
    if (isChunkLoadError(error) && canAutoReload()) {
      // Deploy sonrasi bayat chunk -> yeni surumu al: tek seferlik reload.
      try {
        sessionStorage.setItem(CLE_KEY, String(Date.now()))
      } catch {
        // storage yazilamadi -> yine de bir kez dene; kalkan olmasa da tek reload zararsiz
      }
      window.location.reload()
    }
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Granular fallback verilmisse onu goster (fallback={null} -> bosluk).
      if (this.props.fallback !== undefined) return this.props.fallback
      // Deploy sonrasi bayat chunk (ChunkLoadError): componentDidCatch otomatik reload edecek.
      // KORKUTUCU "Bir seyler ters gitti" YERINE sessiz "Guncelleniyor..." goster -> kullanici
      // sadece kisa bir yenileme gorur, hata sanmaz. (Otomatik reload kalkanla engellenirse
      // manuel "Yenile" butonu yine burada.)
      if (this.state.isChunk) {
        return (
          <div className="error-boundary error-boundary-updating" role="status" aria-live="polite">
            <div className="error-boundary-card">
              <div className="eb-spinner" aria-hidden="true" />
              <p>Güncelleniyor…</p>
              <p className="error-boundary-sub">Yeni sürüm yükleniyor. / Updating to the latest version.</p>
              <Button variant="default" onClick={this.handleReload}>
                Yenile / Reload
              </Button>
            </div>
          </div>
        )
      }
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary-card">
            <h1>Bir şeyler ters gitti</h1>
            <p>Beklenmeyen bir hata oluştu. Sayfayı yenilemeyi dene.</p>
            <p className="error-boundary-sub">Something went wrong. Please try reloading the page.</p>
            <Button variant="default" onClick={this.handleReload}>
              Yenile / Reload
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
